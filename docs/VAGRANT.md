# Quick start with Vagrant

This spins up the full three-VM Docker Swarm in about ten minutes.

## Prerequisites

- **VirtualBox** (any recent version) — https://www.virtualbox.org/
- **Vagrant** — https://developer.hashicorp.com/vagrant/downloads
- At least **16 GB free RAM** on your machine (the VMs run with 4 GB each)
- At least **30 GB free disk**

If your machine has less than 16 GB RAM, use the single-node fallback instead (see `docs/SINGLE_NODE.md`).

## Step 1 — Install Vagrant

Download and install Vagrant for your OS from https://developer.hashicorp.com/vagrant/downloads

Verify it installed:

    vagrant --version

You should see a version number like `Vagrant 2.4.x`.

## Step 2 — Clone the repository

    git clone https://github.com/sweetLawrence/distributed-computing.git
    cd distributed-computing

## Step 3 — Bring up the cluster

    vagrant up

First time this takes 10–15 minutes (it downloads an Ubuntu image, creates three VMs, installs Docker on each, and forms the swarm).

You will see output from each VM as it provisions. Wait until Vagrant returns to the prompt.

## Step 4 — Verify the cluster

    vagrant ssh manager -c "docker node ls"

You should see three nodes, all `Ready`, one of them the `Leader`.

## Step 5 — Deploy the stack

    vagrant ssh manager -c "cd /vagrant && docker stack deploy -c infra/docker-stack.yml theme5"

Wait about 90 seconds, then check:

    vagrant ssh manager -c "docker stack services theme5"

You should see 15 services, all `1/1` or `2/2`.

## Step 6 — Access the services

From your host machine (not inside a VM):

- Device health:  http://192.168.56.11:3000/health
- Edge health:    http://192.168.56.11:3001/health
- Core-1 health:  http://192.168.56.11:4001/health
- Core-2 health:  http://192.168.56.11:4002/health
- ML health:      http://192.168.56.11:5000/health
- Proxy:          http://192.168.56.11:8090/proxy-health
- Prometheus:     http://192.168.56.11:9090
- Grafana:        http://192.168.56.11:3030   (login: admin / admin)

## Stopping and restarting

    # Stop the VMs (keeps them on disk)
    vagrant halt

    # Start them again
    vagrant up

    # Destroy everything and start fresh
    vagrant destroy -f
    vagrant up

## Common issues

**"Vagrant was unable to mount VirtualBox shared folders"**
Run `vagrant reload`.

**"A Vagrant environment or target machine is required to run this command"**
You are not in the repository directory. Run `cd distributed-computing` first.

**"The IP address 192.168.56.11 is not available"**
Another VM on your machine is using the same IP. In VirtualBox, check that no other VM has an adapter on 192.168.56.x.

**"vagrant up" hangs at "Waiting for machine to boot"**
The VM is booting slowly. Wait longer. If it hangs for more than 5 minutes, run `vagrant reload`.

**Services show 0/1 after deploy**
Wait 60 more seconds. Some services (core-ml especially) take time to start. Check with:

    vagrant ssh manager -c "docker stack services theme5"

If a service is still 0/1 after 2 minutes:

    vagrant ssh manager -c "docker service ps theme5_<service-name> --no-trunc"

That will show the error.

## Where the code lives

Inside the VMs, the repository is mounted at `/vagrant`. That means you can edit files on your host and see them inside the VM immediately. No need to re-clone or copy.

To rebuild a service after editing:

    vagrant ssh manager
    cd /vagrant
    docker build -t dep-core:latest ./services/core
    docker service update --image dep-core:latest --force theme5_core-1
    docker service update --image dep-core:latest --force theme5_core-2

## What is provisioned

The Vagrantfile creates:

| VM | IP | RAM | Role |
|---|---|---|---|
| manager | 192.168.56.11 | 4 GB | Swarm manager, runs core-side services |
| worker-1 | 192.168.56.12 | 4 GB | Swarm worker, runs cloud-side services |
| worker-2 | 192.168.56.13 | 4 GB | Swarm worker, runs worker2 services |

Each VM is Ubuntu 22.04 LTS with Docker Engine preinstalled and Swarm configured.