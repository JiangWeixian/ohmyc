// React Query hooks for agent inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import type { Agent } from '@ohmyc/shared'

/** Shape of the GET /api/agents response. */
interface AgentsListResponse {
  agents: Agent[]
}

/** Shape of the GET /api/agents/:name response. */
interface AgentDetailResponse {
  agent: Agent
}

/** Fetches all agents from the inventory (store, plugins, project). */
async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents')
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

/** Query hook for listing all agents. */
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
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
