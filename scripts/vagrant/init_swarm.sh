#!/usr/bin/env bash
set -e

echo "=== Initialising Swarm on manager ==="

if ! docker info | grep -q "Swarm: active"; then
  docker swarm init --advertise-addr 192.168.56.11
fi

docker swarm join-token worker -q > /vagrant/.swarm-worker-token
chmod 644 /vagrant/.swarm-worker-token

docker node update --label-add manager=true manager
docker node update --label-add core-side=true manager

echo "=== Waiting for workers to join and labeling them ==="

# Wait up to 3 minutes for the workers to join
for i in {1..36}; do
  if docker node ls | grep -q "worker-1" && docker node ls | grep -q "worker-2"; then
    echo "Workers have joined! Applying labels..."
    docker node update --label-add cloud-side=true worker-1
    docker node update --label-add worker2=true worker-2
    break
  fi
  echo "Waiting for workers... ($i/36)"
  sleep 5
done

echo "=== Swarm initialised ==="
docker node ls