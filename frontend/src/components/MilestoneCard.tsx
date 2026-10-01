import { useState } from 'react';
import {
  Card, Title, Text, Badge, Group, Stack, Divider, Accordion,
  Button, Alert, Code, List, Anchor, Box, Table
} from '@mantine/core';
import { AlertCircle, CheckCircle2, Loader2, FlaskConical } from 'lucide-react';
import type { Milestone } from '../content/milestones';
import { apiGet, apiPost } from '../api/client';
import { getConfig } from '../config';
import { CopyButton } from './CopyButton';

interface Props { m: Milestone; }

interface DemoResponse {
  steps?: string[];
  evidence?: any;
  conclusion?: string;
  ok?: boolean;
  message?: string;
}

function isDemoResponse(r: any): r is DemoResponse {
  return r && (Array.isArray(r.steps) || r.conclusion || r.evidence);
}

function renderEvidence(evidence: any) {
  if (evidence == null) return <Text c="dimmed">No evidence returned.</Text>;

  if (Array.isArray(evidence) && evidence.every((e) => typeof e === 'object' && e !== null)) {
    const cols = Object.keys(evidence[0]);
    return (
      <Table striped withTableBorder style={{ fontSize: 12 }}>
        <Table.Thead>
          <Table.Tr>{cols.map((c) => <Table.Th key={c}>{c}</Table.Th>)}</Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {evidence.map((row, i) => (
            <Table.Tr key={i}>
              {cols.map((c) => (
                <Table.Td key={c}>{typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  if (typeof evidence === 'object') {
    return (
      <Stack gap="xs">
        {Object.entries(evidence).map(([k, v]) => (
          <Box key={k}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{k}</Text>
            <Code block style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
              {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
            </Code>
          </Box>
        ))}
      </Stack>
    );
  }

  return <Code block style={{ fontSize: 11 }}>{String(evidence)}</Code>;
}

export function MilestoneCard({ m }: Props) {
  const [resp, setResp] = useState<DemoResponse | any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = getConfig();
  const endpoint = m.liveTestEndpoint ?? '';
  const isAdminEndpoint = endpoint.startsWith('/admin/');
  const fullUrl = endpoint.startsWith('/admin/')
    ? `${cfg.adminBase}${endpoint.replace(/^\/admin/, '')}`
    : `${cfg.apiBase}${endpoint}`;
  const method = (m as any).liveTestMethod ?? 'POST';

  const curlCommand = `curl -X ${method} ${fullUrl}`;

  async function runTest() {
    if (!m.liveTestEndpoint) return;
    setLoading(true); setError(null); setResp(null);
    try {
      const r = isAdminEndpoint
        ? await apiPost<any>(endpoint.replace(/^\/admin/, ''), undefined, cfg.adminBase)
        : (method === 'GET' ? await apiGet<any>(endpoint) : await apiPost<any>(endpoint));
      setResp(r);
    } catch (e: any) {
      setError(e.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const demo = isDemoResponse(resp) ? resp : null;
  const raw = !demo && resp ? resp : (demo as any)?.raw;

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
          <Text fw={700} size="xs" c="dimmed" tt="uppercase">What this tests</Text>
          <List size="sm" mt={4}>
            {m.tests.map((t, i) => <List.Item key={i}>{t}</List.Item>)}
          </List>
        </Box>

        <Box>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase">Deliverables</Text>
          <List size="sm" mt={4} icon={<CheckCircle2 size={14} color="#16A34A" />}>
            {m.deliverables.map((d, i) => <List.Item key={i}>{d}</List.Item>)}
          </List>
        </Box>

        <Divider />

        <Box>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase">Plain English</Text>
          <Text mt={4}>{m.plainEnglish}</Text>
        </Box>

        <Box>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase">Real-world analogy</Text>
          <Text mt={4} fs="italic">{m.analogy}</Text>
        </Box>

        <Box>
          <Text fw={700} size="xs" c="dimmed" tt="uppercase">How we built it</Text>
          <Text mt={4}>{m.howWeBuilt}</Text>
        </Box>

        <Accordion variant="contained">
          <Accordion.Item value="defs">
            <Accordion.Control>Definitions</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {m.definitions.map((d, i) => (
                  <Box key={i}>
                    <Text fw={800} size="sm" c="blue.4" mb={2}>{d.term}</Text>
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
                    <Code block style={{ flex: 1, fontSize: 11, overflowX: 'auto' }}>{cmd}</Code>
                    <CopyButton text={cmd} />
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
            <Group justify="space-between" mb={6} wrap="wrap">
              <Group gap="xs">
                <FlaskConical size={16} />
                <Text fw={700} size="xs" c="dimmed" tt="uppercase">Live test</Text>
              </Group>
              <CopyButton text={curlCommand} label="Copy curl" />
            </Group>

            <Group gap="xs">
              <Button onClick={runTest} loading={loading} leftSection={loading ? <Loader2 size={14} /> : undefined}>
                {m.liveTestLabel}
              </Button>
              {loading && <Text size="sm" c="dimmed">Running demo…</Text>}
            </Group>

            <Code block mt="sm" style={{ fontSize: 11, overflowX: 'auto' }}>{curlCommand}</Code>

            {error && (
              <Alert color="red" mt="sm" icon={<AlertCircle size={16} />} title="Demo failed">
                {error}
              </Alert>
            )}

            {demo && (
              <Stack gap="sm" mt="md">
                {demo.steps && demo.steps.length > 0 && (
                  <Alert color="blue" title="Steps taken">
                    <List size="sm" type="ordered">
                      {demo.steps.map((s, i) => <List.Item key={i}>{s}</List.Item>)}
                    </List>
                  </Alert>
                )}

                {demo.evidence !== undefined && (
                  <Alert color="gray" title="Evidence">
                    {renderEvidence(demo.evidence)}
                  </Alert>
                )}

                {demo.conclusion && (
                  <Alert color="green" icon={<CheckCircle2 size={16} />} title="Conclusion">
                    {demo.conclusion}
                  </Alert>
                )}
              </Stack>
            )}

            {raw && !demo && (
              <Alert color="gray" mt="sm" title="Response">
                <Code block style={{ maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(raw, null, 2)}</Code>
              </Alert>
            )}
          </Box>
        )}
      </Stack>
    </Card>
  );
}
