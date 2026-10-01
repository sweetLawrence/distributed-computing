import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Stack,
  Badge,
  Divider,
  Alert,
  Loader,
  Center
} from '@mantine/core'
import {
  useDeviceHealth,
  useDeviceStats,
  useEdge1Health,
  useCore1Health,
  useCore2Health,
  useMlHealth,
  useCloudHealth
} from '../api/queries'
import { ServiceCard } from '../components/ServiceCard'

export default function Overview () {
  const dev = useDeviceHealth()
  const stats = useDeviceStats()
  const edge = useEdge1Health()
  const c1 = useCore1Health()
  const c2 = useCore2Health()
  const ml = useMlHealth()
  const cl = useCloudHealth()

  const leader = c1.data?.isLeader
    ? 'core-1'
    : c2.data?.isLeader
    ? 'core-2'
    : 'unknown'

  return (
    <Container size='xl' px={{ base: 'xs', sm: 'md' }}>
      <Stack gap='lg'>
        <div>
          <Title order={2}>Overview</Title>
          <Text c='dimmed' mt={4}>
            A smartwear platform that routes health records through Edge → Core
            → Cloud. Most records are answered at the edge; flagged ones are
            routed to Core for ML scoring and a 2-phase commit across two
            databases.
          </Text>
        </div>

        <Alert color='indigo' variant='light'>
          <Group wrap='wrap' gap='xs'>
            <Text fw={600}>Current leader:</Text>
            <Badge color='indigo' size='lg'>
              {leader}
            </Badge>
            <Text size='sm' c='dimmed'>
              - only the leader runs 2PC
            </Text>
          </Group>
        </Alert>

        <SimpleGrid
          cols={{ base: 1, sm: 2, lg: 3 }}
          spacing={{ base: 'sm', sm: 'md' }}
        >
          <ServiceCard
            name='device'
            loading={dev.isLoading}
            error={dev.isError}
            data={dev.data}
            extra={[
              { label: 'status', value: dev.data?.status },
              { label: 'streaming', value: dev.data?.streaming }
            ]}
          />
          <ServiceCard
            name='edge (2 replicas)'
            loading={edge.isLoading}
            error={edge.isError}
            data={edge.data}
            extra={[
              { label: 'local', value: edge.data?.localCount },
              { label: 'forwarded', value: edge.data?.forwardCount },
              { label: 'upstream failures', value: edge.data?.upstreamFailures }
            ]}
          />
          <ServiceCard
            name='core-1'
            replica={c1.data?.replica}
            loading={c1.isLoading}
            error={c1.isError}
            data={c1.data}
            extra={[
              { label: 'leader?', value: c1.data?.isLeader },
              { label: 'txns', value: c1.data?.txnCount },
              { label: 'commits', value: c1.data?.commitCount },
              { label: 'aborts', value: c1.data?.abortCount },
              { label: 'avg txn ms', value: c1.data?.txnAvgMs }
            ]}
          />
          <ServiceCard
            name='core-2'
            replica={c2.data?.replica}
            loading={c2.isLoading}
            error={c2.isError}
            data={c2.data}
            extra={[
              { label: 'leader?', value: c2.data?.isLeader },
              { label: 'txns', value: c2.data?.txnCount },
              { label: 'commits', value: c2.data?.commitCount },
              { label: 'aborts', value: c2.data?.abortCount },
              { label: 'avg txn ms', value: c2.data?.txnAvgMs }
            ]}
          />
          <ServiceCard
            name='core-ml'
            loading={ml.isLoading}
            error={ml.isError}
            data={ml.data}
            extra={[{ label: 'model loaded', value: ml.data?.model_loaded }]}
          />
          <ServiceCard
            name='cloud'
            loading={cl.isLoading}
            error={cl.isError}
            data={cl.data}
            extra={[{ label: 'status', value: cl.data?.status }]}
          />
        </SimpleGrid>

        <Divider
          label='Device pipeline stats (last batch)'
          labelPosition='center'
        />

        {stats.isLoading && (
          <Center>
            <Loader />
          </Center>
        )}
        {stats.isError && <Alert color='red'>Device /stats unreachable</Alert>}
        {stats.data && (
          <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing='xs'>
            {[
              ['sent', stats.data.sent],
              ['ok', stats.data.ok],
              ['err', stats.data.err],
              ['avg (ms)', stats.data.avgLatencyMs],
              ['p50', stats.data.p50],
              ['p95', stats.data.p95],
              ['p99', stats.data.p99]
            ].map(([k, v]) => (
              <Card key={String(k)} withBorder p='xs'>
                <Text size='xs' c='dimmed'>
                  {k}
                </Text>
                <Text fw={700} size='md'>
                  {String(v)}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}

        <Divider
          label='What happens when you send a record'
          labelPosition='center'
        />

        <Card withBorder>
          <Stack gap='xs'>
            <Text size='sm'>
              <b>1.</b> Device reads a row from the CSV and POSTs it to Edge.
            </Text>
            <Text size='sm'>
              <b>2.</b> Edge runs a fast threshold check. Normal records are
              answered on the spot.
            </Text>
            <Text size='sm'>
              <b>3.</b> Flagged records are forwarded to Core (only if Core is
              healthy enough).
            </Text>
            <Text size='sm'>
              <b>4.</b> Core calls core-ml for a risk probability.
            </Text>
            <Text size='sm'>
              <b>5.</b> The leader runs 2PC: writes to core-db and cloud-db,
              either both commit or both roll back.
            </Text>
            <Text size='sm'>
              <b>6.</b> The response flows back through Edge to Device, which
              records the round-trip time.
            </Text>
            <Divider my='xs' />
            <Text size='sm' c='dimmed'>
              Everything above is observable live - click the Playground tab to
              try it.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
