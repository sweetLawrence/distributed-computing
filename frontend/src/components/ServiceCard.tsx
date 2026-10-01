import { Card, Group, Text, Stack, Code } from '@mantine/core'
import { StatusBadge } from './StatusBadge'

interface Props {
  name: string
  replica?: string
  loading?: boolean
  error?: boolean
  data?: any
  extra?: Array<{ label: string; value: any }>
}

export function ServiceCard ({
  name,
  replica,
  loading,
  error,
  data,
  extra
}: Props) {
  const status = loading ? 'loading' : error ? 'down' : 'up'
  return (
    <Card withBorder radius='md' p='md'>
      <Group justify='space-between' mb={6}>
        <Text fw={600}>{name}</Text>
        <StatusBadge status={status} />
      </Group>
      {replica && (
        <Text size='xs' c='dimmed' mb='xs'>
          replica: {replica}
        </Text>
      )}
      {error && (
        <Text size='xs' c='red'>
          Not reachable
        </Text>
      )}
      {data && !error && (
        <Stack gap={4} mt='xs'>
          {extra?.map(e => (
            <Group key={e.label} justify='space-between'>
              <Text size='xs' c='dimmed'>
                {e.label}
              </Text>
              <Code>{String(e.value ?? '-')}</Code>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  )
}
