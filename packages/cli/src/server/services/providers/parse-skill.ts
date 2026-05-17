import matter from 'gray-matter'

import type { ParsedSkill, SkillFrontmatter } from '@ohmyc/shared'

/**
 * Generic SKILL.md parser shared by providers that follow the
 * `name` + `description` frontmatter convention (opencode, agents-shared).
 */
export function parseGenericSkill(_file: string, raw: string): ParsedSkill | null {
  const parsed = matter(raw)
  const fm = parsed.data as Record<string, unknown>
  if (typeof fm.name !== 'string' || typeof fm.description !== 'string') {
    return null
  }
  return {
    id: fm.name,
    frontmatter: fm as SkillFrontmatter,
    content: parsed.content.trim(),
    raw,
    filename: 'SKILL.md',
  }
}
