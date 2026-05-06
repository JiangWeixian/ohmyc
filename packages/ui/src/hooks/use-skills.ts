// React Query hooks for skill inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import type { Skill } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

/** Shape of the GET /api/skills response. */
interface SkillsListResponse {
  skills: Skill[]
}

/** Shape of the GET /api/skills/:name response. */
interface SkillDetailResponse {
  skill: Skill
}

/** Fetches all skills across store, plugins, and project sources. */
async function fetchSkills(): Promise<Skill[]> {
  const response = await fetch('/api/skills')
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

/** Query hook for listing all skills. */
export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
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
