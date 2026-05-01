import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Centralized directory name — single definition point for all .claude references */
export const AGENT_DIR_NAME = '.claude'

/** Write directory name — single definition point for managed data writes per D-01 */
export const WRITE_DIR_NAME = '.cui'

export class ConfigLocator {
  private readonly writeBaseDir: string
  private readonly claudeCodeDir: string
  private readonly projectDir: string | null

  constructor(options?: { cwd?: string }) {
    const agentHome = process.env.AGENT_HOME

    // D-01: writeBaseDir defaults to ~/.cui/, overridden by CUI_HOME (not AGENT_HOME)
    const cuiHome = process.env.CUI_HOME
    const writeDirName = cuiHome || WRITE_DIR_NAME
    this.writeBaseDir = path.join(os.homedir(), writeDirName)

    // D-03: claudeCodeDir defaults to ~/.claude/ for plugin reads, overridden by AGENT_HOME
    const claudeDirName = agentHome || AGENT_DIR_NAME
    this.claudeCodeDir = path.join(os.homedir(), claudeDirName)

    // D-01: project discovery checks cwd/.claude/ only (or AGENT_HOME override dir)
    const cwd = options?.cwd ?? process.cwd()
    const projectDirName = agentHome || AGENT_DIR_NAME
    const candidateProject = path.join(cwd, projectDirName)
    // Silent fallback to global-only when absent (no log message).
    this.projectDir = existsSync(candidateProject) ? candidateProject : null
  }

  // Managed data paths — all resolve from writeBaseDir (~/.cui/)
  get agentsDir(): string {
    return path.join(this.writeBaseDir, 'agents')
  }

  get skillsDir(): string {
    return path.join(this.writeBaseDir, 'skills')
  }

  get commandsDir(): string {
    return path.join(this.writeBaseDir, 'commands')
  }

  get settingsPath(): string {
    return path.join(this.writeBaseDir, 'settings.json')
  }

  get baseDir(): string {
    return this.writeBaseDir
  }

  // Claude Code managed path — resolves from claudeCodeDir (~/.claude/)
  get pluginsDir(): string {
    return path.join(this.claudeCodeDir, 'plugins')
  }

  // D-04: readBaseDir initially equals writeBaseDir (both ~/.cui/)
  get readBaseDir(): string {
    return this.writeBaseDir
  }

  // Project discovery (D-02: exposed for route handlers)
  get projectPath(): string | null {
    return this.projectDir
  }

  get hasProject(): boolean {
    return this.projectDir !== null
  }

  // Project-scoped subdirectories (for Phase 11)
  get projectAgentsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'agents') : null
  }

  get projectSkillsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'skills') : null
  }

  get projectCommandsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'commands') : null
  }
}
