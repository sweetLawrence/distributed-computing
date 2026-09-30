const client = require('prom-client');
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const batchRuns = new client.Counter({
  name: 'cloud_batch_runs_total',
  help: 'Cloud batch job runs',
  registers: [register]
});

module.exports = { register, batchRuns };
