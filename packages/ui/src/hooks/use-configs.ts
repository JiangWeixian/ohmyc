import { useQuery } from '@tanstack/react-query'

async function fetchJson<Type>(url: string): Promise<Type> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`)
  }
  return res.json()
}

export interface ConfigEntry {
  name: string
  config: any
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

export interface HookEntry {
  event: string
  name: string
  data: Record<string, unknown>
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp'],
    queryFn: () => fetchJson<{ mcpServers: ConfigEntry[] }>('/api/mcp'),
    select: data => data.mcpServers,
  })
}

export function useHooks() {
  return useQuery({
    queryKey: ['hooks'],
    queryFn: () => fetchJson<{ hooks: HookEntry[] }>('/api/hooks'),
    select: data => data.hooks,
  })
}

export function useLspServers() {
  return useQuery({
    queryKey: ['lsp'],
    queryFn: () => fetchJson<{ lspServers: ConfigEntry[] }>('/api/lsp'),
    select: data => data.lspServers,
  })
}
