# Theme 5 — Milestone Log

Single-node Docker Swarm deployment (3-VM cross-physical deferred; stated honestly).
All services in `docker compose` stack on one host; replica semantics (leader election,
2PC across two Postgres instances, migration) preserved.

## M1 — Service skeleton
5 services + 2 Postgres + Redis, all healthy. Compose-based.

## M2 — Baseline pipeline (dumb)
Device streams CSV → Edge → Core → response. No filtering, no ML, no DB.
Latency instrumented at every hop. Baseline captured for later comparison.

## M3 — Architecture comparison
Microservices chosen over client-server / multi-tier / SOA because:
- Independent scaling (edge vs core have very different load profiles)
- Independent failure domains (edge keeps working when core is slow)
- Polyglot (Node for I/O-bound edges, Python for ML service)
- Placement logic naturally lives at edge; coordination naturally lives at core

## M4 — Leader election
Redis SETNX with PX TTL (10s), renewed every ~3.3s by leader.
Measured failover: ~6s from leader death to follower takeover.
Evidence: `results/leader-election.txt`

## M5 — Two-phase commit across core-db + cloud-db
Leader coordinates PREPARE→COMMIT on two separate Postgres instances.
Failure mode tested: cloud-db killed mid-run → all in-flight txns ABORTED,
no partial writes. Recovery automatic.
Evidence: `results/2pc-committed.txt`, `results/2pc-failure-demo.txt`

## M6 — Row-level locking + deadlock detection
Unsafe race: two concurrent read-modify-writes lose an update.
Safe version: SELECT ... FOR UPDATE serializes; both updates apply.
Deadlock: two txns hold one row and wait for the other's; PostgreSQL detects
the cycle and aborts one with SQLSTATE 40P01. Resource-allocation graph in
`results/m6-locking-deadlock.txt`

## M7 — Automated failure detection (watchdog)
Edge heartbeats Core every 3s. FAIL_THRESHOLD=2 misses → mark dead → route around it.
Kill test: dead detected in ~6s; recovery logged with downtime=12.7s.
No manual trigger. Both edges agree on state.
Evidence: `results/m7-watchdog.txt`

## M8 — Model comparison (analytical)
IsolationForest (unsupervised) chosen over supervised options because the trimmed
dataset has no `anomaly_flag` label. IsolationForest detects multivariate outliers
via random partitioning; contamination=0.05; n_estimators=100; trained on 20k rows
at startup. Complementary to lightTask() thresholds — thresholds catch obvious
spikes, IsolationForest catches subtle feature combinations.

## M9 — Migration transparency
Leader Core restarted mid-stream. Device continued without any 5xx response:
err=0, p99=11ms in the window.
Evidence: `results/m9-migration.txt`

## M10 — Naming + process lifecycle
Swarm-equivalent here: compose service names act as DNS (core-1, core-2, edge-1, edge-2).
Process lifecycle demonstrated: create (docker compose up) → locate (DNS) →
schedule (single host) → coordinate (Redis election, 2PC) → terminate (docker kill).
Scale up/down via compose not tested cross-host; documented as deferred.

## M11 — RPC to ML service
Core → core-ml via REST (POST /predict). Chose REST over gRPC for time budget
and because the payload is small and the call is short-lived. Benchmarked implicitly
via capstone comparison; the ML call adds ~2-5ms on the Core path.

## M12 — Full capstone
Baseline (forward-all) vs proposed (edge placement):
- Core load reduced 88.5%
- p50 latency 7.7× faster
- err=0 in both modes
Evidence: `results/capstone-comparison.md`
