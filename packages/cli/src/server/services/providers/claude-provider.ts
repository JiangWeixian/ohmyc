import path from 'node:path'

import matter from 'gray-matter'

import type {
  AgentFrontmatter,
  CommandFrontmatter,
  ConfigProvider,
  Origin,
  RenderBadge,
  SkillFrontmatter,
} from '@ohmyc/shared'

export interface ClaudeProviderOptions {
  agentsGlobalDir: string
  skillsGlobalDir?: string
  commandsGlobalDir?: string
  projectDir: string | null
}

export class ClaudeProvider implements ConfigProvider {
  readonly id: Origin = 'claude'
  readonly displayName = 'Claude'

  constructor(private opts: ClaudeProviderOptions) {}

  agentsDirs(): string[] {
    const dirs = [this.opts.agentsGlobalDir]
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'agents'))
    }
    return dirs
  }

  commandsDirs(): string[] {
    const dirs: string[] = []
    if (this.opts.commandsGlobalDir) {
      dirs.push(this.opts.commandsGlobalDir)
    }
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'commands'))
    }
    return dirs
  }

  skillsDirs(): string[] {
    const dirs: string[] = []
    if (this.opts.skillsGlobalDir) {
      dirs.push(this.opts.skillsGlobalDir)
    }
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'skills'))
    }
    return dirs
  }

  parseAgent(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as AgentFrontmatter
    if (!fm.name || !fm.description) {
      return null
    }
    return {
      id: path.basename(file).replace(/\.md$/, ''),
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseCommand(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as CommandFrontmatter
    if (!fm.name && !fm.description) {
      return null
    }
    return {
      id: path.basename(file).replace(/\.md$/, ''),
      frontmatter: { name: fm.name ?? path.basename(file).replace(/\.md$/, ''), ...fm },
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseSkill(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as SkillFrontmatter
    if (!fm.name || !fm.description) {
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

  agentBadges(agent: unknown): RenderBadge[] {
    const fm = (agent as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm.model === 'string') {
      out.push({ kind: 'mono', label: fm.model })
    }
    return out
  }

  commandBadges(cmd: unknown): RenderBadge[] {
    const fm = (cmd as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm['argument-hint'] === 'string') {
      out.push({ kind: 'mono', label: fm['argument-hint'] })
    }
    return out
  }
}
