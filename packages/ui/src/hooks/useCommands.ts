import { useQuery } from '@tanstack/react-query';
import type { Command } from '@claudeui/shared';

async function fetchCommands(): Promise<Command[]> {
  const response = await fetch('/api/commands');
  if (!response.ok) throw new Error('Failed to fetch commands');
  const data = await response.json();
  return data.commands;
}

import type { ItemLocator } from './useAgents';

async function fetchCommand(locator: ItemLocator): Promise<Command> {
  const params = new URLSearchParams();
  if (locator.source) params.set('source', locator.source);
  if (locator.pluginId) params.set('pluginId', locator.pluginId);
  if (locator.scope) params.set('scope', locator.scope);
  const qs = params.toString();
  const response = await fetch(`/api/commands/${encodeURIComponent(locator.name)}${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Command not found');
  const data = await response.json();
  return data.command;
}

export function useCommands() {
  return useQuery({ queryKey: ['commands'], queryFn: fetchCommands });
}

export function useCommand(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['commands', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchCommand(locator!),
    enabled: !!locator,
  });
}
