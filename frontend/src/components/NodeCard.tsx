import { Card, Group, Text, Badge, Stack, Code } from '@mantine/core';
import type { AdminNode } from '../api/admin';

export function NodeCard({ n }: { n: AdminNode }) {
  const statusColor =
    n.status === 'Ready' ? 'green' : n.status === 'Down' ? 'red' : 'yellow';
  const roleColor = n.role === 'manager' ? 'indigo' : 'gray';

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{n.hostname}</Text>
        <Group gap="xs">
          <Badge color={roleColor} variant="light">{n.role}</Badge>
          <Badge color={statusColor} variant="filled">{n.status}</Badge>
        </Group>
      </Group>
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Availability</Text>
          <Code>{n.availability}</Code>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Engine</Text>
          <Code>{n.engineVersion}</Code>
        </Group>
        {n.managerStatus && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Manager status</Text>
            <Code>{n.managerStatus}</Code>
          </Group>
        )}
        <Group justify="space-between" align="flex-start">
          <Text size="xs" c="dimmed">Labels</Text>
          <Code style={{ fontSize: 11 }}>{JSON.stringify(n.labels ?? {}, null, 0)}</Code>
        </Group>
      </Stack>
    </Card>
  );
}
