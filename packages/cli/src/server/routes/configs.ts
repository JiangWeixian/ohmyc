import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { PluginResolver } from '../services/plugin-resolver'

import type { FastifyPluginAsync } from 'fastify'

interface ConfigRoutesOptions {
  baseDir: string
  projectBaseDir: string | null | undefined
  pluginsDir: string
  settingsPath: string
  claudeSettingsPaths: readonly string[]
}

interface McpEntry {
  name: string
  config: any
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

interface HookEntry {
  event: string
  name: string
  data: { matcher?: string; type: string; command: string }
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

interface LspEntry {
  name: string
  config: any
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

async function readJson(filePath: string): Promise<any> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function flattenHooks(hooksObject: Record<string, any>): Array<{ event: string; name: string; data: { matcher?: string; type: string; command: string } }> {
  const entries: Array<{ event: string; name: string; data: { matcher?: string; type: string; command: string } }> = []
  for (const [eventName, groups] of Object.entries(hooksObject)) {
    if (!Array.isArray(groups)) {
      continue
    }
    for (const group of groups) {
      const matcher = group.matcher
      const hooks = group.hooks
      if (!Array.isArray(hooks)) {
        continue
      }
      for (const [index, hook] of hooks.entries()) {
        entries.push({
          event: eventName,
          name: `${eventName} [${index}]`,
          data: {
            ...(matcher ? { matcher } : {}),
            type: hook.type,
            command: hook.command,
          },
        })
      }
    }
  }
  return entries
}

export const configsRoutes: FastifyPluginAsync<ConfigRoutesOptions> = async (fastify, options) => {
  const { baseDir, projectBaseDir, pluginsDir, settingsPath, claudeSettingsPaths } = options
  const resolver = new PluginResolver(pluginsDir, claudeSettingsPaths)

  // GET /api/mcp — read .mcp.json and merge with plugin + project contributions
  fastify.get('/api/mcp', async () => {
    const entries: McpEntry[] = []

    const data = await readJson(path.join(baseDir, '.mcp.json'))
    const localServers = data?.mcpServers ?? {}
    for (const [name, config] of Object.entries(localServers)) {
      entries.push({ name, config, source: 'local', scope: 'global' })
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginData = await readJson(path.join(installPath, '.mcp.json'))
      const pluginServers = pluginData?.mcpServers ?? {}
      for (const [name, config] of Object.entries(pluginServers)) {
        entries.push({ name, config, source: 'plugin', scope: 'global', pluginId: id })
      }
    }

    if (projectBaseDir) {
      const projectData = await readJson(path.join(projectBaseDir, '.mcp.json'))
      const projectServers = projectData?.mcpServers ?? {}
      for (const [name, config] of Object.entries(projectServers)) {
        entries.push({ name, config, source: 'project', scope: 'project' })
      }
    }

    return { mcpServers: entries }
  })

  // GET /api/hooks — read hooks from settings.json and merge with plugin + project contributions
  fastify.get('/api/hooks', async () => {
    const entries: HookEntry[] = []

    const settings = await readJson(settingsPath)
    const localHooks = settings?.hooks ?? {}
    const flatLocal = flattenHooks(localHooks)
    for (const entry of flatLocal) {
      entries.push({ ...entry, source: 'local', scope: 'global' })
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginHooksData = await readJson(path.join(installPath, 'hooks', 'hooks.json'))
      const pluginHooks = pluginHooksData?.hooks ?? {}
      const flatPlugin = flattenHooks(pluginHooks)
      for (const entry of flatPlugin) {
        entries.push({ ...entry, source: 'plugin', scope: 'global', pluginId: id })
      }
    }

    if (projectBaseDir) {
      const projectSettings = await readJson(path.join(projectBaseDir, 'settings.json'))
      const projectHooks = projectSettings?.hooks ?? {}
      const flatProject = flattenHooks(projectHooks)
      for (const entry of flatProject) {
        entries.push({ ...entry, source: 'project', scope: 'project' })
      }
    }

    return { hooks: entries }
  })

  // GET /api/lsp — read .lsp.json and merge with plugin + project contributions
  fastify.get('/api/lsp', async () => {
    const entries: LspEntry[] = []

    const data = await readJson(path.join(baseDir, '.lsp.json'))
    if (data && typeof data === 'object') {
      for (const [name, config] of Object.entries(data)) {
        entries.push({ name, config, source: 'local', scope: 'global' })
      }
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginData = await readJson(path.join(installPath, '.lsp.json'))
      if (pluginData && typeof pluginData === 'object') {
        for (const [name, config] of Object.entries(pluginData)) {
          entries.push({ name, config, source: 'plugin', scope: 'global', pluginId: id })
        }
      }
    }

    if (projectBaseDir) {
      const projectData = await readJson(path.join(projectBaseDir, '.lsp.json'))
      if (projectData && typeof projectData === 'object') {
        for (const [name, config] of Object.entries(projectData)) {
          entries.push({ name, config, source: 'project', scope: 'project' })
        }
      }
    }

    return { lspServers: entries }
  })
}
