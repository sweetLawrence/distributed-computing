import { useState } from 'react';
import {
  Container, Title, Text, Stack, Tabs, Card, Group, Code
} from '@mantine/core';
import { SCENARIOS } from '../content/scenarios';
import type { Scenario } from '../content/scenarios';
import { ScenarioCard } from '../components/ScenarioCard';

const GROUPS: Scenario['group'][] = [
  'Happy path', 'Edge behaviour', 'Failure', 'Concurrency', 'Query'
];

export default function Playground() {
  const [active, setActive] = useState<string>('Happy path');

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>Playground</Title>
          <Text c="dimmed" mt={4}>
            Each button fires a real request against the running system. You see the raw JSON response
            and a plain-English explanation of what the system did. Every scenario also has a copyable
            terminal command for anyone who prefers the CLI.
          </Text>
        </div>

        <Card withBorder bg="dark.6">
          <Group>
            <Text size="sm" fw={600}>API base:</Text>
            <Code>/api/*  →  http://192.168.56.11:8090</Code>
          </Group>
        </Card>

        <Tabs value={active} onChange={(v) => setActive(v ?? 'Happy path')}>
          <Tabs.List>
            {GROUPS.map((g) => (
              <Tabs.Tab key={g} value={g}>
                {g} ({SCENARIOS.filter((s) => s.group === g).length})
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {GROUPS.map((g) => (
            <Tabs.Panel key={g} value={g} pt="md">
              <Stack gap="md">
                {SCENARIOS.filter((s) => s.group === g).map((s) => (
                  <ScenarioCard key={s.id} s={s} />
                ))}
              </Stack>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
