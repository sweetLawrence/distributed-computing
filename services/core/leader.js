const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
});

const REPLICA_ID = process.env.REPLICA_ID;
const LEADER_KEY = 'core:leader';
const LEADER_TTL_MS = parseInt(process.env.LEADER_TTL_MS || '10000', 10);

let isLeader = false;
let electionMessages = 0;

async function tryAcquire() {
  electionMessages++;
  const ok = await redis.set(LEADER_KEY, REPLICA_ID, 'PX', LEADER_TTL_MS, 'NX');
  if (ok === 'OK') {
    if (!isLeader) console.log(`[core:${REPLICA_ID}] BECAME LEADER (msg=${electionMessages})`);
    isLeader = true;
    return true;
  }
  // someone else holds the lock — am I renewing or not?
  const holder = await redis.get(LEADER_KEY);
  if (holder === REPLICA_ID) {
    await redis.pexpire(LEADER_KEY, LEADER_TTL_MS);
    isLeader = true;
    return true;
  }
  if (isLeader) console.log(`[core:${REPLICA_ID}] LOST LEADERSHIP to ${holder}`);
  isLeader = false;
  return false;
}

// Lamport clock
let lamport = 0;
function tick() { lamport += 1; return lamport; }
function observe(incoming) { lamport = Math.max(lamport, incoming) + 1; return lamport; }

async function start() {
  // try immediately, then every TTL/3
  await tryAcquire();
  setInterval(tryAcquire, Math.floor(LEADER_TTL_MS / 3));
}

module.exports = { start, isLeader: () => isLeader, tick, observe, getElectionMessages: () => electionMessages, redis };
