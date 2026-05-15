import { existsSync } from 'node:fs'
import path from 'node:path'

import matter from 'gray-matter'

import { parseGenericSkill } from './parse-skill'

import type {
  AgentFrontmatter,
  CommandFrontmatter,
  ConfigProvider,
  Origin,
  ParsedAgent,
  ParsedCommand,
  ParsedSkill,
  RenderBadge,
} from '@ohmyc/shared'

export interface OpencodeProviderOptions {
  home: string
  platform: NodeJS.Platform
  cwd: string
}

const GLOBAL_DIR_NAME = 'opencode'

function defaultGlobalDir(home: string, platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', GLOBAL_DIR_NAME)
  }
  return path.join(home, '.config', GLOBAL_DIR_NAME)
}

export class OpencodeProvider implements ConfigProvider {
  readonly id: Origin = 'opencode'
  readonly displayName = 'Opencode'

  private readonly globalDir: string
  private readonly projectDir: string | null

  constructor(opts: OpencodeProviderOptions) {
    // OPENCODE_CONFIG_DIR is read once at construction. Long-running servers
    // need a restart to pick up env changes.
    const override = process.env.OPENCODE_CONFIG_DIR
    this.globalDir = override && override.length > 0
      ? override
      : defaultGlobalDir(opts.home, opts.platform)

    const candidate = path.join(opts.cwd, '.opencode')
    this.projectDir = existsSync(candidate) ? candidate : null
  }

  private dirs(kind: 'agents' | 'commands' | 'skills'): string[] {
    const out = [path.join(this.globalDir, kind)]
    if (this.projectDir) {
      out.push(path.join(this.projectDir, kind))
    }
    return out
  }

  agentsDirs(): string[] {
    return this.dirs('agents')
  }

  commandsDirs(): string[] {
    return this.dirs('commands')
  }

  skillsDirs(): string[] {
    return this.dirs('skills')
  }

  parseAgent(file: string, raw: string): ParsedAgent | null {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    if (typeof fm.description !== 'string' || fm.description.length === 0) {
      return null
    }
    const id = (typeof fm.name === 'string' && fm.name)
      || path.basename(file).replace(/\.md$/, '')
    const frontmatter = { ...fm, name: id, description: fm.description } as AgentFrontmatter
    return {
      id,
      frontmatter,
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseCommand(file: string, raw: string): ParsedCommand | null {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    const id = (typeof fm.name === 'string' && fm.name)
      || path.basename(file).replace(/\.md$/, '')
    const frontmatter = { ...fm, name: id } as CommandFrontmatter
    return {
      id,
      frontmatter,
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseSkill(file: string, raw: string): ParsedSkill | null {
    return parseGenericSkill(file, raw)
  }

  agentBadges(agent: ParsedAgent): RenderBadge[] {
    const out: RenderBadge[] = []
    const mode = (agent.frontmatter as Record<string, unknown>).mode
    if (typeof mode === 'string') {
      out.push({ kind: 'mono', label: mode })
    }
    return out
  }

  commandBadges(cmd: ParsedCommand): RenderBadge[] {
    const out: RenderBadge[] = []
    const fm = cmd.frontmatter as Record<string, unknown>
    if (typeof fm.agent === 'string') {
      out.push({ kind: 'mono', label: fm.agent })
    }
    if (fm.subtask === true) {
      out.push({ kind: 'pill', label: 'subtask' })
    }
    return out
  }
}
