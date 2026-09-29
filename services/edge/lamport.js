let lamport = 0;
function tick() { lamport += 1; return lamport; }
function observe(incoming) { lamport = Math.max(lamport, incoming || 0) + 1; return lamport; }
module.exports = { tick, observe };
