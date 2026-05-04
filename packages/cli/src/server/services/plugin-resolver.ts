import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface PluginInstallRecord {
  installPath: string
  scope: string
  [key: string]: any
}

/**
 * Resolves install paths of all enabled plugins.
 * Reads installed_plugins.json and Claude Code settings (user + project + local override)
 * to find enabled plugins.
 */
export class PluginResolver {
  constructor(
    private pluginsDir: string,
    private claudeSettingsPaths: readonly string[],
  ) {}

  private async readJson<Value>(filePath: string): Promise<Value | null> {
    try {
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async getEnabledPluginPaths(): Promise<{ id: string; installPath: string }[]> {
    // Merge enabledPlugins across paths in low→high precedence (user → project → local).
    const enabledMap: Record<string, boolean> = {}
    for (const filePath of this.claudeSettingsPaths) {
      const settings = await this.readJson<{ enabledPlugins?: Record<string, boolean> }>(filePath)
      if (settings?.enabledPlugins) {
        Object.assign(enabledMap, settings.enabledPlugins)
      }
    }

    const data = await this.readJson<{ plugins: Record<string, PluginInstallRecord[]> }>(
      path.join(this.pluginsDir, 'installed_plugins.json'),
    )
    if (!data?.plugins) {
      return []
    }

    const results: { id: string; installPath: string }[] = []
    for (const [id, installs] of Object.entries(data.plugins)) {
      if (enabledMap[id] !== true) {
        continue
      }
      if (installs.length > 0 && installs[0].installPath) {
        results.push({ id, installPath: installs[0].installPath })
      }
    }
    return results
  }
}
