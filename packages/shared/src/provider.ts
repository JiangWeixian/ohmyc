export type Origin = 'agents' | 'claude' | 'opencode'

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

  parseAgent: (file: string, raw: string) => unknown
  parseCommand: (file: string, raw: string) => unknown
  parseSkill: (file: string, raw: string) => unknown

  agentBadges: (agent: unknown) => RenderBadge[]
  commandBadges: (cmd: unknown) => RenderBadge[]
}
