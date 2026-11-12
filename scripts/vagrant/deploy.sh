# #!/usr/bin/env bash
# set -e

# # We only run this on the manager
# if [ "$(hostname)" != "manager" ]; then
#   exit 0
# fi

# echo "=== Building Images ==="
# cd /vagrant
# docker build -t dep-device:latest    ./services/device
# docker build -t dep-edge:latest      ./services/edge
# docker build -t dep-core:latest      ./services/core
# docker build -t dep-cloud:latest     ./services/cloud
# docker build -t dep-core-ml:latest   ./services/core-ml
# docker build -t dep-admin:latest     ./services/admin

# echo "=== Distributing Images to Workers ==="
# # Wait a moment for workers to be fully ready
# sleep 10

# for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
#   docker save $img:latest -o /tmp/$img.tar
  
#   # Copy to worker-1
#   scp -i /home/vagrant/.ssh/id_rsa -o StrictHostKeyChecking=no /tmp/$img.tar vagrant@192.168.56.12:/tmp/ || true
  
#   # Copy to worker-2
#   scp -i /home/vagrant/.ssh/id_rsa -o StrictHostKeyChecking=no /tmp/$img.tar vagrant@192.168.56.13:/tmp/ || true
# done

# echo "=== Waiting for workers to finish booting and load images ==="
# # Wait for workers to finish their vagrant provisioning
# sleep 60

# echo "=== Deploying Stack ==="
# docker stack deploy -c infra/docker-stack.yml theme5






#!/usr/bin/env bash
set -e

echo "=== Building Images ==="
cd /vagrant

docker build -t localhost:5050/dep-device:latest    ./services/device
docker build -t localhost:5050/dep-edge:latest      ./services/edge
docker build -t localhost:5050/dep-core:latest      ./services/core
docker build -t localhost:5050/dep-cloud:latest     ./services/cloud
docker build -t localhost:5050/dep-core-ml:latest   ./services/core-ml
docker build -t localhost:5050/dep-admin:latest     ./services/admin

echo "=== Pushing Images to Registry ==="
for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
  docker push localhost:5050/$img:latest
done

echo "=== Deploying Stack ==="
docker stack deploy -c infra/docker-stack.yml theme5