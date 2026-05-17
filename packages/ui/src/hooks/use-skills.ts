// React Query hooks for skill inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Origin, Skill } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

/** Shape of the GET /api/skills response. */
interface SkillsListResponse {
  skills: Skill[]
}

/** Shape of the GET /api/skills/:name response. */
interface SkillDetailResponse {
  skill: Skill
}

/** Builds the sorted `origins=` query value, or null when the selection covers the full registered set. */
function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

/** Fetches all skills across store, plugins, and project sources, optionally filtered by origin. */
async function fetchSkills(origins: string | null): Promise<Skill[]> {
  const url = origins ? `/api/skills?origins=${origins}` : '/api/skills'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch skills')
  }
  const data: SkillsListResponse = await response.json()
  return data.skills
}

/** Fetches a single skill by locator, using query params for source disambiguation. */
async function fetchSkill(locator: ItemLocator): Promise<Skill> {
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
  const response = await fetch(`/api/skills/${encodeURIComponent(locator.name)}${qs ? `?${qs}` : ''}`)
  if (!response.ok) {
    throw new Error('Skill not found')
  }
  const data: SkillDetailResponse = await response.json()
  return data.skill
}

/** Query hook for listing all skills, filtered by the active SourceSwitcher selection. */
export function useSkills() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['skills', originsKey ?? 'all'],
    queryFn: () => fetchSkills(originsKey),
  })
}

/**
 * Query hook for fetching a single skill by locator.
 * @param locator - Identifies the skill with optional source/plugin/scope for disambiguation.
 *   Pass `null` to disable the query.
 */
export function useSkill(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['skills', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchSkill(locator!),
    enabled: !!locator,
  })
}
