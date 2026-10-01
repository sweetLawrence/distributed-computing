import { Link } from 'react-router-dom';
import { Card, Group, Text, Badge, Stack, Box } from '@mantine/core';
import { ArrowRight } from 'lucide-react';
import type { Milestone } from '../content/milestones';

export function MilestoneSummaryCard({ m }: { m: Milestone }) {
  return (
    <Link
      to={`/milestones/${m.id.toLowerCase()}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      <Card withBorder radius="md" p="md" style={{ height: '100%', cursor: 'pointer' }}>
        <Stack gap="xs" h="100%" justify="space-between">
          <Box>
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Badge size="lg" variant="filled" color="indigo">{m.id}</Badge>
              <Badge variant="light" color="gray" size="sm">Week {m.week}</Badge>
            </Group>
            <Text fw={700} size="md" lineClamp={2} mb={6}>
              {m.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={3}>
              {m.summary ?? m.plainEnglish}
            </Text>
          </Box>
          <Group justify="flex-end" gap={4}>
            <Text size="xs" fw={600}>Open</Text>
            <ArrowRight size={14} />
          </Group>
        </Stack>
      </Card>
    </Link>
  );
}
