// M10: Core side of the naming subsystem.
//  - registers this replica in Consul with a health check and a role tag
//  - publishes the leader's location in the Consul KV hierarchy (LDAP-style)
//  - answers "who has core?" broadcasts on Redis pub/sub
const axios = require('axios')
const os = require('os')
const Redis = require('ioredis')

const CONSUL = process.env.CONSUL_URL || 'http://consul:8500'
const ADVERTISE_PREFIX = process.env.ADVERTISE_PREFIX || '10.0.1.'
const KV_ROOT = 'theme5/services/core'
const http = axios.create({ baseURL: CONSUL, timeout: 3000 })

function myIP () {
  const all = []
  for (const arr of Object.values(os.networkInterfaces())) for (const a of arr || []) if (a.family === 'IPv4' && !a.internal) all.push(a.address)
  return all.find(a => a.startsWith(ADVERTISE_PREFIX)) || all.find(a => !a.startsWith('10.0.0.') && !a.startsWith('172.')) || all[0]
}

module.exports = function startNaming ({ replicaId, port, isLeader, publisher, log }) {
  const ip = myIP()
  let lastRole = null

  async function register (role) {
    await http.put('/v1/agent/service/register', {
      ID: replicaId, Name: 'core', Address: ip, Port: Number(port), Tags: [replicaId, role],
      Meta: { replica: replicaId, role },
      Check: { HTTP: `http://${ip}:${port}/health`, Interval: '5s', Timeout: '2s', DeregisterCriticalServiceAfter: '1m' }
    })
  }

  // keep registration and the KV leader entry in step with the Redis lease
  setInterval(async () => {
    const role = isLeader() ? 'leader' : 'standby'
    try {
      if (role !== lastRole) { await register(role); log(`naming: registered as core (${role}) at ${ip}:${port}`); lastRole = role }
      if (role === 'leader') {
        await http.put(`/v1/kv/${KV_ROOT}/leader`, `${ip}:${port}`)
        await http.put(`/v1/kv/${KV_ROOT}/leader-id`, replicaId)
      }
    } catch { lastRole = null /* Consul not reachable yet, retry next tick */ }
  }, 3000)

  // broadcast responder
  const sub = new Redis({ host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT || '6379', 10) })
  sub.subscribe('naming:whohas').catch(() => {})
  sub.on('message', (_ch, msg) => {
    try {
      const q = JSON.parse(msg)
      if (q.name === 'core' || q.name === replicaId) {
        publisher.publish(q.replyTo, JSON.stringify({ reqId: q.reqId, id: replicaId, addr: `${ip}:${port}`, leader: isLeader() }))
      }
    } catch {}
  })

  return {
    ip,
    deregister: async () => { try { await http.put(`/v1/agent/service/deregister/${encodeURIComponent(replicaId)}`) } catch {} }
  }
}
