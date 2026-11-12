#!/usr/bin/env bash
set -e

echo "=== Installing Docker ==="

# Update package list
apt-get update -y

# Install prerequisites
apt-get install -y ca-certificates curl

# Use Docker's official convenience script to install everything reliably
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add vagrant user to docker group
usermod -aG docker vagrant

# Enable Docker at boot
systemctl enable docker
systemctl start docker

echo "=== Docker installed ==="
docker --version