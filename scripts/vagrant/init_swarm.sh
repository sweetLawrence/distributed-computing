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

echo "=== Swarm initialised ==="
docker node ls

# Background process to wait for workers and label them
nohup bash -c '
  for i in {1..60}; do
    if docker node ls | grep -q "worker-1"; then
      docker node update --label-add cloud-side=true worker-1
    fi
    if docker node ls | grep -q "worker-2"; then
      docker node update --label-add worker2=true worker-2
    fi
    if docker node inspect worker-1 | grep -q "cloud-side" && docker node inspect worker-2 | grep -q "worker2"; then
      break
    fi
    sleep 2
  done
' > /vagrant/worker-labels.log 2>&1 &