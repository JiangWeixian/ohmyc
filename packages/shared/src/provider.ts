import { z } from 'zod'

import type { AgentFrontmatter } from './agent-schema'
import type { CommandFrontmatter } from './command-schema'
import type { SkillFrontmatter } from './skill-schema'

export type Origin = 'claude' | 'codex' | 'opencode'

export interface ParsedAgent {
  id: string
  frontmatter: AgentFrontmatter
  content: string
  raw: string
  filename: string
}

export interface ParsedSkill {
  id: string
  frontmatter: SkillFrontmatter
  content: string
  raw: string
  filename: string
}

export interface ParsedCommand {
  id: string
  frontmatter: CommandFrontmatter
  content: string
  raw: string
  filename: string
}

export interface ProviderEntity<EntityData> {
  origins: Origin[]
  sourceFile: string
  scope: 'global' | 'project'
  data: EntityData
}

export interface RenderBadge {
  kind: 'mono' | 'pill'
  label: string
  tone?: 'neutral' | 'warn'
}

export interface ConfigProvider {
  readonly id: Origin
  readonly displayName: string

  agentsDirs: () => string[]
  commandsDirs: () => string[]
  skillsDirs: () => string[]

  parseAgent: (file: string, raw: string) => ParsedAgent | null
  parseCommand: (file: string, raw: string) => ParsedCommand | null
  parseSkill: (file: string, raw: string) => ParsedSkill | null

  agentBadges: (agent: ParsedAgent) => RenderBadge[]
  commandBadges: (cmd: ParsedCommand) => RenderBadge[]
}

export const RenderBadgeSchema = z.object({
  kind: z.enum(['mono', 'pill']),
  label: z.string(),
  tone: z.enum(['neutral', 'warn']).optional(),
})

export const OriginEnum = z.enum(['codex', 'claude', 'opencode'])
