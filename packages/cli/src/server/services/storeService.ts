import { readdir, readFile, copyFile, mkdir, access, stat, writeFile, rm } from 'fs/promises';
import path from 'path';
import untildify from 'untildify';
import {
  ProfileSchema,
  type StoreComponentProvenance,
  type StoreComponentType,
  type StoreImportConflict,
  type StoreImportRequest,
  type StoreImportResult,
} from '@claudeui/shared';

type ProvenanceIndex = Record<StoreComponentType, Record<string, StoreComponentProvenance>>;

interface ImportCandidate {
  type: StoreComponentType;
  id: string;
  sourcePath: string;
  destinationPath: string;
  isConflict: boolean;
}

const EMPTY_RESULT = (): StoreImportResult => ({
  imported: 0,
  skipped: 0,
  overwritten: 0,
  errors: [],
  conflicts: [],
});

export class StoreService {
  constructor(
    private storeDir: string,
    private profilesDir: string,
  ) {}

  private getProvenanceIndexPath(): string {
    return path.join(this.storeDir, '.metadata', 'imports.json');
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async copyRecursive(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceStat = await stat(sourcePath);

    if (sourceStat.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      const entries = await readdir(sourcePath);
      for (const entry of entries) {
        await this.copyRecursive(path.join(sourcePath, entry), path.join(destinationPath, entry));
      }
      return;
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }

  private async readProvenanceIndex(): Promise<ProvenanceIndex> {
    const importsPath = this.getProvenanceIndexPath();
    try {
      const raw = await readFile(importsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ProvenanceIndex>;
      return {
        agents: parsed.agents ?? {},
        skills: parsed.skills ?? {},
        commands: parsed.commands ?? {},
        'model-configs': parsed['model-configs'] ?? {},
      };
    } catch {
      return {
        agents: {},
        skills: {},
        commands: {},
        'model-configs': {},
      };
    }
  }

  private async writeProvenanceIndex(index: ProvenanceIndex): Promise<void> {
    const importsPath = this.getProvenanceIndexPath();
    await mkdir(path.dirname(importsPath), { recursive: true });
    await writeFile(importsPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  private async scanAgents(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = [];
    try {
      const agentsSrc = path.join(sourceDir, 'agents');
      const agentsDest = path.join(this.storeDir, 'agents');
      await mkdir(agentsDest, { recursive: true });
      const files = await readdir(agentsSrc);
      for (const filename of files.filter(file => file.endsWith('.md'))) {
        const destinationPath = path.join(agentsDest, filename);
        candidates.push({
          type: 'agents',
          id: filename.replace(/\.md$/, ''),
          sourcePath: path.join(agentsSrc, filename),
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        });
      }
    } catch {
      return [];
    }
    return candidates;
  }

  private async scanSkills(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = [];
    try {
      const skillsSrc = path.join(sourceDir, 'skills');
      const skillsDest = path.join(this.storeDir, 'skills');
      await mkdir(skillsDest, { recursive: true });
      const entries = await readdir(skillsSrc);
      for (const entry of entries) {
        const sourcePath = path.join(skillsSrc, entry);
        const sourceStat = await stat(sourcePath);
        if (!sourceStat.isDirectory()) continue;
        if (!(await this.pathExists(path.join(sourcePath, 'SKILL.md')))) continue;
        const destinationPath = path.join(skillsDest, entry);
        candidates.push({
          type: 'skills',
          id: entry,
          sourcePath,
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        });
      }
    } catch {
      return [];
    }
    return candidates;
  }

  private async scanCommands(sourceDir: string): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = [];
    try {
      const commandsSrc = path.join(sourceDir, 'commands');
      const commandsDest = path.join(this.storeDir, 'commands');
      await mkdir(commandsDest, { recursive: true });
      const files = await readdir(commandsSrc);
      for (const filename of files.filter(file => file.endsWith('.md'))) {
        const destinationPath = path.join(commandsDest, filename);
        candidates.push({
          type: 'commands',
          id: filename.replace(/\.md$/, ''),
          sourcePath: path.join(commandsSrc, filename),
          destinationPath,
          isConflict: await this.pathExists(destinationPath),
        });
      }
    } catch {
      return [];
    }
    return candidates;
  }

  private toConflict(candidate: ImportCandidate): StoreImportConflict {
    return {
      type: candidate.type,
      id: candidate.id,
      sourcePath: candidate.sourcePath,
      destinationPath: candidate.destinationPath,
    };
  }

  async scanImport(sourceDir: string): Promise<StoreImportResult> {
    const candidates = await this.getImportCandidates(sourceDir);
    return {
      ...EMPTY_RESULT(),
      conflicts: candidates.filter(candidate => candidate.isConflict).map(candidate => this.toConflict(candidate)),
    };
  }

  private async getImportCandidates(sourceDir: string): Promise<ImportCandidate[]> {
    const [agents, skills, commands] = await Promise.all([
      this.scanAgents(sourceDir),
      this.scanSkills(sourceDir),
      this.scanCommands(sourceDir),
    ]);

    return [...agents, ...skills, ...commands];
  }

  async applyImport(sourceDir: string, overwrite = false): Promise<StoreImportResult> {
    const result = await this.scanImport(sourceDir);
    const candidates = await this.getImportCandidates(sourceDir);
    const provenanceIndex = await this.readProvenanceIndex();
    const importedAt = new Date().toISOString();

    for (const candidate of candidates) {
      if (candidate.isConflict && !overwrite) {
        result.skipped += 1;
        continue;
      }

      try {
        if (candidate.isConflict) {
          await rm(candidate.destinationPath, { recursive: true, force: true });
          result.overwritten += 1;
        } else {
          result.imported += 1;
        }

        await this.copyRecursive(candidate.sourcePath, candidate.destinationPath);
        provenanceIndex[candidate.type][candidate.id] = {
          importPath: candidate.sourcePath,
          importedAt,
        };
      } catch (error: any) {
        if (candidate.isConflict && overwrite) {
          result.overwritten -= 1;
        } else {
          result.imported -= 1;
        }
        result.errors.push(`${candidate.type.slice(0, -1)} ${candidate.id}: ${error.message}`);
      }
    }

    await this.writeProvenanceIndex(provenanceIndex);
    return result;
  }

  async import(request: string | StoreImportRequest): Promise<StoreImportResult> {
    const raw = typeof request === 'string'
      ? { sourceDir: request, dryRun: false, overwrite: false }
      : request;

    const normalized = {
      ...raw,
      sourceDir: path.resolve(untildify(raw.sourceDir)),
    };

    if (normalized.dryRun) {
      return this.scanImport(normalized.sourceDir);
    }

    return this.applyImport(normalized.sourceDir, normalized.overwrite ?? false);
  }

  async getProvenance(type: StoreComponentType, id: string): Promise<StoreComponentProvenance | undefined> {
    const index = await this.readProvenanceIndex();
    return index[type][id];
  }

  async getReferencingProfiles(type: 'agents' | 'skills' | 'commands' | 'model-configs', name: string): Promise<string[]> {
    const refs: string[] = [];
    try {
      const entries = await readdir(this.profilesDir);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        try {
          const raw = await readFile(path.join(this.profilesDir, entry, 'profile.json'), 'utf-8');
          const profile = ProfileSchema.parse(JSON.parse(raw));
          if (type === 'model-configs') {
            if (profile.modelConfig === name) refs.push(profile.name);
          } else {
            if (profile[type].includes(name)) refs.push(profile.name);
          }
        } catch { continue; }
      }
    } catch { /* no profiles dir */ }
    return refs;
  }
}
