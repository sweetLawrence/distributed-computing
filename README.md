# Distributed Edge Computing Platform — Theme 5

Smartwear health monitoring pipeline: **Device → Edge → Core → ML**, with a
Cloud batch service. Runs as a Docker Swarm stack (single node by default;
scale to multi-node by adding workers with labels).

## What it demonstrates

- **Dynamic placement at the edge** — Edge decides per-record whether to answer
  locally or forward to Core, using a score built from Core's latency, queue
  depth, and failure risk.
- **Leader election** — Core replicas elect a leader through Redis (SETNX lock
  with TTL). Only the leader performs writes.
- **Two-phase commit across two databases** — flagged records are written
  atomically to `core-db` and `cloud-db`. Either both commit, or both roll back.
- **Row-level locking + deadlock detection** — concurrent writes to the same
  patient are serialized; deadlock scenario is manufacturable and inspected.
- **Automated failure watchdog** — Edge detects Core death by heartbeat misses
  and reroutes, without manual intervention.
- **ML inference** — a FastAPI service serves an IsolationForest risk
  probability for flagged records.

## Repository layout

    services/
      device/       Node/Express — reads CSV and streams rows to Edge
      edge/         Node/Express — threshold check + placement score
      core/         Node/Express — leader election, 2PC, ML RPC
      core-ml/      Python/FastAPI — IsolationForest risk model
      cloud/        Node/Express — periodic batch summary to cloud-db

    infra/
      docker-stack.yml     Swarm deploy file with placement constraints
      nginx-edge/          (reserved; not used in current build)
      nginx-core/          (reserved; not used in current build)

    data/
      smartwear_health_monitoring_dataset.csv     *** NOT in git — see below ***

    docs/
      milestones.md        consolidated milestone evidence log

    results/               captured metrics from demos (git-ignored)

    scripts/               helper shell scripts
    Makefile               common commands
    docker-compose.yml     single-host dev version (docker compose up)

## Dataset

The CSV is **not committed** because it is ~10 MB and possibly licensed.
Expected filename: `data/smartwear_health_monitoring_dataset.csv`.

Required columns (header order matters for the naive CSV parser):

    patient_id,age,gender,bmi,smoking_status,alcohol_consumption,
    heart_rate,systolic_bp,diastolic_bp,respiratory_rate

If you have a wider dataset, select these columns and save with the filename
above. Place it under `data/`. The Device service streams it row by row.

## Quickstart — Docker Compose (single host, dev)

    cp .env.example .env
    docker compose up --build -d
    curl http://localhost:3000/health    # device
    curl http://localhost:3001/health    # edge-1
    curl http://localhost:4001/health    # core-1
    curl http://localhost:5000/health    # core-ml

Then stream a slice of the CSV and read the stats:

    curl -X POST http://localhost:3000/stats/reset
    curl -X POST http://localhost:3000/start
    sleep 30
    curl http://localhost:3000/stats

## Quickstart — Docker Swarm (single node today; multi-node later)

Prereq: a swarm manager node with three label sets:

    docker swarm init --advertise-addr <manager-ip>
    # single node — emulate the roles so the same stack deploys:
    docker node update --label-add manager=true <manager-hostname>
    docker node update --label-add worker1=true <manager-hostname>
    docker node update --label-add worker2=true <manager-hostname>

Build images locally on the manager (Swarm does not build):

    docker build -t dep-device:latest   ./services/device
    docker build -t dep-edge:latest     ./services/edge
    docker build -t dep-core:latest     ./services/core
    docker build -t dep-cloud:latest    ./services/cloud
    docker build -t dep-core-ml:latest  ./services/core-ml

Deploy:

    docker stack deploy -c infra/docker-stack.yml theme5
    docker stack services theme5

Teardown:

    docker stack rm theme5

### Multi-node (production-shaped)

On each worker VM:

    docker swarm join --token <TOKEN> <manager-ip>:2377
    # from the manager, label the new node:
    docker node update --label-add worker1=true vm-worker-1
    docker node update --label-add worker2=true vm-worker-2
    # remove the temporary worker1/worker2 labels from the manager so tasks
    # migrate onto the real workers on next deploy:
    docker node update --label-rm worker1 vm-manager
    docker node update --label-rm worker2 vm-manager

    docker stack deploy -c infra/docker-stack.yml theme5    # reschedules tasks

## Configuration

See `.env.example` for the full list. Notable knobs:

| Var                    | Default | Meaning |
| ---------------------- | ------- | ------- |
| `STREAM_INTERVAL_MS`   | 200     | device pacing between rows |
| `MAX_ROWS`             | 1000    | upper bound on rows streamed |
| `PLACEMENT_THRESHOLD`  | 0.005   | edge threshold on placement score |
| `CORE_HEARTBEAT_MS`    | 3000    | edge heartbeat interval |
| `LEADER_TTL_MS`        | 10000   | redis leader lock TTL |
| `FORCE_FORWARD`        | "0"     | edge kill switch: "1" forwards everything (baseline mode) |

## Demos

Leader election:

    docker kill $(docker ps -q -f name=theme5_core-2)
    # watch core-1 /health flip isLeader -> true within ~10 s

2PC failure (kill cloud-db):

    docker service scale theme5_cloud-db=0
    curl -X POST http://<host>:3000/start      # new rows in core-db abort
    docker service scale theme5_cloud-db=1

Watchdog:

    curl http://<host>:3001/watchdog

Baseline vs proposed (edge placement):

    # in docker-compose.yml (or stack file), set FORCE_FORWARD=1 for baseline
    # then run loadtest and compare p50/p95 against FORCE_FORWARD=0

## Results

Captured numbers under `results/`:

- `capstone-comparison.md` — baseline vs proposed metrics
- `2pc-committed.txt`, `2pc-failure-demo.txt`
- `m6-locking-deadlock.txt` — row-lock anomaly + deadlock detection
- `m7-watchdog.txt`
- `m9-migration.txt`
- `leader-election.txt`

## Deferred / out of scope for this build

- Nginx edge/core LB tier (compose and Swarm DNS route directly)
- gRPC between Core and ML (REST chosen for time budget)
- Tableau dashboard (metrics exported to CSV/JSON under `results/`)
- Full cross-physical-VM migration demo (single-node today; multi-node
  instructions above)

## License / attribution

Dataset not included. Code MIT (add a `LICENSE` if desired).
