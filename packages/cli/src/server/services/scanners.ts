import {
  access,
  readdir,
  stat,
} from 'node:fs/promises'
import path from 'node:path'

export async function scanMdFiles(dir: string): Promise<string[]> {
  try {
    await access(dir)
  } catch {
    return []
  }
  const entries = await readdir(dir)
  return entries
    .filter(f => f.endsWith('.md'))
    .toSorted()
    .map(f => path.join(dir, f))
}

export async function scanSkillDirs(dir: string): Promise<string[]> {
  try {
    await access(dir)
  } catch {
    return []
  }
  const entries = await readdir(dir)
  const out: string[] = []
  for (const name of entries.toSorted()) {
    const sub = path.join(dir, name)
    try {
      const st = await stat(sub)
      if (!st.isDirectory()) {
        continue
      }
      const skillFile = path.join(sub, 'SKILL.md')
      await access(skillFile)
      out.push(skillFile)
    } catch {
      continue
    }
  }
  return out
}
