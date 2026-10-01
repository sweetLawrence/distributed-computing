import { Badge } from '@mantine/core';

export function StatusBadge({ status }: { status: 'up' | 'down' | 'unknown' | 'loading' }) {
  const color = status === 'up' ? 'green' : status === 'down' ? 'red' : status === 'loading' ? 'yellow' : 'gray';
  return <Badge color={color} variant="light">{status}</Badge>;
}
