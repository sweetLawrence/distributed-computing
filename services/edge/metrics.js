const client = require('prom-client');
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const placement = new client.Counter({
  name: 'edge_placement_total',
  help: 'Placement decisions',
  labelNames: ['route'],     // handle-locally | forward-to-core
  registers: [register]
});

const upstreamFailures = new client.Counter({
  name: 'edge_upstream_failures_total',
  help: 'Failed forwards to core',
  registers: [register]
});

module.exports = { register, placement, upstreamFailures };
