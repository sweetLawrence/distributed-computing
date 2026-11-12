# -*- mode: ruby -*-
# vi: set ft=ruby :

NODES = [
  { name: "manager",  ip: "192.168.56.11", memory: 4096, cpus: 2 },
  { name: "worker-1", ip: "192.168.56.12", memory: 2048, cpus: 2 },
  { name: "worker-2", ip: "192.168.56.13", memory: 2048, cpus: 2 },
]

Vagrant.configure("2") do |config|

  config.vm.box = "ubuntu/jammy64"
  config.vm.boot_timeout = 600
  config.vm.synced_folder ".", "/vagrant", disabled: false

  NODES.each do |node|
    config.vm.define node[:name] do |n|
      n.vm.hostname = node[:name]
      n.vm.network "private_network", ip: node[:ip]

      n.vm.provider "virtualbox" do |vb|
        vb.name   = "dist-#{node[:name]}"
        vb.memory = node[:memory]
        vb.cpus   = node[:cpus]
        vb.gui    = true
        vb.customize ["modifyvm", :id, "--uart1", "0x3F8", "4"]
        vb.customize ["modifyvm", :id, "--uartmode1", "file", File::NULL]
      end

      n.vm.provision "shell", path: "scripts/vagrant/install_docker.sh"
      
      # Build the images on EVERY machine so they are locally available
      n.vm.provision "shell", inline: <<-SHELL
        cd /vagrant
        sudo docker build -t dep-device:latest    ./services/device
        sudo docker build -t dep-edge:latest      ./services/edge
        sudo docker build -t dep-core:latest      ./services/core
        sudo docker build -t dep-cloud:latest     ./services/cloud
        sudo docker build -t dep-core-ml:latest   ./services/core-ml
        sudo docker build -t dep-admin:latest     ./services/admin
      SHELL

      if node[:name] == "manager"
        n.vm.provision "shell", path: "scripts/vagrant/init_swarm.sh"
      else
        n.vm.provision "shell", path: "scripts/vagrant/join_swarm.sh", args: ["192.168.56.11"]
      end
    end
  end

  # Automatically deploy the stack on the manager at the very end
  config.vm.define "manager" do |m|
    m.vm.provision "shell", inline: "cd /vagrant && sudo docker stack deploy -c infra/docker-stack.yml theme5", run: "always"
  end
end