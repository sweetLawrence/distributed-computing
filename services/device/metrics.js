const client = require('prom-client');
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requests = new client.Counter({
  name: 'device_requests_total',
  help: 'Total device->edge requests',
  labelNames: ['status'],
  registers: [register]
});

const duration = new client.Histogram({
  name: 'device_request_duration_ms',
  help: 'Round-trip time of a device ingest request',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
  registers: [register]
});

module.exports = { register, requests, duration };
