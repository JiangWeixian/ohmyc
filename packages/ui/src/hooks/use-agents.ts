import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { request } from '@/lib/transport'

import type { Agent, Origin } from '@ohmyc/shared'

interface AgentsListResponse {
  agents: Agent[]
}

interface AgentDetailResponse {
  agent: Agent
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

export interface ItemLocator {
  name: string
  locatorId?: string
  source?: string
  pluginId?: string
  scope?: 'global' | 'project'
}

export function useAgents() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['agents', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<AgentsListResponse>('agents.list', args)
      return r.agents
    },
  })
}

export function useAgent(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['agents', locator?.locatorId, locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: async () => {
      const args: Record<string, unknown> = { name: locator!.name }
      if (locator!.locatorId) {
        args.locator_id = locator!.locatorId
      }
      if (locator!.source) {
        args.source = locator!.source
      }
      if (locator!.pluginId) {
        args.pluginId = locator!.pluginId
      }
      if (locator!.scope) {
        args.scope = locator!.scope
      }
      const r = await request<AgentDetailResponse>('agents.get', args)
      return r.agent
    },
    enabled: !!locator,
  })
}
