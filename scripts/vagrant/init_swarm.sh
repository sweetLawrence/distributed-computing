#!/usr/bin/env bash
# Initialises the Swarm on the manager and stores the join token where workers can read it.
set -e

echo "=== Initialising Swarm on manager ==="

# Init the swarm (idempotent — skips if already a manager)
if ! docker info | grep -q "Swarm: active"; then
  docker swarm init --advertise-addr 192.168.56.11
fi

# Save the worker join token to a file shared with the other VMs
docker swarm join-token worker -q > /vagrant/.swarm-worker-token
chmod 644 /vagrant/.swarm-worker-token

echo "=== Swarm initialised ==="
docker node ls