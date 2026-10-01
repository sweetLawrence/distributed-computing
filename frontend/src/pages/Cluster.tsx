import { Container, Title, Text, Stack, Card, Group, Badge, Table, SimpleGrid, Box, Alert, Loader, Center, Code } from '@mantine/core';
import { useClusterNodes, useClusterTasks, useClusterEvents } from '../api/queries';
import type { ClusterNode, ClusterTask, ClusterEvent } from '../api/admin';

function heartbeatLabel(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 5000) return 'now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

function nodeStatusColor(n: ClusterNode) {
  if (n.status !== 'Ready') return 'red';
  if (n.heartbeatAgeMs != null && n.heartbeatAgeMs > 15000) return 'orange';
  return 'green';
}

function stateColor(s: string) {
  const c = (s || '').toLowerCase();
  if (c.includes('running')) return 'green';
  if (c.includes('preparing') || c.includes('starting') || c.includes('pending') || c.includes('new')) return 'yellow';
  if (c.includes('failed') || c.includes('rejected') || c.includes('shutdown')) return 'red';
  return 'gray';
}

function NodeCard({ n }: { n: ClusterNode }) {
  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{n.hostname}</Text>
        <Group gap="xs">
          <Badge color={n.role === 'manager' ? 'indigo' : 'gray'} variant="light">
            {n.role}
          </Badge>
          <Badge color={nodeStatusColor(n)} variant="filled">
            {n.status}
          </Badge>
        </Group>
      </Group>
      <Stack gap={6}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Heartbeat</Text>
          <Text size="xs">{heartbeatLabel(n.heartbeatAgeMs)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Tasks</Text>
          <Text size="xs">{n.taskCount}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Availability</Text>
          <Text size="xs">{n.availability}</Text>
        </Group>
        <Group justify="space-between" align="flex-start">
          <Text size="xs" c="dimmed">Labels</Text>
          <Code style={{ fontSize: 10 }}>{JSON.stringify(n.labels)}</Code>
        </Group>
      </Stack>
    </Card>
  );
}

function TaskRow({ t }: { t: ClusterTask }) {
  return (
    <Table.Tr>
      <Table.Td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Text size="xs" ff="monospace">{t.name}</Text>
      </Table.Td>
      <Table.Td><Text size="xs">{t.node || '—'}</Text></Table.Td>
      <Table.Td><Badge color={stateColor(t.currentState)} variant="light" size="sm">{t.currentState}</Badge></Table.Td>
      <Table.Td>{t.error ? <Text size="xs" c="red">{t.error}</Text> : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
    </Table.Tr>
  );
}

function EventRow({ e }: { e: ClusterEvent }) {
  const time = new Date(e.time * 1000).toLocaleTimeString();
  return (
    <Group gap="xs" wrap="nowrap" style={{ fontSize: 12, borderBottom: '1px solid var(--mantine-color-dark-5)', padding: '6px 4px' }}>
      <Text size="xs" c="dimmed" ff="monospace" style={{ width: 80, flexShrink: 0 }}>{time}</Text>
      <Badge size="xs" variant="light" color={e.type === 'node' ? 'violet' : e.type === 'service' ? 'blue' : 'gray'}>
        {e.type}
      </Badge>
      <Text size="xs" fw={600} style={{ flexShrink: 0 }}>{e.action}</Text>
      <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>{e.name}{e.node ? ` @ ${e.node}` : ''}</Text>
    </Group>
  );
}

export default function Cluster() {
  const nodes = useClusterNodes();
  const tasks = useClusterTasks();
  const events = useClusterEvents();

  const adminUnreachable =
    (nodes.isError || tasks.isError) &&
    String(nodes.error ?? tasks.error ?? '').match(/Failed to fetch|NetworkError|ERR_/);

  const problemServices = (tasks.data?.services ?? []).filter((s) =>
    s.tasks.some((t) => !t.currentState.toLowerCase().includes('running'))
  );

  return (
    <Container size="xl" px={{ base: 'xs', sm: 'md' }}>
      <Stack gap="lg">
        <div>
          <Title order={2}>Cluster</Title>
          <Text c="dimmed" mt={4}>
            Live view of the swarm: node heartbeats, task reconciliation, and the recent event feed.
            Watch how the manager responds when a node goes quiet or a service crashes.
          </Text>
        </div>

        {adminUnreachable && (
          <Alert color="yellow" title="Admin sidecar not reachable">
            Cluster data is unavailable — the admin sidecar is offline. The rest of the UI works without it.
          </Alert>
        )}

        <div>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase" mb="sm">Nodes</Text>
          {nodes.isLoading && <Center><Loader /></Center>}
          {nodes.data && (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {nodes.data.nodes.map((n) => (
                <NodeCard key={n.hostname} n={n} />
              ))}
            </SimpleGrid>
          )}
        </div>

        {problemServices.length > 0 && (
          <Alert color="orange" title={`${problemServices.length} service(s) not fully healthy`}>
            <Stack gap={4}>
              {problemServices.map((s) => {
                const bad = s.tasks.filter((t) => !t.currentState.toLowerCase().includes('running'));
                return (
                  <Box key={s.name}>
                    <Text size="sm" fw={600}>{s.name}</Text>
                    {bad.slice(0, 3).map((t) => (
                      <Text key={t.id} size="xs" c="dimmed">
                        {t.currentState} on {t.node || '?'} {t.error ? `— ${t.error}` : ''}
                      </Text>
                    ))}
                  </Box>
                );
              })}
            </Stack>
          </Alert>
        )}

        <div>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase" mb="sm">Services & tasks</Text>
          {tasks.isLoading && <Center><Loader /></Center>}
          {tasks.data && (
            <Stack gap="md">
              {tasks.data.services.map((s) => (
                <Card key={s.name} withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <Text fw={700}>{s.name}</Text>
                    <Badge variant="light" color="indigo">{s.desiredReplicas}</Badge>
                  </Group>
                  <Table withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 200 }}>Task</Table.Th>
                        <Table.Th style={{ width: 120 }}>Node</Table.Th>
                        <Table.Th style={{ width: 200 }}>Current state</Table.Th>
                        <Table.Th>Error</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {s.tasks.map((t) => <TaskRow key={t.id} t={t} />)}
                    </Table.Tbody>
                  </Table>
                </Card>
              ))}
            </Stack>
          )}
        </div>

        <div>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase" mb="sm">Recent events (last 5 minutes)</Text>
          {events.isLoading && <Center><Loader /></Center>}
          {events.data && events.data.events.length === 0 && (
            <Card withBorder><Text c="dimmed" ta="center">No events in the last 5 minutes.</Text></Card>
          )}
          {events.data && events.data.events.length > 0 && (
            <Card withBorder p="xs">
              {events.data.events.map((e, i) => <EventRow key={`${e.time}-${e.action}-${i}`} e={e} />)}
            </Card>
          )}
        </div>
      </Stack>
    </Container>
  );
}
