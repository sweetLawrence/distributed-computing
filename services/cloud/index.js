const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ service: 'cloud', status: 'ok' }));
const PORT = process.env.PORT || 6000;
app.listen(PORT, () => console.log(`[cloud] listening on ${PORT}`));
