import { getConfig } from '../config'

export async function apiGet<T = any> (path: string, base?: string): Promise<T> {
  const cfg = getConfig()
  const url = `${base ?? cfg.apiBase}${path}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  return (await res.json()) as T
}

export async function apiPost<T = any> (
  path: string,
  body?: any,
  base?: string
): Promise<T> {
  const cfg = getConfig()
  const url = `${base ?? cfg.apiBase}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  return (await res.json()) as T
}
