import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import { SAFE_NAME_PATTERN } from '@ohmyc/shared'
import matter from 'gray-matter'

import type { Skill, SkillFrontmatter } from '@ohmyc/shared'

const SKILL_FILE = 'SKILL.md'

export class SkillService {
  constructor(private skillsDir: string) {}

  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Skill name "${name}" is invalid: must match [a-zA-Z0-9_-]`)
    }
  }

  private parseSkillFile(dirName: string, raw: string): Skill | null {
    const parsed = matter(raw)
    const frontmatter = parsed.data as SkillFrontmatter
    const name = frontmatter.name || dirName
    const description = frontmatter.description || ''
    return {
      id: dirName,
      frontmatter: { ...frontmatter, name, description },
      content: parsed.content.trim(),
      raw,
      dirName,
      source: 'local',
    }
  }

  async list(): Promise<Skill[]> {
    try {
      await access(this.skillsDir)
    } catch {
      return []
    }

    const entries = await readdir(this.skillsDir)
    const sorted = entries.toSorted()

    const skills: Skill[] = []
    for (const entry of sorted) {
      const entryPath = path.join(this.skillsDir, entry)
      try {
        const s = await stat(entryPath)
        if (!s.isDirectory()) {
          continue
        }
        const skillFile = path.join(entryPath, SKILL_FILE)
        const raw = await readFile(skillFile, 'utf8')
        const skill = this.parseSkillFile(entry, raw)
        if (skill) {
          skills.push(skill)
        }
      } catch {
        continue
      }
    }

    return skills
  }

  async get(name: string): Promise<Skill | null> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return null
    }
    const skillFile = path.join(this.skillsDir, name, SKILL_FILE)
    try {
      const raw = await readFile(skillFile, 'utf8')
      return this.parseSkillFile(name, raw)
    } catch {
      return null
    }
  }

  async create(frontmatter: SkillFrontmatter, content: string): Promise<Skill> {
    const name = frontmatter.name || ''
    this.validateName(name)

    const skillDir = path.join(this.skillsDir, name)

    try {
      await access(skillDir)
      throw new Error(`Skill "${name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    await mkdir(skillDir, { recursive: true })

    const raw = matter.stringify(content, frontmatter)
    await writeFile(path.join(skillDir, SKILL_FILE), raw, 'utf8')

    return {
      id: name,
      frontmatter,
      content: content.trim(),
      raw,
      dirName: name,
      source: 'local',
    }
  }

  async update(
    name: string,
    changes: { frontmatter?: Partial<SkillFrontmatter>; content?: string },
  ): Promise<Skill | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const mergedFrontmatter = changes.frontmatter
      ? { ...existing.frontmatter, ...changes.frontmatter }
      : existing.frontmatter

    const mergedContent = changes.content === undefined ? existing.content : changes.content

    const raw = matter.stringify(mergedContent, mergedFrontmatter)
    await writeFile(path.join(this.skillsDir, name, SKILL_FILE), raw, 'utf8')

    return {
      id: name,
      frontmatter: mergedFrontmatter as SkillFrontmatter,
      content: mergedContent.trim(),
      raw,
      dirName: name,
      source: 'local',
    }
  }

  async delete(name: string): Promise<boolean> {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return false
    }
    const skillDir = path.join(this.skillsDir, name)
    try {
      await access(skillDir)
      await rm(skillDir, { recursive: true })
      return true
    } catch {
      return false
    }
  }
}
