import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Container,
  Text,
  Stack,
  Group,
  Button,
  Card,
  Box,
  Badge
} from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MILESTONES } from '../content/milestones'
import { MilestoneCard } from '../components/MilestoneCard'

export default function MilestoneDetail () {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const idx = MILESTONES.findIndex(
    m => m.id.toLowerCase() === id?.toLowerCase()
  )
  if (idx === -1) {
    return (
      <Container size='lg'>
        <Stack>
          <Text>Milestone "{id}" not found.</Text>
          <Button component={Link} to='/milestones' variant='light'>
            Back to Milestones
          </Button>
        </Stack>
      </Container>
    )
  }

  const m = MILESTONES[idx]
  const prev = idx > 0 ? MILESTONES[idx - 1] : null
  const next = idx < MILESTONES.length - 1 ? MILESTONES[idx + 1] : null

  return (
    <Container size='lg' px={{ base: 'xs', sm: 'md' }}>
      <Stack gap='md'>
        <Group justify='space-between' wrap='wrap'>
          <Button
            variant='subtle'
            leftSection={<ArrowLeft size={16} />}
            component={Link}
            to='/milestones'
          >
            All milestones
          </Button>
          <Group gap='xs'>
            <Badge variant='light' color='gray'>
              Week {m.week}
            </Badge>
            <Badge variant='filled'>{m.id}</Badge>
          </Group>
        </Group>

        <MilestoneCard m={m} />

        <Card withBorder>
          <Group justify='space-between' wrap='wrap'>
            {prev ? (
              <Button
                variant='default'
                leftSection={<ArrowLeft size={16} />}
                onClick={() => navigate(`/milestones/${prev.id.toLowerCase()}`)}
              >
                {prev.id} -{' '}
                {prev.title.length > 30
                  ? prev.title.slice(0, 30) + '…'
                  : prev.title}
              </Button>
            ) : (
              <Box />
            )}
            {next ? (
              <Button
                variant='default'
                rightSection={<ArrowRight size={16} />}
                onClick={() => navigate(`/milestones/${next.id.toLowerCase()}`)}
              >
                {next.id} -{' '}
                {next.title.length > 30
                  ? next.title.slice(0, 30) + '…'
                  : next.title}
              </Button>
            ) : (
              <Box />
            )}
          </Group>
        </Card>
      </Stack>
    </Container>
  )
}
