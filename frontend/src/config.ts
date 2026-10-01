export interface AppConfig {
  apiBase: string; adminBase: string; grafanaUrl: string; prometheusUrl: string;
}
let cached: AppConfig | null = null;
export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  const res = await fetch('/config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /config.json');
  cached = (await res.json()) as AppConfig;
  return cached;
}
export function getConfig(): AppConfig {
  if (!cached) throw new Error('Config not loaded yet');
  return cached;
}
