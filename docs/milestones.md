# Theme 5 - Milestone Log

Single-node Docker Swarm deployment (3-VM cross-physical deferred; stated honestly).
All services in `docker compose` stack on one host; replica semantics (leader election,
2PC across two Postgres instances, migration) preserved.

## M1 - Service skeleton

5 services + 2 Postgres + Redis, all healthy. Compose-based.

## M2 - Baseline pipeline (dumb)

Device streams CSV → Edge → Core → response. No filtering, no ML, no DB.
Latency instrumented at every hop. Baseline captured for later comparison.

## M3 - Architecture comparison

Microservices chosen over client-server / multi-tier / SOA because:

- Independent scaling (edge vs core have very different load profiles)
- Independent failure domains (edge keeps working when core is slow)
- Polyglot (Node for I/O-bound edges, Python for ML service)
- Placement logic naturally lives at edge; coordination naturally lives at core

## M4 - Leader election

Redis SETNX with PX TTL (10s), renewed every ~3.3s by leader.
Measured failover: ~6s from leader death to follower takeover.
Evidence: `results/leader-election.txt`

## M5 - Two-phase commit across core-db + cloud-db

Leader coordinates PREPARE→COMMIT on two separate Postgres instances.
Failure mode tested: cloud-db killed mid-run → all in-flight txns ABORTED,
no partial writes. Recovery automatic.
Evidence: `results/2pc-committed.txt`, `results/2pc-failure-demo.txt`

## M6 - Row-level locking + deadlock detection

Unsafe race: two concurrent read-modify-writes lose an update.
Safe version: SELECT ... FOR UPDATE serializes; both updates apply.
Deadlock: two txns hold one row and wait for the other's; PostgreSQL detects
the cycle and aborts one with SQLSTATE 40P01. Resource-allocation graph in
`results/m6-locking-deadlock.txt`

## M7 - Automated failure detection (watchdog)

Edge heartbeats Core every 3s. FAIL_THRESHOLD=2 misses → mark dead → route around it.
Kill test: dead detected in ~6s; recovery logged with downtime=12.7s.
No manual trigger. Both edges agree on state.
Evidence: `results/m7-watchdog.txt`

## M8 - Model comparison (analytical)

IsolationForest (unsupervised) chosen over supervised options because the trimmed
dataset has no `anomaly_flag` label. IsolationForest detects multivariate outliers
via random partitioning; contamination=0.05; n_estimators=100; trained on 20k rows
at startup. Complementary to lightTask() thresholds - thresholds catch obvious
spikes, IsolationForest catches subtle feature combinations.

## M9 - Migration transparency

Leader Core restarted mid-stream. Device continued without any 5xx response:
err=0, p99=11ms in the window.
Evidence: `results/m9-migration.txt`

## M10 - Naming + process lifecycle

Swarm-equivalent here: compose service names act as DNS (core-1, core-2, edge-1, edge-2).
Process lifecycle demonstrated: create (docker compose up) → locate (DNS) →
schedule (single host) → coordinate (Redis election, 2PC) → terminate (docker kill).
Scale up/down via compose not tested cross-host; documented as deferred.

## M11 - RPC to ML service

Core → core-ml via REST (POST /predict). Chose REST over gRPC for time budget
and because the payload is small and the call is short-lived. Benchmarked implicitly
via capstone comparison; the ML call adds ~2-5ms on the Core path.

## M12 - Full capstone

Baseline (forward-all) vs proposed (edge placement):

- Core load reduced 88.5%
- p50 latency 7.7× faster
- err=0 in both modes
  Evidence: `results/capstone-comparison.md`

## M5 fix verified - 2PC atomicity restored

**Root cause confirmed:** `sequelize.sync({ alter: true })` in `services/core/db.js`
ran on every core replica startup. When a replica booted before its DB was
reachable on the overlay (common during rolling `--force` updates and
container migrations), the alter path either recreated the table or wrote
partial state, silently losing rows on the core side while cloud-db (booted
once, stayed up) kept them.

**Fix applied:** changed both `sync({ alter: true })` calls to plain `sync()`
in `services/core/db.js`. Sequelize now only creates the table if missing -
never alters, never drops. Rebuilt `dep-core:latest`, distributed the image
to both nodes, force-updated both replicas.

**Verification:** wiped both DB volumes, redeployed the stack, ran one clean
200-row batch. Result:
core-db : COMMITTED = 40
cloud-db : COMMITTED = 40
Counts match exactly. Atomicity restored.

**Lesson:** ORM schema-sync-as-a-side-effect-of-startup is unsafe in
distributed deployments. Schema changes must be versioned, one-shot migrations
run at deploy time, not on every replica boot.

## M5 cross-VM 2PC - verified failure and recovery

**Setup:** leader core-2 on vm-worker-1, core-db on vm-manager, cloud-db on vm-worker-1.
Two separate physical VMs participate in every commit.

**Clean baseline (200 rows):**
core-db : COMMITTED = 40
cloud-db : COMMITTED = 40

**Failure injection (docker service scale theme5_cloud-db=0):**
Device stats: sent=86, ok=85, err=1, avg=309ms, p95=2572ms, p99=4163ms
(latency spike because each flagged record waits for cloud-db connect timeout)
core-db after batch:
COMMITTED = 40 (unchanged)
ABORTED = 23 (all in-flight flagged records correctly rolled back)
cloud-db down - no partial writes reached it
core-2 leader logs: every flagged record shows "txn=ABORT"

**Recovery (scale cloud-db back to 1, run again):**
Device stats: sent=200, ok=200, err=0, avg=18ms, p95=89ms, p99=123ms
core-db : COMMITTED = 63, ABORTED = 23
cloud-db : COMMITTED = 63
Counts match - atomicity restored, no drift.

**Conclusion:** 2PC correctly distinguishes prepare failures from commits.
Cross-VM atomicity holds under injected failure and after recovery.
Latency cost of the failure path: 2–4s per record waiting for connect timeout
(documented as a future improvement: set a shorter connect timeout in the pg client).

## M6 - Resource-allocation graph (deadlock scenario)

Scenario: two concurrent transactions each lock one row and then wait for the
other's lock. Cycle: A → row20 → B → row19 → A. Detected by PostgreSQL's
built-in wait-for-graph monitor; youngest txn aborted with SQLSTATE 40P01.

    Txn A ──HOLD──► row 19
      │
      │ WAIT-FOR
      ▼
    row 20 ◄──HOLD── Txn B
      ▲                │
      │                │ WAIT-FOR
      │                ▼
    row 19 ◄────────────┘
    (cycle: A → row20 → B → row19 → A)

Mermaid:

    graph LR
      A[Txn A] -- holds --> R19[row 19]
      A -- waits for --> R20[row 20]
      B[Txn B] -- holds --> R20
      B -- waits for --> R19
      R19 -- allocated to --> A
      R20 -- allocated to --> B

Detection mechanism: PostgreSQL monitors the wait-for graph and aborts the
youngest transaction in any cycle. Our experiment logged:

    {"label":"A","outcome":"aborted","error":"deadlock detected"}
    {"label":"B","outcome":"committed"}
