import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Centralized directory name — single definition point for all .claude references */
export const AGENT_DIR_NAME = '.claude'

/**
 * Resolves all file-system paths used by OhMyC, distinguishing between:
 * - Managed write paths (under ~/.config/ohmyc/)
 * - Claude Code read paths (under ~/.claude/)
 * - Project-scoped paths (cwd/.claude/)
 *
 * Respects the OHMYC_HOME and AGENT_HOME environment variables.
 */
export class ConfigLocator {
  private readonly writeBaseDir: string
  private readonly claudeCodeDir: string
  private readonly projectDir: string | null

  constructor(options?: { cwd?: string }) {
    const agentHome = process.env.AGENT_HOME

    // D-01: writeBaseDir defaults to ~/.config/ohmyc/, overridden by OHMYC_HOME (not AGENT_HOME).
    // OHMYC_HOME, when set, is treated as an absolute path.
    const ohmycHome = process.env.OHMYC_HOME
    this.writeBaseDir = ohmycHome || path.join(os.homedir(), '.config', 'ohmyc')

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

  // Managed data paths — all resolve from writeBaseDir (~/.config/ohmyc/)

  /** Directory for user-managed agent definitions (`~/.config/ohmyc/agents/`). */
  get agentsDir(): string {
    return path.join(this.writeBaseDir, 'agents')
  }

  /** Directory for user-managed skill definitions (`~/.config/ohmyc/skills/`). */
  get skillsDir(): string {
    return path.join(this.writeBaseDir, 'skills')
  }

  /** Directory for user-managed command definitions (`~/.config/ohmyc/commands/`). */
  get commandsDir(): string {
    return path.join(this.writeBaseDir, 'commands')
  }

  /** Path to the OhMyC settings file (`~/.config/ohmyc/settings.json`). */
  get settingsPath(): string {
    return path.join(this.writeBaseDir, 'settings.json')
  }

  /** Root managed data directory (`~/.config/ohmyc/`). */
  get baseDir(): string {
    return this.writeBaseDir
  }

  // Claude Code managed paths — resolve from claudeCodeDir (~/.claude/)

  /** Directory where Claude Code stores plugins (`~/.claude/plugins/`). */
  get pluginsDir(): string {
    return path.join(this.claudeCodeDir, 'plugins')
  }

  /** User-level Claude Code settings path (`~/.claude/settings.json`). */
  get claudeSettingsPath(): string {
    return path.join(this.claudeCodeDir, 'settings.json')
  }

  /** Project-scoped Claude Code settings (`<cwd>/.claude/settings.json`), or null if no project. */
  get projectClaudeSettingsPath(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'settings.json') : null
  }

  /** Project-scoped local override settings (`<cwd>/.claude/settings.local.json`), or null. */
  get projectClaudeSettingsLocalPath(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'settings.local.json') : null
  }

  /** Ordered list of Claude settings paths from lowest to highest precedence for `enabledPlugins` resolution. */
  get claudeSettingsPaths(): string[] {
    const paths = [this.claudeSettingsPath, this.projectClaudeSettingsPath, this.projectClaudeSettingsLocalPath]
    return paths.filter((p): p is string => p !== null)
  }

  // D-04: readBaseDir initially equals writeBaseDir (both ~/.config/ohmyc/)

  /** Base directory for read operations (currently the same as `baseDir`). */
  get readBaseDir(): string {
    return this.writeBaseDir
  }

  /** Absolute path to the discovered project `.claude` directory, or null if none exists. */
  get projectPath(): string | null {
    return this.projectDir
  }

  /** Whether a project-scoped `.claude` directory was discovered. */
  get hasProject(): boolean {
    return this.projectDir !== null
  }

  // Project-scoped subdirectories

  /** Project-scoped agents directory (`<cwd>/.claude/agents/`), or null. */
  get projectAgentsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'agents') : null
  }

  /** Project-scoped skills directory (`<cwd>/.claude/skills/`), or null. */
  get projectSkillsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'skills') : null
  }

  /** Project-scoped commands directory (`<cwd>/.claude/commands/`), or null. */
  get projectCommandsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'commands') : null
  }
}
