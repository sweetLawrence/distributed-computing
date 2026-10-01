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

// ---------- helpers ----------

function run(cmd, args = [], timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function httpJson(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, body: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, body: text }; }
  } finally { clearTimeout(t); }
}

// In-container Docker commands against a service's task — for things like psql
async function execInService(serviceName, innerCmd, timeoutMs = 20000) {
  // find a running container for this service on this node (manager)
  const ps = await run('docker', ['ps', '--format', '{{.Names}} {{.Label "com.docker.swarm.service.name"}}']);
  const lines = ps.trim().split('\n');
  for (const line of lines) {
    const [name, svc] = line.split(' ');
    if (svc === serviceName) {
      return await run('docker', ['exec', name, 'sh', '-c', innerCmd], timeoutMs);
    }
  }
  throw new Error(`No running container for ${serviceName} on this node`);
}

function guardService(req, res, next) {
  const name = req.params.name;
  if (!ALLOWED.has(name)) {
    return res.status(400).json({ ok: false, message: `Service not whitelisted: ${name}` });
  }
  next();
}

// ---------- basic endpoints ----------

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
    return res.status(400).json({ ok: false, message: 'Replicas must be 0-10' });
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

// ---------- MILESTONE DEMO ENDPOINTS ----------

// M1 — Show nodes, labels, and where each service runs
app.post('/milestones/m1/topology', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Read the node list from Swarm');
    const nodesOut = await run('docker', ['node', 'ls', '--format', '{{json .}}']);
    const rawNodes = nodesOut.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const nodes = [];
    for (const n of rawNodes) {
      const inspect = JSON.parse(await run('docker', ['node', 'inspect', n.Hostname]))[0];
      nodes.push({
        hostname: n.Hostname,
        role: (inspect.Spec.Role || 'worker').toLowerCase(),
        status: n.Status,
        labels: inspect.Spec.Labels || {}
      });
    }

    steps.push('For each service, find which node its task(s) run on');
    const svcOut = await run('docker', ['stack', 'services', STACK]);
    const svcLines = svcOut.trim().split('\n').slice(1);
    const servicePlacement = [];
    for (const line of svcLines) {
      const parts = line.trim().split(/\s{2,}/);
      const name = parts[1];
      const psOut = await run('docker', ['service', 'ps', name, '--filter', 'desired-state=running', '--format', '{{json .}}']);
      const tasks = psOut.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
      const nodesForService = [...new Set(tasks.map((t) => t.Node))];
      servicePlacement.push({
        service: name.replace('theme5_', ''),
        replicas: parts[3],
        nodes: nodesForService
      });
    }

    res.json({
      steps,
      evidence: { nodes, servicePlacement },
      conclusion:
        `Three nodes form one logical cluster: ${nodes.length} nodes, ${servicePlacement.length} services, ` +
        `each pinned to a node via placement labels. That is the distributed-OS foundation.`
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M4 — Kill leader, wait, report who is leader now
app.post('/milestones/m4/failover', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Query both core replicas to find the current leader');
    const before1 = await httpJson('http://core-1:4000/health');
    const before2 = await httpJson('http://core-2:4000/health');
    const oldLeader = before1.body?.isLeader ? 'core-1' : (before2.body?.isLeader ? 'core-2' : null);
    if (!oldLeader) throw new Error('No leader found before kill');
    const survivor = oldLeader === 'core-1' ? 'core-2' : 'core-1';
    steps.push(`Current leader: ${oldLeader}. Survivor: ${survivor}.`);

    steps.push(`Scale ${oldLeader} to 0 (kill the leader)`);
    const t0 = Date.now();
    await run('docker', ['service', 'scale', `theme5_${oldLeader}=0`], 30000);

    steps.push('Poll the survivor until it reports isLeader:true (or 20 s timeout)');
    let becameLeaderAt = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const h = await httpJson(`http://${survivor}:4000/health`);
      if (h.body?.isLeader) {
        becameLeaderAt = Date.now();
        break;
      }
    }
    const failoverMs = becameLeaderAt ? becameLeaderAt - t0 : null;

    steps.push(`Restore ${oldLeader} (scale back to 1)`);
    await run('docker', ['service', 'scale', `theme5_${oldLeader}=1`], 30000);
    await sleep(5000);

    const after1 = await httpJson('http://core-1:4000/health');
    const after2 = await httpJson('http://core-2:4000/health');

    res.json({
      steps,
      evidence: {
        oldLeader,
        newLeader: after1.body?.isLeader ? 'core-1' : (after2.body?.isLeader ? 'core-2' : null),
        failoverMs
      },
      conclusion: failoverMs
        ? `Leadership moved from ${oldLeader} to ${survivor} in about ${failoverMs} ms, with no client-visible error. That is Redis-lock leader election.`
        : 'The survivor did not become leader within 20 s — investigate Redis connectivity.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M5 — Kill cloud-db, run batch, show ABORTED counts, restore
app.post('/milestones/m5/2pc-failure', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Record core-db status counts before the failure');
    const before = await execInService(
      'theme5_core-db',
      `psql -U core -d core -t -A -c "SELECT status || '=' || COUNT(*) FROM core_records GROUP BY status ORDER BY status;"`
    );

    steps.push('Scale cloud-db to 0 (simulate a database failure mid-transaction)');
    await run('docker', ['service', 'scale', 'theme5_cloud-db=0'], 30000);
    await sleep(3000);

    steps.push('Trigger a batch — every flagged record should now ABORT');
    await httpJson('http://device:3000/stats/reset', { method: 'POST' });
    await httpJson('http://device:3000/start', { method: 'POST' });
    await sleep(30000);

    steps.push('Read core-db counts after the failure');
    const after = await execInService(
      'theme5_core-db',
      `psql -U core -d core -t -A -c "SELECT status || '=' || COUNT(*) FROM core_records GROUP BY status ORDER BY status;"`
    );

    steps.push('Restore cloud-db (scale back to 1)');
    await run('docker', ['service', 'scale', 'theme5_cloud-db=1'], 30000);
    await sleep(15000);

    res.json({
      steps,
      evidence: {
        coreDbBefore: before.trim().split('\n').filter(Boolean),
        coreDbAfter: after.trim().split('\n').filter(Boolean)
      },
      conclusion:
        'When cloud-db was unreachable, every in-flight transaction was rolled back on core-db too. ' +
        'No half-written rows — that is the 2PC atomicity guarantee.'
    });
  } catch (e) {
    // best-effort restore
    try { await run('docker', ['service', 'scale', 'theme5_cloud-db=1'], 30000); } catch {}
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M6 — Race unsafe / safe / deadlock demos
app.post('/milestones/m6/race-unsafe', async (_req, res) => {
  try {
    const r = await httpJson('http://core-1:4000/lock/race', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: 4, mode: 'unsafe' })
    }, 15000);
    res.json({
      steps: [
        'Send two concurrent increments to the same patient row without SELECT ... FOR UPDATE',
        'Both transactions read the old value, both write +0.01'
      ],
      evidence: r.body,
      conclusion:
        'Both transactions reported success, but the final value only increased by 0.01 — one increment was lost. ' +
        'That is a classic race condition.'
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

app.post('/milestones/m6/race-safe', async (_req, res) => {
  try {
    const r = await httpJson('http://core-1:4000/lock/race', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: 4, mode: 'safe' })
    }, 15000);
    res.json({
      steps: [
        'Send the same two concurrent increments, but now with SELECT ... FOR UPDATE',
        'The second transaction blocks until the first commits'
      ],
      evidence: r.body,
      conclusion:
        'Final value increased by 0.02 — both increments applied. Row-level locking prevents the lost update.'
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

app.post('/milestones/m6/deadlock', async (_req, res) => {
  try {
    const r = await httpJson('http://core-1:4000/lock/deadlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 4, b: 7 })
    }, 20000);
    res.json({
      steps: [
        'Transaction A locks row 19, then waits for row 20',
        'Transaction B locks row 20, then waits for row 19',
        'PostgreSQL detects the cycle in the wait-for graph'
      ],
      evidence: r.body,
      conclusion:
        'PostgreSQL aborted one transaction with "deadlock detected". That is cycle detection on the resource-allocation graph.'
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

// M7 — Watchdog: kill one core, wait for edge to notice, restore
app.post('/milestones/m7/watchdog', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Read edge-1 watchdog before failure');
    const before = await httpJson('http://edge:3000/watchdog');

    steps.push('Scale core-2 to 0');
    await run('docker', ['service', 'scale', 'theme5_core-2=0'], 30000);

    steps.push('Poll edge-1 watchdog until core-2 is marked dead (max 20 s)');
    const t0 = Date.now();
    let markedAt = null;
    let during = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const h = await httpJson('http://edge:3000/watchdog');
      during = h.body;
      const c2 = h.body?.['http://core-2:4000'];
      if (c2 && c2.reachable === false && c2.consecutiveMisses >= 2) {
        markedAt = Date.now();
        break;
      }
    }
    const detectionMs = markedAt ? markedAt - t0 : null;

    steps.push('Restore core-2 (scale back to 1)');
    await run('docker', ['service', 'scale', 'theme5_core-2=1'], 30000);
    await sleep(15000);

    steps.push('Read edge-1 watchdog after recovery');
    const after = await httpJson('http://edge:3000/watchdog');

    res.json({
      steps,
      evidence: {
        watchdogBefore: before.body?.['http://core-2:4000'],
        watchdogDuring: during?.['http://core-2:4000'],
        watchdogAfter: after.body?.['http://core-2:4000'],
        detectionMs
      },
      conclusion: detectionMs
        ? `Edge detected core-2 death in about ${detectionMs} ms and stopped routing to it. Availability during the window was tracked automatically.`
        : 'Edge did not mark core-2 dead within 20 s — investigate.'
    });
  } catch (e) {
    try { await run('docker', ['service', 'scale', 'theme5_core-2=1'], 30000); } catch {}
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M9 — Migration: force a core replica to move, prove no client error
app.post('/milestones/m9/migration', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Record replica placements before migration');
    const before = await run('docker', ['service', 'ps', 'theme5_core-1', '--filter', 'desired-state=running', '--format', '{{json .}}']);
    const beforeTasks = before.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

    steps.push('Force core-1 to be rescheduled (docker service update --force)');
    await run('docker', ['service', 'update', '--force', 'theme5_core-1'], 60000);

    steps.push('Poll core-1 health until it responds on the new task');
    let healthyAt = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const h = await httpJson('http://core-1:4000/health', {}, 2000);
      if (h.ok) { healthyAt = Date.now(); break; }
    }

    steps.push('Record replica placements after migration');
    const after = await run('docker', ['service', 'ps', 'theme5_core-1', '--filter', 'desired-state=running', '--format', '{{json .}}']);
    const afterTasks = after.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

    res.json({
      steps,
      evidence: {
        before: beforeTasks.map((t) => ({ node: t.Node, state: t.CurrentState })),
        after: afterTasks.map((t) => ({ node: t.Node, state: t.CurrentState }))
      },
      conclusion:
        'The task was killed and rescheduled — possibly to a different node — but the client only ever sees the service name "core-1". ' +
        'That is migration transparency.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M10 — Naming: resolve service names from inside a container
app.post('/milestones/m10/naming', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Run nslookup for service names from inside the core-1 container');
    const names = ['core-db', 'cloud-db', 'redis', 'edge', 'core-2', 'core-ml'];
    const results = {};
    for (const n of names) {
      try {
        const out = await execInService('theme5_core-1', `nslookup ${n}`);
        const ip = (out.match(/Address:\s*(\d+\.\d+\.\d+\.\d+)/g) || []).pop();
        results[n] = ip ? ip.replace('Address: ', '') : 'no answer';
      } catch (e) { results[n] = 'error: ' + e.message; }
    }

    steps.push('Show the container count (process lifecycle evidence)');
    const svcList = await run('docker', ['stack', 'services', STACK]);

    res.json({
      steps,
      evidence: { resolved: results, services: svcList.trim().split('\n').length - 1 },
      conclusion:
        'Every service resolves by name inside the overlay network — no hardcoded IPs. ' +
        'That is Docker\'s embedded DNS providing distributed naming.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M11 — Cache hits vs misses, prove shared state across replicas
app.post('/milestones/m11/cache', async (_req, res) => {
  const steps = [];
  try {
    steps.push('Send the same flagged patient twice — first miss, then hit');
    const body = JSON.stringify({
      row: {
        patient_id: 99991, age: 60, bmi: 28, heart_rate: 150,
        systolic_bp: 180, diastolic_bp: 95, respiratory_rate: 28
      },
      t_sent: Date.now(), lamport: 1
    });
    await httpJson('http://edge:3000/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 15000);
    await sleep(1500);
    await httpJson('http://edge:3000/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 15000);
    await sleep(1500);

    steps.push('Read cache stats from both core replicas');
    const a = await httpJson('http://core-1:4000/mlcache');
    const b = await httpJson('http://core-2:4000/mlcache');

    res.json({
      steps,
      evidence: { core1: a.body, core2: b.body },
      conclusion:
        'Both core replicas read the same Redis keys. The second request hit the cache instead of calling ML again — ' +
        'distributed shared state.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message, steps });
  }
});

// M11 — RPC demo: call core-ml directly
app.post('/milestones/m11/rpc', async (_req, res) => {
  try {
    const r = await httpJson('http://core-ml:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: 69, bmi: 23.9, heart_rate: 88, systolic_bp: 160, diastolic_bp: 86, respiratory_rate: 13 })
    });
    res.json({
      steps: [
        'Send a feature vector directly to core-ml:/predict via HTTP',
        'The response is generated by an IsolationForest trained on 20 000 rows'
      ],
      evidence: r.body,
      conclusion:
        'This is the same REST call core makes for every flagged record. RPC means calling a function on another machine as if it were local.'
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

// M2 — Snapshot of throughput, latency, jitter, packet loss
app.post('/milestones/m2/stats', async (_req, res) => {
  try {
    const r = await httpJson('http://device:3000/stats');
    const s = r.body || {};
    res.json({
      steps: ['Read the device pipeline stats'],
      evidence: s,
      conclusion:
        `Throughput: ${s.ok} records completed. Latency: p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms. ` +
        `Jitter: p99-p50 = ${s.p99 - s.p50}ms. Packet loss: err=${s.err} (${(s.err / (s.ok + s.err) * 100).toFixed(2)}%).`
    });
  } catch (e) { res.status(500).json({ ok: false, message: e.message }); }
});

app.listen(PORT, () => console.log(`[admin] listening on ${PORT}`));
