import { getConfig } from '../config'

export interface AdminNode {
  id: string
  hostname: string
  status: string
  availability: string
  managerStatus?: string
  engineVersion: string
  labels: Record<string, string>
  role: 'manager' | 'worker'
}

export interface AdminService {
  id: string
  name: string
  mode: string
  replicas: string // "1/1" or "2/2"
  image: string
  ports: string
}

async function adminFetch<T> (path: string, init?: RequestInit): Promise<T> {
  const cfg = getConfig()
  const url = `${cfg.adminBase}${path}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...init
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} - ${text || url}`)
  }
  return (await res.json()) as T
}

export const adminApi = {
  nodes: () => adminFetch<{ nodes: AdminNode[] }>('/nodes'),
  services: () => adminFetch<{ services: AdminService[] }>('/services'),
  servicePs: (name: string) =>
    adminFetch<{ tasks: any[] }>(`/service/${name}/ps`),
  serviceLogs: (name: string, lines = 100) =>
    adminFetch<{ logs: string }>(`/service/${name}/logs?lines=${lines}`),
  restartService: (name: string) =>
    adminFetch<{ ok: boolean; message: string }>(`/service/${name}/restart`, {
      method: 'POST'
    }),
  scaleService: (name: string, replicas: number) =>
    adminFetch<{ ok: boolean; message: string }>(
      `/service/${name}/scale/${replicas}`,
      { method: 'POST' }
    ),
  redeployStack: () =>
    adminFetch<{ ok: boolean; message: string }>('/stack/redeploy', {
      method: 'POST'
    }),
  removeStack: () =>
    adminFetch<{ ok: boolean; message: string }>('/stack/rm', {
      method: 'POST'
    })
}

// ---------- cluster ----------
export interface ClusterNode {
  hostname: string;
  status: string;
  availability: string;
  managerStatus: string | null;
  role: 'manager' | 'worker';
  labels: Record<string, string>;
  heartbeatAgeMs: number | null;
  taskCount: number;
}

export interface ClusterTask {
  id: string;
  name: string;
  node: string;
  desiredState: string;
  currentState: string;
  error: string | null;
}

export interface ClusterService {
  name: string;
  fullName: string;
  desiredReplicas: string;
  tasks: ClusterTask[];
}

export interface ClusterEvent {
  time: number;
  type: string;
  action: string;
  name: string;
  node: string | null;
}

export const clusterApi = {
  nodes: () => adminFetch<{ nodes: ClusterNode[]; now: number }>('/cluster/nodes'),
  tasks: () => adminFetch<{ services: ClusterService[] }>('/cluster/tasks'),
  events: (since = 300) => adminFetch<{ events: ClusterEvent[]; sinceSeconds: number }>(`/cluster/events?since=${since}`)
};
