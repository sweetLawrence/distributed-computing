// M9: store-and-forward buffer (failure transparency).
// When no Core can take a critical reading, Edge publishes it to Kafka instead of
// failing. The Core leader drains the topic when it is back.
const { Kafka, logLevel } = require('kafkajs')

const BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',')
const TOPIC = process.env.KAFKA_TOPIC || 'critical-readings'
const REPLICA_ID = process.env.REPLICA_ID || 'edge-?'

const kafka = new Kafka({
  clientId: REPLICA_ID,
  brokers: BROKERS,
  connectionTimeout: 3000,
  requestTimeout: 5000,
  retry: { retries: 2 },
  logLevel: logLevel.ERROR
})

let producer = null
let connecting = null

async function getProducer () {
  if (producer) return producer
  if (!connecting) {
    const p = kafka.producer({ allowAutoTopicCreation: true })
    connecting = p.connect()
      .then(() => { producer = p; return p })
      .catch(e => { connecting = null; throw e })
  }
  return connecting
}

async function publish (payload) {
  const t0 = Date.now()
  const p = await getProducer()
  await p.send({
    topic: TOPIC,
    messages: [{ key: String(payload.row?.patient_id ?? ''), value: JSON.stringify(payload) }]
  })
  return Date.now() - t0
}

async function close () {
  try { if (producer) await producer.disconnect() } catch {}
}

module.exports = { publish, close, TOPIC }
