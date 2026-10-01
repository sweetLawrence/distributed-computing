import { Container, Title, Text, Stack, SimpleGrid } from '@mantine/core';
import { MILESTONES } from '../content/milestones';
import { MilestoneSummaryCard } from '../components/MilestoneSummaryCard';

export default function Milestones() {
  return (
    <Container size="lg" px={{ base: 'xs', sm: 'md' }}>
      <Stack gap="lg">
        <div>
          <Title order={2}>Milestones</Title>
          <Text c="dimmed" mt={4}>
            Twelve milestones, one continuous system. Tap a card to open the full
            explanation, definitions, live test, and terminal commands.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, xs: 2, sm: 2, md: 3, lg: 4 }} spacing="md">
          {MILESTONES.map((m) => <MilestoneSummaryCard key={m.id} m={m} />)}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
