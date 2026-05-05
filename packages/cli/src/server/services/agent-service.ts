import {
  access,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { SAFE_NAME_PATTERN } from '@ohmyc/shared'
import matter from 'gray-matter'

import type { Agent, AgentFrontmatter } from '@ohmyc/shared'

/**
 * CRUD service for agent definitions stored as Markdown files with YAML frontmatter.
 * Each agent is a `.md` file in the configured `agentsDir`.
 */
export class AgentService {
  constructor(private agentsDir: string) {}

  /** Validates that a name contains only safe characters ([a-zA-Z0-9_-]). */
  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Agent name "${name}" is invalid: must match [a-zA-Z0-9_-]`)
    }
  }

  /**
   * Parses a raw Markdown file into an {@link Agent} object.
   * Returns null when required frontmatter fields (name, description) are missing.
   */
  private parseAgentFile(filename: string, raw: string): Agent | null {
    const parsed = matter(raw)
    const frontmatter = parsed.data as AgentFrontmatter
    if (!frontmatter.name || !frontmatter.description) {
      return null
    }
    return {
      id: filename.replace(/\.md$/, ''),
      frontmatter,
      content: parsed.content.trim(),
      raw,
      filename,
      source: 'local',
    }
  }

  /** Fetches a single agent by name. Returns null if not found or name is invalid. */
  async get(name: string): Promise<Agent | null> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return null
    }
    const filePath = path.join(this.agentsDir, `${name}.md`)
    try {
      const raw = await readFile(filePath, 'utf8')
      return this.parseAgentFile(`${name}.md`, raw)
    } catch {
      return null
    }
  }

  /**
   * Creates a new agent file. Throws if the name is invalid or the file already exists.
   * @param frontmatter - Agent metadata (must include name and description).
   * @param content - Markdown body content.
   * @returns The newly created agent.
   */
  async create(frontmatter: AgentFrontmatter, content: string): Promise<Agent> {
    this.validateName(frontmatter.name)

    await mkdir(this.agentsDir, { recursive: true })

    const filename = `${frontmatter.name}.md`
    const filePath = path.join(this.agentsDir, filename)

    try {
      await access(filePath)
      throw new Error(`Agent "${frontmatter.name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    const raw = matter.stringify(content, frontmatter)
    await writeFile(filePath, raw, 'utf8')

    return {
      id: frontmatter.name,
      frontmatter,
      content: content.trim(),
      raw,
      filename,
      source: 'local',
    }
  }

  /**
   * Updates an existing agent by merging provided frontmatter/content changes.
   * @param name - The agent identifier (filename without `.md`).
   * @param changes - Partial frontmatter and/or content to merge.
   * @returns The updated agent, or null if not found.
   */
  async update(
    name: string,
    changes: { frontmatter?: Partial<AgentFrontmatter>; content?: string },
  ): Promise<Agent | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const mergedFrontmatter = changes.frontmatter
      ? { ...existing.frontmatter, ...changes.frontmatter }
      : existing.frontmatter

    const mergedContent = changes.content === undefined ? existing.content : changes.content

    const raw = matter.stringify(mergedContent, mergedFrontmatter)
    const filePath = path.join(this.agentsDir, `${name}.md`)
    await writeFile(filePath, raw, 'utf8')

    return {
      id: name,
      frontmatter: mergedFrontmatter as AgentFrontmatter,
      content: mergedContent.trim(),
      raw,
      filename: `${name}.md`,
      source: 'local',
    }
  }

  /** Deletes an agent file by name. Returns true if the file existed and was removed. */
  async delete(name: string): Promise<boolean> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return false
    }
    const filePath = path.join(this.agentsDir, `${name}.md`)
    try {
      await access(filePath)
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  /** Lists all agents in the directory, sorted alphabetically by filename. */
  async list(): Promise<Agent[]> {
    try {
      await access(this.agentsDir)
    } catch {
      return []
    }

    const files = await readdir(this.agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md')).toSorted()

    const agents: Agent[] = []
    for (const filename of mdFiles) {
      const filePath = path.join(this.agentsDir, filename)
      try {
        const raw = await readFile(filePath, 'utf8')
        const agent = this.parseAgentFile(filename, raw)
        if (agent) {
          agents.push(agent)
        }
      } catch {
        continue
      }
    }

    return agents
  }
}
