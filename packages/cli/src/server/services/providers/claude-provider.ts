import path from 'node:path'

import matter from 'gray-matter'

import type {
  AgentFrontmatter,
  CommandFrontmatter,
  ConfigProvider,
  Origin,
  ParsedAgent,
  ParsedCommand,
  ParsedSkill,
  RenderBadge,
  SkillFrontmatter,
} from '@ohmyc/shared'

export interface ClaudeProviderOptions {
  agentsGlobalDir: string
  skillsGlobalDir: string
  commandsGlobalDir: string
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
    const dirs: string[] = [this.opts.commandsGlobalDir]
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'commands'))
    }
    return dirs
  }

  skillsDirs(): string[] {
    const dirs: string[] = [this.opts.skillsGlobalDir]
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'skills'))
    }
    return dirs
  }

  parseAgent(file: string, raw: string): ParsedAgent | null {
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

  parseCommand(file: string, raw: string): ParsedCommand | null {
    const parsed = matter(raw)
    const fm = parsed.data as CommandFrontmatter
    const id = path.basename(file).replace(/\.md$/, '')
    return {
      id,
      frontmatter: { ...fm, name: fm.name || id },
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseSkill(file: string, raw: string): ParsedSkill | null {
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

  agentBadges(agent: ParsedAgent): RenderBadge[] {
    const out: RenderBadge[] = []
    if (typeof agent.frontmatter.model === 'string') {
      out.push({ kind: 'mono', label: agent.frontmatter.model })
    }
    return out
  }

  commandBadges(cmd: ParsedCommand): RenderBadge[] {
    const out: RenderBadge[] = []
    const hint = cmd.frontmatter['argument-hint']
    if (typeof hint === 'string') {
      out.push({ kind: 'mono', label: hint })
    }
    return out
  }
}
