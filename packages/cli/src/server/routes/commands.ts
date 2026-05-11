import path from 'node:path'

import { CommandService } from '../services/command-service'
import { PluginResolver } from '../services/plugin-resolver'
import { resolveInventorySource } from './inventory-source'

import type { Origin } from '@ohmyc/shared'
import type { FastifyPluginAsync } from 'fastify'
import type { ProviderRegistry } from '../services/provider-registry'

interface CommandsRoutesOptions {
  commandsDir: string
  projectCommandsDir: string | null | undefined
  pluginsDir: string
  claudeSettingsPaths: readonly string[]
  baseDir?: string
  registry?: ProviderRegistry
}

function parseOriginsQuery(value: string | undefined): Origin[] | undefined {
  if (!value) {
    return undefined
  }
  const valid: Origin[] = ['claude', 'opencode', 'agents']
  const parts = value.split(',').map(s => s.trim()).filter(Boolean)
  const filtered = parts.filter((p): p is Origin => (valid as string[]).includes(p))
  return filtered.length > 0 ? filtered : undefined
}

export const commandsRoutes: FastifyPluginAsync<CommandsRoutesOptions> = async (fastify, options) => {
  const service = new CommandService(options.commandsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.claudeSettingsPaths)

  fastify.get<{ Querystring: { origins?: string } }>('/api/commands', async (request) => {
    const origins = parseOriginsQuery(request.query.origins)

    const commands: any[] = []

    if (options.registry) {
      const entries = await options.registry.listCommands(origins ? { origins } : undefined)
      for (const entry of entries) {
        const data = entry.data as any
        const primary = entry.origins[0]
        const merged = { ...data, origins: entry.origins, scope: entry.scope }
        if (primary === 'claude' && entry.scope === 'global') {
          merged.source = await resolveInventorySource(entry.sourceFile, options.baseDir)
        } else if (primary === 'claude' && entry.scope === 'project') {
          merged.source = 'project'
        } else {
          merged.source = primary
        }
        commands.push(merged)
      }
    } else {
      const list = await service.list()
      for (const cmd of list) {
        const filePath = path.join(options.commandsDir, cmd.filename)
        ;(cmd as any).source = await resolveInventorySource(filePath, options.baseDir)
        ;(cmd as any).scope = 'global'
        commands.push(cmd)
      }

      if (options.projectCommandsDir) {
        const projectService = new CommandService(options.projectCommandsDir)
        const projectCommands = await projectService.list()
        for (const cmd of projectCommands) {
          commands.push({ ...cmd, source: 'project' as const, scope: 'project' as const })
        }
      }
    }

    const includeClaude = !origins || origins.includes('claude')
    if (includeClaude) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      for (const { id, installPath } of pluginPaths) {
        const pluginService = new CommandService(path.join(installPath, 'commands'))
        const pluginCommands = await pluginService.list()
        for (const cmd of pluginCommands) {
          commands.push({
            ...cmd,
            source: 'plugin' as const,
            scope: 'global' as const,
            pluginId: id,
            origins: ['claude'],
          })
        }
      }
    }

    commands.sort((a, b) => {
      const cmp = a.id.localeCompare(b.id)
      if (cmp !== 0) {
        return cmp
      }
      const aScope = (a as any).scope === 'project' ? 0 : 1
      const bScope = (b as any).scope === 'project' ? 0 : 1
      return aScope - bScope
    })
    return { commands }
  })

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string; scope?: string } }>('/api/commands/:name', async (request, reply) => {
    const { name } = request.params
    const { source, pluginId, scope } = request.query

    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      const target = pluginPaths.find(p => p.id === pluginId)
      if (target) {
        const pluginService = new CommandService(path.join(target.installPath, 'commands'))
        const pluginCommand = await pluginService.get(name)
        if (pluginCommand) {
          return { command: { ...pluginCommand, source: 'plugin' as const, scope: 'global' as const, pluginId } }
        }
      }
      return reply.status(404).send({ error: 'Command not found' })
    }

    if ((source === 'project' || scope === 'project') && options.projectCommandsDir) {
      const projectService = new CommandService(options.projectCommandsDir)
      const projectCommand = await projectService.get(name)
      if (projectCommand) {
        return { command: { ...projectCommand, source: 'project' as const, scope: 'project' as const } }
      }
    }

    const command = await service.get(name)
    if (command) {
      const filePath = path.join(options.commandsDir, command.filename);
      (command as any).source = await resolveInventorySource(filePath, options.baseDir);
      (command as any).scope = 'global'
      return { command }
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new CommandService(path.join(installPath, 'commands'))
      const pluginCommand = await pluginService.get(name)
      if (pluginCommand) {
        return { command: { ...pluginCommand, source: 'plugin' as const, scope: 'global' as const, pluginId: id } }
      }
    }

    return reply.status(404).send({ error: 'Command not found' })
  })
}
