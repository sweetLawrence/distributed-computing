import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Group,
  Badge,
  Accordion,
  Box
} from '@mantine/core'
import { FAILURES } from '../content/failures'

export default function Failures () {
  return (
    <Container size='lg'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>Failure-Driven Engineering Log</Title>
          <Text c='dimmed' mt={4}>
            Every real failure we hit while building this system, in the
            rubric's required format: what changed, what failed, why, how it was
            fixed, what alternative was considered, and what was learned.
          </Text>
        </div>

        <Card withBorder>
          <Group>
            <Text fw={600}>Total entries:</Text>
            <Badge size='lg'>{FAILURES.length}</Badge>
            <Text size='sm' c='dimmed'>
              - one per non-trivial incident during the build.
            </Text>
          </Group>
        </Card>

        {FAILURES.map(f => (
          <Card key={f.id} withBorder radius='md'>
            <Group justify='space-between' mb='sm'>
              <Group>
                <Badge color='indigo' variant='filled'>
                  {f.milestone}
                </Badge>
                <Text fw={600}>{f.whatChanged.split('.')[0]}</Text>
              </Group>
              <Badge variant='light' color='gray'>
                {f.date}
              </Badge>
            </Group>

            <Accordion variant='separated' multiple>
              <Accordion.Item value='whatChanged'>
                <Accordion.Control>What changed?</Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.whatChanged}</Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value='whatFailed'>
                <Accordion.Control>What failed?</Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.whatFailed}</Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value='why'>
                <Accordion.Control>Why did it fail?</Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.whyItFailed}</Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value='how'>
                <Accordion.Control>How was it fixed?</Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.howFixed}</Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value='alt'>
                <Accordion.Control>
                  What alternative was considered?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.alternativeConsidered}</Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value='learned'>
                <Accordion.Control>What was learned?</Accordion.Control>
                <Accordion.Panel>
                  <Text>{f.whatLearned}</Text>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            {f.evidence && (
              <Box mt='sm'>
                <Text size='xs' c='dimmed'>
                  Evidence: {f.evidence}
                </Text>
              </Box>
            )}
          </Card>
        ))}
      </Stack>
    </Container>
  )
}
