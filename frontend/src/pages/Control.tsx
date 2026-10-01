import { useState } from 'react';
import {
  Container, Title, Text, Stack, SimpleGrid, Card, Group, Button,
  Alert, Loader, Center, Divider, Modal, Code
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AlertTriangle } from 'lucide-react';
import { useAdminNodes, useAdminServices } from '../api/queries';
import { NodeCard } from '../components/NodeCard';
import { ServiceTable } from '../components/ServiceTable';
import { adminApi } from '../api/admin';

export default function Control() {
  const nodes = useAdminNodes();
  const services = useAdminServices();

  const [redeployOpen, setRedeployOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doRedeploy() {
    setBusy(true);
    try {
      const r = await adminApi.redeployStack();
      notifications.show({ title: 'Redeploy requested', message: r.message, color: 'green' });
      setRedeployOpen(false);
      services.refetch();
    } catch (e: any) {
      notifications.show({ title: 'Redeploy failed', message: e.message, color: 'red' });
    } finally { setBusy(false); }
  }

  async function doRemove() {
    setBusy(true);
    try {
      const r = await adminApi.removeStack();
      notifications.show({ title: 'Stack removal requested', message: r.message, color: 'orange' });
      setRemoveOpen(false);
      services.refetch();
    } catch (e: any) {
      notifications.show({ title: 'Removal failed', message: e.message, color: 'red' });
    } finally { setBusy(false); }
  }

  const adminUnreachable =
    (nodes.isError && services.isError) &&
    String(nodes.error ?? '').match(/Failed to fetch|NetworkError|ERR_/);

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>Control</Title>
          <Text c="dimmed" mt={4}>
            Live cluster state and operational commands. All actions talk to a small
            admin sidecar service that runs on the manager node with a whitelist of
            allowed operations.
          </Text>
        </div>

        {adminUnreachable && (
          <Alert color="yellow" icon={<AlertTriangle size={16} />} title="Admin sidecar not reachable">
            The frontend can't reach <Code>/admin/*</Code>. This is expected until the
            VMs are running and the <Code>theme5-admin</Code> service is deployed.
            The rest of the UI works without it.
          </Alert>
        )}

        <Divider label="Nodes" labelPosition="center" />
        {nodes.isLoading && <Center><Loader /></Center>}
        {nodes.isError && !adminUnreachable && (
          <Alert color="red" title="Failed to load nodes">{String(nodes.error)}</Alert>
        )}
        {nodes.data && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {nodes.data.nodes.map((n) => <NodeCard key={n.id} n={n} />)}
          </SimpleGrid>
        )}

        <Divider label="Services" labelPosition="center" />
        {services.isLoading && <Center><Loader /></Center>}
        {services.isError && !adminUnreachable && (
          <Alert color="red" title="Failed to load services">{String(services.error)}</Alert>
        )}
        {services.data && (
          <ServiceTable services={services.data.services} onChanged={() => services.refetch()} />
        )}

        <Divider label="Danger zone" labelPosition="center" color="red" />
        <Card withBorder style={{ borderColor: 'var(--mantine-color-red-6)' }}>
          <Stack>
            <Group justify="space-between">
              <div>
                <Text fw={600}>Redeploy stack</Text>
                <Text size="sm" c="dimmed">
                  Runs <Code>docker stack deploy -c infra/docker-stack.yml theme5</Code>.
                </Text>
              </div>
              <Button color="orange" onClick={() => setRedeployOpen(true)}>Redeploy</Button>
            </Group>
            <Divider />
            <Group justify="space-between">
              <div>
                <Text fw={600}>Remove stack</Text>
                <Text size="sm" c="dimmed">
                  Runs <Code>docker stack rm theme5</Code>. Volumes survive.
                </Text>
              </div>
              <Button color="red" onClick={() => setRemoveOpen(true)}>Remove stack</Button>
            </Group>
          </Stack>
        </Card>
      </Stack>

      <Modal opened={redeployOpen} onClose={() => setRedeployOpen(false)} title="Redeploy stack?">
        <Stack>
          <Text>This restarts every service one at a time. Continue?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRedeployOpen(false)}>Cancel</Button>
            <Button color="orange" onClick={doRedeploy} loading={busy}>Redeploy</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={removeOpen} onClose={() => setRemoveOpen(false)} title="Remove entire stack?">
        <Stack>
          <Text c="red" fw={600}>This stops all services.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button color="red" onClick={doRemove} loading={busy}>Remove</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
