# -*- mode: ruby -*-
# vi: set ft=ruby :

# Machine folder is set once on the host, NOT here:
#   VBoxManage setproperty machinefolder "D:\vagrant-vms"

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

        # Keep the serial port (jammy kernel uses console=ttyS0) but discard output
        vb.customize ["modifyvm", :id, "--uart1", "0x3F8", "4"]
        vb.customize ["modifyvm", :id, "--uartmode1", "file", File::NULL]
      end

      n.vm.provision "shell", path: "scripts/vagrant/install_docker.sh"

      if node[:name] == "manager"
        n.vm.provision "shell", path: "scripts/vagrant/init_swarm.sh"
      else
        n.vm.provision "shell", path: "scripts/vagrant/join_swarm.sh", args: ["192.168.56.11"]
      end
    end
  end

end