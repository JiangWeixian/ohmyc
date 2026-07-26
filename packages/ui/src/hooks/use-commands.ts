import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { request } from '@/lib/transport'

import type { Command, Origin } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

interface CommandsListResponse {
  commands: Command[]
}

interface CommandDetailResponse {
  command: Command
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

export function useCommands() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['commands', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<CommandsListResponse>('commands.list', args)
      return r.commands
    },
  })
}

export function useCommand(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['commands', locator?.locatorId, locator?.name, locator?.source, locator?.pluginId, locator?.scope],
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
      const r = await request<CommandDetailResponse>('commands.get', args)
      return r.command
    },
    enabled: !!locator,
  })
}
