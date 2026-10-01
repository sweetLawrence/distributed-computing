export interface Definition {
  term: string
  category:
    | 'Performance'
    | 'Distributed systems'
    | 'Data'
    | 'Networking'
    | 'Infrastructure'
  plain: string
  example?: string
  analogy?: string
}

export const DEFINITIONS: Definition[] = [
  // ---------- PERFORMANCE ----------
  {
    term: 'p50 (median)',
    category: 'Performance',
    plain:
      'The latency at which half of all requests finished faster and half took longer. It is the "typical" experience.',
    example: 'p50 = 8 ms means 100 out of 200 requests finished in under 8 ms.',
    analogy:
      'If you line up 100 people by height, the one in the middle is the median. Half are shorter, half are taller.'
  },
  {
    term: 'p95',
    category: 'Performance',
    plain:
      '95% of requests finished faster than this, 5% took longer. Reveals the "slow tail" that users notice.',
    example: 'p95 = 88 ms means 190 of 200 requests finished within 88 ms.'
  },
  {
    term: 'p99',
    category: 'Performance',
    plain:
      '99% of requests finished faster than this, only 1% took longer. This is what the unluckiest users experience.',
    example: 'p99 = 164 ms means 198 of 200 requests finished within 164 ms.'
  },
  {
    term: 'Average latency',
    category: 'Performance',
    plain:
      'The mean. Useful as a rough indicator but hides outliers - a few very slow requests can drag the average up while most requests are fast.',
    example:
      '99 requests at 5 ms and 1 request at 500 ms gives an average of 9.95 ms - looks fine, but someone waited half a second.'
  },
  {
    term: 'Throughput',
    category: 'Performance',
    plain: 'Completed work divided by time. Usually requests per second.',
    example: '200 requests in 50 seconds = 4 requests per second.'
  },
  {
    term: 'Latency',
    category: 'Performance',
    plain: 'Time from sending a request to receiving a response.',
    example: 'Latency = T_response − T_request.'
  },
  {
    term: 'Jitter',
    category: 'Performance',
    plain:
      'The variation in latency between requests. High jitter means one request is fast and the next is slow.',
    example: 'p99 − p50 = 164 − 8 = 156 ms of jitter.'
  },
  {
    term: 'Packet loss',
    category: 'Performance',
    plain:
      'The percentage of requests that never received a response. Should be 0 in a healthy system.',
    example: 'err / (ok + err) × 100.'
  },

  // ---------- DISTRIBUTED SYSTEMS ----------
  {
    term: 'Node',
    category: 'Distributed systems',
    plain: 'One physical or virtual machine in the cluster.',
    analogy: 'One kitchen in a restaurant franchise.'
  },
  {
    term: 'Swarm',
    category: 'Distributed systems',
    plain:
      "Docker's built-in orchestrator. Decides which node runs which container and restarts failed containers automatically.",
    analogy: 'A dispatch centre that assigns delivery drivers to orders.'
  },
  {
    term: 'Task',
    category: 'Distributed systems',
    plain:
      'A single running container. A service with 3 replicas runs 3 tasks.',
    analogy: 'One chef in the kitchen.'
  },
  {
    term: 'Service',
    category: 'Distributed systems',
    plain:
      'A logical unit that Swarm deploys. A service has a name, an image, and a desired number of replicas.',
    analogy:
      'The "waiter" role - you can have 1 or 5 waiters, all doing the same job.'
  },
  {
    term: 'Replica',
    category: 'Distributed systems',
    plain:
      'One copy of a service. Running 2 replicas of Core means 2 separate containers handle requests.',
    analogy: 'Two identical cashiers at the same supermarket.'
  },
  {
    term: 'Leader election',
    category: 'Distributed systems',
    plain:
      'The process of choosing one node to act as the coordinator. Only the leader performs writes that must not conflict.',
    analogy:
      'A meeting where everyone agrees on one person to take minutes. If they leave, someone else takes over.'
  },
  {
    term: 'Split-brain',
    category: 'Distributed systems',
    plain:
      'Two nodes both think they are the leader. This causes conflicting writes and is the failure mode leader election exists to prevent.',
    analogy: 'Two managers both giving orders to the same team.'
  },
  {
    term: 'Lamport clock',
    category: 'Distributed systems',
    plain:
      'A counter that increments on every event. Receiving a message with a higher value bumps yours past it. Allows ordering events across machines without synchronised physical clocks.',
    analogy:
      'Numbering letters in a correspondence. Even if the post office loses the actual postmark dates, you still know letter #5 was written after letter #4.'
  },
  {
    term: 'Coordination overhead',
    category: 'Distributed systems',
    plain:
      'The extra messages and time spent keeping nodes in agreement, beyond the useful work itself. Higher with more nodes.'
  },
  {
    term: 'Availability',
    category: 'Distributed systems',
    plain:
      'Fraction of time the system is up and serving requests. Expressed as a percentage.',
    example: 'Availability = uptime / total time.'
  },
  {
    term: 'MTTR',
    category: 'Distributed systems',
    plain:
      'Mean Time To Recovery - the average time from a failure occurring to full service being restored.'
  },
  {
    term: 'Fault tolerance',
    category: 'Distributed systems',
    plain:
      'The ability of a system to keep serving requests even when some components fail.',
    analogy:
      'A hospital running on backup generators when the mains power goes out.'
  },

  // ---------- DATA ----------
  {
    term: 'ACID',
    category: 'Data',
    plain:
      'Atomicity, Consistency, Isolation, Durability - four guarantees a transaction can offer. Atomicity means "all or nothing".',
    analogy:
      'A bank transfer either moves the money from A to B completely, or not at all. It never leaves halfway.'
  },
  {
    term: '2PC (Two-Phase Commit)',
    category: 'Data',
    plain:
      'A protocol where a coordinator first asks every database to PREPARE, then tells all of them to COMMIT - or to roll back if any said no. Guarantees that either all databases save the write or none does.',
    analogy:
      'Two accountants agreeing to publish a report together. Only if both say "ready" do they both sign; otherwise neither signs.'
  },
  {
    term: 'txn_id',
    category: 'Data',
    plain:
      'A UUID assigned to one specific transaction. The same txn_id is written to every database so we can prove the two rows belong to the same commit.'
  },
  {
    term: 'PREPARE',
    category: 'Data',
    plain:
      'Phase 1 of 2PC. The coordinator asks: "are you able to save this? yes or no."'
  },
  {
    term: 'COMMIT',
    category: 'Data',
    plain:
      'Phase 2 of 2PC. "Save it for real" - only sent if every participant said yes to PREPARE.'
  },
  {
    term: 'Rollback / ABORT',
    category: 'Data',
    plain:
      'Undo a prepared transaction. The rows are marked ABORTED instead of COMMITTED.'
  },
  {
    term: 'Race condition',
    category: 'Data',
    plain:
      'Two processes reading and writing the same data without coordination. The final value depends on timing and one update can be silently lost.',
    analogy:
      'Two people editing the same document at once. Whoever saves last overwrites the other.'
  },
  {
    term: 'Row-level lock',
    category: 'Data',
    plain:
      'A database lock on a single row. Prevents two transactions from updating the same patient at the same time.'
  },
  {
    term: 'Deadlock',
    category: 'Data',
    plain:
      'Two transactions each hold a resource the other one needs. Neither can proceed. The database detects the cycle and aborts one.',
    analogy:
      'Two cars at a 4-way stop, each waiting for the other to go first. Nobody moves.'
  },
  {
    term: 'Resource-allocation graph',
    category: 'Data',
    plain:
      'A diagram showing which transactions hold which resources and which ones are waiting. A cycle in the graph means a deadlock.'
  },

  // ---------- NETWORKING ----------
  {
    term: 'Overlay network',
    category: 'Networking',
    plain:
      'A virtual network that spans multiple physical machines. Containers on different VMs can talk as if they were on the same LAN.',
    analogy: 'A VPN - your laptop feels like it is on the office network.'
  },
  {
    term: 'Service discovery',
    category: 'Networking',
    plain:
      'Looking up a service by name (e.g. "core-1") to find its current IP. Swarm does this automatically.'
  },
  {
    term: 'DNS',
    category: 'Networking',
    plain:
      'Domain Name System - the standard way to translate a human name into an IP address.',
    analogy:
      'Your phone contacts list. You tap "Mum", the phone looks up the current number.'
  },
  {
    term: 'Ingress mesh',
    category: 'Networking',
    plain:
      "Swarm's cluster-wide port publishing. Traffic to port 4001 on any node gets routed to whichever node is running a matching task."
  },
  {
    term: 'CORS',
    category: 'Networking',
    plain:
      'Cross-Origin Resource Sharing. A browser security rule that blocks a page loaded from one domain from calling an API on another, unless the API explicitly allows it.'
  },
  {
    term: 'RPC',
    category: 'Networking',
    plain:
      'Remote Procedure Call - calling a function on another machine as if it were local.',
    analogy:
      'Dialling a restaurant and saying "give me the price of the special". You do not care which chef answers.'
  },
  {
    term: 'Proxy',
    category: 'Networking',
    plain:
      'A middle-man server. The browser calls the proxy; the proxy calls the real service and returns the answer.'
  },
  {
    term: 'Load balancer',
    category: 'Networking',
    plain:
      'A component that spreads incoming requests across multiple replicas so no single one is overwhelmed.'
  },

  // ---------- INFRASTRUCTURE ----------
  {
    term: 'Edge',
    category: 'Infrastructure',
    plain:
      'The tier nearest the data source. Fast, cheap, stateless. Handles most records without contacting Core.'
  },
  {
    term: 'Core',
    category: 'Infrastructure',
    plain:
      'The coordinating tier. Replicated for fault tolerance. Runs the ML call and the 2-phase commit.'
  },
  {
    term: 'Cloud',
    category: 'Infrastructure',
    plain:
      'The archival and batch tier. Receives summaries. Not on the real-time path.'
  },
  {
    term: 'Container',
    category: 'Infrastructure',
    plain:
      'A lightweight, isolated process packaged with its dependencies. Many containers share the same OS kernel.',
    analogy:
      'Shipping containers on a cargo ship - each one carries its own goods, they do not mix, and any ship can carry them.'
  },
  {
    term: 'Image',
    category: 'Infrastructure',
    plain:
      'A frozen snapshot of a container - the code, runtime, and dependencies. Containers are running instances of images.'
  },
  {
    term: 'Overlay config',
    category: 'Infrastructure',
    plain:
      'In Swarm, a configuration file mounted read-only into a container. Configs are immutable - to change one you must create it under a new name.'
  }
]
