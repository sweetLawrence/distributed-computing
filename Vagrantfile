# -*- mode: ruby -*-
# vi: set ft=ruby :

# Three-node Docker Swarm for the distributed edge platform.
# Run `vagrant up` once. The cluster is ready in 10-15 minutes.
#
# VMs:
#   manager   192.168.56.11   Swarm manager
#   worker-1  192.168.56.12   Swarm worker
#   worker-2  192.168.56.13   Swarm worker

Vagrant.configure("2") do |config|

  config.vm.box = "ubuntu/jammy64"
  config.vm.synced_folder ".", "/vagrant", disabled: false

  # ---------- manager ----------
  config.vm.define "manager" do |m|
    m.vm.hostname = "manager"
    m.vm.network "private_network", ip: "192.168.56.11"

    m.vm.provider "virtualbox" do |vb|
      vb.name   = "dist-manager"
      vb.memory = 4096
      vb.cpus   = 2
    end

    m.vm.provision "shell", path: "scripts/vagrant/install_docker.sh"
    m.vm.provision "shell", path: "scripts/vagrant/init_swarm.sh"
    m.vm.provision "shell", inline: "docker node update --label-add manager=true    manager"
    m.vm.provision "shell", inline: "docker node update --label-add core-side=true  manager"
  end

  # ---------- worker-1 ----------
  config.vm.define "worker-1" do |w|
    w.vm.hostname = "worker-1"
    w.vm.network "private_network", ip: "192.168.56.12"

    w.vm.provider "virtualbox" do |vb|
      vb.name   = "dist-worker-1"
      vb.memory = 4096
      vb.cpus   = 2
    end

    w.vm.provision "shell", path: "scripts/vagrant/install_docker.sh"
    w.vm.provision "shell", path: "scripts/vagrant/join_swarm.sh", args: ["192.168.56.11"]
    w.vm.provision "shell", inline: "docker node update --label-add cloud-side=true worker-1"
  end

  # ---------- worker-2 ----------
  config.vm.define "worker-2" do |w|
    w.vm.hostname = "worker-2"
    w.vm.network "private_network", ip: "192.168.56.13"

    w.vm.provider "virtualbox" do |vb|
      vb.name   = "dist-worker-2"
      vb.memory = 4096
      vb.cpus   = 2
    end

    w.vm.provision "shell", path: "scripts/vagrant/install_docker.sh"
    w.vm.provision "shell", path: "scripts/vagrant/join_swarm.sh", args: ["192.168.56.11"]
    w.vm.provision "shell", inline: "docker node update --label-add worker2=true worker-2"
  end

end