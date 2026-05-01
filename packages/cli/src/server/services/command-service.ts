import {
  access,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { SAFE_NAME_PATTERN } from '@claudeui/shared'
import matter from 'gray-matter'

import type { Command, CommandFrontmatter } from '@claudeui/shared'

export class CommandService {
  constructor(private commandsDir: string) {}

  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Command name "${name}" is invalid: must match [a-zA-Z0-9_-]`)
    }
  }

  private parseCommandFile(filename: string, raw: string): Command | null {
    const parsed = matter(raw)
    const frontmatter = parsed.data as CommandFrontmatter
    const id = filename.replace(/\.md$/, '')
    const name = frontmatter.name || id
    return {
      id,
      frontmatter: { ...frontmatter, name },
      content: parsed.content.trim(),
      raw,
      filename,
      source: 'local',
    }
  }

  async list(): Promise<Command[]> {
    try {
      await access(this.commandsDir)
    } catch {
      return []
    }

    const files = await readdir(this.commandsDir)
    const mdFiles = files.filter(f => f.endsWith('.md')).toSorted()

    const commands: Command[] = []
    for (const filename of mdFiles) {
      const filePath = path.join(this.commandsDir, filename)
      try {
        const raw = await readFile(filePath, 'utf8')
        const command = this.parseCommandFile(filename, raw)
        if (command) {
          commands.push(command)
        }
      } catch {
        continue
      }
    }

    return commands
  }

  async get(name: string): Promise<Command | null> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return null
    }
    const filePath = path.join(this.commandsDir, `${name}.md`)
    try {
      const raw = await readFile(filePath, 'utf8')
      return this.parseCommandFile(`${name}.md`, raw)
    } catch {
      return null
    }
  }

  async create(frontmatter: CommandFrontmatter, content: string): Promise<Command> {
    const name = frontmatter.name || ''
    this.validateName(name)

    await mkdir(this.commandsDir, { recursive: true })

    const filename = `${name}.md`
    const filePath = path.join(this.commandsDir, filename)

    try {
      await access(filePath)
      throw new Error(`Command "${name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    const raw = matter.stringify(content, frontmatter)
    await writeFile(filePath, raw, 'utf8')

    return {
      id: name,
      frontmatter,
      content: content.trim(),
      raw,
      filename,
      source: 'local',
    }
  }

  async update(
    name: string,
    changes: { frontmatter?: Partial<CommandFrontmatter>; content?: string },
  ): Promise<Command | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const mergedFrontmatter = changes.frontmatter
      ? { ...existing.frontmatter, ...changes.frontmatter }
      : existing.frontmatter

    const mergedContent = changes.content === undefined ? existing.content : changes.content

    const raw = matter.stringify(mergedContent, mergedFrontmatter)
    await writeFile(path.join(this.commandsDir, `${name}.md`), raw, 'utf8')

    return {
      id: name,
      frontmatter: mergedFrontmatter as CommandFrontmatter,
      content: mergedContent.trim(),
      raw,
      filename: `${name}.md`,
      source: 'local',
    }
  }

  async delete(name: string): Promise<boolean> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return false
    }
    const filePath = path.join(this.commandsDir, `${name}.md`)
    try {
      await access(filePath)
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }
}
