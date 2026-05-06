// React Query hooks for MCP servers, hooks, and LSP server configuration queries.
import { useQuery } from '@tanstack/react-query'

/** Generic JSON fetch helper with error handling. */
async function fetchJson<Type>(url: string): Promise<Type> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`)
  }
  return res.json()
}

/** A single MCP or LSP server entry after merging all sources. */
export interface ConfigEntry {
  name: string
  config: any
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

/** A single flattened hook entry. */
export interface HookEntry {
  event: string
  name: string
  data: Record<string, unknown>
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

/** Query hook for MCP servers merged from local, plugin, and project sources. */
export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp'],
    queryFn: () => fetchJson<{ mcpServers: ConfigEntry[] }>('/api/mcp'),
    select: data => data.mcpServers,
  })
}

/** Query hook for hooks merged from local, plugin, and project sources. */
export function useHooks() {
  return useQuery({
    queryKey: ['hooks'],
    queryFn: () => fetchJson<{ hooks: HookEntry[] }>('/api/hooks'),
    select: data => data.hooks,
  })
}

/** Query hook for LSP servers merged from local, plugin, and project sources. */
export function useLspServers() {
  return useQuery({
    queryKey: ['lsp'],
    queryFn: () => fetchJson<{ lspServers: ConfigEntry[] }>('/api/lsp'),
    select: data => data.lspServers,
  })
}
