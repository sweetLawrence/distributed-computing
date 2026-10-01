import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  SimpleGrid,
  Group,
  Badge,
  Divider,
  Code,
  Table,
  List
} from '@mantine/core'
import { useDeviceStats } from '../api/queries'

const BASELINE = {
  sent: 172,
  ok: 172,
  err: 0,
  avgLatencyMs: 60.65,
  p50: 54,
  p95: 88,
  p99: 259,
  maxLatencyMs: 936,
  coreProcessed: 253
}
const PROPOSED = {
  sent: 209,
  ok: 209,
  err: 0,
  avgLatencyMs: 10.54,
  p50: 7,
  p95: 56,
  p99: 66,
  maxLatencyMs: 81,
  coreProcessed: 29
}

function Row ({ label, a, b }: { label: string; a: any; b: any }) {
  const aNum = typeof a === 'number' ? a : 0
  const bNum = typeof b === 'number' ? b : 0
  const better = aNum > bNum ? 'b' : bNum > aNum ? 'a' : 'tie'
  const improvement =
    aNum && bNum ? (((aNum - bNum) / aNum) * 100).toFixed(1) : '-'
  return (
    <Table.Tr>
      <Table.Td>{label}</Table.Td>
      <Table.Td>
        <Code>{a}</Code>
      </Table.Td>
      <Table.Td>
        <Code>{b}</Code>
      </Table.Td>
      <Table.Td>
        <Badge
          color={better === 'b' ? 'green' : better === 'a' ? 'orange' : 'gray'}
        >
          {better === 'tie'
            ? 'same'
            : better === 'b'
            ? `${improvement}% better`
            : 'worse'}
        </Badge>
      </Table.Td>
    </Table.Tr>
  )
}

export default function Capstone () {
  const live = useDeviceStats()

  return (
    <Container size='lg'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>Capstone - Baseline vs Proposed</Title>
          <Text c='dimmed' mt={4}>
            Same dataset, same hardware, two configurations.
          </Text>
        </div>

        <Card withBorder>
          <Stack gap='xs'>
            <Text fw={600}>Hypothesis</Text>
            <Text>
              Edge-side placement will reduce Core load and end-to-end latency.
            </Text>
            <Divider my='xs' />
            <Text fw={600}>Variables</Text>
            <List size='sm'>
              <List.Item>
                <b>Independent</b>: placement mode (FORCE_FORWARD).
              </List.Item>
              <List.Item>
                <b>Dependent</b>: latency percentiles, throughput, Core
                processed count.
              </List.Item>
              <List.Item>
                <b>Controlled</b>: first 200 CSV rows, 200 ms pacing, same VMs,
                same images.
              </List.Item>
            </List>
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder>
            <Group justify='space-between' mb='xs'>
              <Text fw={600}>Baseline</Text>
              <Badge color='orange'>FORCE_FORWARD=1</Badge>
            </Group>
            <Text size='sm' c='dimmed'>
              All records forwarded to Core.
            </Text>
          </Card>
          <Card withBorder>
            <Group justify='space-between' mb='xs'>
              <Text fw={600}>Proposed</Text>
              <Badge color='green'>FORCE_FORWARD=0</Badge>
            </Group>
            <Text size='sm' c='dimmed'>
              Edge handles normal records.
            </Text>
          </Card>
        </SimpleGrid>

        <Divider label='Measured results' labelPosition='center' />

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Metric</Table.Th>
              <Table.Th>Baseline</Table.Th>
              <Table.Th>Proposed</Table.Th>
              <Table.Th>Result</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Row
              label='Core records processed'
              a={BASELINE.coreProcessed}
              b={PROPOSED.coreProcessed}
            />
            <Row
              label='Avg latency (ms)'
              a={BASELINE.avgLatencyMs}
              b={PROPOSED.avgLatencyMs}
            />
            <Row label='p50 latency (ms)' a={BASELINE.p50} b={PROPOSED.p50} />
            <Row label='p95 latency (ms)' a={BASELINE.p95} b={PROPOSED.p95} />
            <Row label='p99 latency (ms)' a={BASELINE.p99} b={PROPOSED.p99} />
            <Row
              label='Max latency (ms)'
              a={BASELINE.maxLatencyMs}
              b={PROPOSED.maxLatencyMs}
            />
            <Row label='Errors' a={BASELINE.err} b={PROPOSED.err} />
          </Table.Tbody>
        </Table>

        <Card withBorder>
          <Stack gap='xs'>
            <Text fw={600}>Conclusions</Text>
            <Text>
              • Core load reduced by 88.5% (253 → 29 records per batch).
            </Text>
            <Text>• p50 latency 7.7× faster; average latency 5.8× faster.</Text>
            <Text>• p99 tail improved from 259 ms to 66 ms.</Text>
            <Text>• Zero errors in both modes - availability unchanged.</Text>
          </Stack>
        </Card>

        <Divider label='Live device stats' labelPosition='center' />
        {live.data && (
          <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }}>
            {[
              ['sent', live.data.sent],
              ['ok', live.data.ok],
              ['err', live.data.err],
              ['avg ms', live.data.avgLatencyMs],
              ['p50', live.data.p50],
              ['p95', live.data.p95],
              ['p99', live.data.p99]
            ].map(([k, v]) => (
              <Card key={String(k)} withBorder p='sm'>
                <Text size='xs' c='dimmed'>
                  {k}
                </Text>
                <Text fw={700}>{String(v)}</Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
        {live.isError && (
          <Text c='dimmed'>Device /stats not reachable (VMs down).</Text>
        )}
      </Stack>
    </Container>
  )
}
