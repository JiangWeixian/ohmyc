import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises'
import path from 'node:path'

import type {
  InstalledPlugin,
  Marketplace,
  PluginInstall,
  PluginManifest,
} from '@ohmyc/shared'

/** Components discovered inside a plugin installation directory. */
interface PluginComponents {
  agents: string[]
  skills: string[]
  commands: string[]
  hooks: any | null
  mcpServers: any | null
  lspServers: any | null
}

/**
 * Reads the Claude Code plugin registry and resolves installed plugin metadata,
 * including manifests, discovered components, and enabled state.
 */
export class PluginService {
  constructor(
    private pluginsDir: string,
    private claudeSettingsPaths: readonly string[],
  ) {}

  /** Safely reads and parses a JSON file, returning null on any error. */
  private async readJson<Value>(filePath: string): Promise<Value | null> {
    try {
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  /** Attempts to load `plugin.json` from the install root or the `.claude-plugin` subdirectory. */
  private async loadManifest(installPath: string): Promise<PluginManifest | null> {
    const manifest = await this.readJson<PluginManifest>(path.join(installPath, 'plugin.json'))
    if (manifest) {
      return manifest
    }
    return this.readJson<PluginManifest>(path.join(installPath, '.claude-plugin', 'plugin.json'))
  }

  /** Scans a plugin directory to discover agents, skills, commands, hooks, MCP and LSP definitions. */
  private async scanComponents(installPath: string): Promise<PluginComponents> {
    const components: PluginComponents = {
      agents: [],
      skills: [],
      commands: [],
      hooks: null,
      mcpServers: null,
      lspServers: null,
    }

    // Agents: flat .md files in agents/
    try {
      const agentsDir = path.join(installPath, 'agents')
      const files = await readdir(agentsDir)
      components.agents = files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')).toSorted()
    } catch { /* no agents dir */ }

    // Skills: directories with SKILL.md in skills/
    try {
      const skillsDir = path.join(installPath, 'skills')
      const entries = await readdir(skillsDir)
      for (const entry of entries.toSorted()) {
        try {
          const s = await stat(path.join(skillsDir, entry))
          if (s.isDirectory()) {
            try {
              await stat(path.join(skillsDir, entry, 'SKILL.md'))
              components.skills.push(entry)
            } catch { /* no SKILL.md */ }
          }
        } catch { /* skip */ }
      }
    } catch { /* no skills dir */ }

    // Commands: flat .md files in commands/
    try {
      const commandsDir = path.join(installPath, 'commands')
      const files = await readdir(commandsDir)
      components.commands = files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')).toSorted()
    } catch { /* no commands dir */ }

    // Hooks: hooks/hooks.json
    components.hooks = await this.readJson(path.join(installPath, 'hooks', 'hooks.json'))

    // MCP servers: .mcp.json
    components.mcpServers = await this.readJson(path.join(installPath, '.mcp.json'))

    // LSP servers: .lsp.json
    components.lspServers = await this.readJson(path.join(installPath, '.lsp.json'))

    return components
  }

  /** Merges `enabledPlugins` from all settings paths in low→high precedence (user → project → local). */
  private async getEnabledPlugins(): Promise<Record<string, boolean>> {
    const merged: Record<string, boolean> = {}
    for (const filePath of this.claudeSettingsPaths) {
      const settings = await this.readJson<{ enabledPlugins?: Record<string, boolean> }>(filePath)
      if (settings?.enabledPlugins) {
        Object.assign(merged, settings.enabledPlugins)
      }
    }
    return merged
  }

  /** Lists all installed plugins with their metadata, components, and enabled state. */
  async listPlugins(): Promise<InstalledPlugin[]> {
    const filePath = path.join(this.pluginsDir, 'installed_plugins.json')
    const data = await this.readJson<{ version?: number; plugins: Record<string, PluginInstall[]> }>(filePath)
    if (!data?.plugins) {
      return []
    }

    const enabledMap = await this.getEnabledPlugins()

    const plugins: InstalledPlugin[] = []
    for (const [id, installs] of Object.entries(data.plugins)) {
      const atIndex = id.indexOf('@')
      const name = atIndex > 0 ? id.slice(0, atIndex) : id
      const marketplace = atIndex > 0 ? id.slice(atIndex + 1) : ''

      let manifest: PluginManifest | null = null
      let components: PluginComponents = { agents: [], skills: [], commands: [], hooks: [], mcpServers: [], lspServers: [] }

      if (installs.length > 0 && installs[0].installPath) {
        manifest = await this.loadManifest(installs[0].installPath)
        components = await this.scanComponents(installs[0].installPath)
      }

      plugins.push({
        id,
        name,
        marketplace,
        enabled: enabledMap[id] === true,
        installs,
        manifest,
        components,
      })
    }

    return plugins.toSorted((a, b) => a.name.localeCompare(b.name))
  }

  /** Fetches a single installed plugin by its full ID (e.g. `name@marketplace`). */
  async getPlugin(id: string): Promise<InstalledPlugin | null> {
    const all = await this.listPlugins()
    return all.find(p => p.id === id) ?? null
  }

  /** Lists all known plugin marketplaces from the registry file. */
  async listMarketplaces(): Promise<Marketplace[]> {
    const filePath = path.join(this.pluginsDir, 'known_marketplaces.json')
    const data = await this.readJson<Record<string, Omit<Marketplace, 'id'>>>(filePath)
    if (!data) {
      return []
    }

    return Object.entries(data)
      .map(([id, info]) => ({ id, ...info }))
      .toSorted((a, b) => a.id.localeCompare(b.id))
  }

  /** Fetches a single marketplace by ID. */
  async getMarketplace(id: string): Promise<Marketplace | null> {
    const all = await this.listMarketplaces()
    return all.find(m => m.id === id) ?? null
  }
}
