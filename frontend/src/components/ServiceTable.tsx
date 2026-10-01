import { useState } from 'react'
import {
  Table,
  Badge,
  Group,
  ActionIcon,
  Modal,
  Button,
  Code,
  Text,
  Stack,
  NumberInput,
  Alert,
  Tooltip
} from '@mantine/core'
import { RefreshCw, FileText, Plus, Minus } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import type { AdminService } from '../api/admin'
import { adminApi } from '../api/admin'

interface Props {
  services: AdminService[]
  onChanged?: () => void
}

export function ServiceTable ({ services, onChanged }: Props) {
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [logsFor, setLogsFor] = useState<string>('')
  const [scaleOpen, setScaleOpen] = useState(false)
  const [scaleFor, setScaleFor] = useState<string>('')
  const [scaleTo, setScaleTo] = useState<number>(1)
  const [busy, setBusy] = useState(false)

  async function openLogs (name: string) {
    setLogsFor(name)
    setLogsOpen(true)
    setLogs('Loading…')
    try {
      const r = await adminApi.serviceLogs(name, 200)
      setLogs(r.logs || '(empty)')
    } catch (e: any) {
      setLogs(`Error: ${e.message}`)
    }
  }

  async function restart (name: string) {
    setBusy(true)
    try {
      const r = await adminApi.restartService(name)
      notifications.show({
        title: 'Restart requested',
        message: r.message,
        color: 'green'
      })
      onChanged?.()
    } catch (e: any) {
      notifications.show({
        title: 'Restart failed',
        message: e.message,
        color: 'red'
      })
    } finally {
      setBusy(false)
    }
  }

  async function doScale () {
    setBusy(true)
    try {
      const r = await adminApi.scaleService(scaleFor, scaleTo)
      notifications.show({
        title: 'Scale requested',
        message: r.message,
        color: 'green'
      })
      setScaleOpen(false)
      onChanged?.()
    } catch (e: any) {
      notifications.show({
        title: 'Scale failed',
        message: e.message,
        color: 'red'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Table striped withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Service</Table.Th>
            <Table.Th>Replicas</Table.Th>
            <Table.Th>Image</Table.Th>
            <Table.Th>Ports</Table.Th>
            <Table.Th style={{ width: 160 }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {services.map(s => {
            const [running, desired] = s.replicas.split('/').map(Number)
            const healthy = running === desired && desired > 0
            const shortName = s.name.replace(/^theme5_/, '')
            const canScale = s.mode === 'replicated'
            return (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text fw={600}>{shortName}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={healthy ? 'green' : 'red'} variant='light'>
                    {s.replicas}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size='xs' c='dimmed'>
                    {s.image}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size='xs' c='dimmed'>
                    {s.ports || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap='xs'>
                    <Tooltip label='Restart'>
                      <ActionIcon
                        variant='light'
                        onClick={() => restart(s.name)}
                        loading={busy}
                      >
                        <RefreshCw size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label='Logs'>
                      <ActionIcon
                        variant='light'
                        onClick={() => openLogs(s.name)}
                      >
                        <FileText size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {canScale && (
                      <Tooltip label='Scale'>
                        <ActionIcon
                          variant='light'
                          onClick={() => {
                            setScaleFor(s.name)
                            setScaleTo(desired || 1)
                            setScaleOpen(true)
                          }}
                        >
                          <Plus size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>

      <Modal
        opened={logsOpen}
        onClose={() => setLogsOpen(false)}
        title={`Logs - ${logsFor}`}
        size='xl'
      >
        <Code block style={{ maxHeight: 480, overflow: 'auto', fontSize: 12 }}>
          {logs}
        </Code>
      </Modal>

      <Modal
        opened={scaleOpen}
        onClose={() => setScaleOpen(false)}
        title={`Scale ${scaleFor}`}
      >
        <Stack>
          <Text size='sm'>Set replica count:</Text>
          <NumberInput
            value={scaleTo}
            onChange={v => setScaleTo(Number(v) || 1)}
            min={0}
            max={10}
          />
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setScaleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doScale} loading={busy}>
              Apply
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
