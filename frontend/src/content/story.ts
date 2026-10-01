export interface Story {
  id: string // "M1".."M12"
  title: string // human name
  oneLiner: string // short teaser
  narration: string[] // paragraph(s), light and descriptive
  keyIdea: string // single-sentence takeaway
}

export const STORIES: Story[] = [
  {
    id: 'M1',
    title: 'The cluster wakes up',
    oneLiner: 'Three machines discover each other and agree to work as one.',
    narration: [
      'Three virtual machines sit next to each other on a private network. None of them knows about the others yet.',
      'Then the first one raises a hand and says: "I am the manager." It hands the other two a secret token, and they reply: "We are your workers." The swarm is born.',
      'Each machine is now given a role - one carries the core services, one carries the cloud side, one just helps out. When a service needs to run, the manager consults these roles and places it exactly where it belongs.',
      'From this moment on, a request that lands on any machine can reach any service, no matter which box it actually lives on. Three machines. One logical computer.'
    ],
    keyIdea: 'A distributed OS makes many machines look like one.'
  },
  {
    id: 'M2',
    title: 'Measuring how fast we are',
    oneLiner: 'We time every request and count how often the system keeps up.',
    narration: [
      'The device reads rows from a CSV and sends them into the pipeline. Every step records the moment it received the record and the moment it replied.',
      'When the run finishes, we look at the numbers. Half the requests finished in under 13 milliseconds. Ninety-five percent finished within 94 ms. Only one in a hundred ever went above 215 ms.',
      'That difference between the fastest and slowest is called jitter. If you are a user, the p99 number is the one that matters most - that is what the unluckiest visitor experienced.',
      'Packet loss here is simply how many requests never got an answer. Ours is zero.'
    ],
    keyIdea:
      'Latency is how long one request took; throughput is how many finished; jitter is how much the time varies.'
  },
  {
    id: 'M3',
    title: 'Small teams, not one big factory',
    oneLiner:
      'The system is built as many small services instead of one giant program.',
    narration: [
      'Imagine a single factory that does everything: it takes orders, cooks, packs, ships, and handles complaints. If one part breaks, the whole factory stops.',
      'Now imagine a street of small shops. The baker only bakes. The butcher only cuts. The courier only delivers. If the baker is slow, the butcher keeps selling.',
      'Our system is the street of shops. Device, Edge, Core, ML, Cloud - each owns one job, each can be restarted without touching the others, each can even be scaled up or down on its own.',
      'The trick is that they all speak the same language: the network. That is what makes them a system rather than a pile of programs.'
    ],
    keyIdea:
      'Microservices trade simplicity for resilience and independent growth.'
  },
  {
    id: 'M4',
    title: 'One leader at a time',
    oneLiner:
      'Two core replicas take turns being in charge - and the handover is instant.',
    narration: [
      'Two core replicas run side by side. Both could handle requests, but if both wrote to the database at once, they would overwrite each other. So they agree on one rule: only one of us is in charge.',
      'The rule is enforced by a small lock in Redis. Whoever grabs it becomes leader. The other stands by, watching.',
      'When the leader dies - a crash, a restart, a network hiccup - the lock expires. The other replica notices and takes over. Requests never stop flowing, they just start flowing to the new leader.',
      'Our measured failover: about 13 seconds from the moment the leader was killed to the moment the other replica was serving writes. No errors were seen by any client.'
    ],
    keyIdea:
      'Distributed systems elect one coordinator so writes never conflict.'
  },
  {
    id: 'M5',
    title: 'Both databases or neither',
    oneLiner:
      'A flagged record has to land in two databases - and it either lands in both or in none.',
    narration: [
      'When a health record is flagged, the leader sends it to two databases at once: one stores the full record, the other stores a summary. Two separate machines, two separate disks.',
      'If both agree to save it, the leader tells them both to commit. The record exists in both places. Success.',
      'But what if the second database is unreachable? The leader cannot just save one half - that would leave the system inconsistent forever. So it asks the first database to roll back too. Both sides stay in agreement.',
      'We tested this by killing the second database mid-run. Fifty-two records had been aborted in earlier tests. Our new record became number fifty-three - aborted on both sides. Not a single half-written row.',
      'That is the guarantee people call two-phase commit.'
    ],
    keyIdea: '2PC keeps two databases in step, even across failures.'
  },
  {
    id: 'M6',
    title: 'Two writers, one row',
    oneLiner:
      'Two requests try to update the same patient at the same time - and only one wins.',
    narration: [
      "Two requests arrive at the same moment, both intending to add one point to a patient's risk score. Without any coordination, both read the old score, both add one, both write it back. The result: the score went up by one, not two.",
      'That is called a race condition - the final value depends on who wrote last, and one update vanished into thin air.',
      'Our fix is a row lock. When the first request starts, it locks the row. The second request waits until the lock is released, then reads the fresh value. This time the score goes up by two, exactly as it should.',
      'We also manufactured a deadlock on purpose - two requests each holding a lock the other one wanted. The database detected the cycle, aborted one, and let the other through. That is not a bug; that is the system healing itself.'
    ],
    keyIdea: 'Locks prevent lost updates; detectors break deadlocks.'
  },
  {
    id: 'M7',
    title: 'Watching for trouble',
    oneLiner:
      'The edge constantly checks the core. When one goes quiet, traffic moves on.',
    narration: [
      'The edge does not trust the core to tell it when it is struggling. Every three seconds it sends a quiet ping: "are you alive?"',
      'Two missed pings in a row and the edge makes a decision: this replica is dead. Stop sending traffic to it.',
      'We killed core-2 to test this. The edge took about thirteen seconds to notice. In that window, requests were still flowing to the other replica, so nothing failed.',
      'When core-2 came back, the edge saw it, marked it alive again, and resumed routing. Availability during the whole episode stayed above ninety-four percent.'
    ],
    keyIdea: 'Watchdogs detect failures automatically so humans do not have to.'
  },
  {
    id: 'M8',
    title: 'Choosing the right shape',
    oneLiner:
      'Five classic ways to organise distributed systems - and why we picked one.',
    narration: [
      'There is more than one way to build a distributed system. One big powerful machine with thin clients. A pool of CPUs. A workstation model where idle machines help out. A server-based model with dedicated servers. Or an integrated model where services are autonomous but still coordinated.',
      'We chose the integrated model because our workloads are genuinely different. Edge work is fast and stateless. Core work is slow and stateful. Cloud work is asynchronous and batchy.',
      'An integrated model lets each of those live in its own container, with its own scaling, its own restart policy, its own resource limits - while still agreeing on the same network and the same naming.'
    ],
    keyIdea: 'Match the architecture to how your workloads actually differ.'
  },
  {
    id: 'M9',
    title: 'Moving without anyone noticing',
    oneLiner:
      'We move a service to a new machine while clients keep talking to it.',
    narration: [
      'In a traditional system, moving a service means downtime. Clients have to know the new address, retry, or wait.',
      'Here, we forced core-1 to restart. Swarm killed the container and started a new one, possibly on a different node. The IP changed. The process ID changed. The physical machine may have changed.',
      'The client saw none of it. It kept calling "core-1" by name. The swarm DNS kept resolving that name to whatever IP was current. Retries happened invisibly.',
      'That is migration transparency: the system moves, and the outside world does not.'
    ],
    keyIdea: 'Name-based access hides the physical reality underneath.'
  },
  {
    id: 'M10',
    title: 'Names, not numbers',
    oneLiner: 'Everything talks by name. The system figures out the address.',
    narration: [
      'No service hardcodes an IP address. There are no configuration files full of "192.168.56.12:4000". Instead, every service says: I need to reach "core-db", or "redis", or "core-ml".',
      'Docker maintains an internal DNS that answers these names. Inside any container, if you ask "where is core-db?", the answer comes back instantly: 10.0.1.2. Ask again from another container, and the answer is the same. Ask a container on a different machine, and it still works - the overlay network spans them all.',
      'We proved this by running nslookup inside a container. Every service resolved. No hardcoded addresses. No manual configuration. Just names.'
    ],
    keyIdea:
      'Distributed naming lets services find each other without hard-coded addresses.'
  },
  {
    id: 'M11',
    title: 'Calling a function on another machine',
    oneLiner:
      'Core asks the ML service for a risk score - and remembers the answer.',
    narration: [
      'When a flagged record arrives, core needs a risk score. It does not compute this itself - it sends a small request over the network to core-ml, which runs an IsolationForest model trained on twenty thousand rows of the dataset.',
      'The call looks like a normal function: give me the risk probability of this patient. But underneath, that request is travelling across the overlay network, entering a different container, running in a different language (Python instead of Node), and coming back.',
      "We also added a shared memory layer: Redis. The first time a patient's score is computed, it is stored in Redis. If the same patient appears again within a minute, any replica can read it straight from the cache instead of calling ML again.",
      'Two replicas, one cache. That is distributed shared state.'
    ],
    keyIdea: 'RPC and shared caches make many machines behave like one.'
  },
  {
    id: 'M12',
    title: 'Everything together',
    oneLiner:
      'The final system, and the number that proves it is better than the baseline.',
    narration: [
      'Every piece we built now runs together: device streams the data, edge filters it, core coordinates it, ML scores it, two databases commit it, and the whole stack is monitored live.',
      'We ran the same workload twice. In the baseline, every record went to core. In the proposed version, most records stopped at the edge.',
      'The proposed version reduced core load by eighty-eight percent. Median latency dropped from fifty-four milliseconds to seven. The slow tail - the requests that the unluckiest users noticed - shrank from two hundred and fifty-nine milliseconds to sixty-six.',
      'Same dataset. Same hardware. Different architecture. Better results at every level.'
    ],
    keyIdea:
      'Edge-side placement is the improvement over a naive all-to-core design.'
  }
]
