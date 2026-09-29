#!/usr/bin/env bash
set -e

echo "== checking prerequisites =="
command -v docker >/dev/null || { echo "Docker not installed. See https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin missing"; exit 1; }

echo "== preparing env =="
[ -f .env ] || cp .env.example .env

echo "== checking dataset =="
if [ ! -f data/smartwear_health_monitoring_dataset.csv ]; then
  echo "WARNING: data/smartwear_health_monitoring_dataset.csv not found."
  echo "Place the CSV under data/ before starting the stack."
  echo "Required columns: patient_id,age,gender,bmi,smoking_status,"
  echo "  alcohol_consumption,heart_rate,systolic_bp,diastolic_bp,respiratory_rate"
  exit 2
fi

echo "== building & starting (compose) =="
docker compose up --build -d

echo "== waiting for health =="
sleep 15
for url in http://localhost:3000/health http://localhost:3001/health \
           http://localhost:4001/health http://localhost:5000/health; do
  printf "%s -> " "$url"
  curl -s "$url" || true
  echo
done

cat <<'TIP'

== ready ==
Stream rows:  curl -X POST http://localhost:3000/start
Read stats:   curl http://localhost:3000/stats

Swarm deploy: see README.md
TIP
