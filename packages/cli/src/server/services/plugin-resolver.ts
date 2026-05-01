import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface PluginInstallRecord {
  installPath: string
  scope: string
  [key: string]: any
}

/**
 * Resolves install paths of all enabled plugins.
 * Reads installed_plugins.json and settings.json to find enabled plugins.
 */
export class PluginResolver {
  constructor(
    private pluginsDir: string,
    private settingsPath: string,
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
    const settings = await this.readJson<{ enabledPlugins?: Record<string, boolean> }>(this.settingsPath)
    const enabledMap = settings?.enabledPlugins ?? {}

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
