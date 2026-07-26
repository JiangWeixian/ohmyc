import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { request } from '@/lib/transport'

import type { Origin, Skill } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

interface SkillsListResponse {
  skills: Skill[]
}

interface SkillDetailResponse {
  skill: Skill
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

export function useSkills() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['skills', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<SkillsListResponse>('skills.list', args)
      return r.skills
    },
  })
}

export function useSkill(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['skills', locator?.locatorId, locator?.name, locator?.source, locator?.pluginId, locator?.scope],
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
      const r = await request<SkillDetailResponse>('skills.get', args)
      return r.skill
    },
    enabled: !!locator,
  })
}
