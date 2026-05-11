import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { scanMdFiles, scanSkillDirs } from './scanners'

import type {
  ConfigProvider,
  Origin,
  ProviderEntity,
} from '@ohmyc/shared'

interface ListFilter {
  origins?: Origin[]
}

function canonicalize(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

function inFilter(entity: ProviderEntity<unknown>, filter?: ListFilter): boolean {
  if (!filter?.origins || filter.origins.length === 0) {
    return true
  }
  return entity.origins.some(o => filter.origins!.includes(o))
}

export class ProviderRegistry {
  constructor(private providers: ConfigProvider[]) {}

  async listAgents(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    return this.listFlat('agents', filter)
  }

  async listCommands(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    return this.listFlat('commands', filter)
  }

  async listSkills(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    const byPath = new Map<string, ProviderEntity<unknown>>()

    for (const provider of this.providers) {
      for (let i = 0; i < provider.skillsDirs().length; i++) {
        const dir = provider.skillsDirs()[i]
        const scope = i === 0 ? 'global' : 'project'
        const skillFiles = await scanSkillDirs(dir)
        for (const file of skillFiles) {
          const canonical = canonicalize(file)
          const existing = byPath.get(canonical)
          if (existing) {
            if (!existing.origins.includes(provider.id)) {
              existing.origins.push(provider.id)
            }
            continue
          }
          const raw = await readFile(file, 'utf8')
          const data = provider.parseSkill(file, raw)
          if (!data) {
            continue
          }
          byPath.set(canonical, {
            origins: [provider.id],
            sourceFile: file,
            scope,
            data,
          })
        }
      }
    }

    return [...byPath.values()].filter(e => inFilter(e, filter))
  }

  private async listFlat(
    kind: 'agents' | 'commands',
    filter?: ListFilter,
  ): Promise<ProviderEntity<unknown>[]> {
    const out: ProviderEntity<unknown>[] = []
    for (const provider of this.providers) {
      const dirs = kind === 'agents' ? provider.agentsDirs() : provider.commandsDirs()
      for (const [i, dir] of dirs.entries()) {
        const scope = i === 0 ? 'global' : 'project'
        const files = await scanMdFiles(dir)
        for (const file of files) {
          const raw = await readFile(file, 'utf8')
          const data = kind === 'agents'
            ? provider.parseAgent(file, raw)
            : provider.parseCommand(file, raw)
          if (!data) {
            continue
          }
          out.push({
            origins: [provider.id],
            sourceFile: file,
            scope,
            data,
          })
        }
      }
    }
    return out.filter(e => inFilter(e, filter))
  }
}
