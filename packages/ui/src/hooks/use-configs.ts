// React Query hooks for MCP servers, hooks, and LSP server configuration queries.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

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

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp'],
    queryFn: () => request<{ mcpServers: ConfigEntry[] }>('configs.mcp', {}),
    select: data => data.mcpServers,
  })
}

export function useHooks() {
  return useQuery({
    queryKey: ['hooks'],
    queryFn: () => request<{ hooks: HookEntry[] }>('configs.hooks', {}),
    select: data => data.hooks,
  })
}

export function useLspServers() {
  return useQuery({
    queryKey: ['lsp'],
    queryFn: () => request<{ lspServers: ConfigEntry[] }>('configs.lsp', {}),
    select: data => data.lspServers,
  })
}
