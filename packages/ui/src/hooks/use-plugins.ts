// React Query hooks for installed plugins and marketplace listing.
import { useQuery } from '@tanstack/react-query'

import { request } from '../lib/transport'

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

/** Query hook for listing installed plugins with normalized component counts. */
export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const data = await request<{ plugins?: InstalledPlugin[] }>('plugins.list', {})
      return Array.isArray(data.plugins) ? data.plugins.map(plugin => normalizePlugin(plugin)) : []
    },
  })
}

/** Query hook for listing available plugin marketplaces. */
export function useMarketplaces() {
  return useQuery({
    queryKey: ['marketplaces'],
    queryFn: async () => {
      const data = await request<{ marketplaces?: Marketplace[] }>('marketplaces.list', {})
      return Array.isArray(data.marketplaces) ? data.marketplaces : []
    },
  })
}
