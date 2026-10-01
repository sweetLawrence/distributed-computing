# Swarm task flapping under memory pressure

## Symptom

On a 2-node Docker Swarm (vm-manager + vm-worker-1, each 4 GB RAM, no swap),
`docker stack services theme5` shows services randomly cycling through
`0/1`, `1/1`, `0/2`, `1/2` between snapshots. The same service is healthy in
one snapshot and down in the next. No error is consistently reported by
`docker service ps` beyond transient rejections.

Example observations across three consecutive `docker stack services`
snapshots taken minutes apart:

    Snapshot 1:  cadvisor 0/2, edge 1/2, grafana 0/1
    Snapshot 2:  cadvisor 0/2, cloud 0/1, grafana 1/1
    Snapshot 3:  cadvisor 0/2, redis 0/1, core-db 0/1

Every service flaps; no single service is consistently broken.

## Diagnosis

Two diagnostic commands revealed the cause:

    $ free -h
                   total   used   free   shared  buff/cache   available
    Mem:           3.3Gi  1.5Gi  123Mi    413Mi        2.3Gi        1.8Gi
    Swap:            0B     0B     0B

    $ docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
    NAME                           CPU %   MEM USAGE / LIMIT
    theme5_core-1.1...             2.49%   29.64MiB / 256MiB
    theme5_grafana.1...            5.65%   248.1MiB / 1GiB
    theme5_prometheus.1...         1.86%   44.76MiB / 512MiB
    (cadvisor is absent - the kernel OOM-killed it)

Key observations:

1.  Free RAM is 123 MiB (3.7% of total). The VM is at capacity.
2.  No swap is configured, so the kernel has nowhere to page cold memory.
3.  cadvisor does not appear in `docker stats` - it was the first victim of
    the OOM killer. Every time Swarm restarts it, the kernel kills it again.
4.  `docker service ps` shows the rejection cause:

        theme5_nginx-edge.1  ...  Rejected  "Canceled: context canceled"
        theme5_redis.1       ...  Rejected  "rpc error: code = Canceled desc = context canceled"

    `context canceled` is not an application error. It is the Swarm manager
    giving up on a task because the daemon on the target node is not
    responding within the deadline - the daemon is starved of CPU/memory
    handling container lifecycle events.

## How Swarm kills and reschedules tasks

Docker Swarm is a declarative orchestration system. The operator declares
desired state (`replicas: 1`); the swarm manager continuously reconciles
actual state toward that desired state. The manager does not know _why_ a
task disappeared - it only observes "1 wanted, 0 running" and schedules a
replacement.

The reconciliation loop:

    1. Manager watches for task events from worker nodes.
    2. On each iteration, it compares desired replica count to actual
       running tasks per node.
    3. If actual < desired, it schedules a new task on a node that
       satisfies the placement constraints and has resources.
    4. The task starts, reports Healthy, manager marks it converged.

Under memory pressure, this loop runs constantly:

    a. Memory exhausted -> kernel OOM killer picks a container (largest RSS
       or the most recently started, depending on kernel heuristics).
    b. Container dies -> worker sends task-update to manager.
    c. Manager sees actual < desired -> schedules a new task.
    d. New container starts, allocates memory, pushes the node closer to
       the limit.
    e. Another container (sometimes the same one) gets OOM-killed.
    f. Loop repeats, generating the flapping behaviour.

The `Rejected: context canceled` errors appear when step (c) or (d)
times out. The manager has a deadline for task lifecycle RPCs to the worker
daemon. If the daemon is thrashing (heavy memory pressure, scheduler
contention, page cache eviction), it misses the deadline and the task is
rejected. The manager then re-schedules, but that new task faces the same
conditions.

## Why cadvisor is the first casualty

cadvisor reads cgroup files for **every container on the node** to produce
CPU/memory/network metrics. Its working set scales with the number of
running containers. On a node with 10+ containers and 3.3 GiB RAM, cadvisor
regularly peaks over 200 MB, more than any other service.

Under memory pressure, the kernel's OOM killer scores processes by RSS and
selects the largest. cadvisor wins that competition and dies first. Its
absence then removes the node's own memory accounting - ironically making
the problem harder to diagnose from inside.

## Why the effect is random per service

The OOM killer and the Swarm scheduler are both independent decisions:

- OOM killer: kernel-level, picks the largest resident process on the node
  at the moment of pressure. Ties broken by "most recently started".
- Swarm scheduler: picks the node with available resources and matching
  placement constraints. On a 2-node swarm with hard constraints, both
  nodes are near capacity, so the scheduler is effectively picking between
  two equally-bad options.

The two systems do not coordinate. So the container that dies and the
container that is asked to start are not related - hence the "random
service failing" impression.

## Reproduction

To observe the flapping directly:

    for i in 1 2 3 4 5; do
      docker stack services theme5 | grep -E "0/1|0/2|1/2"
      sleep 15
    done

Different services appear in each iteration.

To confirm OOM kills in the kernel log:

    dmesg -T | grep -i -E "oom|killed process" | tail -20

Expected output names cadvisor, then grafana, then others.

## Fix

The correct fix is to give the VMs enough RAM and add swap as a safety
net.

### 1. Increase VM RAM

VirtualBox -> vm-manager -> Settings -> System -> Motherboard:
Base Memory: 8192 MB (or 6144 if host has < 16 GB)
Same for vm-worker-1.

### 2. Add 2 GB swap inside each VM

    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    free -h

### 3. Redeploy

    docker stack rm theme5
    sleep 30
    docker stack deploy -c infra/docker-stack.yml theme5
    sleep 90
    docker stack services theme5

With adequate RAM, no service is OOM-killed, the reconciliation loop
converges, and the stack stops flapping.

## Alternative mitigations (if RAM cannot be increased)

- Reduce cAdvisor replicas from 2 to 1: `docker service scale theme5_cadvisor=1`
- Scale down observability temporarily: `docker service scale theme5_grafana=0`
- Reduce prometheus retention to 6 hours
- Lower `deploy.resources.limits.memory` per service so the OOM killer has
  a clear ordering (deeply undesirable - this only postpones the problem)

## Lesson

Docker Swarm's self-healing is a double-edged property. It correctly
reschedules failed tasks, but it has no concept of "the system is
overloaded - stop restarting things". Every OOM kill produces a
reschedule, every reschedule adds memory pressure, and the swarm oscillates
until the underlying resource shortage is resolved. Orchestrators do not
detect resource starvation; they compound it. The only real fix is more
resources.
