// M9: drain the store-and-forward buffer.
// Only the current leader consumes the Kafka topic; the consumer is started when this
// replica becomes leader and stopped when it loses leadership. Delivery is
// at-least-once: a reading is committed via 2PC, then its offset is committed.
const { Kafka, logLevel } = require('kafkajs')

const BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',')
const TOPIC = process.env.KAFKA_TOPIC || 'critical-readings'
const GROUP = process.env.KAFKA_GROUP || 'core-drain'
const sleep = ms => new Promise(r => setTimeout(r, ms))

module.exports = function startDrain ({ replicaId, isLeader, processRow, log }) {
  const kafka = new Kafka({ clientId: `${replicaId}-drain`, brokers: BROKERS, connectionTimeout: 3000, retry: { retries: 3 }, logLevel: logLevel.ERROR })
  const stats = { running: false, drained: 0, failed: 0, lastAt: null, lastDelayMs: null }
  let consumer = null; let busy = false

  async function start () {
    consumer = kafka.consumer({ groupId: GROUP, allowAutoTopicCreation: true })
    await consumer.connect()
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true })
    await consumer.run({
      eachMessage: async ({ message }) => {
        let p; try { p = JSON.parse(message.value.toString()) } catch { stats.failed++; return }
        let ok = false
        for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
          try { const r = await processRow(p.row, p.lamport); ok = !!(r && r.txn && r.txn.outcome === 'COMMIT') } catch {}
          if (!ok) await sleep(2000)
        }
        if (ok) { stats.drained++; stats.lastDelayMs = p.buffered_at ? Date.now() - p.buffered_at : null } else stats.failed++
        stats.lastAt = Date.now()
        if (ok) log(`DRAINED pid=${p.row?.patient_id} buffered ${stats.lastDelayMs} ms ago by ${p.buffered_by}`)
      }
    })
    stats.running = true
    log('drain consumer STARTED (this replica is leader)')
  }
  async function stop () {
    try { if (consumer) await consumer.disconnect() } catch {}
    consumer = null; stats.running = false
    log('drain consumer STOPPED (no longer leader)')
  }

  setInterval(async () => {
    if (busy) return
    busy = true
    try {
      if (isLeader() && !stats.running) await start()
      else if (!isLeader() && stats.running) await stop()
    } catch (e) {
      log(`drain error: ${e.message}`); try { if (consumer) await consumer.disconnect() } catch {}
      consumer = null; stats.running = false
    } finally { busy = false }
  }, 2000)

  return { stats, stop }
}
