import os
import time
import numpy as np
from fastapi import FastAPI, Response
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import joblib

MODEL_PATH = os.environ.get("MODEL_PATH", "/app/model.joblib")
CSV_PATH = os.environ.get("CSV_PATH", "/data/smartwear_health_monitoring_dataset.csv")

app = FastAPI()
model = None
FEATURES = ["age", "bmi", "heart_rate", "systolic_bp", "diastolic_bp", "respiratory_rate"]

# --- Prometheus metrics ---
PREDICT_REQUESTS = Counter(
    "ml_predict_requests_total",
    "Total /predict requests",
    ["status"]
)
PREDICT_DURATION = Histogram(
    "ml_predict_duration_ms",
    "Duration of /predict in ms",
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000]
)

class PredictIn(BaseModel):
    age: float | None = None
    bmi: float | None = None
    heart_rate: float | None = None
    systolic_bp: float | None = None
    diastolic_bp: float | None = None
    respiratory_rate: float | None = None

def train_or_load():
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"[core-ml] loaded model from {MODEL_PATH}")
        return
    if not os.path.exists(CSV_PATH):
        print(f"[core-ml] no CSV at {CSV_PATH}, cannot train. Falling back to formula.")
        return
    print(f"[core-ml] training IsolationForest from {CSV_PATH}")
    import csv
    X = []
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= 20000:
                break
            try:
                vec = [float(row[f]) for f in FEATURES]
                X.append(vec)
            except (KeyError, ValueError):
                continue
    X = np.array(X)
    print(f"[core-ml] training on {len(X)} rows")
    m = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    m.fit(X)
    model = m
    joblib.dump(model, MODEL_PATH)
    print(f"[core-ml] model saved to {MODEL_PATH}")

@app.on_event("startup")
def startup():
    train_or_load()

@app.get("/health")
def health():
    return {"service": "core-ml", "status": "ok", "model_loaded": model is not None}

@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/predict")
def predict(inp: PredictIn):
    t0 = time.time()
    feats = [getattr(inp, f) for f in FEATURES]
    if any(v is None for v in feats):
        PREDICT_REQUESTS.labels(status="error").inc()
        return {"risk_probability": 0.5, "model_version": "fallback-missing"}

    if model is not None:
        x = np.array([feats])
        raw = model.decision_function(x)[0]
        prob = float(np.clip(0.5 - raw, 0.0, 1.0))
        PREDICT_REQUESTS.labels(status="ok").inc()
        PREDICT_DURATION.observe((time.time() - t0) * 1000)
        return {"risk_probability": round(prob, 4), "model_version": "isoforest-v1"}
    else:
        hr, sbp, rr = inp.heart_rate, inp.systolic_bp, inp.respiratory_rate
        score = 0.0
        if hr and hr > 100: score += min((hr - 100) / 60, 1.0)
        if sbp and sbp > 140: score += min((sbp - 140) / 60, 1.0)
        if rr and rr > 20: score += min((rr - 20) / 15, 1.0)
        prob = min(score / 3, 1.0)
        PREDICT_REQUESTS.labels(status="ok").inc()
        PREDICT_DURATION.observe((time.time() - t0) * 1000)
        return {"risk_probability": round(prob, 4), "model_version": "formula-v1"}
