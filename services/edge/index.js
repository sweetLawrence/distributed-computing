const express = require('express')
const axios = require('axios')
const lamport = require('./lamport')
const metrics = require('./metrics')
const buffer = require('./buffer')
const naming = require('./naming')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const REPLICA_ID = process.env.REPLICA_ID || 'edge-?'
const CORE_1_URL = process.env.CORE_1_URL || 'http://core-1:4000'
const CORE_2_URL = process.env.CORE_2_URL || 'http://core-2:4000'
const PLACEMENT_THRESHOLD = parseFloat(process.env.PLACEMENT_THRESHOLD || '0.005')
const CORE_HEARTBEAT_MS = parseInt(process.env.CORE_HEARTBEAT_MS || '3000', 10)
const FAIL_THRESHOLD = parseInt(process.env.FAIL_THRESHOLD || '2', 10)
const FORCE_FORWARD = process.env.FORCE_FORWARD === '1'
// M9: store-and-forward through Kafka when no Core can take a reading (1 = on)
const EDGE_BUFFER = process.env.EDGE_BUFFER === '1'
// M10: how Edge finds the Core replicas: static (env URLs) or consul (name server)
const NAMING_MODE = process.env.NAMING_MODE || 'static'

let CORES = [CORE_1_URL, CORE_2_URL]

// HEALTH state - what routing uses
const coreHealth = {}
// WATCHDOG state - what we log; independent of routing state
const wd = {}
function ensureCore (u) {
  if (coreHealth[u]) return
  coreHealth[u] = { reachable: false, latencyMs: 50, queueLength: 1, failureRisk: 0.1, lastSeen: 0 }
  wd[u] = { status: 'unknown', consecutiveMisses: 0, aliveSince: null, deadSince: null, upMs: 0, downMs: 0, transitions: [] }
}
CORES.forEach(ensureCore)

function setStatus (u, next) {
  const w = wd[u]
  const now = Date.now()
  if (w.status === next) return
  const from = w.status
  w.status = next
  if (next === 'dead') {
    w.deadSince = now
    if (w.aliveSince) w.upMs += now - w.aliveSince
    w.aliveSince = null
    w.transitions.push({ at: now, from, to: 'dead' })
    console.log(`[edge:${REPLICA_ID}] WATCHDOG: ${u} MARKED DEAD (was ${from})`)
  } else if (next === 'alive') {
    const downtime = w.deadSince ? now - w.deadSince : null
    w.aliveSince = now
    if (w.deadSince) w.downMs += now - w.deadSince
    w.deadSince = null
    w.transitions.push({ at: now, from, to: 'alive', downtimeMs: downtime })
    console.log(`[edge:${REPLICA_ID}] WATCHDOG: ${u} RECOVERED after ${downtime !== null ? (downtime / 1000).toFixed(1) + 's' : 'unknown'}`)
  }
}

function lightTask (row) {
  if (Number(row.heart_rate) > 120) return 'FLAG'
  if (Number(row.systolic_bp) > 160) return 'FLAG'
  if (Number(row.respiratory_rate) > 25) return 'FLAG'
  return 'NORMAL'
}
function placementScore (h) {
  return 0.4 * (1 / Math.max(h.latencyMs, 1)) + 0.4 * (1 / Math.max(h.queueLength, 1)) + 0.2 * (1 / Math.max(h.failureRisk, 0.01))
}
function pickBestCore () {
  const live = CORES.filter(u => coreHealth[u] && coreHealth[u].reachable)
  if (!live.length) return null
  return live.reduce((a, b) => (coreHealth[a].latencyMs <= coreHealth[b].latencyMs ? a : b))
}
function decide (row) {
  if (FORCE_FORWARD) return { route: 'forward-to-core', reason: 'baseline-forced', target: pickBestCore() || CORES[0] }
  if (lightTask(row) === 'NORMAL') return { route: 'handle-locally', reason: 'normal' }
  const best = pickBestCore()
  if (!best) return { route: 'handle-locally', reason: 'no-core-reachable' }
  const score = placementScore(coreHealth[best])
  if (score > PLACEMENT_THRESHOLD) return { route: 'forward-to-core', reason: 'flagged+score', score: +score.toFixed(4), target: best }
  return { route: 'handle-locally', reason: 'flagged+low-score', score: +score.toFixed(4) }
}

async function heartbeatOnce () {
  if (NAMING_MODE === 'consul') {
    try {
      const urls = await naming.discoverCores()
      if (urls.length) { urls.forEach(ensureCore); CORES = urls }
    } catch { /* keep the last known list; the watchdog will mark them dead */ }
  }
  for (const u of CORES) {
    ensureCore(u)
    const t0 = Date.now()
    try {
      const r = await axios.get(`${u}/health`, { timeout: 800 })
      wd[u].consecutiveMisses = 0
      setStatus(u, 'alive')
      Object.assign(coreHealth[u], { reachable: true, latencyMs: Date.now() - t0, queueLength: r.data.queueLength ?? 1, failureRisk: r.data.failureRisk ?? 0.1, lastSeen: Date.now() })
    } catch {
      wd[u].consecutiveMisses++
      if (wd[u].consecutiveMisses >= FAIL_THRESHOLD) setStatus(u, 'dead')
      coreHealth[u].reachable = false
      coreHealth[u].failureRisk = 1.0
    }
  }
}
setInterval(heartbeatOnce, CORE_HEARTBEAT_MS)
heartbeatOnce()

let localCount = 0; let forwardCount = 0; let upstreamFailures = 0
let bufferedCount = 0; let bufferFailures = 0; let bufferMsTotal = 0

app.get('/metrics', async (_req, res) => { res.set('Content-Type', metrics.register.contentType); res.end(await metrics.register.metrics()) })
app.get('/health', (_req, res) => {
  const total = localCount + forwardCount + upstreamFailures + bufferedCount
  res.json({
    service: 'edge', replica: REPLICA_ID, status: 'ok', namingMode: NAMING_MODE, edgeBuffer: EDGE_BUFFER,
    cores: CORES, localCount, forwardCount, upstreamFailures, bufferedCount, bufferFailures,
    bufferAvgMs: bufferedCount ? +(bufferMsTotal / bufferedCount).toFixed(2) : 0,
    packetLossPct: total ? +((upstreamFailures / total) * 100).toFixed(4) : 0
  })
})
app.get('/core-health', (_req, res) => res.json(coreHealth))
app.get('/watchdog', (_req, res) => {
  const now = Date.now(); const out = {}
  for (const u of CORES) {
    const w = wd[u]; if (!w) continue
    const total = w.upMs + w.downMs || 1
    out[u] = {
      status: w.status, reachable: coreHealth[u].reachable, consecutiveMisses: w.consecutiveMisses,
      currentStateMs: w.status === 'alive' && w.aliveSince ? now - w.aliveSince : w.status === 'dead' && w.deadSince ? now - w.deadSince : 0,
      availability: +(((w.upMs + (w.status === 'alive' && w.aliveSince ? now - w.aliveSince : 0)) / total) * 100).toFixed(2),
      transitions: w.transitions.slice(-5)
    }
  }
  res.json(out)
})

// M9: hand a reading to Kafka instead of failing (store-and-forward)
async function bufferReading (res, payload, why) {
  try {
    const ms = await buffer.publish({ ...payload, buffered_at: Date.now(), buffered_by: REPLICA_ID, why })
    bufferedCount++; bufferMsTotal += ms
    return res.status(202).json({ status: 'buffered', replica: REPLICA_ID, why, topic: buffer.TOPIC, kafkaMs: ms,
      lamport: payload.lamport, t_sent: payload.t_sent, t_edge_in: payload.t_edge_in, t_edge_out: Date.now() })
  } catch (e) {
    bufferFailures++; upstreamFailures++
    metrics.upstreamFailures.inc()
    return res.status(503).json({ status: 'error', replica: REPLICA_ID, error: `no core and buffer failed: ${e.message}` })
  }
}

app.post('/ingest', async (req, res) => {
  const { row, t_sent, lamport: incomingLamport } = req.body
  const t_edge_in = Date.now()
  const lamportOut = incomingLamport ? lamport.observe(incomingLamport) : lamport.tick()
  const decision = decide(row)
  const payload = { row, t_sent, t_edge_in, lamport: lamportOut }

  if (decision.route === 'handle-locally') {
    if (EDGE_BUFFER && decision.reason === 'no-core-reachable') return bufferReading(res, payload, 'no-core-reachable')
    localCount++
    metrics.placement.inc({ route: 'handle-locally' })
    return res.json({ status: 'handled-locally', replica: REPLICA_ID, decision, light_task: lightTask(row), lamport: lamportOut,
      t_sent, t_edge_in, t_edge_out: Date.now(), local_count: localCount, forward_count: forwardCount })
  }

  const target = decision.target
  try {
    const resp = await axios.post(`${target}/process`, payload, { timeout: 5000 })
    forwardCount++
    metrics.placement.inc({ route: 'forward-to-core' })
    res.json({ status: 'forwarded', replica: REPLICA_ID, decision, routed_to: target, lamport: lamportOut, t_sent, t_edge_in,
      t_edge_out: Date.now(), core_response: resp.data, local_count: localCount, forward_count: forwardCount })
  } catch (e) {
    if (EDGE_BUFFER) return bufferReading(res, payload, `forward-failed: ${e.message}`)
    upstreamFailures++
    metrics.upstreamFailures.inc()
    res.status(502).json({ status: 'error', replica: REPLICA_ID, routed_to: target, error: e.message })
  }
})

// ---------- M10 naming endpoints ----------
const ms = t0 => +(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(4)
app.get('/naming/info', (_req, res) => res.json({ replica: REPLICA_ID, namingMode: NAMING_MODE, cores: CORES, ...naming.info() }))
app.get('/naming/resolve', async (req, res) => {
  const name = req.query.name || 'core'; const method = req.query.method || 'consul'
  const t0 = process.hrtime.bigint()
  try { const result = await naming.resolve(name, method); res.json({ replica: REPLICA_ID, name, method, result, latencyMs: ms(t0) }) } catch (e) { res.status(404).json({ replica: REPLICA_ID, name, method, error: e.message, latencyMs: ms(t0) }) }
})
app.get('/naming/bench', async (req, res) => {
  const n = Math.min(parseInt(req.query.n || '200', 10), 5000)
  try { res.json({ replica: REPLICA_ID, ...(await naming.bench(req.query.method || 'consul', req.query.name || 'core', n)) }) } catch (e) { res.status(500).json({ error: e.message }) }
})
// one request = seed K names everywhere, then benchmark every method that can hold K names
app.get('/naming/scalebench', async (req, res) => {
  const k = Math.min(parseInt(req.query.k || '10', 10), 2000); const n = Math.min(parseInt(req.query.n || '300', 10), 5000)
  try {
    const t0 = process.hrtime.bigint(); await naming.seed(k); const seedMs = ms(t0)
    const out = []
    for (const m of ['static', 'consul', 'consul-dns', 'kv']) out.push(await naming.bench(m, 'dummy', n))
    await naming.clearSeed()
    res.json({ replica: REPLICA_ID, k, n, seedMs, results: out })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// unique per container: with start-first updates the old and new copy share REPLICA_ID,
// and the old one deregistering on SIGTERM must not remove the new one
const CONSUL_ID = `${REPLICA_ID}-${require('os').hostname()}`

app.listen(PORT, () => {
  console.log(`[edge:${REPLICA_ID}] listening on ${PORT} | threshold=${PLACEMENT_THRESHOLD} | buffer=${EDGE_BUFFER} | naming=${NAMING_MODE}`)
  naming.registerWithRetry({ name: 'edge', id: CONSUL_ID, port: PORT, tags: ['edge', REPLICA_ID] })
})

process.on('SIGTERM', async () => {
  console.log(`[edge:${REPLICA_ID}] SIGTERM: deregistering and exiting`)
  await naming.deregister(CONSUL_ID); await buffer.close(); process.exit(0)
})
