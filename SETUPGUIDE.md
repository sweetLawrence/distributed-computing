# Theme 5 Distributed Edge Platform - Complete Setup Guide

A step-by-step guide for running this system on your own machine, from zero to a working demo. **Follow in order. Do not skip steps.**

---

## Table of Contents

1. [What You're Building](#1-what-youre-building)
2. [What You Need](#2-what-you-need)
3. [Create the First VM](#3-create-the-first-vm)
4. [Create the Second VM](#4-create-the-second-vm)
5. [Form the Docker Swarm](#5-form-the-docker-swarm)
6. [Get the Code and the Dataset](#6-get-the-code-and-the-dataset)
7. [Build and Ship the Images](#7-build-and-ship-the-images)
8. [Deploy the Stack](#8-deploy-the-stack)
9. [Verify It Works](#9-verify-it-works)
10. [Demos](#10-demos)
11. [Rebuilding After Changes](#11-rebuilding-after-changes)
12. [Troubleshooting](#12-troubleshooting)
13. [Teardown](#13-teardown)
14. [Reproducibility](#14-reproducibility)
15. [One-Command Summary](#15-one-command-summary)

---

## 1. What You're Building

A smartwear health-monitoring pipeline:

```
CSV → Device → Edge (2 replicas) → Core (2 replicas, leader elected)
                                       ↓
                                  core-ml (risk prediction)
                                       ↓
                               2PC across core-db + cloud-db
```

Plus:

- **Prometheus + Grafana** for observability
- An **nginx proxy** for CORS
- An **admin sidecar** for remote control
- A **React dashboard** that documents and drives the whole thing

> **Where everything runs:** two Ubuntu Server 22.04 VMs in VirtualBox, on your local machine. No cloud, no external services.

---

## 2. What You Need

**Hardware**

- A machine with **≥16 GB RAM** and **~120 GB free disk**
- Windows, macOS, or Linux

**Software**

- VirtualBox (latest)
- Ubuntu Server 22.04 LTS ISO - [download](https://releases.ubuntu.com/22.04/)
- Git
- A terminal (on Windows: **Git Bash** works; **WSL2** is better)

---

## 3. Create the First VM

### 3.1 New VM

Open VirtualBox → **New**:

| Field   | Value                                                   |
| ------- | ------------------------------------------------------- |
| Name    | `vm-manager`                                            |
| Type    | Linux                                                   |
| Version | Ubuntu (64-bit)                                         |
| Memory  | **8192 MB** (do not go below 4096 - services will flap) |
| CPUs    | 2                                                       |
| Disk    | **30 GB**, VDI, dynamically allocated                   |

### 3.2 Attach the ISO

Settings → **Storage** → Controller: IDE → click the empty disc → choose the Ubuntu Server ISO.

### 3.3 Network

Settings → **Network**:

| Adapter   | Attached to                                                     | Purpose                           |
| --------- | --------------------------------------------------------------- | --------------------------------- |
| Adapter 1 | **NAT**                                                         | Internet for `apt`, `docker pull` |
| Adapter 2 | **Host-only Adapter** → `VirtualBox Host-Only Ethernet Adapter` | Host ↔ VM and VM ↔ VM traffic     |

> **Note:** If the host-only adapter doesn't exist: **File → Host Network Manager → Create**. It gets an IP like `192.168.56.1`.

### 3.4 Install Ubuntu

Start the VM. In the installer:

- Language: English
- **Hostname:** `vm-manager`
- **Username:** `vboxuser`
- **Password:** pick something (you'll type it a lot)
- **Check "Install OpenSSH server"** - required for SSH later
- Skip snaps (don't install any featured snaps)
- Disk: use the entire disk

Reboot when done.

### 3.5 First Login + Static IP

Log in as `vboxuser`.

**Disable cloud-init networking** (otherwise our netplan edits get overwritten):

```bash
sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg > /dev/null <<'EOF'
network: {config: disabled}
EOF
```

**Find the interface names:**

```bash
ip -br addr
```

You'll see something like `enp0s3` (NAT) and `enp0s8` (host-only). **Use your actual names** in the file below.

**Edit the netplan config** (filename might be `00-installer-config.yaml` or `50-cloud-init.yaml` - check with `ls /etc/netplan/`):

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

Replace the contents with:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: false
      addresses: [192.168.56.11/24]
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

**Apply:**

```bash
sudo netplan apply
ip -br addr show enp0s8
```

Expected: `192.168.56.11/24`.

**Test from your host machine** (open a new terminal):

```bash
ping 192.168.56.11
```

Should reply.

### 3.6 Install Docker

On **vm-manager**:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install -y docker-compose-plugin git curl jq

# log out and back in
exit
```

Reconnect (either in the VM console or over SSH) and verify:

```bash
docker --version
docker compose version
```

Both should print versions.

**Add swap** (important - see [Troubleshooting](#services-flapping-alternating-between-11-and-01)):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 4. Create the Second VM

Shut down vm-manager:

```bash
sudo shutdown -h now
```

In VirtualBox: right-click `vm-manager` → **Clone** → **Full Clone** → name it `vm-worker-1`.

Start the clone. Change hostname and IP:

```bash
sudo hostnamectl set-hostname vm-worker-1
sudo sed -i 's/vm-manager/vm-worker-1/g' /etc/hosts
sudo sed -i 's/vm-manager/vm-worker-1/g' /etc/hostname

sudo nano /etc/netplan/50-cloud-init.yaml
# change 192.168.56.11 → 192.168.56.12

sudo netplan apply
ip -br addr show enp0s8
```

Expected: `192.168.56.12/24`.

Test from host:

```bash
ping 192.168.56.12
```

---

## 5. Form the Docker Swarm

### 5.1 On vm-manager

```bash
docker swarm init --advertise-addr 192.168.56.11
```

Copy the `docker swarm join --token ...` line it prints.

### 5.2 On vm-worker-1

Paste that join command. You should see:

```
This node joined a swarm as a worker.
```

### 5.3 Back on vm-manager

Label the nodes so services land where we want:

```bash
docker node ls
# note the HOSTNAME column values

docker node update --label-add manager=true    vm-manager
docker node update --label-add core-side=true  vm-manager
docker node update --label-add cloud-side=true vm-worker-1

docker node ls --format 'table {{.Hostname}}\t{{.Status}}\t{{.Availability}}'
```

Both nodes should be **Ready / Active**.

---

## 6. Get the Code and the Dataset

### 6.1 Clone the Repo

On **vm-manager**:

```bash
cd ~
git clone <YOUR-REPO-URL> distributed-edge-platform
cd distributed-edge-platform
```

> If your repo isn't public, `scp` the folder from your host instead.

### 6.2 Provide the Dataset

The CSV is **not** committed (too large). Place it here:

```
~/distributed-edge-platform/data/smartwear_health_monitoring_dataset.csv
```

Required columns (order matters):

```
patient_id,age,gender,bmi,smoking_status,alcohol_consumption,
heart_rate,systolic_bp,diastolic_bp,respiratory_rate
```

If you don't have the dataset, ask the project owner for a copy, or see the `README.md` for a link.

### 6.3 Distribute the Repo to the Worker

The worker needs the same files. On **vm-manager**:

```bash
scp -r ~/distributed-edge-platform vboxuser@192.168.56.12:~/distributed-edge-platform
```

---

## 7. Build and Ship the Images

> Swarm does **not** build images. Build on the manager, then copy them to the worker.

### 7.1 On vm-manager

```bash
cd ~/distributed-edge-platform

docker build -t dep-device:latest    ./services/device
docker build -t dep-edge:latest      ./services/edge
docker build -t dep-core:latest      ./services/core
docker build -t dep-cloud:latest     ./services/cloud
docker build -t dep-core-ml:latest   ./services/core-ml
docker build -t dep-admin:latest     ./services/admin
```

The `core-ml` build takes a few minutes (scikit-learn, pandas, numpy). Others are fast.

### 7.2 Ship to Worker

```bash
for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
  docker save $img:latest -o /tmp/$img.tar
  scp /tmp/$img.tar vboxuser@192.168.56.12:/tmp/
done
```

### 7.3 Load on Worker

SSH into vm-worker-1:

```bash
ssh vboxuser@192.168.56.12
for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
  docker load -i /tmp/$img.tar
done
docker images | grep dep-
```

You should see all six.

---

## 8. Deploy the Stack

On **vm-manager**:

```bash
cd ~/distributed-edge-platform
docker stack deploy -c infra/docker-stack.yml theme5
sleep 90
docker stack services theme5
```

Expected: **15 services**, all `1/1` or `2/2`:

| Service             | Replicas |
| ------------------- | -------- |
| `theme5_admin`      | 1/1      |
| `theme5_cadvisor`   | 2/2      |
| `theme5_cloud`      | 1/1      |
| `theme5_cloud-db`   | 1/1      |
| `theme5_core-1`     | 1/1      |
| `theme5_core-2`     | 1/1      |
| `theme5_core-db`    | 1/1      |
| `theme5_core-ml`    | 1/1      |
| `theme5_device`     | 1/1      |
| `theme5_edge`       | 2/2      |
| `theme5_grafana`    | 1/1      |
| `theme5_nginx-edge` | 1/1      |
| `theme5_prometheus` | 1/1      |
| `theme5_proxy`      | 1/1      |
| `theme5_redis`      | 1/1      |

> **Warning:** If any show `0/1` after 2 minutes, see [Troubleshooting](#12-troubleshooting).

---

## 9. Verify It Works

### 9.1 Health Checks

From vm-manager:

```bash
curl -s http://localhost:3000/health; echo
curl -s http://localhost:3001/health; echo
curl -s http://localhost:4001/health | head -c 250; echo
curl -s http://localhost:4002/health | head -c 250; echo
curl -s http://localhost:5000/health; echo
curl -s http://localhost:8090/proxy-health; echo
curl -s http://localhost:8090/admin/health; echo
curl -s http://localhost:9090/api/v1/targets | grep -oE '"health":"[a-z]+"' | sort | uniq -c
```

You should see `"status":"ok"` everywhere, and `8 "health":"up"` at the end.

### 9.2 Stream a Batch

```bash
curl -X POST http://localhost:3000/stats/reset
curl -X POST http://localhost:3000/start
sleep 50
curl -s http://localhost:3000/stats; echo
```

Expected: `sent=200, ok=200, err=0`, with `p50` around 5–15 ms.

### 9.3 Check Both Databases

On vm-manager:

```bash
CORE_DB=$(docker ps --format '{{.Names}}' | grep -m1 theme5_core-db)
docker exec "$CORE_DB" psql -U core -d core -c "SELECT status, COUNT(*) FROM core_records GROUP BY status;"
```

SSH into the worker:

```bash
ssh vboxuser@192.168.56.12
CLOUD_DB=$(docker ps --format '{{.Names}}' | grep -m1 theme5_cloud-db)
docker exec "$CLOUD_DB" psql -U cloud -d cloud -c "SELECT status, COUNT(*) FROM cloud_summaries GROUP BY status;"
```

> **The `COMMITTED` counts must match. That's the 2PC guarantee.**

### 9.4 Grafana

From your host browser: <http://192.168.56.11:3030>

Login: **admin** / **admin**

- Connections → Data sources → Prometheus → should show **green**
- Dashboards → **Theme 5** → panels should show data after a batch

### 9.5 React Dashboard

On your **host machine** (not the VM):

```bash
cd distributed-edge-platform/frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Every tab should work:

| Tab        | What it does          |
| ---------- | --------------------- |
| Overview   | Shows live services   |
| Milestones | Explains the system   |
| Playground | Fires real requests   |
| Control    | Shows nodes           |
| Failures   | Documents the results |
| Capstone   | Documents the results |

> If the API base URLs in `frontend/public/config.json` don't match your VM IPs, edit that file.

---

## 10. Demos

### 10.1 Kill cloud-db - 2PC Abort

On vm-manager:

```bash
docker service scale theme5_cloud-db=0

curl -X POST http://localhost:3000/stats/reset
curl -X POST http://localhost:3000/start
sleep 30

CORE_DB=$(docker ps --format '{{.Names}}' | grep -m1 theme5_core-db)
docker exec "$CORE_DB" psql -U core -d core -c "SELECT status, COUNT(*) FROM core_records GROUP BY status;"
# ABORTED count increases, COMMITTED frozen

docker service scale theme5_cloud-db=1
sleep 15
```

Watch Grafana → **2PC Transactions** panel shows ABORT rising.

### 10.2 Kill the Leader - Failover

```bash
curl -s http://localhost:4001/health | grep isLeader
curl -s http://localhost:4002/health | grep isLeader

# kill the one that says isLeader:true
docker service scale theme5_core-1=0
sleep 12
docker service scale theme5_core-1=1

sleep 10
curl -s http://localhost:4002/health | grep isLeader
# now the other one is leader
```

### 10.3 Full Demo Scripts

The repo ships with these scripts (run them from vm-manager):

| Script                     | What it does                              |
| -------------------------- | ----------------------------------------- |
| `scripts/kill-core.sh`     | Kills the current leader, waits, restores |
| `scripts/kill-cloud-db.sh` | Same pattern for the database             |
| `scripts/migrate-core.sh`  | Forces core-1 to reschedule               |

---

## 11. Rebuilding After Changes

If you edit any source file:

```bash
# on vm-manager
cd ~/distributed-edge-platform

# rebuild only what changed, e.g.:
docker build -t dep-core:latest ./services/core

# ship to worker
docker save dep-core:latest -o /tmp/dep-core.tar
scp /tmp/dep-core.tar vboxuser@192.168.56.12:/tmp/

# on worker
ssh vboxuser@192.168.56.12 "docker load -i /tmp/dep-core.tar"

# force update the service
docker service update --image dep-core:latest --force theme5_core-1
docker service update --image dep-core:latest --force theme5_core-2
```

---

## 12. Troubleshooting

### Services stuck at `0/1`

```bash
docker service ps theme5_<service> --no-trunc | head -5
docker service logs theme5_<service> --tail 30
```

Common causes:

- **`no suitable node`** - the node label the service needs is missing. Check `docker node inspect <node> --format '{{json .Spec.Labels}}'`.
- **`image not found`** - the image wasn't shipped to the node where the task landed. Run `docker load` on that node.
- **Container exits immediately** - read the logs. Usually a missing env var or DB connection failure at startup.

### Services flapping (alternating between `1/1` and `0/1`)

You are out of RAM. Check `free -h` and `docker stats --no-stream`.

**Fix:** increase VM RAM in VirtualBox and add swap (section [3.6](#36-install-docker)).

### `network theme5_appnet not found` when deploying

Swarm left a phantom network reference. Reset:

```bash
docker stack rm theme5
sleep 20
docker network prune -f
docker swarm leave --force
docker swarm init --advertise-addr 192.168.56.11
# rejoin worker, re-label nodes, redeploy
```

### DNS resolution fails inside containers

The worker node may have dropped out of the swarm. Check `docker node ls` on the manager. If a node shows `Down`, restart Docker on that node:

```bash
sudo systemctl restart docker
```

If that doesn't fix it, run `docker swarm leave --force` on the worker and rejoin.

### Port already in use

```bash
sudo ss -tlnp | grep -E ':(3000|3001|4001|4002|5000|6000|8080|8090|9090|3030)'
```

Kill whatever is holding the port, or stop the stack (`docker stack rm theme5`).

### `docker service` commands fail on the worker

You're on a worker node. `docker service` only works on managers. SSH back to vm-manager.

### Grafana shows "Datasource not found"

The Grafana volume has a stale datasource record. Wipe it:

```bash
docker service scale theme5_grafana=0
sleep 10
docker volume rm theme5_grafana-data 2>/dev/null
ssh vboxuser@192.168.56.12 "docker volume rm theme5_grafana-data 2>/dev/null"
docker service scale theme5_grafana=1
```

---

## 13. Teardown

Stop everything:

```bash
docker stack rm theme5
sleep 30
```

Volumes survive. To also delete data:

```bash
docker volume rm theme5_core-db-data theme5_cloud-db-data theme5_grafana-data
```

Remove the swarm:

```bash
docker swarm leave --force
```

On the worker: same command.

---

## 14. Reproducibility

For the record, this is what a second researcher needs:

| Item           | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| **OS**         | Ubuntu Server 22.04 LTS                                             |
| **Runtime**    | Docker Engine 29.x with Swarm mode                                  |
| **Language**   | Node.js 20 (services), Python 3.11 (ML)                             |
| **Databases**  | PostgreSQL 16 (two instances), Redis 7                              |
| **ML**         | scikit-learn IsolationForest, trained on 20 000 CSV rows            |
| **Monitoring** | Prometheus, Grafana, cAdvisor                                       |
| **Frontend**   | React 18 + Vite + Mantine + Tailwind                                |
| **Dataset**    | `smartwear_health_monitoring_dataset.csv`, 120 000 rows, 10 columns |
| **Network**    | Host-only 192.168.56.0/24                                           |
| **VMs**        | 2 vCPU, 8 GB RAM, 30 GB disk each                                   |

Every measured result in this project is reproducible from this document plus the shipped source code.

---

## 15. One-Command Summary

For the impatient:

```bash
# --- on your host: create 2 VMs (192.168.56.11, 192.168.56.12) with Ubuntu 22.04 + Docker ---
# --- on vm-manager ---
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

docker swarm init --advertise-addr 192.168.56.11
# paste join token on vm-worker-1

docker node update --label-add manager=true    vm-manager
docker node update --label-add core-side=true  vm-manager
docker node update --label-add cloud-side=true vm-worker-1

git clone <repo> ~/distributed-edge-platform
cd ~/distributed-edge-platform
# place the CSV at data/smartwear_health_monitoring_dataset.csv

for s in device edge core cloud core-ml admin; do
  docker build -t dep-$s:latest ./services/$s
done

for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do
  docker save $img:latest -o /tmp/$img.tar
  scp /tmp/$img.tar vboxuser@192.168.56.12:/tmp/
done

ssh vboxuser@192.168.56.12 'for img in dep-device dep-edge dep-core dep-cloud dep-core-ml dep-admin; do docker load -i /tmp/$img.tar; done'

docker stack deploy -c infra/docker-stack.yml theme5
sleep 90
docker stack services theme5
```

Then from the host:

```bash
cd ~/distributed-edge-platform/frontend
npm install
npm run dev
# open http://localhost:5173
```

If anything breaks, [section 12](#12-troubleshooting) has the fixes.
