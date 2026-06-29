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
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  commands: 'Custom slash commands you can invoke with ',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
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
