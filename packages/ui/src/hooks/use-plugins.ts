// React Query hooks for installed plugins and marketplace listing.
import { useQuery } from '@tanstack/react-query'

import type {
  InstalledPlugin,
  Marketplace,
  PluginInstall,
  PluginManifest,
} from '@ohmyc/shared'

/** Normalized view of an installed plugin with resolved component counts. */
export interface PluginInventoryItem {
  id: string
  name: string
  marketplace: string
  enabled: boolean
  installs: PluginInstall[]
  manifest: PluginManifest | null
  componentCounts: {
    agents: number
    skills: number
    commands: number
  }
}

/** Normalizes raw InstalledPlugin data into a safe, UI-ready shape. */
function normalizePlugin(plugin: InstalledPlugin): PluginInventoryItem {
  const installs = Array.isArray(plugin.installs) ? plugin.installs : []

  return {
    id: plugin.id,
    name: plugin.name,
    marketplace: plugin.marketplace,
    enabled: plugin.enabled === true,
    installs,
    manifest: plugin.manifest ?? null,
    componentCounts: {
      agents: Array.isArray(plugin.components?.agents) ? plugin.components.agents.length : 0,
      skills: Array.isArray(plugin.components?.skills) ? plugin.components.skills.length : 0,
      commands: Array.isArray(plugin.components?.commands) ? plugin.components.commands.length : 0,
    },
  }
}

/** Fetches and normalizes the full list of installed plugins. */
async function fetchPlugins(): Promise<PluginInventoryItem[]> {
  const response = await fetch('/api/plugins')
  if (!response.ok) {
    throw new Error('Failed to fetch plugins')
  }
  const data = (await response.json()) as { plugins?: InstalledPlugin[] }
  return Array.isArray(data.plugins) ? data.plugins.map(plugin => normalizePlugin(plugin)) : []
}

/** Fetches available plugin marketplaces. */
async function fetchMarketplaces(): Promise<Marketplace[]> {
  const response = await fetch('/api/marketplaces')
  if (!response.ok) {
    throw new Error('Failed to fetch marketplaces')
  }
  const data = await response.json()
  return data.marketplaces
}

/** Query hook for listing installed plugins with normalized component counts. */
export function usePlugins() {
  return useQuery({ queryKey: ['plugins'], queryFn: fetchPlugins })
}

/** Query hook for listing available plugin marketplaces. */
export function useMarketplaces() {
  return useQuery({ queryKey: ['marketplaces'], queryFn: fetchMarketplaces })
}
