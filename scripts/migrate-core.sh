#!/usr/bin/env bash
# Forces core-1 to be rescheduled (may move to the other node).
set -e
echo "forcing reschedule of core-1..."
docker service update --force theme5_core-1
sleep 10
docker service ps theme5_core-1 --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}' | head -3
