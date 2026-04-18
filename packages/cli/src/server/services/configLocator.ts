import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

/** Centralized directory name — single definition point for all .claude references */
export const AGENT_DIR_NAME = '.claude';

export class ConfigLocator {
  private readonly globalDir: string;
  private readonly projectDir: string | null;

  constructor(options?: { cwd?: string }) {
    const agentHome = process.env.AGENT_HOME || AGENT_DIR_NAME;
    this.globalDir = path.join(os.homedir(), agentHome);

    const cwd = options?.cwd ?? process.cwd();
    const candidateProject = path.join(cwd, agentHome);
    // D-01: Check ${cwd}/.claude only — no walk-up, no env var override for project dir.
    // Silent fallback to global-only when absent (no log message).
    this.projectDir = existsSync(candidateProject) ? candidateProject : null;
  }

  // Global paths (D-03: class-based, constructor-injected pattern)
  get agentsDir(): string { return path.join(this.globalDir, 'agents'); }
  get skillsDir(): string { return path.join(this.globalDir, 'skills'); }
  get commandsDir(): string { return path.join(this.globalDir, 'commands'); }
  get pluginsDir(): string { return path.join(this.globalDir, 'plugins'); }
  get settingsPath(): string { return path.join(this.globalDir, 'settings.json'); }
  get baseDir(): string { return this.globalDir; }

  // Project discovery (D-02: exposed for route handlers)
  get projectPath(): string | null { return this.projectDir; }
  get hasProject(): boolean { return this.projectDir !== null; }

  // Project-scoped subdirectories (for Phase 11)
  get projectAgentsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'agents') : null;
  }
  get projectSkillsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'skills') : null;
  }
  get projectCommandsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'commands') : null;
  }
}