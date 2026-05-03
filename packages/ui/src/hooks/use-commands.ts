import { useQuery } from '@tanstack/react-query'

import type { Command } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

async function fetchCommands(): Promise<Command[]> {
  const response = await fetch('/api/commands')
  if (!response.ok) {
    throw new Error('Failed to fetch commands')
  }
  const data = await response.json()
  return data.commands
}

async function fetchCommand(locator: ItemLocator): Promise<Command> {
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
  const response = await fetch(`/api/commands/${encodeURIComponent(locator.name)}${qs ? `?${qs}` : ''}`)
  if (!response.ok) {
    throw new Error('Command not found')
  }
  const data = await response.json()
  return data.command
}

export function useCommands() {
  return useQuery({ queryKey: ['commands'], queryFn: fetchCommands })
}

export function useCommand(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['commands', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchCommand(locator!),
    enabled: !!locator,
  })
}
