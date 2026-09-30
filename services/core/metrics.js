const client = require('prom-client');
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const txn = new client.Counter({
  name: 'core_txn_total',
  help: '2PC transactions',
  labelNames: ['outcome'],   // COMMIT | ABORT
  registers: [register]
});

const txnDuration = new client.Histogram({
  name: 'core_txn_duration_ms',
  help: 'Duration of a 2PC transaction',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
  registers: [register]
});

const mlCache = new client.Counter({
  name: 'core_ml_cache_total',
  help: 'ML cache hits and misses',
  labelNames: ['result'],    // hit | miss
  registers: [register]
});

const mlCall = new client.Counter({
  name: 'core_ml_call_total',
  help: 'ML inference calls',
  registers: [register]
});

module.exports = { register, txn, txnDuration, mlCache, mlCall };
