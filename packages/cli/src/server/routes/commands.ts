import path from 'node:path'

import { CommandService } from '../services/command-service'
import { PluginResolver } from '../services/plugin-resolver'
import { resolveInventorySource } from './inventory-source'

import type { FastifyPluginAsync } from 'fastify'

interface CommandsRoutesOptions {
  commandsDir: string
  projectCommandsDir: string | null | undefined
  pluginsDir: string
  settingsPath: string
  baseDir?: string
}

export const commandsRoutes: FastifyPluginAsync<CommandsRoutesOptions> = async (fastify, options) => {
  const service = new CommandService(options.commandsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath)

  fastify.get('/api/commands', async () => {
    const commands = await service.list()

    for (const cmd of commands) {
      const filePath = path.join(options.commandsDir, cmd.filename);
      (cmd as any).source = await resolveInventorySource(filePath, options.baseDir);
      (cmd as any).scope = 'global'
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new CommandService(path.join(installPath, 'commands'))
      const pluginCommands = await pluginService.list()
      for (const cmd of pluginCommands) {
        commands.push({ ...cmd, source: 'plugin' as const, scope: 'global' as const, pluginId: id })
      }
    }

    if (options.projectCommandsDir) {
      const projectService = new CommandService(options.projectCommandsDir)
      const projectCommands = await projectService.list()
      for (const cmd of projectCommands) {
        commands.push({ ...cmd, source: 'project' as const, scope: 'project' as const })
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
