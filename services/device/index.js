const express = require('express');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const metrics = require('./metrics');
const lamport = require('./lamport');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const EDGE_URL = process.env.EDGE_URL || 'http://edge-1:3000';
const CSV_PATH = process.env.CSV_PATH || '/data/smartwear_health_monitoring_dataset.csv';
const STREAM_INTERVAL_MS = parseInt(process.env.STREAM_INTERVAL_MS || '200', 10);
const MAX_ROWS = parseInt(process.env.MAX_ROWS || '1000', 10);

let streaming = false;
let stats = { sent: 0, ok: 0, err: 0, totalLatencyMs: 0, minLatencyMs: Infinity, maxLatencyMs: 0, latencies: [] };

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

app.get('/health', (_req, res) => res.json({ service: 'device', status: 'ok', streaming }));

app.get('/stats', (_req, res) => {
  const lat = stats.latencies;
  const avg = stats.ok ? stats.totalLatencyMs / stats.ok : 0;
  const sorted = [...lat].sort((a, b) => a - b);
  const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;
  res.json({
    sent: stats.sent, ok: stats.ok, err: stats.err,
    avgLatencyMs: +avg.toFixed(2),
    minLatencyMs: stats.minLatencyMs === Infinity ? 0 : stats.minLatencyMs,
    maxLatencyMs: stats.maxLatencyMs,
    p50, p95, p99
  });
});

app.post('/stats/reset', (_req, res) => {
  stats = { sent: 0, ok: 0, err: 0, totalLatencyMs: 0, minLatencyMs: Infinity, maxLatencyMs: 0, latencies: [] };
  res.json({ reset: true });
});

function parseRow(line, header) {
  const parts = line.split(',');
  if (parts.length !== header.length) return null;
  const row = {};
  header.forEach((h, i) => {
    const v = parts[i].trim();
    row[h] = isNaN(v) || v === '' ? v : Number(v);
  });
  return row;
}

async function streamCsv() {
  if (streaming) return;
  streaming = true;
  console.log(`[device] streaming ${CSV_PATH} -> ${EDGE_URL} (max ${MAX_ROWS} rows, interval ${STREAM_INTERVAL_MS}ms)`);

  const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header = null;
  let sent = 0;

  for await (const line of rl) {
    if (!header) { header = line.split(',').map(s => s.trim()); continue; }
    if (!line.trim()) continue;
    if (MAX_ROWS && sent >= MAX_ROWS) break;

    const row = parseRow(line, header);
    if (!row) continue;

    const t_sent = Date.now();
    const lam = lamport.tick();
    try {
      const resp = await axios.post(`${EDGE_URL}/ingest`, { row, t_sent, lamport: lam }, { timeout: 5000 });
      const rtt = Date.now() - t_sent;
      stats.sent++;
      stats.ok++;
      stats.totalLatencyMs += rtt;
      stats.minLatencyMs = Math.min(stats.minLatencyMs, rtt);
      stats.maxLatencyMs = Math.max(stats.maxLatencyMs, rtt);
      stats.latencies.push(rtt);
      metrics.requests.inc({ status: 'ok' });
      metrics.duration.observe(rtt);
      if (sent % 50 === 0 || sent < 5) {
        console.log(`[device] row ${sent} pid=${row.patient_id} -> ${resp.data.status} lam=${lam} rtt=${rtt}ms`);
      }
    } catch (e) {
      metrics.requests.inc({ status: 'err' });
      stats.sent++;
      stats.err++;
      console.log(`[device] ERR pid=${row.patient_id}: ${e.message}`);
    }
    sent++;
    if (STREAM_INTERVAL_MS > 0) await new Promise(r => setTimeout(r, STREAM_INTERVAL_MS));
  }

  streaming = false;
  console.log(`[device] done. sent=${stats.sent} ok=${stats.ok} err=${stats.err}`);
}

app.post('/start', (_req, res) => { streamCsv(); res.json({ started: true }); });

app.listen(PORT, () => {
  console.log(`[device] listening on ${PORT}`);
  setTimeout(streamCsv, 2000);
});
