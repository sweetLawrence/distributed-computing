#!/usr/bin/env bash
# Joins this node to the Swarm using the token saved by the manager.
set -e

MANAGER_IP="${1:-192.168.56.11}"
TOKEN_FILE="/vagrant/.swarm-worker-token"

echo "=== Joining Swarm at $MANAGER_IP ==="

# Wait for the token file to appear (the manager writes it during provisioning)
for i in $(seq 1 60); do
  if [ -s "$TOKEN_FILE" ]; then
    break
  fi
  echo "Waiting for join token... ($i/60)"
  sleep 5
done

if [ ! -s "$TOKEN_FILE" ]; then
  echo "ERROR: join token not found after 5 minutes"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

# Join the swarm (idempotent — skips if already a worker)
if docker info | grep -q "Swarm: active"; then
  echo "Already in a swarm, skipping join"
else
  docker swarm join --token "$TOKEN" "$MANAGER_IP:2377"
fi

echo "=== Joined Swarm ==="


# ... existing join swarm code ...

echo "=== Loading Images from manager ==="
sleep 40 # Wait for manager to copy the images

for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
  if [ -f /tmp/$img.tar ]; then
    docker load -i /tmp/$img.tar
  fi
done
echo "=== Images loaded ==="