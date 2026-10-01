import { useState } from 'react';
import {
  Card, Group, Text, Button, Code, Alert, Stack, Loader, Badge, Divider
} from '@mantine/core';
import type { Scenario } from '../content/scenarios';
import { apiGet, apiPost } from '../api/client';

interface Props { s: Scenario; }

function resolveEndpoint(endpoint: string): string {
  // 'prom' scenarios are relative to prometheusUrl, not apiBase
  if (endpoint.startsWith('/prom/')) return endpoint; // handled below
  return endpoint;
}

async function fire(s: Scenario) {
  if (s.endpoint.startsWith('/prom/')) {
    // strip /prom prefix and use prometheus via proxy
    const path = s.endpoint.replace('/prom', '/prom');
    return apiGet<any>(path);   // /api/prom/... hits the proxy which forwards to prometheus
  }
  if (s.method === 'GET') return apiGet<any>(s.endpoint);
  return apiPost<any>(s.endpoint, s.body);
}

export function ScenarioCard({ s }: Props) {
  const [resp, setResp] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true); setError(null); setResp(null);
    try {
      const r = await fire(s);
      setResp(r);
    } catch (e: any) {
      setError(e.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const isErr = error !== null;
  const explanation = isErr ? (s.explanationFailure ?? s.explanationSuccess) : s.explanationSuccess;

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Badge size="sm" variant="light">{s.group}</Badge>
            <Text fw={600}>{s.title}</Text>
          </Group>
          <Text size="sm" c="dimmed">{s.description}</Text>
        </Stack>
      </Group>

      <Group mt="md">
        <Button
          onClick={run}
          loading={loading}
          leftSection={loading ? <Loader size={14} color="white" /> : undefined}
        >
          {loading && s.delayMs ? 'Running…' : 'Send'}
        </Button>
      </Group>

      {error && (
        <Alert color="red" mt="md" title="Error">
          {error}
        </Alert>
      )}

      {resp && (
        <Alert color="blue" mt="md" title="Response">
          <Code block style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(resp, null, 2)}
          </Code>
        </Alert>
      )}

      {(resp || isErr) && (
        <Alert color="gray" mt="sm" title="What just happened">
          {explanation}
        </Alert>
      )}

      <Divider my="md" />

      <Stack gap="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Terminal equivalent</Text>
        {s.terminal.map((cmd, i) => (
          <Group key={i} wrap="nowrap" align="flex-start">
            <Code block style={{ flex: 1, fontSize: 11, overflowX: 'auto' }}>
              {cmd}
            </Code>
            <Button
              size="xs"
              variant="light"
              onClick={() => navigator.clipboard.writeText(cmd)}
            >
              Copy
            </Button>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
