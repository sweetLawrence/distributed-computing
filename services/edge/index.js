const express = require('express');
const axios = require('axios');
const lamport = require('./lamport');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const REPLICA_ID = process.env.REPLICA_ID || 'edge-?';
const CORE_1_URL = process.env.CORE_1_URL || 'http://core-1:4000';
const CORE_2_URL = process.env.CORE_2_URL || 'http://core-2:4000';
const PLACEMENT_THRESHOLD = parseFloat(process.env.PLACEMENT_THRESHOLD || '0.005');
const CORE_HEARTBEAT_MS = parseInt(process.env.CORE_HEARTBEAT_MS || '3000', 10);
const FAIL_THRESHOLD = parseInt(process.env.FAIL_THRESHOLD || '2', 10);

const CORES = [CORE_1_URL, CORE_2_URL];

// HEALTH state — what routing uses
const coreHealth = {};
// WATCHDOG state — what we log; independent of routing state
const wd = {};
for (const u of CORES) {
  coreHealth[u] = { reachable: false, latencyMs: 50, queueLength: 1, failureRisk: 0.1, lastSeen: 0 };
  wd[u] = {
    status: 'unknown',      // 'unknown' | 'alive' | 'dead'
    consecutiveMisses: 0,
    aliveSince: null,       // ms timestamp when we last entered 'alive'
    deadSince: null,        // ms timestamp when we last entered 'dead'
    upMs: 0,                // accumulated alive time (past intervals)
    downMs: 0,              // accumulated dead time
    transitions: []         // { at, from, to, downtimeMs? }
  };
}

function setStatus(u, next) {
  const w = wd[u];
  const now = Date.now();
  if (w.status === next) return;
  const from = w.status;
  w.status = next;
  if (next === 'dead') {
    w.deadSince = now;
    if (w.aliveSince) w.upMs += now - w.aliveSince;
    w.aliveSince = null;
    w.transitions.push({ at: now, from, to: 'dead' });
    console.log(`[edge:${REPLICA_ID}] WATCHDOG: ${u} MARKED DEAD (was ${from})`);
  } else if (next === 'alive') {
    const downtime = w.deadSince ? now - w.deadSince : null;
    w.aliveSince = now;
    if (w.deadSince) w.downMs += now - w.deadSince;
    w.deadSince = null;
    w.transitions.push({ at: now, from, to: 'alive', downtimeMs: downtime });
    console.log(`[edge:${REPLICA_ID}] WATCHDOG: ${u} RECOVERED after ${downtime !== null ? (downtime/1000).toFixed(1)+'s' : 'unknown'}`);
  }
}

function lightTask(row) {
  if (Number(row.heart_rate) > 120) return 'FLAG';
  if (Number(row.systolic_bp) > 160) return 'FLAG';
  if (Number(row.respiratory_rate) > 25) return 'FLAG';
  return 'NORMAL';
}
function placementScore(h) {
  return 0.4 * (1/Math.max(h.latencyMs,1)) + 0.4 * (1/Math.max(h.queueLength,1)) + 0.2 * (1/Math.max(h.failureRisk,0.01));
}
function pickBestCore() {
  const live = CORES.filter(u => coreHealth[u].reachable);
  if (!live.length) return null;
  return live.reduce((a, b) => coreHealth[a].latencyMs <= coreHealth[b].latencyMs ? a : b);
}
const FORCE_FORWARD = process.env.FORCE_FORWARD === "1";
function decide(row) {
  if (FORCE_FORWARD) return { route: "forward-to-core", reason: "baseline-forced", target: pickBestCore() || CORE_1_URL };
  if (lightTask(row) === 'NORMAL') return { route: 'handle-locally', reason: 'normal' };
  const best = pickBestCore();
  if (!best) return { route: 'handle-locally', reason: 'no-core-reachable' };
  const h = coreHealth[best];
  const score = placementScore(h);
  if (score > PLACEMENT_THRESHOLD) return { route: 'forward-to-core', reason: 'flagged+score', score: +score.toFixed(4), target: best };
  return { route: 'handle-locally', reason: 'flagged+low-score', score: +score.toFixed(4) };
}

async function heartbeatOnce() {
  for (const u of CORES) {
    const t0 = Date.now();
    try {
      const r = await axios.get(`${u}/health`, { timeout: 800 });
      const lat = Date.now() - t0;
      wd[u].consecutiveMisses = 0;
      setStatus(u, 'alive');
      coreHealth[u].reachable = true;
      coreHealth[u].latencyMs = lat;
      coreHealth[u].queueLength = r.data.queueLength ?? 1;
      coreHealth[u].failureRisk = r.data.failureRisk ?? 0.1;
      coreHealth[u].lastSeen = Date.now();
    } catch {
      wd[u].consecutiveMisses++;
      if (wd[u].consecutiveMisses >= FAIL_THRESHOLD) setStatus(u, 'dead');
      coreHealth[u].reachable = false;
      coreHealth[u].failureRisk = 1.0;
    }
  }
}
setInterval(heartbeatOnce, CORE_HEARTBEAT_MS);
heartbeatOnce();

app.get('/health', (_req, res) => res.json({ service: 'edge', replica: REPLICA_ID, status: 'ok', localCount, forwardCount, upstreamFailures, packetLossPct: (localCount + forwardCount + upstreamFailures) ? +((upstreamFailures / (localCount + forwardCount + upstreamFailures)) * 100).toFixed(3) : 0 }));
app.get('/core-health', (_req, res) => res.json(coreHealth));
app.get('/watchdog', (_req, res) => {
  const now = Date.now();
  const out = {};
  for (const u of CORES) {
    const w = wd[u];
    const total = w.upMs + w.downMs || 1;
    out[u] = {
      status: w.status,
      reachable: coreHealth[u].reachable,
      consecutiveMisses: w.consecutiveMisses,
      currentStateMs: w.status === 'alive' && w.aliveSince ? now - w.aliveSince
                    : w.status === 'dead' && w.deadSince ? now - w.deadSince : 0,
      availability: +(((w.upMs + (w.status === 'alive' && w.aliveSince ? now - w.aliveSince : 0)) / total) * 100).toFixed(2),
      transitions: w.transitions.slice(-5)
    };
  }
  res.json(out);
});

let localCount = 0, forwardCount = 0, upstreamFailures = 0;
app.post('/ingest', async (req, res) => {
  const { row, t_sent, lamport: incomingLamport } = req.body;
  const t_edge_in = Date.now();
  const lamportOut = incomingLamport ? lamport.observe(incomingLamport) : lamport.tick();
  const decision = decide(row);
  if (decision.route === 'handle-locally') {
    localCount++;
    return res.json({ status: 'handled-locally', replica: REPLICA_ID, decision, light_task: lightTask(row), lamport: lamportOut, t_sent, t_edge_in, t_edge_out: Date.now(), local_count: localCount, forward_count: forwardCount });
  }
  forwardCount++;
  const target = decision.target;
  try {
    const resp = await axios.post(`${target}/process`, { row, t_sent, t_edge_in, lamport: lamportOut }, { timeout: 5000 });
    res.json({ status: 'forwarded', replica: REPLICA_ID, decision, routed_to: target, lamport: lamportOut, t_sent, t_edge_in, t_edge_out: Date.now(), core_response: resp.data, local_count: localCount, forward_count: forwardCount });
  } catch (e) {
    upstreamFailures++;
    res.status(502).json({ status: 'error', replica: REPLICA_ID, routed_to: target, error: e.message });
  }
});

app.listen(PORT, () => console.log(`[edge:${REPLICA_ID}] listening on ${PORT} | threshold=${PLACEMENT_THRESHOLD}`));
