import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import {
  ProfileSchema,
  RESERVED_PROFILE_NAMES,
  SAFE_NAME_PATTERN,
} from '@ohmyc/shared'

import { LockService } from './lock-service'
import { ModelConfigService } from './model-config-service'

import type { Profile } from '@ohmyc/shared'

interface UndoAction {
  label: string
  undo: () => Promise<void>
}

export class ActivationBlockedError extends Error {
  missing: string[]

  constructor(message: string, missing: string[]) {
    super(message)
    this.name = 'ActivationBlockedError'
    this.missing = missing
  }
}

export interface ModelConfigEnvChange {
  action: 'CHANGE' | 'REMOVE' | 'SET'
  key: string
  value: string // masked for API key, plain for others
  previousValue?: string // only for CHANGE action
}

export interface ModelConfigChanges {
  configName: string
  changes: ModelConfigEnvChange[]
  deactivationChanges?: ModelConfigEnvChange[]
  deactivationConfigName?: string
}

export interface PreflightResult {
  canActivate: boolean
  missing: string[]
  settingsWarnings: string[]
  currentActive: string | null
  modelConfigChanges?: ModelConfigChanges
}

export class ProfileService {
  private profilesDir: string
  private lockService: LockService
  private storeDir: string
  private modelConfigService: ModelConfigService

  constructor(private baseDir: string, private claudeSettingsPath: string) {
    this.profilesDir = path.join(baseDir, 'profiles')
    this.storeDir = path.join(baseDir, 'store')
    this.lockService = new LockService(this.profilesDir)
    this.modelConfigService = new ModelConfigService(path.join(this.storeDir, 'model-configs'))
  }

  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Profile name "${name}" is invalid: must match [a-zA-Z0-9_-]`)
    }
    if (RESERVED_PROFILE_NAMES.includes(name)) {
      throw new Error(`Profile name "${name}" is reserved`)
    }
  }

  private profileDir(name: string): string {
    return path.join(this.profilesDir, name)
  }

  private profileJsonPath(name: string): string {
    return path.join(this.profileDir(name), 'profile.json')
  }

  private activePath(): string {
    return path.join(this.profilesDir, '.active')
  }

  async list(): Promise<{ profiles: Profile[]; active: string | null }> {
    let active: string | null = null
    try {
      const rawActive = await readFile(this.activePath(), 'utf8')
      const raw = rawActive.trim()
      if (raw) {
        // If it's an absolute path, extract the directory name (which IS the profile name).
        // If it's already a bare name, use it directly.
        active = path.isAbsolute(raw) ? path.basename(raw) : raw
      }
    } catch { /* no active */ }

    try {
      await access(this.profilesDir)
    } catch {
      return { profiles: [], active }
    }

    const entries = await readdir(this.profilesDir)
    const profiles: Profile[] = []

    for (const entry of entries) {
      if (entry.startsWith('.')) {
        continue
      }
      try {
        const raw = await readFile(path.join(this.profilesDir, entry, 'profile.json'), 'utf8')
        const profile = ProfileSchema.parse(JSON.parse(raw))
        profiles.push(profile)
      } catch {
        continue
      }
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name))
    return { profiles, active }
  }

  async get(name: string): Promise<Profile | null> {
    try {
      const raw = await readFile(this.profileJsonPath(name), 'utf8')
      return ProfileSchema.parse(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async create(data: Partial<Profile> & { name: string }): Promise<Profile> {
    this.validateName(data.name)

    const dir = this.profileDir(data.name)
    try {
      await access(dir)
      throw new Error(`Profile "${data.name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    const profile = ProfileSchema.parse(data)
    await mkdir(dir, { recursive: true })
    await writeFile(this.profileJsonPath(data.name), JSON.stringify(profile, null, 2), 'utf8')
    return profile
  }

  async update(name: string, changes: Partial<Omit<Profile, 'name'>>): Promise<Profile | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const merged = { ...existing, ...changes }
    const profile = ProfileSchema.parse(merged)
    await writeFile(this.profileJsonPath(name), JSON.stringify(profile, null, 2), 'utf8')
    return profile
  }

  async delete(name: string): Promise<boolean> {
    const dir = this.profileDir(name)
    try {
      await access(dir)
      await rm(dir, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      result[key] = source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
        ? this.deepMerge(target[key], source[key])
        : source[key]
    }
    return result
  }

  private async getActive(): Promise<string | null> {
    try {
      const activeContent = await readFile(this.activePath(), 'utf8')
      return activeContent.trim()
    } catch {
      return null
    }
  }

  private async getActiveProfileName(): Promise<string | null> {
    const rawActive = await this.getActive()
    if (!rawActive) {
      return null
    }
    return path.isAbsolute(rawActive) ? path.basename(rawActive) : rawActive
  }

  private async readSettings(): Promise<any> {
    try {
      return JSON.parse(await readFile(this.claudeSettingsPath, 'utf8'))
    } catch {
      return {}
    }
  }

  private computeSettingsWarnings(currentSettings: any, profileSettings: any): string[] {
    if (!profileSettings) {
      return []
    }
    const warnings: string[] = []
    for (const key of Object.keys(profileSettings)) {
      if (key in currentSettings) {
        warnings.push(`Settings key '${key}' would be overwritten`)
      }
    }
    return warnings
  }

  private maskApiKey(key: string): string {
    if (key.length >= 4) {
      return `****${key.slice(-4)}`
    }
    return '****'
  }

  private computeModelConfigChanges(
    apiKey: string,
    baseUrl: string,
    modelName: string | undefined,
    currentEnvironment: Record<string, string> | undefined,
  ): ModelConfigEnvChange[] {
    const environmentVariables: { key: string; value: string }[] = [
      { key: 'ANTHROPIC_AUTH_TOKEN', value: apiKey },
      { key: 'ANTHROPIC_BASE_URL', value: baseUrl },
      { key: 'API_TIMEOUT_MS', value: '3000000' },
      { key: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', value: '1' },
    ]
    if (modelName) {
      environmentVariables.push({ key: 'ANTHROPIC_MODEL', value: modelName })
    }

    const changes: ModelConfigEnvChange[] = []
    const current = currentEnvironment || {}

    for (const { key, value } of environmentVariables) {
      if (key in current) {
        changes.push({
          action: 'CHANGE',
          key,
          value: key === 'ANTHROPIC_AUTH_TOKEN' ? this.maskApiKey(value) : value,
          previousValue: current[key],
        })
      } else {
        changes.push({
          action: 'SET',
          key,
          value: key === 'ANTHROPIC_AUTH_TOKEN' ? this.maskApiKey(value) : value,
        })
      }
    }

    return changes
  }

  private async storeComponentExists(type: 'agents' | 'commands' | 'skills', name: string): Promise<boolean> {
    const componentPath = type === 'agents' || type === 'commands'
      ? path.join(this.storeDir, type, `${name}.md`)
      : path.join(this.storeDir, type, name)
    try {
      await access(componentPath)
      return true
    } catch {
      return false
    }
  }

  async preflight(name: string): Promise<PreflightResult> {
    const profile = await this.get(name)
    if (!profile) {
      throw new Error(`Profile "${name}" not found`)
    }

    const missing: string[] = []

    for (const agent of profile.agents) {
      if (!(await this.storeComponentExists('agents', agent))) {
        missing.push(`agent:${agent}`)
      }
    }

    for (const skill of profile.skills) {
      if (!(await this.storeComponentExists('skills', skill))) {
        missing.push(`skill:${skill}`)
      }
    }

    for (const cmd of profile.commands) {
      if (!(await this.storeComponentExists('commands', cmd))) {
        missing.push(`command:${cmd}`)
      }
    }

    const currentSettings = await this.readSettings()
    const settingsWarnings = this.computeSettingsWarnings(currentSettings, profile.settings)

    const currentActive = await this.getActiveProfileName()

    const result: PreflightResult = {
      canActivate: missing.length === 0,
      missing,
      settingsWarnings,
      currentActive,
    }

    // Compute model config changes for preflight preview
    if (profile.modelConfig) {
      const mc = await this.modelConfigService.get(profile.modelConfig)
      if (mc) {
        const currentEnvironment = currentSettings.env as Record<string, string> | undefined
        const changes = this.computeModelConfigChanges(mc.apiKey, mc.baseUrl, mc.modelName, currentEnvironment)

        let deactivationChanges: ModelConfigEnvChange[] | undefined
        let deactivationConfigName: string | undefined

        // If switching from another profile, compute deactivation changes
        if (currentActive) {
          const currentProfile = await this.get(currentActive)
          if (currentProfile?.modelConfig) {
            const currentMc = await this.modelConfigService.get(currentProfile.modelConfig)
            if (currentMc) {
              deactivationConfigName = currentProfile.modelConfig
              // Compute REMOVE actions for the current active profile's env vars
              const removeVariables: { key: string }[] = [
                { key: 'ANTHROPIC_AUTH_TOKEN' },
                { key: 'ANTHROPIC_BASE_URL' },
                { key: 'API_TIMEOUT_MS' },
                { key: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC' },
              ]
              if (currentMc.modelName) {
                removeVariables.push({ key: 'ANTHROPIC_MODEL' })
              }
              deactivationChanges = removeVariables.map(({ key }) => ({
                action: 'REMOVE' as const,
                key,
                value: currentEnvironment?.[key] ?? '',
              }))
            }
          }
        }

        result.modelConfigChanges = {
          configName: profile.modelConfig,
          changes,
          deactivationChanges,
          deactivationConfigName,
        }
      }
      // If model config not found (deleted), leave modelConfigChanges undefined
    }

    return result
  }

  async activate(name: string): Promise<{ warnings: string[] }> {
    const undoStack: UndoAction[] = []
    let previousActiveName: string | null = null

    try {
      // Step 0: Acquire lock
      await this.lockService.acquire()

      // Step 1: Internal preflight check (safety gate)
      const preflightResult = await this.preflight(name)
      if (!preflightResult.canActivate) {
        throw new ActivationBlockedError(
          'Cannot activate profile: missing store components',
          preflightResult.missing,
        )
      }

      const profile = await this.get(name)
      if (!profile) {
        throw new Error(`Profile "${name}" not found`)
      }

      // Step 2: Record previous active profile for rollback
      const previousActive = await this.getActive()
      previousActiveName = previousActive
        ? (path.isAbsolute(previousActive) ? path.basename(previousActive) : previousActive)
        : null

      // Step 3: Deactivate current profile if one exists
      if (previousActive) {
        await this.deactivateInternal(previousActiveName!)
      }

      // Step 4: Per-profile settings backup
      const backupName = `settings.backup.${name}.json`
      const backupPath = path.join(this.baseDir, backupName)
      const currentSettings = await this.readSettings()
      await writeFile(backupPath, JSON.stringify(currentSettings, null, 2), 'utf8')
      undoStack.push({
        label: 'restore-backup',
        undo: async () => {
          try {
            await rm(backupPath, { force: true })
          } catch {}
        },
      })

      const dir = this.profileDir(name)
      const settingsWarnings = preflightResult.settingsWarnings

      // Step 5: Write .active EARLY (before symlinks) for crash recovery
      await writeFile(this.activePath(), path.resolve(dir), 'utf8')
      undoStack.push({
        label: 'active-marker',
        undo: async () => {
          try {
            await unlink(this.activePath())
          } catch {}
        },
      })

      // Step 6: Create symlinks for agents
      if (profile.agents.length > 0) {
        const agentsDir = path.join(dir, 'agents')
        await mkdir(agentsDir, { recursive: true })
        for (const agent of profile.agents) {
          const source = path.join(this.storeDir, 'agents', `${agent}.md`)
          const destination = path.join(agentsDir, `${agent}.md`)
          try {
            await lstat(destination)
            await unlink(destination)
          } catch {}
          await symlink(source, destination)
          undoStack.push({
            label: `symlink-agent-${agent}`,
            undo: async () => {
              try {
                await rm(destination, { force: true })
              } catch {}
            },
          })
        }
      }

      // Step 7: Create symlinks for skills (directory symlinks)
      if (profile.skills.length > 0) {
        const skillsDir = path.join(dir, 'skills')
        await mkdir(skillsDir, { recursive: true })
        for (const skill of profile.skills) {
          const source = path.join(this.storeDir, 'skills', skill)
          const destination = path.join(skillsDir, skill)
          try {
            await lstat(destination)
            await rm(destination, { force: true })
          } catch {}
          await symlink(source, destination)
          undoStack.push({
            label: `symlink-skill-${skill}`,
            undo: async () => {
              try {
                await rm(destination, { force: true })
              } catch {}
            },
          })
        }
      }

      // Step 8: Create symlinks for commands
      if (profile.commands.length > 0) {
        const commandsDir = path.join(dir, 'commands')
        await mkdir(commandsDir, { recursive: true })
        for (const cmd of profile.commands) {
          const source = path.join(this.storeDir, 'commands', `${cmd}.md`)
          const destination = path.join(commandsDir, `${cmd}.md`)
          try {
            await lstat(destination)
            await unlink(destination)
          } catch {}
          await symlink(source, destination)
          undoStack.push({
            label: `symlink-command-${cmd}`,
            undo: async () => {
              try {
                await rm(destination, { force: true })
              } catch {}
            },
          })
        }
      }

      // Step 9: Generate plugin files
      const pluginDir = path.join(dir, '.claude-plugin')
      await mkdir(pluginDir, { recursive: true })
      await writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify({
        name: `profile-${name}`,
        version: '1.0.0',
        description: `ClaudeUI profile: ${profile.description || name}`,
      }, null, 2), 'utf8')
      undoStack.push({
        label: 'plugin-files',
        undo: async () => {
          try {
            await rm(pluginDir, { recursive: true, force: true })
          } catch {}
        },
      })

      if (profile.hooks) {
        const hooksDir = path.join(dir, 'hooks')
        await mkdir(hooksDir, { recursive: true })
        await writeFile(path.join(hooksDir, 'hooks.json'), JSON.stringify({ hooks: profile.hooks }, null, 2), 'utf8')
        undoStack.push({
          label: 'hooks-dir',
          undo: async () => {
            try {
              await rm(hooksDir, { recursive: true, force: true })
            } catch {}
          },
        })
      }

      if (profile.mcpServers) {
        const mcpPath = path.join(dir, '.mcp.json')
        await writeFile(mcpPath, JSON.stringify({ mcpServers: profile.mcpServers }, null, 2), 'utf8')
        undoStack.push({
          label: 'mcp-json',
          undo: async () => {
            try {
              await rm(mcpPath, { force: true })
            } catch {}
          },
        })
      }

      if (profile.lspServers) {
        const lspPath = path.join(dir, '.lsp.json')
        await writeFile(lspPath, JSON.stringify(profile.lspServers, null, 2), 'utf8')
        undoStack.push({
          label: 'lsp-json',
          undo: async () => {
            try {
              await rm(lspPath, { force: true })
            } catch {}
          },
        })
      }

      // Step 10: Merge settings
      let merged = { ...currentSettings }
      if (profile.settings) {
        merged = this.deepMerge(merged, profile.settings)
      }

      // Inject model config env vars
      if (profile.modelConfig) {
        const mc = await this.modelConfigService.get(profile.modelConfig)
        if (mc) {
          const environmentVariables: Record<string, string> = { ANTHROPIC_AUTH_TOKEN: mc.apiKey, ANTHROPIC_BASE_URL: mc.baseUrl, API_TIMEOUT_MS: '3000000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }
          if (mc.modelName) {
            environmentVariables.ANTHROPIC_MODEL = mc.modelName
          }
          merged.env = { ...merged.env, ...environmentVariables }
        }
        // If model config not found (deleted between preflight and activation), skip silently
      }

      // Set enabledPlugins
      const enabledPlugins: Record<string, boolean> = merged.enabledPlugins || {}
      for (const pluginId of profile.plugins) {
        enabledPlugins[pluginId] = true
      }
      // Add profile itself as plugin
      enabledPlugins[`profile-${name}`] = true
      merged.enabledPlugins = enabledPlugins

      await mkdir(path.dirname(this.claudeSettingsPath), { recursive: true })
      await writeFile(this.claudeSettingsPath, JSON.stringify(merged, null, 2), 'utf8')
      // Settings backup already recorded in undo stack

      return { warnings: settingsWarnings }
    } catch (error) {
      // Rollback in reverse order
      for (let index = undoStack.length - 1; index >= 0; index--) {
        try {
          await undoStack[index].undo()
        } catch {
          // Log but continue rollback
        }
      }

      // If this was a switch and the error is not ActivationBlockedError, restore previous profile
      if (previousActiveName && !(error instanceof ActivationBlockedError)) {
        try {
          await this.activate(previousActiveName)
        } catch {
          // Best effort recovery
        }
      }

      throw error
    } finally {
      await this.lockService.release()
    }
  }

  /**
   * Internal deactivation without lock -- called from within activate's transaction.
   */
  private async deactivateInternal(activeName: string): Promise<void> {
    const settingsPath = this.claudeSettingsPath
    const profileDir = path.join(this.profilesDir, activeName)

    // Restore per-profile settings backup
    const profileBackupPath = path.join(this.baseDir, `settings.backup.${activeName}.json`)
    const genericBackupPath = path.join(this.baseDir, 'settings.backup.json')

    let backupRestored = false

    try {
      const backup = await readFile(profileBackupPath, 'utf8')
      await writeFile(settingsPath, backup, 'utf8')
      await rm(profileBackupPath, { force: true })
      backupRestored = true
    } catch { /* no per-profile backup */ }

    if (!backupRestored) {
      try {
        const backup = await readFile(genericBackupPath, 'utf8')
        await writeFile(settingsPath, backup, 'utf8')
        await rm(genericBackupPath, { force: true })
      } catch { /* no generic backup */ }
    }

    // Remove generated symlinks from agents/, skills/, commands/
    for (const sub of ['agents', 'skills', 'commands']) {
      const subDir = path.join(profileDir, sub)
      try {
        const entries = await readdir(subDir)
        for (const entry of entries) {
          await rm(path.join(subDir, entry), { force: true })
        }
      } catch { /* dir doesn't exist */ }
    }

    // Remove generated config files
    for (const file of ['.claude-plugin', 'hooks', '.mcp.json', '.lsp.json']) {
      await rm(path.join(profileDir, file), { recursive: true, force: true })
    }

    // Remove .active marker
    try {
      await unlink(this.activePath())
    } catch {}
  }

  async deactivate(): Promise<void> {
    const activeName = await this.getActiveProfileName()
    if (!activeName) {
      return
    }

    await this.deactivateInternal(activeName)
  }
}
