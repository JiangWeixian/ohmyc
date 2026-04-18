import { useQuery } from '@tanstack/react-query';
import type { Agent } from '@claudeui/shared';

interface AgentsListResponse {
  agents: Agent[];
}

interface AgentDetailResponse {
  agent: Agent;
}

async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents');
  if (!response.ok) {
    throw new Error('Failed to fetch agents');
  }
  const data: AgentsListResponse = await response.json();
  return data.agents;
}

export interface ItemLocator {
  name: string;
  source?: string;
  pluginId?: string;
  scope?: 'global' | 'project';
}

async function fetchAgent(locator: ItemLocator): Promise<Agent> {
  const params = new URLSearchParams();
  if (locator.source) params.set('source', locator.source);
  if (locator.pluginId) params.set('pluginId', locator.pluginId);
  if (locator.scope) params.set('scope', locator.scope);
  const qs = params.toString();
  const response = await fetch(`/api/agents/${encodeURIComponent(locator.name)}${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Agent not found');
  }
  const data: AgentDetailResponse = await response.json();
  return data.agent;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });
}

export function useAgent(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['agents', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchAgent(locator!),
    enabled: !!locator,
  });
}
