import { existsSync } from 'node:fs'
import path from 'node:path'

import { parseGenericSkill } from './parse-skill'

import type {
  ConfigProvider,
  Origin,
  ParsedAgent,
  ParsedCommand,
  ParsedSkill,
  RenderBadge,
} from '@ohmyc/shared'

export interface AgentsSharedProviderOptions {
  home: string
  cwd: string
}

export class AgentsSharedProvider implements ConfigProvider {
  readonly id: Origin = 'agents'
  readonly displayName = 'Shared'

  private readonly globalDir: string
  private readonly projectDir: string | null

  constructor(opts: AgentsSharedProviderOptions) {
    this.globalDir = path.join(opts.home, '.agents')
    const candidate = path.join(opts.cwd, '.agents')
    this.projectDir = existsSync(candidate) ? candidate : null
  }

  agentsDirs(): string[] {
    return []
  }

  commandsDirs(): string[] {
    return []
  }

  skillsDirs(): string[] {
    const out = [path.join(this.globalDir, 'skills')]
    if (this.projectDir) {
      out.push(path.join(this.projectDir, 'skills'))
    }
    return out
  }

  parseAgent(): ParsedAgent | null {
    return null
  }

  parseCommand(): ParsedCommand | null {
    return null
  }

  parseSkill(file: string, raw: string): ParsedSkill | null {
    return parseGenericSkill(file, raw)
  }

  agentBadges(): RenderBadge[] {
    return []
  }

  commandBadges(): RenderBadge[] {
    return []
  }
}
