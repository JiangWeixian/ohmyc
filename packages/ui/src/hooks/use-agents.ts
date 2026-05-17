// React Query hooks for agent inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Agent, Origin } from '@ohmyc/shared'

/** Shape of the GET /api/agents response. */
interface AgentsListResponse {
  agents: Agent[]
}

/** Shape of the GET /api/agents/:name response. */
interface AgentDetailResponse {
  agent: Agent
}

/** Builds the sorted `origins=` query value, or null when the selection covers the full registered set. */
function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

/** Fetches all agents from the inventory (store, plugins, project), optionally filtered by origin. */
async function fetchAgents(origins: string | null): Promise<Agent[]> {
  const url = origins ? `/api/agents?origins=${origins}` : '/api/agents'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch agents')
  }
  const data: AgentsListResponse = await response.json()
  return data.agents
}

/** Identifies a specific agent, including optional source/plugin/scope for disambiguation. */
export interface ItemLocator {
  name: string
  source?: string
  pluginId?: string
  scope?: 'global' | 'project'
}

/** Fetches a single agent by locator. */
async function fetchAgent(locator: ItemLocator): Promise<Agent> {
  const parameters = new URLSearchParams()
  if (locator.source) {
    parameters.set('source', locator.source)
  }
  if (locator.pluginId) {
    parameters.set('pluginId', locator.pluginId)
  }
  if (locator.scope) {
    parameters.set('scope', locator.scope)
  }
  const qs = parameters.toString()
  const response = await fetch(`/api/agents/${encodeURIComponent(locator.name)}${qs ? `?${qs}` : ''}`)
  if (!response.ok) {
    throw new Error('Agent not found')
  }
  const data: AgentDetailResponse = await response.json()
  return data.agent
}

/** Query hook for listing all agents, filtered by the active SourceSwitcher selection. */
export function useAgents() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['agents', originsKey ?? 'all'],
    queryFn: () => fetchAgents(originsKey),
  })
}

/** Query hook for fetching a single agent by locator. */
export function useAgent(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['agents', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchAgent(locator!),
    enabled: !!locator,
  })
}
