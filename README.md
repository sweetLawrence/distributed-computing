# Distributed Edge Computing Platform (Theme 5)

Smartwear health monitoring pipeline: Device → Edge → Core → ML, with Cloud batch.
Single-node Docker Compose stack; Swarm/VMs deferred (see docs/milestones.md).

## Architecture

    CSV ──► device ──► edge-1/edge-2 ──► core-1/core-2 (leader elected) ──► core-ml
              │             │                     │
              │             │                     └──► core-db  (Postgres)
              │             │                     └──► cloud-db (Postgres)
              │             └──► handled locally for NORMAL records
              └── HTTP, timestamped at each hop

## Key mechanism (Theme 5)

Edge applies `lightTask(row)` — a fast threshold check — and
`placementScore(coreHealth)` — a weighted score of Core's latency, queue depth,
and failure risk — to decide whether each record is handled locally or forwarded.
Same input, different route depending on Core's live health.

## Quickstart

    docker compose up --build -d
    curl http://localhost:3000/health        # device
    curl http://localhost:3001/health        # edge-1
    curl http://localhost:4001/health        # core-1
    curl http://localhost:5000/health        # core-ml

    # stream 200 rows
    curl -X POST http://localhost:3000/stats/reset
    curl -X POST http://localhost:3000/start
    sleep 30
    curl http://localhost:3000/stats

## Demos

    # leader election
    docker kill distributed-edge-platform-core-2-1   # kill leader; other takes over ~6s

    # 2PC failure
    docker stop distributed-edge-platform-cloud-db-1
    # ... stream ... new rows in core-db marked ABORTED, none committed on cloud-db
    docker start distributed-edge-platform-cloud-db-1

    # watchdog (automated failure detection)
    curl http://localhost:3001/watchdog

    # capstone baseline-vs-proposed
    sed -i 's/FORCE_FORWARD: "0"/FORCE_FORWARD: "1"/' docker-compose.yml   # baseline
    docker compose up -d --force-recreate edge-1 edge-2
    # ... run ... restore FORCE_FORWARD: "0" for proposed

## Results

See `results/`:
- `capstone-comparison.md` — baseline vs proposed headline numbers
- `2pc-failure-demo.txt` — cross-DB atomicity evidence
- `m6-locking-deadlock.txt` — row-lock + deadlock
- `m7-watchdog.txt` — automated failure detection
- `m9-migration.txt` — leader restart transparency

## Deferred

- Cross-VM Swarm with physical replica migration (single-node here; semantics preserved)
- Nginx edge/core load-balancers (compose DNS + app-level routing used instead)
- Tableau dashboard (results exported to CSV/JSON)
- gRPC between Core and ML (REST used)
