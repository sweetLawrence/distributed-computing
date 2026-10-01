import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Badge,
  Group,
  Divider,
  Box
} from '@mantine/core'
import { BookOpen } from 'lucide-react'
import { STORIES } from '../content/story'

export default function Story () {
  return (
    <Container size='md' px={{ base: 'xs', sm: 'md' }}>
      <Stack gap='xl'>
        <div>
          <Group gap='xs' mb={4}>
            <BookOpen size={22} />
            <Title order={2}>The Story</Title>
          </Group>
          <Text c='dimmed'>
            Twelve short chapters. Each one narrates what a milestone actually
            does, in plain language, without jargon or dashboards.
          </Text>
        </div>

        {STORIES.map((s, i) => (
          <Card key={s.id} withBorder radius='md' p='lg'>
            <Group gap='xs' mb='xs'>
              <Badge size='lg' variant='filled'>
                {s.id}
              </Badge>
              <Text size='sm' c='dimmed'>
                Chapter {i + 1}
              </Text>
            </Group>

            <Title order={3} mb={4}>
              {s.title}
            </Title>
            <Text c='dimmed' fs='italic' size='sm' mb='md'>
              {s.oneLiner}
            </Text>

            <Stack gap='md'>
              {s.narration.map((p, j) => (
                <Text key={j} style={{ lineHeight: 1.7 }}>
                  {p}
                </Text>
              ))}
            </Stack>

            <Divider my='md' />

            <Box
              p='md'
              style={{
                background: 'var(--mantine-color-blue-light)',
                borderLeft: '3px solid var(--mantine-color-blue-6)',
                borderRadius: 4
              }}
            >
              <Text size='xs' tt='uppercase' fw={700} c='blue.7' mb={4}>
                Key idea
              </Text>
              <Text fw={600}>{s.keyIdea}</Text>
            </Box>
          </Card>
        ))}

        <Card withBorder bg='gray.0' p='lg'>
          <Text ta='center' c='dimmed' size='sm'>
            That is the whole system - twelve chapters, one continuous story.
          </Text>
        </Card>
      </Stack>
    </Container>
  )
}
