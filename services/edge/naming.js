// M10: naming subsystem.  Name -> Name Resolution -> Resource Location
// Methods: static map, Docker DNS, Consul catalog (name server), Consul DNS,
// Consul KV (LDAP-style hierarchy), Redis broadcast, and a prefix table on top.
const axios = require('axios')
const os = require('os')
const dns = require('dns')
const Redis = require('ioredis')
const { randomUUID } = require('crypto')

const CONSUL = process.env.CONSUL_URL || 'http://consul:8500'
const ADVERTISE_PREFIX = process.env.ADVERTISE_PREFIX || '10.0.1.'
const REDIS_HOST = process.env.REDIS_HOST || 'redis'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10)
const BROADCAST_WINDOW_MS = parseInt(process.env.BROADCAST_WINDOW_MS || '150', 10)
const KV_ROOT = 'theme5/services'

const http = axios.create({ baseURL: CONSUL, timeout: 3000 })
// writes (registering many names) are slower than reads, so seeding gets a longer timeout and retries
const seedHttp = axios.create({ baseURL: CONSUL, timeout: 30000 })
async function retry (fn, tries = 3) { for (let i = 0; ; i++) { try { return await fn() } catch (e) { if (i >= tries - 1) throw e; await sleep(500) } } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ---------- my own address on the overlay network ----------
function myIP () {
  const all = []
  for (const arr of Object.values(os.networkInterfaces())) {
    for (const a of arr || []) if (a.family === 'IPv4' && !a.internal) all.push(a.address)
  }
  return all.find(a => a.startsWith(ADVERTISE_PREFIX)) ||
         all.find(a => !a.startsWith('10.0.0.') && !a.startsWith('172.')) || all[0]
}

// ---------- 1. static map (name -> fixed list of locations) ----------
const STATIC = new Map()
function loadStatic () {
  let m = {}
  try { m = JSON.parse(process.env.STATIC_MAP || '{}') } catch {}
  if (!Object.keys(m).length) {
    const strip = u => (u || '').replace(/^https?:\/\//, '')
    m = {
      core: [strip(process.env.CORE_1_URL || 'core-1:4000'), strip(process.env.CORE_2_URL || 'core-2:4000')],
      ml: ['core-ml:5000'],
      edge: ['edge:3000']
    }
  }
  for (const [k, v] of Object.entries(m)) STATIC.set(k, v)
}
loadStatic()

// ---------- 2. Docker (Swarm) embedded DNS ----------
const DNS_NAMES = { core: ['core-1', 'core-2'], ml: ['core-ml'], edge: ['edge'] }
async function viaDNS (name) {
  const hosts = DNS_NAMES[name] || [name]
  const out = []
  for (const h of hosts) {
    try { const r = await dns.promises.lookup(h); out.push(r.address) } catch {}
  }
  if (!out.length) throw new Error(`dns: ${name} not found`)
  return out
}

// ---------- 3. Consul catalog (name server with health checks) ----------
async function viaConsul (name) {
  const { data } = await http.get(`/v1/health/service/${encodeURIComponent(name)}`, { params: { passing: true } })
  const out = data.map(e => `${e.Service.Address}:${e.Service.Port}`)
  if (!out.length) throw new Error(`consul: no healthy ${name}`)
  return out
}

// ---------- 4. Consul DNS (DNS-style name server on port 8600) ----------
let consulResolver = null
async function viaConsulDNS (name) {
  if (!consulResolver) {
    const { address } = await dns.promises.lookup(new URL(CONSUL).hostname)
    consulResolver = new dns.promises.Resolver({ timeout: 1500, tries: 1 })
    consulResolver.setServers([`${address}:8600`])
  }
  const out = await consulResolver.resolve4(`${name}.service.consul`)
  if (!out.length) throw new Error(`consul-dns: ${name} not found`)
  return out
}

// ---------- 5. Consul KV hierarchy (LDAP-style path lookup) ----------
async function viaKV (name) {
  const path = name.includes('/') ? name : `${name}/leader`
  const { data } = await http.get(`/v1/kv/${KV_ROOT}/${path}`, { params: { raw: true }, responseType: 'text' })
  if (!data) throw new Error(`kv: ${path} empty`)
  return [String(data)]
}

// ---------- 6. broadcast: "who has <name>?" over Redis pub/sub ----------
let pub = null; let sub = null
const pending = new Map()
const REPLY = `naming:reply:${randomUUID()}`
async function ensureBroadcast () {
  if (pub) return
  pub = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: false })
  sub = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: false })
  await sub.subscribe(REPLY)
  sub.on('message', (_ch, msg) => {
    try { const m = JSON.parse(msg); const p = pending.get(m.reqId); if (p) p.push(m) } catch {}
  })
}
async function viaBroadcast (name) {
  await ensureBroadcast()
  const reqId = randomUUID()
  pending.set(reqId, [])
  await pub.publish('naming:whohas', JSON.stringify({ name, reqId, replyTo: REPLY }))
  await sleep(BROADCAST_WINDOW_MS)
  const replies = pending.get(reqId) || []
  pending.delete(reqId)
  if (!replies.length) throw new Error(`broadcast: nobody answered for ${name}`)
  return replies.map(r => `${r.addr}${r.leader ? ' (leader)' : ''}`)
}

// ---------- 7. prefix table (longest prefix wins) ----------
let PREFIX_TABLE = { '/core/leader': 'kv:core', '/core': 'consul:core', '/ml': 'dns:ml', '/edge': 'consul:edge' }
try { if (process.env.PREFIX_TABLE) PREFIX_TABLE = JSON.parse(process.env.PREFIX_TABLE) } catch {}
async function viaPrefix (name) {
  const match = Object.keys(PREFIX_TABLE).filter(p => name === p || name.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0]
  if (!match) throw new Error(`prefix: no entry for ${name}`)
  const [method, target] = PREFIX_TABLE[match].split(':')
  return resolve(target, method)
}

const METHODS = { static: async n => { const v = STATIC.get(n); if (!v) throw new Error(`static: ${n} not in map`); return v },
  dns: viaDNS, consul: viaConsul, 'consul-dns': viaConsulDNS, kv: viaKV, broadcast: viaBroadcast, prefix: viaPrefix }

async function resolve (name, method = 'consul') {
  const fn = METHODS[method]
  if (!fn) throw new Error(`unknown method ${method}`)
  return fn(name)
}

// ---------- benchmark (latency measured inside Edge, no network to the client) ----------
let seededK = 0
async function bench (method, name, n) {
  const lat = []; let errors = 0
  for (let i = 0; i < n; i++) {
    const target = name === 'dummy' ? `svc-${Math.floor(Math.random() * Math.max(seededK, 1))}` : name
    const t0 = process.hrtime.bigint()
    try { await resolve(target, method) } catch { errors++ }
    lat.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  lat.sort((a, b) => a - b)
  const pick = p => +lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(4)
  return { method, name, n, errors, avgMs: +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(4),
    p50Ms: pick(0.5), p95Ms: pick(0.95), maxMs: +lat[lat.length - 1].toFixed(4) }
}

// ---------- seed K dummy names into static map, Consul catalog and KV ----------
async function clearSeed () {
  const ids = [...Array(seededK).keys()]
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(k => seedHttp.put(`/v1/agent/service/deregister/svc-${k}`).catch(() => {})))
  }
  await seedHttp.delete(`/v1/kv/${KV_ROOT}/svc-`, { params: { recurse: true } }).catch(() => {})
  for (const k of [...STATIC.keys()]) if (k.startsWith('svc-')) STATIC.delete(k)
  seededK = 0
}
async function seed (k) {
  await clearSeed()
  const ids = [...Array(k).keys()]
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(async j => {
      const addr = `10.9.${Math.floor(j / 250)}.${(j % 250) + 1}`
      STATIC.set(`svc-${j}`, [`${addr}:9000`])
      await retry(() => seedHttp.put('/v1/agent/service/register', { ID: `svc-${j}`, Name: `svc-${j}`, Address: addr, Port: 9000, Tags: ['dummy'] }))
      await retry(() => seedHttp.put(`/v1/kv/${KV_ROOT}/svc-${j}/leader`, `${addr}:9000`))
    }))
  }
  seededK = k
  return k
}

// ---------- register / deregister this process in Consul ----------
async function register ({ name, id, port, tags = [] }) {
  const ip = myIP()
  await http.put('/v1/agent/service/register', {
    ID: id, Name: name, Address: ip, Port: Number(port), Tags: tags,
    Check: { HTTP: `http://${ip}:${port}/health`, Interval: '5s', Timeout: '2s', DeregisterCriticalServiceAfter: '1m' }
  })
  return ip
}
async function registerWithRetry (opts, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try { const ip = await register(opts); console.log(`[naming] registered ${opts.id} as ${opts.name} at ${ip}:${opts.port}`); return ip } catch { await sleep(2000) }
  }
  console.log(`[naming] could not register ${opts.id} in Consul (continuing without it)`)
}
async function deregister (id) { try { await http.put(`/v1/agent/service/deregister/${encodeURIComponent(id)}`) } catch {} }

// discover healthy core URLs for routing (NAMING_MODE=consul)
async function discoverCores () {
  const locs = await viaConsul('core')
  return locs.map(l => `http://${l}`)
}

module.exports = { resolve, bench, seed, clearSeed, registerWithRetry, deregister, discoverCores, myIP,
  info: () => ({ methods: Object.keys(METHODS), prefixTable: PREFIX_TABLE, staticEntries: STATIC.size, seededK }) }
