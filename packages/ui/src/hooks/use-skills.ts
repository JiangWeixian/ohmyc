import { useQuery } from '@tanstack/react-query'

import type { Skill } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

interface SkillsListResponse {
  skills: Skill[]
}

interface SkillDetailResponse {
  skill: Skill
}

async function fetchSkills(): Promise<Skill[]> {
  const response = await fetch('/api/skills')
  if (!response.ok) {
    throw new Error('Failed to fetch skills')
  }
  const data: SkillsListResponse = await response.json()
  return data.skills
}

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

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
  })
}

export function useSkill(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['skills', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: () => fetchSkill(locator!),
    enabled: !!locator,
  })
}
