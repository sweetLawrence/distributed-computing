import { useState, useMemo } from 'react';
import {
  Container, Title, Text, Stack, Card, Badge, Group, TextInput, Box,
  SegmentedControl,
} from '@mantine/core';
import { BookMarked, Search } from 'lucide-react';
import { DEFINITIONS } from '../content/definitions';
import type { Definition } from '../content/definitions';

const CATEGORIES: (Definition['category'] | 'All')[] = [
  'All', 'Performance', 'Distributed systems', 'Data', 'Networking', 'Infrastructure'
];

const CATEGORY_COLOR: Record<Definition['category'], string> = {
  'Performance': 'orange',
  'Distributed systems': 'indigo',
  'Data': 'teal',
  'Networking': 'cyan',
  'Infrastructure': 'violet'
};

export default function Definitions() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('All');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DEFINITIONS.filter((d) => {
      if (cat !== 'All' && d.category !== cat) return false;
      if (!needle) return true;
      return (
        d.term.toLowerCase().includes(needle) ||
        d.plain.toLowerCase().includes(needle) ||
        (d.example ?? '').toLowerCase().includes(needle) ||
        (d.analogy ?? '').toLowerCase().includes(needle)
      );
    });
  }, [q, cat]);

  return (
    <Container size="lg" px={{ base: 'xs', sm: 'md' }}>
      <Stack gap="lg">
        <div>
          <Group gap="xs" mb={4}>
            <BookMarked size={22} />
            <Title order={2}>Definitions</Title>
          </Group>
          <Text c="dimmed">
            Every term used in this project, explained in plain language with
            examples and analogies. Use the search or filter by category.
          </Text>
        </div>

        <Card withBorder>
          <Stack gap="sm">
            <TextInput
              placeholder="Search terms, examples, analogies…"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
              leftSection={<Search size={16} />}
            />
            <SegmentedControl
              fullWidth
              value={cat}
              onChange={setCat}
              data={CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
          </Stack>
        </Card>

        <Text size="sm" c="dimmed">
          {filtered.length} {filtered.length === 1 ? 'definition' : 'definitions'}
          {cat !== 'All' ? ` in "${cat}"` : ''}
          {q ? ` matching "${q}"` : ''}
        </Text>

        <Stack gap="md">
          {filtered.map((d) => (
            <Card key={d.term} withBorder>
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap">
                  <Text fw={700} size="lg">{d.term}</Text>
                  <Badge color={CATEGORY_COLOR[d.category]} variant="light">
                    {d.category}
                  </Badge>
                </Group>

                <Text>{d.plain}</Text>

                {d.example && (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
                      Example
                    </Text>
                    <Text size="sm" fs="italic">{d.example}</Text>
                  </Box>
                )}

                {d.analogy && (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
                      Analogy
                    </Text>
                    <Text size="sm" fs="italic">{d.analogy}</Text>
                  </Box>
                )}
              </Stack>
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card withBorder>
              <Text c="dimmed" ta="center">
                No definitions match your search.
              </Text>
            </Card>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
