export interface FailureLogEntry {
  id: string
  milestone: string // "M5"
  date: string // ISO
  whatChanged: string
  whatFailed: string
  whyItFailed: string
  howFixed: string
  alternativeConsidered: string
  whatLearned: string
  evidence?: string // filename or note
}

export const FAILURES: FailureLogEntry[] = [
  {
    id: 'seq-key-fix',
    milestone: 'M5',
    date: '2026-09-29',
    whatChanged:
      'Added a risk cache in Redis and ran a batch to seed it. Investigated a strange count mismatch between core-db and cloud-db.',
    whatFailed:
      'Core-db showed 269 COMMITTED, cloud-db showed 369. 129 transactions existed only in cloud-db.',
    whyItFailed:
      'Sequelize was configured with `sync({ alter: true })`. Every time core restarted (which happened during rolling updates), Sequelize re-ran the model sync against the live table. When the DB was not yet reachable on the overlay at boot, the sync path either recreated the table or wrote into an unexpected state, silently losing rows on the core side while cloud-db (which restarted less often) kept its data.',
    howFixed:
      'Changed `sync({ alter: true })` to plain `sync()` in services/core/db.js. Rebuilt the core image, shipped it to both VMs, force-updated both replicas. Re-ran a clean batch: core-db COMMITTED = 40, cloud-db COMMITTED = 40.',
    alternativeConsidered:
      'A versioned migration tool (umzug, Flyway-style). Correct for production but heavier than this course build.',
    whatLearned:
      'ORM schema-sync-on-startup is unsafe in distributed systems. Schema changes must be versioned, one-shot migrations run at deploy time, not as an implicit side-effect of a replica boot.',
    evidence: 'docs/milestones.md (M5 fix section)'
  },
  {
    id: 'swarm-memory',
    milestone: 'M7',
    date: '2026-09-30',
    whatChanged:
      'Deployed the full 15-service stack across two VMs, each 4 GB RAM, no swap (later expanded to three VMs).',
    whatFailed:
      'Services flapped: different ones showed 0/1 or 0/2 on every `docker stack services` snapshot. cadvisor disappeared from `docker stats`.',
    whyItFailed:
      'Free RAM was 123 MiB out of 3.3 GiB. The kernel OOM killer picked cadvisor first (largest RSS on the node). Every time Swarm rescheduled it, memory pressure killed it again. The reconciliation loop never converged.',
    howFixed:
      'Bumped each VM to 8 GB and added a 2 GB swapfile inside each VM. Redeployed the stack - no more flapping.',
    alternativeConsidered:
      'Reduce cadvisor replicas to 1, scale down grafana, shorten Prometheus retention. Works but postpones the problem.',
    whatLearned:
      'Orchestrators do not detect resource starvation - they compound it. The only real fix is more resources. See docs/swarm-memory-issue.md.',
    evidence: 'docs/swarm-memory-issue.md'
  },
  {
    id: 'overlay-dns-stale',
    milestone: 'M7',
    date: '2026-09-30',
    whatChanged:
      'Prometheus began reporting several targets as "down" with `dial tcp: lookup core-1 on 127.0.0.11:53: no such host`.',
    whatFailed:
      'Overlay DNS stopped resolving core-1, core-2, and core-ml - even though the containers were running and reachable by IP.',
    whyItFailed:
      "The worker node had been marked `Down` in the swarm while its Docker daemon was still active locally. The manager removed the worker's tasks from the DNS records for those service names, but the container processes were still running on the isolated worker. The two views disagreed.",
    howFixed:
      'Ran `docker swarm leave --force` on the worker, `docker node rm --force` on the manager, then re-joined the worker with a fresh token and re-labelled it.',
    alternativeConsidered:
      'Restart Docker on the worker without leaving the swarm. Sometimes works, but state drifted again - the clean rejoin was the reliable fix.',
    whatLearned:
      'The swarm manager and each node have independent views of cluster state. When they disagree, DNS and placement break silently. A clean rejoin is faster than debugging the specific divergence.',
    evidence: 'docs/swarm-memory-issue.md (context)'
  },
  {
    id: 'phantom-network',
    milestone: 'M7',
    date: '2026-09-30',
    whatChanged:
      'After a stack rm and redeploy, the manager refused to create new services.',
    whatFailed:
      '`network theme5_appnet not found` on every service creation attempt, even though `docker network ls` showed the network.',
    whyItFailed:
      "The swarm raft store held a stale reference to a network whose underlying object had already been destroyed. `docker network ls` reads from a different code path than the service-attach path; one saw the network, the other didn't.",
    howFixed:
      'Left the swarm (`docker swarm leave --force`) on both nodes, re-initialized on the manager, rejoined the worker with a fresh token. Redeployed - services came up clean.',
    alternativeConsidered:
      "`docker network prune` (didn't touch swarm-scoped networks) and daemon restart (also didn't clear the raft-store entry).",
    whatLearned:
      'Swarm state is eventually consistent. When raft-store entries and real resources disagree, reinit is the safe escape hatch.'
  },
  {
    id: 'prom-client-cache',
    milestone: 'M2',
    date: '2026-09-30',
    whatChanged:
      'Instrumented core with prom-client to expose `core_ml_cache_total`.',
    whatFailed:
      'Prometheus could not find the metric; `core_ml_cache_total` did not appear in `/metrics` at all.',
    whyItFailed:
      'The patch added `metrics.mlCall.inc()` but the earlier Python regex missed the cache hit/miss increments. The counter was registered but never `.inc()`-ed, and prom-client does not emit zero-value counters - the metric simply does not exist until the first increment.',
    howFixed:
      'Added explicit `metrics.mlCache.inc({ result: "hit" })` and `metrics.mlCache.inc({ result: "miss" })` in the cache lookup block. Rebuilt core, redeployed. Metric appeared.',
    alternativeConsidered:
      'Switch to a Gauge that pre-initializes at 0. Rejected - counters are semantically right for monotonic values.',
    whatLearned:
      'prom-client never emits a metric that has zero observations. When instrumenting, verify with `curl /metrics` that the metric actually appears - do not assume the code path ran.'
  },
  {
    id: 'grafana-datasource-uid',
    milestone: 'M2',
    date: '2026-09-30',
    whatChanged:
      'Provisioned Grafana with a `Prometheus` datasource, then added an explicit `uid: prometheus` to the provisioning file.',
    whatFailed:
      'Grafana crash-looped with `Datasource provisioning error: data source not found`, even after wiping the data volume.',
    whyItFailed:
      'Grafana assigns a random UID to a datasource on first creation. Adding a specific `uid` in the provisioning file causes Grafana to attempt a UID change, which it refuses to do - and then it enters a Failed state on every boot.',
    howFixed:
      "Added a `deleteDatasources` directive to the provisioning file so the old datasource is removed before the new one is created. Wiped Grafana's data volume on both nodes and let it start clean.",
    alternativeConsidered:
      'Skip provisioning entirely and create the datasource through the UI once. Works, but is not reproducible.',
    whatLearned:
      'Grafana provisioning is not fully idempotent for datasource UIDs. When the initial datasource was created without an explicit UID, all subsequent provisioning attempts fail.'
  },
  {
    id: 'nginx-config-immutable',
    milestone: 'M3',
    date: '2026-09-30',
    whatChanged:
      'Updated the nginx-edge config file to remove the static /health endpoint.',
    whatFailed:
      '`docker service update --force` restarted nginx, but the container still served the old config.',
    whyItFailed:
      'Swarm configs are immutable. Once a config object is created, its content cannot be changed - only labels can. The container was restarted with the same old config object.',
    howFixed:
      'Renamed the config in the stack file (`nginx_edge_conf` → `nginx_edge_conf_v3`). Swarm created a new config object with the new content. Redeployed the stack.',
    alternativeConsidered:
      'Bind-mount the config file from the host instead of using a config object. Works but couples the stack to a host path.',
    whatLearned:
      'In Swarm, config content is versioned by name. To change content, change the name.'
  },
  {
    id: 'edge-placement-constraint',
    milestone: 'M1',
    date: '2026-09-29',
    whatChanged:
      'Deployed the stack onto a single-node swarm with placement constraints for worker1 and worker2.',
    whatFailed:
      'edge replicas and core replicas stayed `Pending` with `no suitable node (scheduling constraints not satisfied)`',
    whyItFailed:
      'The single node was labelled `manager=true`, but the stack file also constrained services to `worker1` and `worker2` labels that no node carried.',
    howFixed:
      'Temporarily labelled the single node with all three role labels (`manager`, `worker1`, `worker2`). When the second VM was added, the labels were rebalanced.',
    alternativeConsidered:
      'Write a separate single-node stack file with no constraints. Cleaner but doubles the maintenance.',
    whatLearned:
      'Placement constraints fail closed - an unsatisfied constraint blocks the task forever. When first deploying, temporarily satisfy all constraints on one node, then rebalance when real workers join.'
  },
  {
    id: 'device-lamport-missing',
    milestone: 'M4',
    date: '2026-09-30',
    whatChanged:
      'Refactored services/device/index.js to add Prometheus instrumentation.',
    whatFailed:
      'The Lamport clock require and tick calls disappeared from the file. Records arrived at Edge without logical timestamps.',
    whyItFailed:
      'The refactor replaced the whole file via heredoc and the new version did not carry over the lamport module. The check `grep lamport` on the updated file returned nothing.',
    howFixed:
      'Rewrote services/device/index.js with both metrics and lamport. Rebuilt the device image and redeployed.',
    alternativeConsidered:
      'Smaller surgical edits to the file rather than a full rewrite. Would have preserved the lamport code but takes longer.',
    whatLearned:
      'When rewriting a file, always compare against the previous version. Grep for every expected import after any full-file replacement.'
  },
  {
    id: 'packet-loss-metric-hitting-right-replica',
    milestone: 'M2',
    date: '2026-09-30',
    whatChanged:
      'Added `edge_placement_total` counter and wanted to verify it in Prometheus.',
    whatFailed:
      'Curl to port 3001 returned a metric, curl to port 3002 returned nothing. Prometheus still had the metric aggregated across both replicas.',
    whyItFailed:
      'The Swarm ingress mesh routes each curl to one of the two edge replicas. Both replicas have independent counters, and a fresh replica has no metric until its first request. The curl just happened to hit different replicas.',
    howFixed:
      'No code change needed - the metric was correct. Aggregate queries in Prometheus (`sum by (route)`) show the total across replicas.',
    alternativeConsidered:
      'Query each replica directly by task ID. More verbose.',
    whatLearned:
      "Under a load-balanced service, always aggregate in Prometheus, not in one replica's /metrics output."
  }
]
