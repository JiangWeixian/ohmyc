import { existsSync } from 'node:fs'
import path from 'node:path'

import matter from 'gray-matter'

import type {
  ConfigProvider,
  Origin,
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

  parseAgent(): unknown {
    return null
  }

  parseCommand(): unknown {
    return null
  }

  parseSkill(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    if (typeof fm.name !== 'string' || typeof fm.description !== 'string') {
      return null
    }
    return {
      id: fm.name,
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: 'SKILL.md',
    }
  }

  agentBadges(): RenderBadge[] {
    return []
  }

  commandBadges(): RenderBadge[] {
    return []
  }
}
