import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import {
  ProfileSchema,
  type StoreComponentProvenance,
  type StoreComponentType,
  type StoreImportConflict,
  type StoreImportRequest,
  type StoreImportResult,
} from '@ohmyc/shared'
import untildify from 'untildify'

/** Maps component types to their imported-source tracking records. */
type ProvenanceIndex = Record<StoreComponentType, Record<string, StoreComponentProvenance>>

/** A single file or directory queued for import into the store. */
interface ImportCandidate {
  type: StoreComponentType
  id: string
  sourcePath: string
  destinationPath: string
  isConflict: boolean
}

/** Factory for an empty import result. */
const EMPTY_RESULT = (): StoreImportResult => ({
  imported: 0,
  skipped: 0,
  overwritten: 0,
  errors: [],
  conflicts: [],
})

/**
 * Manages bulk import of agents, skills, and commands into the OhMyC store,
 * tracking provenance and preventing accidental overwrites.
 */
export class StoreService {
  constructor(
    private storeDir: string,
    private profilesDir: string,
  ) {}

  /** Path to the JSON file that tracks where each store component was imported from. */
  private getProvenanceIndexPath(): string {
    return path.join(this.storeDir, '.metadata', 'imports.json')
  }

  /** Checks whether a path exists without throwing. */
  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath)
      return true
    } catch {
      return false
    }
  }

  /** Recursively copies a file or directory tree. */
  private async copyRecursive(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceStat = await stat(sourcePath)

    if (sourceStat.isDirectory()) {
      await mkdir(destinationPath, { recursive: true })
      const entries = await readdir(sourcePath)
      for (const entry of entries) {
        await this.copyRecursive(path.join(sourcePath, entry), path.join(destinationPath, entry))
      }
      return
    }

    await mkdir(path.dirname(destinationPath), { recursive: true })
    await copyFile(sourcePath, destinationPath)
  }

  /** Reads the provenance index from disk, returning a default empty structure on missing/invalid JSON. */
  private async readProvenanceIndex(): Promise<ProvenanceIndex> {
    const importsPath = this.getProvenanceIndexPath()
    try {
      const raw = await readFile(importsPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ProvenanceIndex>
      return {
        agents: parsed.agents ?? {},
        skills: parsed.skills ?? {},
        commands: parsed.commands ?? {},
        'model-configs': parsed['model-configs'] ?? {},
      }
    } catch {
      return {
        agents: {},
        skills: {},
        commands: {},
        'model-configs': {},
      }
    }
  }

  /** Persists the provenance index back to disk. */
  private async writeProvenanceIndex(index: ProvenanceIndex): Promise<void> {
    const importsPath = this.getProvenanceIndexPath()
    await mkdir(path.dirname(importsPath), { recursive: true })
    await writeFile(importsPath, JSON.stringify(index, null, 2), 'utf8')
  }

  /** Scans `sourceDir/agents` for `.md` files that can be imported. */
  private async scanAgents(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = []
    try {
      const agentsSource = path.join(sourceDir, 'agents')
      const agentsDestination = path.join(this.storeDir, 'agents')
      await mkdir(agentsDestination, { recursive: true })
      const files = await readdir(agentsSource)
      for (const filename of files.filter(file => file.endsWith('.md'))) {
        const destinationPath = path.join(agentsDestination, filename)
        candidates.push({
          type: 'agents',
          id: filename.replace(/\.md$/, ''),
          sourcePath: path.join(agentsSource, filename),
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        })
      }
    } catch {
      return []
    }
    return candidates
  }

  /** Scans `sourceDir/skills` for directories containing `SKILL.md` that can be imported. */
  private async scanSkills(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = []
    try {
      const skillsSource = path.join(sourceDir, 'skills')
      const skillsDestination = path.join(this.storeDir, 'skills')
      await mkdir(skillsDestination, { recursive: true })
      const entries = await readdir(skillsSource)
      for (const entry of entries) {
        const sourcePath = path.join(skillsSource, entry)
        const sourceStat = await stat(sourcePath)
        if (!sourceStat.isDirectory()) {
          continue
        }
        if (!(await this.pathExists(path.join(sourcePath, 'SKILL.md')))) {
          continue
        }
        const destinationPath = path.join(skillsDestination, entry)
        candidates.push({
          type: 'skills',
          id: entry,
          sourcePath,
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        })
      }
    } catch {
      return []
    }
    return candidates
  }

  /** Scans `sourceDir/commands` for `.md` files that can be imported. */
  private async scanCommands(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = []
    try {
      const commandsSource = path.join(sourceDir, 'commands')
      const commandsDestination = path.join(this.storeDir, 'commands')
      await mkdir(commandsDestination, { recursive: true })
      const files = await readdir(commandsSource)
      for (const filename of files.filter(file => file.endsWith('.md'))) {
        const destinationPath = path.join(commandsDestination, filename)
        candidates.push({
          type: 'commands',
          id: filename.replace(/\.md$/, ''),
          sourcePath: path.join(commandsSource, filename),
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        })
      }
    } catch {
      return []
    }
    return candidates
  }

  /** Converts an import candidate into a conflict descriptor. */
  private toConflict(candidate: ImportCandidate): StoreImportConflict {
    return {
      type: candidate.type,
      id: candidate.id,
      sourcePath: candidate.sourcePath,
      destinationPath: candidate.destinationPath,
    }
  }

  /**
   * Dry-run scan: lists all import candidates and identifies conflicts
   * without modifying the store.
   * @param sourceDir - Directory containing agents/, skills/, and/or commands/ subdirectories.
   * @returns Import result with conflicts populated but no files copied.
   */
  async scanImport(sourceDir: string): Promise<StoreImportResult> {
    const candidates = await this.getImportCandidates(sourceDir)
    return {
      ...EMPTY_RESULT(),
      conflicts: candidates.filter(candidate => candidate.isConflict).map(candidate => this.toConflict(candidate)),
    }
  }

  /** Gathers all import candidates from the three component subdirectories in parallel. */
  private async getImportCandidates(sourceDir: string): Promise<ImportCandidate[]> {
    const [agents, skills, commands] = await Promise.all([
      this.scanAgents(sourceDir),
      this.scanSkills(sourceDir),
      this.scanCommands(sourceDir),
    ])

    return [...agents, ...skills, ...commands]
  }

  /**
   * Applies a bulk import, optionally overwriting existing files.
   * Tracks provenance for every imported component.
   * @param sourceDir - Source directory to import from.
   * @param overwrite - When true, replaces conflicting files instead of skipping them.
   * @returns Import result with counts and any errors that occurred.
   */
  async applyImport(sourceDir: string, overwrite = false): Promise<StoreImportResult> {
    const result = await this.scanImport(sourceDir)
    const candidates = await this.getImportCandidates(sourceDir)
    const provenanceIndex = await this.readProvenanceIndex()
    const importedAt = new Date().toISOString()

    for (const candidate of candidates) {
      if (candidate.isConflict && !overwrite) {
        result.skipped += 1
        continue
      }

      try {
        if (candidate.isConflict) {
          await rm(candidate.destinationPath, { recursive: true, force: true })
          result.overwritten += 1
        } else {
          result.imported += 1
        }

        await this.copyRecursive(candidate.sourcePath, candidate.destinationPath)
        provenanceIndex[candidate.type][candidate.id] = {
          importPath: candidate.sourcePath,
          importedAt,
        }
      } catch (error: any) {
        if (candidate.isConflict && overwrite) {
          result.overwritten -= 1
        } else {
          result.imported -= 1
        }
        result.errors.push(`${candidate.type.slice(0, -1)} ${candidate.id}: ${error.message}`)
      }
    }

    await this.writeProvenanceIndex(provenanceIndex)
    return result
  }

  /**
   * Public entry point for importing components into the store.
   * Accepts either a source directory path or a full request object.
   * @param request - Source directory string or structured import request.
   * @returns Import result with counts, conflicts, and errors.
   */
  async import(request: StoreImportRequest | string): Promise<StoreImportResult> {
    const raw = typeof request === 'string'
      ? { sourceDir: request, dryRun: false, overwrite: false }
      : request

    const normalized = {
      ...raw,
      sourceDir: path.resolve(untildify(raw.sourceDir)),
    }

    if (normalized.dryRun) {
      return this.scanImport(normalized.sourceDir)
    }

    return this.applyImport(normalized.sourceDir, normalized.overwrite ?? false)
  }

  /** Retrieves provenance metadata (original import path and timestamp) for a store component. */
  async getProvenance(type: StoreComponentType, id: string): Promise<StoreComponentProvenance | undefined> {
    const index = await this.readProvenanceIndex()
    return index[type][id]
  }

  /** Finds all profiles that reference a given component by name. */
  async getReferencingProfiles(type: 'agents' | 'commands' | 'model-configs' | 'skills', name: string): Promise<string[]> {
    const references: string[] = []
    try {
      const entries = await readdir(this.profilesDir)
      for (const entry of entries) {
        if (entry.startsWith('.')) {
          continue
        }
        try {
          const raw = await readFile(path.join(this.profilesDir, entry, 'profile.json'), 'utf8')
          const profile = ProfileSchema.parse(JSON.parse(raw))
          if (type === 'model-configs') {
            if (profile.modelConfig === name) {
              references.push(profile.name)
            }
          } else {
            if (profile[type].includes(name)) {
              references.push(profile.name)
            }
          }
        } catch {
          continue
        }
      }
    } catch { /* no profiles dir */ }
    return references
  }
}
