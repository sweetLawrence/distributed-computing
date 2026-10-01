import { useState } from 'react';
import {
  Card, Title, Text, Badge, Group, Stack, Divider, Accordion,
  Button, Alert, Code, List, Anchor, Box
} from '@mantine/core';
import type { Milestone } from '../content/milestones';
import { apiGet } from '../api/client';

interface Props { m: Milestone; }

export function MilestoneCard({ m }: Props) {
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    if (!m.liveTestEndpoint) return;
    setLoading(true); setError(null); setResp(null);
    try {
      const r = await apiGet(m.liveTestEndpoint);
      setResp(r);
    } catch (e: any) {
      setError(e.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card withBorder radius="md" p="lg" id={m.id.toLowerCase()}>
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
        <Group gap="xs" wrap="wrap">
          <Badge size="lg" variant="filled">{m.id}</Badge>
          <Title order={3} style={{ lineHeight: 1.2 }}>{m.title}</Title>
        </Group>
        <Badge variant="light" color="gray">Week {m.week}</Badge>
      </Group>

      <Stack gap="md" mt="md">
        <Box>
          <Text fw={600} size="sm" c="dimmed" tt="uppercase">What this tests</Text>
          <List size="sm" mt={4}>
            {m.tests.map((t, i) => <List.Item key={i}>{t}</List.Item>)}
          </List>
        </Box>

        <Box>
          <Text fw={600} size="sm" c="dimmed" tt="uppercase">Deliverables</Text>
          <List size="sm" mt={4} icon={<span style={{ color: 'green' }}>✓</span>}>
            {m.deliverables.map((d, i) => <List.Item key={i}>{d}</List.Item>)}
          </List>
        </Box>

        <Divider />

        <Box>
          <Text fw={600} size="sm" c="dimmed" tt="uppercase">Plain English</Text>
          <Text mt={4}>{m.plainEnglish}</Text>
        </Box>

        <Box>
          <Text fw={600} size="sm" c="dimmed" tt="uppercase">Real-world analogy</Text>
          <Text mt={4} fs="italic">{m.analogy}</Text>
        </Box>

        <Box>
          <Text fw={600} size="sm" c="dimmed" tt="uppercase">How we built it</Text>
          <Text mt={4}>{m.howWeBuilt}</Text>
        </Box>

        <Accordion variant="contained">
          <Accordion.Item value="defs">
            <Accordion.Control>Definitions</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {m.definitions.map((d, i) => (
                  <Box key={i}>
                    <Text fw={800} size="sm" mb={2}>{d.term}</Text>
                    <Text size="sm">{d.meaning}</Text>
                  </Box>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="terminal">
            <Accordion.Control>Terminal equivalent</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {m.terminal.map((cmd, i) => (
                  <Group key={i} wrap="nowrap" align="flex-start">
                    <Code block style={{ flex: 1 }}>{cmd}</Code>
                    <Button size="xs" variant="light" onClick={() => navigator.clipboard.writeText(cmd)}>Copy</Button>
                  </Group>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="links">
            <Accordion.Control>Theory links</Accordion.Control>
            <Accordion.Panel>
              <List>
                {m.links.map((l, i) => (
                  <List.Item key={i}>
                    <Anchor href={l.url} target="_blank" rel="noreferrer">{l.label}</Anchor>
                  </List.Item>
                ))}
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        {m.liveTestLabel && (
          <Box>
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" mb={6}>Live test</Text>
            <Button onClick={runTest} loading={loading}>{m.liveTestLabel}</Button>

            {error && <Alert color="red" mt="sm">{error}</Alert>}

            {resp && (
              <>
                <Alert color="blue" mt="sm" title="Response">
                  <Code block style={{ maxHeight: 240, overflow: 'auto' }}>
                    {JSON.stringify(resp, null, 2)}
                  </Code>
                </Alert>
                {m.liveTestNote && (
                  <Alert color="gray" mt="sm" title="What just happened">
                    {m.liveTestNote}
                  </Alert>
                )}
              </>
            )}
          </Box>
        )}
      </Stack>
    </Card>
  );
}
