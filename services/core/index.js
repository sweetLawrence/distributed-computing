const express = require('express');
const axios = require('axios');
const leader = require('./leader');
const { init } = require('./db');
const { twoPhaseCommit } = require('./twopc');
const lockdemo = require('./lockdemo');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const REPLICA_ID = process.env.REPLICA_ID || 'core-?';
const PEER_URL = REPLICA_ID === 'core-1' ? 'http://core-2:4000' : 'http://core-1:4000';
const ML_URL = process.env.ML_URL || 'http://core-ml:5000';

let processed = 0, queueLength = 0, failureRisk = 0.1, simDelayMs = 0, lastLogAt = 0;
let txnCount = 0, commitCount = 0, abortCount = 0;

app.get('/health', (_req, res) => res.json({
  service: 'core', replica: REPLICA_ID, status: 'ok',
  processed, queueLength, failureRisk,
  isLeader: leader.isLeader(),
  lamport: leader.tick(),
  electionMessages: leader.getElectionMessages(),
  txnCount, commitCount, abortCount
}));

async function callML(row) {
  try {
    const r = await axios.post(`${ML_URL}/predict`, {
      age: row.age, bmi: row.bmi,
      heart_rate: row.heart_rate, systolic_bp: row.systolic_bp,
      diastolic_bp: row.diastolic_bp, respiratory_rate: row.respiratory_rate
    }, { timeout: 2000 });
    return r.data.risk_probability;
  } catch { return null; }
}

app.post('/process', async (req, res) => {
  const { row, t_sent, t_edge_in, lamport: incoming } = req.body;
  const t_core_in = Date.now();
  const lamportOut = incoming ? leader.observe(incoming) : leader.tick();
  queueLength++;
  try {
    if (simDelayMs > 0) await new Promise(r => setTimeout(r, simDelayMs));
    processed++;

    if (!leader.isLeader()) {
      try {
        const r = await axios.post(`${PEER_URL}/process`, { row, t_sent, t_edge_in, lamport: lamportOut }, { timeout: 5000 });
        queueLength--;
        return res.json({ ...r.data, forwarded_from: REPLICA_ID, lamport: lamportOut });
      } catch (e) {
        return res.status(502).json({ status: 'error', replica: REPLICA_ID, error: `peer forward failed: ${e.message}` });
      }
    }

    const riskProb = await callML(row);
    let txn = null;
    if (riskProb !== null) {
      txnCount++;
      txn = await twoPhaseCommit(row, riskProb);
      if (txn.outcome === 'COMMIT') commitCount++; else abortCount++;
    }

    const now = Date.now();
    if (processed <= 5 || now - lastLogAt > 500) {
      lastLogAt = now;
      console.log(`[core:${REPLICA_ID}] LEADER #${processed} pid=${row?.patient_id} risk=${riskProb} txn=${txn?.outcome} lam=${lamportOut}`);
    }

    res.json({
      status: 'received', replica: REPLICA_ID, isLeader: true, processed,
      queueLength, risk_probability: riskProb,
      txn: txn ? { outcome: txn.outcome, id: txn.txn_id, log: txn.log } : null,
      lamport: lamportOut, t_core_in, t_core_out: Date.now()
    });
  } finally {
    queueLength--;
  }
});

app.post('/sim/load', (req, res) => {
  const { delayMs = 0, failureRisk: fr } = req.body || {};
  simDelayMs = Math.max(0, parseInt(delayMs, 10) || 0);
  if (typeof fr === 'number') failureRisk = fr;
  res.json({ simDelayMs, failureRisk });
});

app.post('/sim/reset', (_req, res) => {
  simDelayMs = 0; failureRisk = 0.1;
  res.json({ simDelayMs, failureRisk });
});

// ---- M6: row-level locking demos ----
app.post('/lock/race', async (req, res) => {
  const { patient_id, mode = 'unsafe' } = req.body;
  const [a, b] = await Promise.all([
    lockdemo.incrementRisk(patient_id, mode),
    lockdemo.incrementRisk(patient_id, mode)
  ]);
  const [cur] = await require('./db').coreDb.query(
    `SELECT id, patient_id, risk_probability FROM core_records WHERE patient_id = :pid ORDER BY id LIMIT 1`,
    { replacements: { pid: patient_id } }
  );
  res.json({ mode, patient_id, results: [a, b], current: cur[0] || null });
});

app.post('/lock/deadlock', async (req, res) => {
  const { a, b } = req.body;
  const result = await lockdemo.deadlockDemo(a, b);
  res.json(result);
});

(async () => {
  await init();
  leader.start();
  app.listen(PORT, () => console.log(`[core:${REPLICA_ID}] listening on ${PORT}`));
})();
