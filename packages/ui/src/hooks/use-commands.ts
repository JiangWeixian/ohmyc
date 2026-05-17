// React Query hooks for command inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Command, Origin } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

/** Builds the sorted `origins=` query value, or null when the selection covers the full registered set. */
function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

/** Fetches all commands across store, plugins, and project sources, optionally filtered by origin. */
async function fetchCommands(origins: string | null): Promise<Command[]> {
  const url = origins ? `/api/commands?origins=${origins}` : '/api/commands'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch commands')
  }
  const data = await response.json()
  return data.commands
}

/** Fetches a single command by locator, using query params for source disambiguation. */
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

/** Query hook for listing all commands, filtered by the active SourceSwitcher selection. */
export function useCommands() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['commands', originsKey ?? 'all'],
    queryFn: () => fetchCommands(originsKey),
  })
}

/**
 * Query hook for fetching a single command by locator.
 * @param locator - Identifies the command with optional source/plugin/scope for disambiguation.
 *   Pass `null` to disable the query.
 */
export function useCommand(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['commands', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchCommand(locator!),
    enabled: !!locator,
  })
}
