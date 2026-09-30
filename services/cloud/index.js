const express = require('express');
const app = express();
const metrics = require('./metrics');
app.use(express.json());
app.get('/metrics', async (_req, res) => { res.set('Content-Type', metrics.register.contentType); res.end(await metrics.register.metrics()); });
app.get('/health', (_req, res) => res.json({ service: 'cloud', status: 'ok' }));
const PORT = process.env.PORT || 6000;
app.listen(PORT, () => console.log(`[cloud] listening on ${PORT}`));
