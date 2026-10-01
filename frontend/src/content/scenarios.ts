export type HttpMethod = 'GET' | 'POST'

export interface Scenario {
  id: string
  group: 'Happy path' | 'Edge behaviour' | 'Failure' | 'Concurrency' | 'Query'
  title: string
  description: string
  method: HttpMethod
  endpoint: string
  body?: any
  explanationSuccess: string
  explanationFailure?: string
  terminal: string[]
  delayMs?: number
}

export const SCENARIOS: Scenario[] = [
  /* ------------------- HAPPY PATH ------------------- */
  {
    id: 'send-normal',
    group: 'Happy path',
    title: 'Send one NORMAL row',
    description:
      'A patient with normal vitals (HR 80, BP 120, RR 16). Edge should answer locally without involving Core.',
    method: 'POST',
    endpoint: '/edge/ingest',
    body: {
      row: {
        patient_id: 10001,
        age: 40,
        gender: 'Male',
        bmi: 22.5,
        smoking_status: 'Never',
        alcohol_consumption: 'None',
        heart_rate: 80,
        systolic_bp: 120,
        diastolic_bp: 78,
        respiratory_rate: 16
      },
      t_sent: Date.now(),
      lamport: 1
    },
    explanationSuccess:
      'Edge ran its threshold check. HR 80 ≤ 120, BP 120 ≤ 160, RR 16 ≤ 25 - nothing flagged. The record was handled at the edge and never touched Core. This is the whole point of edge placement: most traffic never leaves the edge.',
    terminal: [
      `curl -s -X POST http://192.168.56.11:3001/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"row":{"patient_id":10001,"age":40,"bmi":22.5,"heart_rate":80,"systolic_bp":120,"diastolic_bp":78,"respiratory_rate":16},"t_sent":1,"lamport":1}'`
    ]
  },
  {
    id: 'send-flagged',
    group: 'Happy path',
    title: 'Send one FLAGGED row',
    description:
      'A patient with high HR and BP. Edge should route this to Core, which calls ML then runs 2PC.',
    method: 'POST',
    endpoint: '/edge/ingest',
    body: {
      row: {
        patient_id: 10002,
        age: 65,
        gender: 'Female',
        bmi: 30.1,
        smoking_status: 'Former',
        alcohol_consumption: 'Moderate',
        heart_rate: 145,
        systolic_bp: 180,
        diastolic_bp: 95,
        respiratory_rate: 28
      },
      t_sent: Date.now(),
      lamport: 2
    },
    explanationSuccess:
      'Edge saw HR 145 > 120 → flagged. The placement score said Core was healthy, so it forwarded the record. Core called core-ml for a risk probability and then ran a 2-phase commit writing to both core-db and cloud-db. The response tells you which replicas handled it and how long the transaction took.',
    terminal: [
      `curl -s -X POST http://192.168.56.11:3001/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"row":{"patient_id":10002,"age":65,"bmi":30.1,"heart_rate":145,"systolic_bp":180,"diastolic_bp":95,"respiratory_rate":28},"t_sent":1,"lamport":2}'`
    ]
  },
  {
    id: 'send-dup',
    group: 'Happy path',
    title: 'Send the same patient twice (cache hit)',
    description:
      'Fires the same flagged row twice in a row. The second call should be served from the Redis cache instead of calling ML again.',
    method: 'POST',
    endpoint: '/edge/ingest',
    body: {
      row: {
        patient_id: 10003,
        age: 55,
        gender: 'Male',
        bmi: 27.0,
        heart_rate: 150,
        systolic_bp: 175,
        diastolic_bp: 92,
        respiratory_rate: 26
      },
      t_sent: Date.now(),
      lamport: 3
    },
    explanationSuccess:
      'First call: cache miss → Core calls ML and stores the score in Redis. Fire the button again and you should see a cache hit: the ML service is not called, and the response latency drops. Redis acts as distributed shared memory: any Core replica reads the same cache.',
    terminal: [
      `# send twice`,
      `for i in 1 2; do curl -s -X POST http://192.168.56.11:3001/ingest -H "Content-Type: application/json" -d '{"row":{"patient_id":10003,"age":55,"bmi":27,"heart_rate":150,"systolic_bp":175,"diastolic_bp":92,"respiratory_rate":26},"t_sent":1,"lamport":3}'; echo; done`,
      `# then check cache stats`,
      `curl -s http://192.168.56.11:4001/mlcache`
    ]
  },
  {
    id: 'stream-200',
    group: 'Happy path',
    title: 'Stream 200 rows from the CSV',
    description:
      'Fires a real batch through the pipeline. Takes about 40–50 seconds.',
    method: 'POST',
    endpoint: '/device/start',
    explanationSuccess:
      'The device read 200 rows from the CSV, one every 200 ms, and POSTed each to Edge. Most rows were NORMAL (answered locally), a small fraction were FLAGGED (forwarded to Core). Open the Overview tab to see the p50 / p95 / p99 latencies and the throughput. This is the baseline workload for all comparisons.',
    terminal: [
      `curl -X POST http://192.168.56.11:3000/stats/reset`,
      `curl -X POST http://192.168.56.11:3000/start`,
      `sleep 50 && curl http://192.168.56.11:3000/stats`
    ],
    delayMs: 50000
  },

  /* ------------------- EDGE BEHAVIOUR ------------------- */
  {
    id: 'edge-stats',
    group: 'Edge behaviour',
    title: 'Show edge placement counters',
    description:
      'What fraction of records did Edge handle locally vs forward to Core?',
    method: 'GET',
    endpoint: '/edge/health',
    explanationSuccess:
      'localCount = records Edge handled on its own. forwardCount = records Edge forwarded to Core. upstreamFailures = forwards that failed (packet loss on the Edge→Core hop). On a healthy system upstreamFailures stays 0 and localCount >> forwardCount.',
    terminal: [
      `curl -s http://192.168.56.11:3001/health`,
      `curl -s http://192.168.56.11:3002/health`
    ]
  },
  {
    id: 'edge-watchdog',
    group: 'Edge behaviour',
    title: 'Show edge watchdog state',
    description:
      'Each Edge replica heartbeats both Core replicas. This shows what it currently thinks.',
    method: 'GET',
    endpoint: '/edge/watchdog',
    explanationSuccess:
      'The response lists each Core replica with status (alive/dead), consecutive misses, uptime/downtime, and the transitions log. Availability = uptime / total. If both cores show alive, Edge is routing flagged records to whichever is faster right now.',
    terminal: [`curl -s http://192.168.56.11:3001/watchdog`]
  },

  /* ------------------- FAILURE ------------------- */
  {
    id: 'kill-cloud-db',
    group: 'Failure',
    title: 'Kill cloud-db, watch 2PC abort',
    description:
      'Scales cloud-db to 0. Run a batch while it is down; every flagged record aborts. Cloud-db is restored automatically after 30 s.',
    method: 'POST',
    endpoint: '/device/start',
    explanationFailure:
      'While cloud-db is down, the leader cannot PREPARE its side. Every in-flight transaction rolls back on core-db too - no half-written rows. Device still gets a response (no crash), but the latency spikes because each call waits for the DB connection timeout. This is the 2PC guarantee working.',
    explanationSuccess:
      'Batch sent. Note the elevated p95 / p99 latencies and the err count - those are the aborted transactions. Once cloud-db comes back, new batches commit normally.',
    terminal: [
      `docker service scale theme5_cloud-db=0`,
      `curl -X POST http://192.168.56.11:3000/start`,
      `sleep 30`,
      `docker service scale theme5_cloud-db=1`
    ],
    delayMs: 40000
  },
  {
    id: 'kill-leader',
    group: 'Failure',
    title: 'Kill the current leader core',
    description:
      'Detects which replica is leader, scales it to 0, waits ~12 s, scales it back. Leadership flips to the surviving replica.',
    method: 'GET',
    endpoint: '/core-1/health',
    explanationSuccess:
      'Before the kill, one replica had isLeader:true. After ~6–10 s, the other one does. Redis TTL-based election: no split-brain, no client-visible error.',
    terminal: [
      `# find leader`,
      `curl -s http://192.168.56.11:4001/health | grep isLeader`,
      `curl -s http://192.168.56.11:4002/health | grep isLeader`,
      `# kill it (adjust as needed)`,
      `docker service scale theme5_core-1=0 && sleep 12 && docker service scale theme5_core-1=1`
    ]
  },
  {
    id: 'migrate-core',
    group: 'Failure',
    title: 'Force-migrate core-1 (transparency demo)',
    description:
      'Restarts the core-1 task. Swarm reschedules it - the client sees no errors.',
    method: 'GET',
    endpoint: '/core-1/health',
    explanationSuccess:
      "The task was killed and replaced. From the client's perspective the service never went away: service name is stable, DNS keeps resolving, ingress reroutes. That is migration transparency.",
    terminal: [`docker service update --force theme5_core-1`]
  },

  /* ------------------- CONCURRENCY ------------------- */
  {
    id: 'race-unsafe',
    group: 'Concurrency',
    title: 'Unsafe race (no row locks)',
    description:
      'Two concurrent increments on the same patient row without SELECT FOR UPDATE. One increment is lost.',
    method: 'POST',
    endpoint: '/core-1/lock/race',
    body: { patient_id: 4, mode: 'unsafe' },
    explanationSuccess:
      'Both transactions committed, but the final value only went up by 0.01 instead of 0.02. That is a lost update - the classic race condition. This is why we need row-level locking.',
    terminal: [
      `curl -X POST http://192.168.56.11:4001/lock/race -H "Content-Type: application/json" -d '{"patient_id":4,"mode":"unsafe"}'`
    ]
  },
  {
    id: 'race-safe',
    group: 'Concurrency',
    title: 'Safe race (SELECT FOR UPDATE)',
    description:
      'Same two concurrent increments, but now with row-level locking. Both apply.',
    method: 'POST',
    endpoint: '/core-1/lock/race',
    body: { patient_id: 4, mode: 'safe' },
    explanationSuccess:
      'Final value went up by 0.02 - both increments applied. The second transaction waited for the first to release the lock.',
    terminal: [
      `curl -X POST http://192.168.56.11:4001/lock/race -H "Content-Type: application/json" -d '{"patient_id":4,"mode":"safe"}'`
    ]
  },
  {
    id: 'deadlock',
    group: 'Concurrency',
    title: 'Manufacture a deadlock',
    description:
      'Two transactions each lock a row in opposite order. Postgres detects the cycle and aborts one.',
    method: 'POST',
    endpoint: '/core-1/lock/deadlock',
    body: { a: 4, b: 7 },
    explanationSuccess:
      'One transaction committed, the other aborted with "deadlock detected". Postgres builds a wait-for graph internally; when it finds a cycle it aborts the younger transaction. That is what the resource-allocation graph in the report depicts.',
    terminal: [
      `curl -X POST http://192.168.56.11:4001/lock/deadlock -H "Content-Type: application/json" -d '{"a":4,"b":7}'`
    ]
  },

  /* ------------------- QUERY ------------------- */
  {
    id: 'q-leader',
    group: 'Query',
    title: 'Query the leader',
    description: 'Which core replica is leader right now?',
    method: 'GET',
    endpoint: '/core-1/health',
    explanationSuccess:
      'Look at isLeader. Exactly one of core-1 / core-2 should be true at any moment. Hit the other endpoint to confirm.',
    terminal: [
      `curl -s http://192.168.56.11:4001/health | grep isLeader`,
      `curl -s http://192.168.56.11:4002/health | grep isLeader`
    ]
  },
  {
    id: 'q-cache',
    group: 'Query',
    title: 'Query the shared ML cache',
    description: 'How many cache hits vs misses since this core started?',
    method: 'GET',
    endpoint: '/core-1/mlcache',
    explanationSuccess:
      'hits = records whose risk was already known. misses = records that triggered an ML call. The Redis key is shared across replicas so both cores read the same counter.',
    terminal: [
      `curl -s http://192.168.56.11:4001/mlcache`,
      `curl -s http://192.168.56.11:4002/mlcache`
    ]
  },
  {
    id: 'q-ml-direct',
    group: 'Query',
    title: 'Call ML directly (RPC demo)',
    description:
      'Bypass the pipeline and hit core-ml with a feature vector. This is the RPC target Core uses.',
    method: 'POST',
    endpoint: '/ml/predict',
    body: {
      age: 69,
      bmi: 23.9,
      heart_rate: 88,
      systolic_bp: 160,
      diastolic_bp: 86,
      respiratory_rate: 13
    },
    explanationSuccess:
      'This is the RPC call Core makes for every flagged record. The response includes a risk probability between 0 and 1, produced by an IsolationForest trained on 20 000 rows of the CSV.',
    terminal: [
      `curl -s -X POST http://192.168.56.11:5000/predict -H "Content-Type: application/json" -d '{"age":69,"bmi":23.9,"heart_rate":88,"systolic_bp":160,"diastolic_bp":86,"respiratory_rate":13}'`
    ]
  },
  {
    id: 'q-prom-txn',
    group: 'Query',
    title: 'Query Prometheus for total 2PC transactions',
    description: 'Live scrape count.',
    method: 'GET',
    endpoint: '/prom/api/v1/query?query=core_txn_total',
    explanationSuccess:
      'The result is a list of metric vectors keyed by outcome (COMMIT / ABORT). Values are cumulative counters since the container started.',
    terminal: [
      `curl -s 'http://192.168.56.11:9090/api/v1/query?query=core_txn_total' | python -m json.tool`
    ]
  }
]
