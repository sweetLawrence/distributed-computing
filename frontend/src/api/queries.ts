import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

export interface Health {
  service: string; replica?: string; status: string;
  streaming?: boolean;
  isLeader?: boolean; processed?: number; queueLength?: number;
  txnCount?: number; commitCount?: number; abortCount?: number;
  txnAvgMs?: number; txnMaxMs?: number;
  localCount?: number; forwardCount?: number; upstreamFailures?: number;
  packetLossPct?: number;
  model_loaded?: boolean;
}

export interface DeviceStats {
  sent: number; ok: number; err: number;
  avgLatencyMs: number; minLatencyMs: number; maxLatencyMs: number;
  p50: number; p95: number; p99: number;
}

export const useDeviceHealth  = () => useQuery({ queryKey: ['device-health'],  queryFn: () => apiGet<Health>('/device/health'),  refetchInterval: 5000 });
export const useDeviceStats   = () => useQuery({ queryKey: ['device-stats'],   queryFn: () => apiGet<DeviceStats>('/device/stats'), refetchInterval: 5000 });
export const useEdge1Health   = () => useQuery({ queryKey: ['edge1-health'],   queryFn: () => apiGet<Health>('/edge/health'), refetchInterval: 5000 });
export const useCore1Health   = () => useQuery({ queryKey: ['core1-health'],   queryFn: () => apiGet<Health>('/core-1/health'), refetchInterval: 3000 });
export const useCore2Health   = () => useQuery({ queryKey: ['core2-health'],   queryFn: () => apiGet<Health>('/core-2/health'), refetchInterval: 3000 });
export const useMlHealth      = () => useQuery({ queryKey: ['ml-health'],      queryFn: () => apiGet<Health>('/ml/health'),     refetchInterval: 5000 });
export const useCloudHealth   = () => useQuery({ queryKey: ['cloud-health'],   queryFn: () => apiGet<Health>('/cloud/health'),  refetchInterval: 5000 });
export const useWatchdog      = () => useQuery({ queryKey: ['watchdog'],       queryFn: () => apiGet('/edge/watchdog'),         refetchInterval: 5000 });

// ---- admin queries (via sidecar) ----
import { adminApi } from './admin';

export const useAdminNodes    = () => useQuery({ queryKey: ['admin-nodes'],    queryFn: adminApi.nodes,    refetchInterval: 10000, retry: 0 });
export const useAdminServices = () => useQuery({ queryKey: ['admin-services'], queryFn: adminApi.services, refetchInterval: 10000, retry: 0 });
