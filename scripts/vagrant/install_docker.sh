#!/usr/bin/env bash
# Installs Docker Engine, Compose plugin, and adds the vagrant user to the docker group.
set -e

echo "=== Installing Docker ==="

# Update package list
apt-get update -y

# Install prerequisites
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker's apt repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add vagrant user to docker group
usermod -aG docker vagrant

# Enable Docker at boot
systemctl enable docker
systemctl start docker

echo "=== Docker installed ==="
docker --version