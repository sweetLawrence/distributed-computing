const express = require('express');
const { execFile } = require('child_process');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 7000;
const STACK = 'theme5';
const STACK_FILE = '/stack/docker-stack.yml';

// Whitelist of services this admin can act on
const ALLOWED = new Set([
  'theme5_device','theme5_edge','theme5_core-1','theme5_core-2',
  'theme5_core-db','theme5_cloud-db','theme5_core-ml','theme5_cloud',
  'theme5_redis','theme5_nginx-edge','theme5_grafana','theme5_prometheus',
  'theme5_cadvisor','theme5_proxy','theme5_admin'
]);

function run(cmd, args = [], timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
  });
}

function guardService(req, res, next) {
  const name = req.params.name;
  if (!ALLOWED.has(name)) {
    return res.status(400).json({ ok: false, message: `Service not whitelisted: ${name}` });
  }
  next();
}

app.get('/health', (_req, res) => res.json({ service: 'admin', status: 'ok' }));

app.get('/nodes', async (_req, res) => {
  try {
    const out = await run('docker', ['node', 'ls', '--format', '{{json .}}']);
    const raw = out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const nodes = await Promise.all(raw.map(async (n) => {
      const inspect = await run('docker', ['node', 'inspect', n.Hostname]);
      const data = JSON.parse(inspect)[0];
      return {
        id: n.ID,
        hostname: n.Hostname,
        status: n.Status,
        availability: n.Availability,
        managerStatus: n.ManagerStatus || undefined,
        engineVersion: n.EngineVersion,
        role: (data.Spec.Role || 'worker').toLowerCase(),
        labels: data.Spec.Labels || {}
      };
    }));
    res.json({ nodes });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/services', async (_req, res) => {
  try {
    const out = await run('docker', ['stack', 'services', STACK]);
    const lines = out.trim().split('\n').slice(1);
    const services = lines.map((line) => {
      const parts = line.trim().split(/\s{2,}/);
      return {
        id: parts[0],
        name: parts[1],
        mode: parts[2],
        replicas: parts[3],
        image: parts[4],
        ports: parts[5] || ''
      };
    });
    res.json({ services });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/service/:name/ps', guardService, async (req, res) => {
  try {
    const out = await run('docker', ['service', 'ps', req.params.name, '--format', '{{json .}}']);
    const tasks = out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.get('/service/:name/logs', guardService, async (req, res) => {
  const lines = Math.min(parseInt(req.query.lines || '100', 10), 500);
  try {
    const out = await run('docker', ['service', 'logs', req.params.name, '--tail', String(lines), '--no-task-ids'], 15000);
    res.json({ logs: out });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/service/:name/restart', guardService, async (req, res) => {
  try {
    await run('docker', ['service', 'update', '--force', req.params.name], 60000);
    res.json({ ok: true, message: `Restart issued for ${req.params.name}` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/service/:name/scale/:n', guardService, async (req, res) => {
  const n = parseInt(req.params.n, 10);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    return res.status(400).json({ ok: false, message: 'Replicas must be 0–10' });
  }
  try {
    await run('docker', ['service', 'scale', `${req.params.name}=${n}`], 60000);
    res.json({ ok: true, message: `Scaled ${req.params.name} to ${n}` });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/stack/redeploy', async (_req, res) => {
  try {
    await run('docker', ['stack', 'deploy', '-c', STACK_FILE, STACK], 120000);
    res.json({ ok: true, message: 'Stack redeployed' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/stack/rm', async (_req, res) => {
  try {
    await run('docker', ['stack', 'rm', STACK], 60000);
    res.json({ ok: true, message: 'Stack removed' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.listen(PORT, () => console.log(`[admin] listening on ${PORT}`));
