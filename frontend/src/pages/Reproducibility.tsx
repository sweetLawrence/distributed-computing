import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Group,
  Code,
  Divider,
  List,
  Table,
  Accordion,
  Badge,
} from '@mantine/core'

function Copy ({ text }: { text: string }) {
  return (
    <Group wrap='nowrap' align='flex-start'>
      <Code block style={{ flex: 1, fontSize: 12, overflowX: 'auto' }}>
        {text}
      </Code>
      <a
        style={{ cursor: 'pointer', fontSize: 12 }}
        onClick={() => navigator.clipboard.writeText(text)}
      >
        copy
      </a>
    </Group>
  )
}

export default function Reproducibility () {
  return (
    <Container size='lg'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>Reproducibility</Title>
          <Text c='dimmed' mt={4}>
            Everything a second researcher needs to reproduce this system:
            hardware, OS, versions, network topology, dataset, configuration,
            and starting commands.
          </Text>
        </div>

        <Card withBorder>
          <Stack gap='md'>
            <Group>
              <Badge color='indigo'>Hardware</Badge>
              <Text size='sm'>
                2× VirtualBox VMs - 2 vCPU, 8 GB RAM, 30 GB disk (dynamic)
              </Text>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Operating System</Badge>
              <Text size='sm'>Ubuntu Server 22.04 LTS (both VMs)</Text>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Network</Badge>
              <div>
                <Text size='sm'>Host-only adapter on 192.168.56.0/24</Text>
                <Text size='sm' c='dimmed'>
                  vm-manager → 192.168.56.11 · vm-worker-1 → 192.168.56.12
                </Text>
              </div>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Runtime</Badge>
              <div>
                <Text size='sm'>
                  Docker Engine 29.8.1 · Docker Compose v2 · Swarm mode
                </Text>
                <Text size='sm' c='dimmed'>
                  Node 20 Alpine, Python 3.11 slim, Postgres 16, Redis 7
                </Text>
              </div>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Frameworks</Badge>
              <div>
                <Text size='sm'>
                  Express (Node), FastAPI (Python), Sequelize (ORM),
                  scikit-learn
                </Text>
                <Text size='sm' c='dimmed'>
                  React 18 + Vite + Mantine + Tailwind (this UI)
                </Text>
              </div>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Dataset</Badge>
              <div>
                <Text size='sm'>
                  <Code>smartwear_health_monitoring_dataset.csv</Code> - 120 000
                  rows, 10 columns
                </Text>
                <Text size='sm' c='dimmed'>
                  Columns: patient_id, age, gender, bmi, smoking_status,
                  alcohol_consumption, heart_rate, systolic_bp, diastolic_bp,
                  respiratory_rate
                </Text>
              </div>
            </Group>
            <Divider />
            <Group>
              <Badge color='indigo'>Configuration</Badge>
              <div>
                <Text size='sm'>
                  <Code>STREAM_INTERVAL_MS=200</Code>, <Code>MAX_ROWS=200</Code>
                  , <Code>PLACEMENT_THRESHOLD=0.005</Code>,{' '}
                  <Code>CORE_HEARTBEAT_MS=3000</Code>,{' '}
                  <Code>LEADER_TTL_MS=10000</Code>
                </Text>
              </div>
            </Group>
          </Stack>
        </Card>

        <Divider label='Starting from scratch' labelPosition='center' />

        <Card withBorder>
          <Text fw={600} mb='xs'>
            1. Create the VMs
          </Text>
          <List size='sm'>
            <List.Item>
              VirtualBox → New → Ubuntu Server 22.04, 2 vCPU, 8 GB RAM, 30 GB
              disk.
            </List.Item>
            <List.Item>Adapter 1: NAT. Adapter 2: Host-only Adapter.</List.Item>
            <List.Item>Static IPs 192.168.56.11, 192.168.56.12, 192.168.56.13.</List.Item>
            <List.Item>Install OpenSSH server when prompted.</List.Item>
          </List>
        </Card>

        <Card withBorder>
          <Text fw='600' mb='xs'>
            2. Install Docker on both VMs
          </Text>
          <Copy
            text={`curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install -y docker-compose-plugin git curl jq
# log out and back in
docker --version`}
          />
        </Card>

        <Card withBorder>
          <Text fw='600' mb='xs'>
            3. Form the swarm
          </Text>
          <Copy
            text={`# On vm-manager:
docker swarm init --advertise-addr 192.168.56.11
docker swarm join-token worker
# Copy the printed join command and run it on vm-worker-1 AND vm-worker-2.

# On vm-manager: label the nodes
docker node update --label-add manager=true    vm-manager
docker node update --label-add core-side=true  vm-manager
docker node update --label-add cloud-side=true vm-worker-1
docker node update --label-add worker2=true    vm-worker-2`}
          />
        </Card>

        <Card withBorder>
          <Text fw='600' mb='xs'>
            4. Place the dataset
          </Text>
          <Copy
            text={`mkdir -p ~/distributed-edge-platform/data
# Copy the CSV there:
#   data/smartwear_health_monitoring_dataset.csv`}
          />
        </Card>

        <Card withBorder>
          <Text fw='600' mb='xs'>
            5. Build and deploy
          </Text>
          <Copy
            text={`git clone <this-repo> ~/distributed-edge-platform
cd ~/distributed-edge-platform
docker build -t dep-device:latest    ./services/device
docker build -t dep-edge:latest      ./services/edge
docker build -t dep-core:latest      ./services/core
docker build -t dep-cloud:latest     ./services/cloud
docker build -t dep-core-ml:latest   ./services/core-ml
docker build -t dep-admin:latest     ./services/admin
# On vm-worker-1 AND vm-worker-2: docker load each image

docker stack deploy -c infra/docker-stack.yml theme5
sleep 90
docker stack services theme5`}
          />
        </Card>

        <Card withBorder>
          <Text fw='600' mb='xs'>
            6. Access the system
          </Text>
          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Device</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:3000/health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Edge</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:3001/health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Core 1</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:4001/health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Core 2</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:4002/health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>ML</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:5000/health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Proxy</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:8090/proxy-health</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Prometheus</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:9090</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Grafana</Table.Td>
                <Table.Td>
                  <Code>http://192.168.56.11:3030</Code>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        <Divider label='The 30-section report' labelPosition='center' />

        <Card withBorder>
          <Text c='dimmed' mb='xs'>
            The technical report has 30 required sections. Each maps to a
            location in this project.
          </Text>
          <Accordion variant='contained'>
            {[
              ['1. Introduction', 'Overview tab'],
              ['2. Problem statement', 'Overview'],
              ['3. Research questions', 'Capstone → Hypothesis'],
              ['4. System requirements', 'Overview + Milestones M1'],
              ['5. Literature review', 'Milestones tab → Theory links'],
              ['6. Distributed system model', 'Milestones M8'],
              ['7. System architecture', 'Milestones M3'],
              [
                '8. Mathematical model',
                'Milestones M2 (throughput/latency formulas)'
              ],
              ['9. Distributed algorithms', 'Milestones M4'],
              ['10. Communication architecture', 'Milestones M11'],
              ['11. Transaction management', 'Milestones M5'],
              ['12. Concurrency management', 'Milestones M6'],
              ['13. Fault model', 'Milestones M7'],
              ['14. Fault-tolerance mechanism', 'Milestones M7'],
              ['15. Naming architecture', 'Milestones M10'],
              ['16. Process management', 'Milestones M10'],
              ['17. RPC architecture', 'Milestones M11'],
              [
                '18. Distributed memory / state',
                'Milestones M11 (Redis cache)'
              ],
              ['19. Distributed storage', 'Milestones M12'],
              ['20. Implementation', 'This repository'],
              ['21. Experimental methodology', 'Capstone → Variables'],
              ['22. Performance evaluation', 'Capstone → Table'],
              ['23. Reliability evaluation', 'Failures tab → M7 entries'],
              ['24. Scalability evaluation', 'Capstone + Overview'],
              ['25. Failure analysis', 'Failures tab'],
              ['26. Baseline comparison', 'Capstone'],
              ['27. Proposed improvement', 'Capstone'],
              ['28. Limitations', 'Failures tab + docs/milestones.md'],
              ['29. Future work', 'docs/milestones.md'],
              ['30. Conclusion', 'Capstone → Conclusions']
            ].map(([s, where]) => (
              <Accordion.Item key={s} value={s}>
                <Accordion.Control>{s}</Accordion.Control>
                <Accordion.Panel>
                  <Text size='sm'>See: {where}</Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Card>

        <Divider label='Oral defense prep (A–G)' labelPosition='center' />

        <Card withBorder>
          <Accordion variant='contained'>
            {[
              [
                'A. Theory',
                'Milestones M1, M4, M5, M6, M7 - start with the Overview tab then walk milestone by milestone.'
              ],
              [
                'B. Architecture',
                'Milestones M3 (comparison) and Overview (deployed diagram).'
              ],
              [
                'C. Algorithms',
                'Milestones M4 (leader election + Lamport) and M6 (deadlock detection).'
              ],
              [
                'D. Implementation',
                'Playground tab - fire live requests, show JSON responses.'
              ],
              [
                'E. Failure demo',
                'Playground → Failure group → "Kill cloud-db" or "Kill leader core".'
              ],
              [
                'F. Quantitative evaluation',
                'Capstone tab - baseline vs proposed table.'
              ],
              [
                'G. Research contribution',
                'Capstone → Conclusions; the contribution is edge-aware placement.'
              ]
            ].map(([q, a]) => (
              <Accordion.Item key={q} value={q}>
                <Accordion.Control>{q}</Accordion.Control>
                <Accordion.Panel>
                  <Text>{a}</Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Card>
      </Stack>
    </Container>
  )
}
