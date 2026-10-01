export interface Milestone {
  id: string // "M1".."M12"
  title: string // human name
  week: number
  summary?: string // 1-line teaser for the grid
  tests: string[] // what the rubric says this milestone tests
  deliverables: string[] // what the rubric wants as output
  plainEnglish: string // one-paragraph explanation for a newcomer
  analogy: string // real-world analogy
  howWeBuilt: string // what our system actually does
  definitions: { term: string; meaning: string }[]
  liveTestLabel?: string // button label, e.g. "Show nodes"
  liveTestEndpoint?: string // API path, resolved at click time
  liveTestNote?: string // explanation shown after the response
  terminal: string[] // copyable terminal commands
  links: { label: string; url: string }[]
}

export const MILESTONES: Milestone[] = [
  {
    id: 'M1',
    title: 'Distributed Operating System Foundation',
    week: 1,
    summary: 'Three VMs joined into one logical cluster. Nodes, processes, resources, communication.',
    tests: [
      'Distributed vs network operating systems',
      'Process management',
      'Resource allocation',
      'Computational foundation'
    ],
    deliverables: [
      'Initial distributed prototype',
      'System architecture',
      'Process model',
      'Resource model',
      'Design justification'
    ],
    plainEnglish:
      'A normal operating system manages one computer. A distributed OS makes several computers look like one, so that you can run a program as if everything were on a single machine - even though it actually runs across multiple physical hosts.',
    analogy:
      'A single-kitchen restaurant has one chef, one stove, one menu. A franchise restaurant has many kitchens that share the same menu, ordering system, and recipes. The customer does not care which kitchen cooked the meal. Our distributed OS is the shared menu and ordering system.',
    howWeBuilt:
      'Three Ubuntu VMs joined into a Docker Swarm: one manager and two workers. Fifteen services run across them, communicating over an overlay network. Nodes carry role labels so services land where we want them.',
    definitions: [
      {
        term: 'Node',
        meaning: 'One physical or virtual machine in the cluster.'
      },
      { term: 'Process', meaning: 'A running container - one Swarm task.' },
      {
        term: 'Resource',
        meaning: 'CPU, memory, ports, storage that a process needs.'
      },
      {
        term: 'Overlay network',
        meaning:
          'A virtual network spanning multiple physical hosts so containers talk as if on the same LAN.'
      },
      {
        term: 'Swarm',
        meaning:
          "Docker's built-in orchestrator that decides which node runs which container."
      }
    ],
    liveTestLabel: 'Show nodes and services',
    liveTestEndpoint: '/device/health',
    liveTestNote:
      'Both nodes are Ready and labelled. Services are distributed across them by placement constraints.',
    terminal: [
      'docker node ls',
      'docker stack services theme5',
      'docker node inspect vm-manager --format "{{json .Spec.Labels}}"'
    ],
    links: [
      {
        label: 'Wikipedia: Distributed operating system',
        url: 'https://en.wikipedia.org/wiki/Distributed_operating_system'
      },
      {
        label: 'Docker: Swarm mode overview',
        url: 'https://docs.docker.com/engine/swarm/'
      }
    ]
  },
  {
    id: 'M2',
    title: 'Distributed Processing and Performance',
    week: 2,
    summary: 'Throughput, latency, jitter, and packet loss , measured live across the pipeline.',
    tests: [
      'Distributed processing',
      'Quantitative performance analysis',
      'Workload distribution'
    ],
    deliverables: [
      'Distributed processing implementation',
      'Performance measurements',
      'Load-distribution analysis',
      'Bottleneck analysis'
    ],
    plainEnglish:
      'We measure how fast the system moves data and how much it can process at once. Throughput is how many requests per second. Latency is how long each request takes. Jitter is how much latency varies. Packet loss is the fraction of requests that never got an answer.',
    analogy:
      'Like measuring a courier service: how many parcels per hour (throughput), how long a parcel takes door-to-door (latency), how much that varies between parcels (jitter), how often a parcel goes missing (packet loss).',
    howWeBuilt:
      'Every hop timestamps its arrival. Device logs round-trip latency per record and exposes p50 / p95 / p99 in /stats. Prometheus scrapes every service and exposes live rates.',
    definitions: [
      {
        term: 'Throughput',
        meaning: 'Completed work per unit of time - requests per second.'
      },
      {
        term: 'Latency',
        meaning: 'T_response − T_request for a single request.'
      },
      {
        term: 'Jitter',
        meaning: 'Variation in latency; in practice max − min over a window.'
      },
      {
        term: 'Packet loss',
        meaning: 'Failed requests ÷ total requests, as a percentage.'
      },
      {
        term: 'p50 / p95 / p99',
        meaning:
          'The 50th / 95th / 99th percentile of latency - half/95%/99% of requests were at least this fast.'
      }
    ],
    liveTestLabel: 'Show device stats',
    liveTestEndpoint: '/device/stats',
    liveTestNote:
      'The response shows sent, ok, err, and percentile latencies. err > 0 means packet loss. p99 >> p50 means high jitter.',
    terminal: [
      'curl -X POST http://192.168.56.11:3000/stats/reset',
      'curl -X POST http://192.168.56.11:3000/start',
      'sleep 50',
      'curl http://192.168.56.11:3000/stats'
    ],
    links: [
      {
        label: 'Wikipedia: Latency (engineering)',
        url: 'https://en.wikipedia.org/wiki/Latency_(engineering)'
      },
      {
        label: 'Wikipedia: Percentile',
        url: 'https://en.wikipedia.org/wiki/Percentile'
      }
    ]
  },
  {
    id: 'M3',
    title: 'Distributed Architecture',
    week: 3,
    summary: 'Microservices over client-server, multi-tier, or SOA. The edge,core,cloud split.',
    tests: [
      'Distributed architecture design',
      'Scalability',
      'Modularity',
      'Edge–core–cloud reasoning'
    ],
    deliverables: [
      'Architectural design',
      'Deployment architecture',
      'Service decomposition',
      'Scalability analysis',
      'Edge versus core trade-off analysis'
    ],
    plainEnglish:
      'The system is split into many small services instead of one monolith. Each service does one job, owns its own data, and communicates over the network. This is called a microservices architecture.',
    analogy:
      'Instead of a single big supermarket, imagine a street of specialty shops: butcher, baker, greengrocer. Each owns its stock, opens and closes independently, and they coordinate by delivery. If the baker is slow, the butcher keeps selling.',
    howWeBuilt:
      'We compared four architecture styles and chose microservices because Edge and Core have very different profiles: Edge is fast and stateless, Core is slow and coordinated.',
    definitions: [
      {
        term: 'Client–server',
        meaning:
          'One powerful server, many dumb clients. Simple but the server is a single point of failure.'
      },
      {
        term: 'Multi-tier',
        meaning:
          'Requests flow through a fixed chain of layers: web → app → database.'
      },
      {
        term: 'SOA',
        meaning:
          'Service-oriented architecture: services exposed on a central enterprise bus.'
      },
      {
        term: 'Microservices',
        meaning:
          'Many small, independently deployable services, each owning its data.'
      },
      {
        term: 'Edge / Core / Cloud',
        meaning:
          'Three tiers of compute: near the data source (Edge), coordinating (Core), archival (Cloud).'
      }
    ],
    liveTestLabel: 'Show all service health',
    liveTestEndpoint: '/device/health',
    liveTestNote:
      'Each service is independently deployed and can fail without bringing the others down - the property that motivated choosing microservices.',
    terminal: [
      'docker stack services theme5',
      'curl http://192.168.56.11:4001/health',
      'curl http://192.168.56.11:4002/health'
    ],
    links: [
      {
        label: 'Martin Fowler: Microservices',
        url: 'https://martinfowler.com/articles/microservices.html'
      }
    ]
  },
  {
    id: 'M4',
    title: 'Distributed Algorithms and Coordination',
    week: 4,
    summary: 'Leader election via Redis, plus Lamport clocks for event ordering.',
    tests: [
      'Distributed algorithm design',
      'Coordination',
      'Synchronization',
      'Event ordering'
    ],
    deliverables: [
      'Distributed algorithm implementation',
      'Algorithm analysis',
      'Complexity analysis',
      'Experimental results'
    ],
    plainEnglish:
      'Two Core replicas cannot both be the boss at once - they would write conflicting data. We elect one leader and let the other stand by. Every message is also stamped with a logical clock so we can tell which event happened first, even across machines whose physical clocks disagree.',
    analogy:
      'Leader election is like a meeting where everyone agrees one person takes minutes - and if that person leaves, someone else takes over. Logical clocks are like numbering letters in a correspondence: no matter when each letter was actually posted, you know letter #5 was written after letter #4.',
    howWeBuilt:
      'Redis SETNX with a 10-second TTL. The holder renews every ~3 s; if the holder dies, the other replica wins the next attempt. Each hop increments a Lamport counter carried inside every request.',
    definitions: [
      {
        term: 'Leader election',
        meaning: 'The process of choosing one node to act as coordinator.'
      },
      {
        term: 'Lamport clock',
        meaning:
          'A counter that increments on every event; receiving a message with a higher clock bumps yours past theirs.'
      },
      {
        term: 'Consensus',
        meaning: 'Agreement among multiple nodes on a single value.'
      },
      {
        term: 'Split-brain',
        meaning:
          'Two leaders at once - catastrophic; we avoid it with a TTL-based lock.'
      }
    ],
    liveTestLabel: 'Show leader health',
    liveTestEndpoint: '/core-1/health',
    liveTestNote:
      'Only one replica shows isLeader:true at any moment. Kill it and the other takes over within the TTL window (~6–10 s).',
    terminal: [
      'curl http://192.168.56.11:4001/health | grep isLeader',
      'curl http://192.168.56.11:4002/health | grep isLeader',
      '# kill leader and watch',
      'docker service scale theme5_core-1=0 && sleep 12 && docker service scale theme5_core-1=1'
    ],
    links: [
      {
        label: 'Wikipedia: Leader election',
        url: 'https://en.wikipedia.org/wiki/Leader_election'
      },
      {
        label: 'Wikipedia: Lamport timestamp',
        url: 'https://en.wikipedia.org/wiki/Lamport_timestamp'
      }
    ]
  },
  {
    id: 'M5',
    title: 'Distributed Transactions',
    week: 5,
    summary: 'Two databases must agree. Either both save the record or neither does.',
    tests: [
      'Distributed transaction processing',
      'Consistency',
      'Recovery',
      'Transaction coordination'
    ],
    deliverables: [
      'Transaction subsystem',
      'Failure experiments',
      'Recovery mechanism',
      'Consistency analysis'
    ],
    plainEnglish:
      'Two databases on two machines must agree. If one writes a record, the other must also write it - or neither does. This is enforced by a two-phase commit.',
    analogy:
      'A bank transfer: money leaves account A and arrives at account B. If the system crashes after the debit but before the credit, the money vanishes. 2PC is the rule that prevents that.',
    howWeBuilt:
      'The leader generates a txn_id, sends PREPARE to both databases, and only COMMITs when both say yes. If either fails, both roll back. The txn_id is what ties the two halves together.',
    definitions: [
      {
        term: 'ACID',
        meaning:
          'Atomicity, Consistency, Isolation, Durability - the four guarantees of a transaction.'
      },
      {
        term: '2PC',
        meaning:
          'Two-Phase Commit - the protocol we use to write atomically to multiple databases.'
      },
      {
        term: 'txn_id',
        meaning:
          'A UUID identifying one specific write across all participants.'
      },
      {
        term: 'PREPARE',
        meaning: 'Phase 1: "are you able to save this? yes or no".'
      },
      {
        term: 'COMMIT',
        meaning: 'Phase 2: "save it for real" (only if all said yes).'
      }
    ],
    liveTestLabel: 'Show commit / abort counts',
    liveTestEndpoint: '/core-1/health',
    liveTestNote:
      'Every COMMIT appears in both databases with the same txn_id. When cloud-db is killed, in-flight transactions are ABORTED and no half-written rows exist.',
    terminal: [
      'CORE_DB=$(docker ps --format "{{.Names}}" | grep -m1 theme5_core-db)',
      'docker exec "$CORE_DB" psql -U core -d core -c "SELECT status, COUNT(*) FROM core_records GROUP BY status;"',
      '# kill cloud-db and run a batch to see ABORTs'
    ],
    links: [
      {
        label: 'Wikipedia: Two-phase commit protocol',
        url: 'https://en.wikipedia.org/wiki/Two-phase_commit_protocol'
      },
      { label: 'Wikipedia: ACID', url: 'https://en.wikipedia.org/wiki/ACID' }
    ]
  },
  {
    id: 'M6',
    title: 'Concurrency and Deadlock Management',
    week: 6,
    summary: 'Row-level locks stop races. Deadlock detection aborts one transaction.',
    tests: [
      'Concurrent execution',
      'Resource allocation',
      'Deadlock reasoning',
      'Race conditions, mutual exclusion, starvation'
    ],
    deliverables: [
      'Concurrent distributed implementation',
      'Deadlock experiment',
      'Detection / recovery mechanism',
      'Resource utilization analysis'
    ],
    plainEnglish:
      'Two requests updating the same record at the same time can clobber each other. We use row-level locks so only one writes at a time. But locks can deadlock - two requests each holding what the other needs. We manufactured one and drew the graph.',
    analogy:
      'Two drivers arrive at a 4-way stop at the same time, each waiting for the other to go. Nobody moves. That is a deadlock.',
    howWeBuilt:
      'Postgres SELECT ... FOR UPDATE serializes concurrent updates. We manufactured a deadlock by having two transactions lock rows in opposite orders; PostgreSQL detected the cycle and aborted one.',
    definitions: [
      {
        term: 'Race condition',
        meaning:
          'Two processes reading and writing the same data without coordination; the result depends on timing.'
      },
      {
        term: 'Mutual exclusion',
        meaning: 'Only one process holds a lock at a time.'
      },
      {
        term: 'Deadlock',
        meaning:
          'A set of processes, each waiting for a resource held by another.'
      },
      {
        term: 'Starvation',
        meaning:
          'A process that never gets the lock because others keep taking it first.'
      },
      {
        term: 'Resource-allocation graph',
        meaning:
          'Nodes are processes and resources; edges are "holds" and "waits-for"; a cycle means deadlock.'
      }
    ],
    liveTestLabel: 'Show txn counts (evidence of locking)',
    liveTestEndpoint: '/core-1/health',
    liveTestNote:
      'Under concurrent writes with row locks, no updates are lost. Without locks, one update would disappear and the final value would be off by exactly one increment.',
    terminal: [
      'curl -X POST http://192.168.56.11:4001/lock/race -H "Content-Type: application/json" -d "{\\"patient_id\\":4,\\"mode\\":\\"unsafe\\"}"',
      'curl -X POST http://192.168.56.11:4001/lock/race -H "Content-Type: application/json" -d "{\\"patient_id\\":4,\\"mode\\":\\"safe\\"}"',
      'curl -X POST http://192.168.56.11:4001/lock/deadlock -H "Content-Type: application/json" -d "{\\"a\\":4,\\"b\\":7}"'
    ],
    links: [
      {
        label: 'Wikipedia: Deadlock',
        url: 'https://en.wikipedia.org/wiki/Deadlock'
      },
      {
        label: 'PostgreSQL: Explicit locking',
        url: 'https://www.postgresql.org/docs/current/explicit-locking.html'
      }
    ]
  },
  {
    id: 'M7',
    title: 'Fault Tolerance and Recovery',
    week: 7,
    summary: 'Watchdog detects failures automatically. Availability and MTTR measured.',
    tests: [
      'Reliability engineering',
      'Fault modeling',
      'Recovery mechanisms',
      'Crash, communication, omission, node, service failures'
    ],
    deliverables: [
      'Fault-injection framework',
      'Recovery mechanism',
      'Availability analysis',
      'Recovery-time analysis',
      'Failure comparison'
    ],
    plainEnglish:
      'Machines break. Our system detects failures automatically and reroutes traffic. We measure how often the system is up (availability) and how fast it recovers (MTTR).',
    analogy:
      'A hospital with backup generators. When the power goes out, the generator kicks in automatically. What matters is how often the power goes out, and how long the generator takes to start.',
    howWeBuilt:
      'Edge heartbeats both Core replicas every 3 s. Two consecutive misses marks a replica dead and stops routing to it. A scripted harness can kill services on demand.',
    definitions: [
      { term: 'Crash failure', meaning: 'A process simply stops.' },
      {
        term: 'Communication failure',
        meaning: 'Messages are lost or delayed.'
      },
      {
        term: 'Omission failure',
        meaning:
          'A process fails to send or receive a message it was supposed to.'
      },
      {
        term: 'Byzantine failure',
        meaning: 'A process behaves arbitrarily, possibly maliciously.'
      },
      { term: 'Availability', meaning: 'T_uptime ÷ T_total.' },
      {
        term: 'MTTR',
        meaning:
          'Mean Time To Recovery - the average time from failure to full service.'
      },
      {
        term: 'Watchdog',
        meaning: 'A monitor that detects and reacts to failures.'
      }
    ],
    liveTestLabel: 'Show edge watchdog state',
    liveTestEndpoint: '/edge/watchdog',
    liveTestNote:
      'The response shows each Core replica as alive or dead with uptime / downtime. Availability is a percentage; MTTR is derived from the transition log.',
    terminal: [
      'curl http://192.168.56.11:3001/watchdog',
      'bash scripts/kill-cloud-db.sh',
      'bash scripts/kill-core.sh'
    ],
    links: [
      {
        label: 'Wikipedia: Fault tolerance',
        url: 'https://en.wikipedia.org/wiki/Fault_tolerance'
      },
      {
        label: 'Wikipedia: Mean time to recovery',
        url: 'https://en.wikipedia.org/wiki/Mean_time_to_recovery'
      }
    ]
  },
  {
    id: 'M8',
    title: 'Distributed System Models',
    week: 8,
    summary: 'Five distributed system models compared , integrated model chosen.',
    tests: ['Architectural reasoning', 'Distributed-system model selection'],
    deliverables: [
      'Model comparison',
      'Simulation / experimental results',
      'Architectural justification'
    ],
    plainEnglish:
      'Distributed systems can be organized in several ways. We compare five classic models and argue which one fits a telecom health pipeline.',
    analogy:
      'Host-based is a big shared house; processor pool is a computing co-op; workstation is a consultancy office; server-based is a hospital with a central lab; integrated is a modern hotel where every room has its own services but a common front desk.',
    howWeBuilt:
      'Our system is closest to the integrated model: services are autonomous, but the swarm manager provides central scheduling and naming.',
    definitions: [
      {
        term: 'Host-based model',
        meaning: 'One powerful host, many thin clients.'
      },
      {
        term: 'Processor pool',
        meaning: 'A pool of CPUs that any process can be assigned to.'
      },
      {
        term: 'Workstation model',
        meaning: 'Users own their machines; the cluster uses idle capacity.'
      },
      {
        term: 'Server-based model',
        meaning: 'Clients talk to dedicated servers.'
      },
      {
        term: 'Integrated model',
        meaning:
          'Autonomous services plus a shared control plane - what we built.'
      }
    ],
    liveTestLabel: 'Show service placement (model evidence)',
    liveTestEndpoint: '/device/health',
    liveTestNote:
      'Services are autonomous (each a container) yet coordinated (each obeys Swarm placement and DNS). That is the integrated model in production.',
    terminal: [
      'docker node ls',
      'docker service ps theme5_core-1',
      'docker service ps theme5_core-2'
    ],
    links: [
      {
        label: 'Wikipedia: Distributed computing',
        url: 'https://en.wikipedia.org/wiki/Distributed_computing'
      }
    ]
  },
  {
    id: 'M9',
    title: 'Transparency and Reliability',
    week: 9,
    summary: 'Access, location, replication, migration and failure transparency.',
    tests: ['Access, location, replication, migration, failure transparency'],
    deliverables: [
      'Transparent service mechanism',
      'Replication / migration experiment',
      'Reliability evaluation',
      'Overhead analysis'
    ],
    plainEnglish:
      'Transparency means the user never has to know how the system is organized underneath. They call a service by name; the system decides where it runs, how many copies exist, and how to keep working if a copy dies.',
    analogy:
      'Calling a taxi company: you ask for a cab to your address. You never care which driver, which car, which depot. If a driver cancels, another is sent.',
    howWeBuilt:
      'Clients use service names (edge, core-1, core-2). Swarm DNS resolves them, the ingress mesh routes round-robin across replicas, and failure of one replica is hidden by retrying to the other. Migration and restart of a service do not produce client-visible errors.',
    definitions: [
      {
        term: 'Access transparency',
        meaning: 'Local and remote calls look identical.'
      },
      {
        term: 'Location transparency',
        meaning: 'The user does not know which machine the service runs on.'
      },
      {
        term: 'Replication transparency',
        meaning: 'The user does not know how many copies exist.'
      },
      {
        term: 'Migration transparency',
        meaning:
          'The service can move between machines without the user noticing.'
      },
      {
        term: 'Failure transparency',
        meaning: 'The user does not see a failure if the system can recover.'
      }
    ],
    liveTestLabel: 'Show running replicas (replication evidence)',
    liveTestEndpoint: '/device/health',
    liveTestNote:
      'Two replicas exist, but the client only ever sees one service name - replication transparency. Forcing a service to restart mid-stream produces no client-visible error.',
    terminal: [
      'for i in 1 2 3 4 5 6; do curl -s http://192.168.56.11:3001/health | grep replica; done',
      'docker service update --force theme5_core-1'
    ],
    links: [
      {
        label: 'Wikipedia: Transparency (human–computer interaction)',
        url: 'https://en.wikipedia.org/wiki/Transparency_(human%E2%80%93computer_interaction)'
      }
    ]
  },
  {
    id: 'M10',
    title: 'Naming and Distributed Process Management',
    week: 10,
    summary: 'DNS-style naming plus the full process lifecycle.',
    tests: [
      'Resource naming',
      'Name resolution',
      'Process management',
      'Distributed coordination'
    ],
    deliverables: [
      'Naming subsystem',
      'Process-management subsystem',
      'Resolution latency analysis',
      'Scalability analysis'
    ],
    plainEnglish:
      'Naming means: instead of hard-coding IP addresses, we call services by name. The system figures out the actual IP at request time. Process management means we can create, locate, schedule, coordinate and terminate processes across the cluster.',
    analogy:
      'Instead of memorising phone numbers, you save contacts by name. When you call "Mum", your phone looks up the current number.',
    howWeBuilt:
      'Swarm provides an internal DNS. Names like edge, core-1, cloud-db resolve to container IPs inside the overlay network. Docker service commands give the full create → locate → schedule → coordinate → terminate lifecycle.',
    definitions: [
      {
        term: 'Naming',
        meaning: 'Assigning human-readable identifiers to resources.'
      },
      {
        term: 'Name resolution',
        meaning: 'Looking up the current address for a name.'
      },
      {
        term: 'DNS',
        meaning: 'Domain Name System - the standard name-to-address resolver.'
      },
      {
        term: 'Process lifecycle',
        meaning: 'Create → locate → schedule → coordinate → terminate.'
      }
    ],
    liveTestLabel: 'Resolve service name from inside the network',
    liveTestEndpoint: '/core-1/health',
    liveTestNote:
      'Curl by service name works because the overlay DNS resolves core-1 and core-2 inside the cluster.',
    terminal: [
      'docker exec $(docker ps -q -f name=theme5_core-1) getent hosts core-db',
      'docker exec $(docker ps -q -f name=theme5_core-1) getent hosts redis',
      'docker service scale theme5_edge=3 && docker service scale theme5_edge=2'
    ],
    links: [
      {
        label: 'Wikipedia: Domain Name System',
        url: 'https://en.wikipedia.org/wiki/Domain_Name_System'
      }
    ]
  },
  {
    id: 'M11',
    title: 'RPC and Distributed Shared Memory',
    week: 11,
    summary: 'RPC to the ML service and a Redis-backed shared risk cache.',
    tests: [
      'Distributed communication',
      'Remote execution',
      'Distributed memory abstractions'
    ],
    deliverables: [
      'RPC implementation',
      'Distributed memory / state mechanism',
      'Communication benchmarks',
      'Consistency analysis'
    ],
    plainEnglish:
      'RPC means calling a function on a remote machine as if it were local. Distributed shared memory means several machines share a piece of state - in our case, a Redis cache of risk scores that any Core replica can read or write.',
    analogy:
      'RPC is like ordering by phone: you say "give me the price of X" and someone else looks it up. Distributed shared memory is like a shared whiteboard in an office - anyone can read or write it, and everyone sees the same thing.',
    howWeBuilt:
      'Core calls core-ml via REST (POST /predict). Risk scores are cached in Redis under risk:{patient_id} with a 60-second TTL. Any Core replica sees the same cache.',
    definitions: [
      {
        term: 'RPC',
        meaning:
          'Remote Procedure Call - invoking a function on another machine.'
      },
      {
        term: 'Stub',
        meaning:
          'Client-side code that serialises a call and sends it over the network.'
      },
      {
        term: 'Distributed shared memory',
        meaning:
          'A memory abstraction that multiple machines can read and write.'
      },
      {
        term: 'Cache hit / miss',
        meaning:
          'The value was found in the shared cache (hit) or had to be computed (miss).'
      }
    ],
    liveTestLabel: 'Show cache hits and misses',
    liveTestEndpoint: '/core-1/mlcache',
    liveTestNote:
      'Hits means the risk was already known; misses means it was computed by ML and stored in Redis. Both replicas share the same underlying cache.',
    terminal: [
      'curl http://192.168.56.11:4001/mlcache',
      'curl http://192.168.56.11:4002/mlcache',
      'curl -X POST http://192.168.56.11:5000/predict -H "Content-Type: application/json" -d "{\\"age\\":69,\\"bmi\\":23.9,\\"heart_rate\\":88,\\"systolic_bp\\":160,\\"diastolic_bp\\":86,\\"respiratory_rate\\":13}"'
    ],
    links: [
      {
        label: 'Wikipedia: Remote procedure call',
        url: 'https://en.wikipedia.org/wiki/Remote_procedure_call'
      },
      {
        label: 'Wikipedia: Distributed shared memory',
        url: 'https://en.wikipedia.org/wiki/Distributed_shared_memory'
      }
    ]
  },
  {
    id: 'M12',
    title: 'Distributed File System and Capstone',
    week: 12,
    summary: 'Everything integrated. Baseline vs proposed capstone results.',
    tests: ['Complete distributed-system engineering and integration'],
    deliverables: [
      'Fully working system integrating all course topics',
      'Baseline vs proposed comparison',
      'Technical report',
      'Research paper'
    ],
    plainEnglish:
      'Everything from weeks 1–11 runs together as one system. We compare a baseline configuration (all records forwarded to Core) against our proposed configuration (records routed at the Edge) and defend the numbers.',
    analogy:
      'A restaurant where the kitchen prepares everything (baseline) versus a restaurant with a salad bar (proposed). Most orders never touch the kitchen, so it can focus on the complex dishes.',
    howWeBuilt:
      'Two modes with a single environment variable (FORCE_FORWARD=1 for baseline, 0 for proposed). Same workload, same dataset; we measure throughput, latency, and Core load.',
    definitions: [
      {
        term: 'Baseline',
        meaning:
          'A simple but honest comparison system - usually the naive approach.'
      },
      {
        term: 'Proposed',
        meaning:
          'The improved system that introduces a genuine engineering change.'
      },
      {
        term: 'Capstone experiment',
        meaning:
          'The final test that exercises the whole system under realistic load.'
      }
    ],
    liveTestLabel: 'Show current device stats',
    liveTestEndpoint: '/device/stats',
    liveTestNote:
      'This snapshot is either baseline or proposed, depending on the current FORCE_FORWARD value. Flip it, re-run the same batch, and compare.',
    terminal: [
      '# baseline',
      'sed -i "s/FORCE_FORWARD: \\"0\\"/FORCE_FORWARD: \\"1\\"/" infra/docker-stack.yml',
      'docker stack deploy -c infra/docker-stack.yml theme5',
      '# run a batch, capture /stats, then flip back'
    ],
    links: [
      {
        label: 'Wikipedia: Distributed file system',
        url: 'https://en.wikipedia.org/wiki/Distributed_file_system'
      }
    ]
  }
]
