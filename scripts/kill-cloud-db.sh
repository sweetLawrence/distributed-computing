#!/usr/bin/env bash
# Kills cloud-db for 30s, forcing all 2PCs to abort. Then restores.
set -e
echo "killing cloud-db..."
docker service scale theme5_cloud-db=0
sleep 30
echo "restoring cloud-db..."
docker service scale theme5_cloud-db=1
sleep 15
echo "done"
