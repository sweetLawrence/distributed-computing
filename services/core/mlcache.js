// Distributed shared state: risk scores cached in Redis, shared across all
// Core replicas (and would be across nodes in a multi-node Swarm).
// This is the "distributed shared memory" abstraction for M11.

const { redis } = require('./leader');

const TTL_SEC = parseInt(process.env.RISK_CACHE_TTL_SEC || '60', 10);
const HITS_KEY = 'ml:stats:hits';
const MISSES_KEY = 'ml:stats:misses';

function keyFor(patientId) {
  return `risk:${patientId}`;
}

async function get(patientId) {
  try {
    const raw = await redis.get(keyFor(patientId));
    if (raw) {
      await redis.incr(HITS_KEY);
      return { hit: true, risk_probability: parseFloat(raw) };
    }
    await redis.incr(MISSES_KEY);
    return { hit: false };
  } catch (e) {
    return { hit: false, error: e.message };
  }
}

async function set(patientId, riskProb) {
  try {
    await redis.set(keyFor(patientId), String(riskProb), 'EX', TTL_SEC);
  } catch (e) {
    // best-effort; no throw
  }
}

async function stats() {
  try {
    const [h, m] = await Promise.all([redis.get(HITS_KEY), redis.get(MISSES_KEY)]);
    return { hits: parseInt(h || '0', 10), misses: parseInt(m || '0', 10) };
  } catch {
    return { hits: 0, misses: 0 };
  }
}

module.exports = { get, set, stats, TTL_SEC };
