// Per-section configuration for entity list pages (agents, skills, commands).
// Extracted from explorer.tsx so the shared EntityList component and the
// per-section page components can both consume it without circular deps.
import type {
  Agent,
  Command,
  Skill,
} from '@ohmyc/shared'

export type EntitySection = 'agents' | 'commands' | 'skills'

export const SECTION_DESCRIPTIONS: Record<EntitySection, string> = {
  agents:
    'Local agents available to your coding tools. Inspect scope, source, and instructions.',
  commands: 'Reusable slash commands available as ',
  skills:
    'Reusable instructions your coding agents can invoke for focused tasks.',
}

export const ENTITY_CONFIG = {
  agents: {
    iconAccentVar: '--text-primary',
    getTitle: (entity: Agent) => entity.frontmatter.name,
    getDescription: (entity: Agent) => entity.frontmatter.description,
  },
  skills: {
    iconAccentVar: '--text-secondary',
    getTitle: (entity: Skill) => entity.frontmatter.name,
    getDescription: (entity: Skill) => entity.frontmatter.description,
  },
  commands: {
    iconAccentVar: '--text-tertiary',
    getTitle: (entity: Command) => `/${entity.frontmatter.name}`,
    getDescription: (entity: Command) => entity.frontmatter.description,
  },
} as const
