#!/usr/bin/env bash
# Kills the current leader core, forcing the other replica to take over.
set -e
LEADER_1=$(curl -s http://192.168.56.11:4001/health | grep -o '"isLeader":true' || true)
if [ -n "$LEADER_1" ]; then
  echo "core-1 is leader — killing it"
  docker service scale theme5_core-1=0
  echo "waiting 12s for takeover..."
  sleep 12
  docker service scale theme5_core-1=1
else
  echo "core-2 is leader — killing it"
  docker service scale theme5_core-2=0
  echo "waiting 12s for takeover..."
  sleep 12
  docker service scale theme5_core-2=1
fi
echo "done"
