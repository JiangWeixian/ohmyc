import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import { CommandService } from '../services/commandService';
import { PluginResolver } from '../services/pluginResolver';
import { resolveInventorySource } from './inventorySource';

interface CommandsRoutesOptions {
  commandsDir: string;
  pluginsDir: string;
  settingsPath: string;
  baseDir?: string;
}

export const commandsRoutes: FastifyPluginAsync<CommandsRoutesOptions> = async (fastify, options) => {
  const service = new CommandService(options.commandsDir);
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath);

  fastify.get('/api/commands', async () => {
    const commands = await service.list();

    // Tag source: check if symlink (profile) or regular file (local)
    for (const cmd of commands) {
      const filePath = path.join(options.commandsDir, cmd.filename);
      (cmd as any).source = await resolveInventorySource(filePath, options.baseDir);
    }

    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new CommandService(path.join(installPath, 'commands'));
      const pluginCommands = await pluginService.list();
      for (const cmd of pluginCommands) {
        commands.push({ ...cmd, source: 'plugin', pluginId: id });
      }
    }

    commands.sort((a, b) => a.id.localeCompare(b.id));
    return { commands };
  });

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string } }>('/api/commands/:name', async (request, reply) => {
    const { name } = request.params;
    const { source, pluginId } = request.query;

    // If source=plugin and pluginId specified, search that plugin directly
    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths();
      const target = pluginPaths.find(p => p.id === pluginId);
      if (target) {
        const pluginService = new CommandService(path.join(target.installPath, 'commands'));
        const pluginCommand = await pluginService.get(name);
        if (pluginCommand) return { command: { ...pluginCommand, source: 'plugin' as const, pluginId } };
      }
      return reply.status(404).send({ error: 'Command not found' });
    }

    // Search local
    const command = await service.get(name);
    if (command) {
      const filePath = path.join(options.commandsDir, command.filename);
      (command as any).source = await resolveInventorySource(filePath, options.baseDir);
      return { command };
    }

    // Fallback: search all plugins
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new CommandService(path.join(installPath, 'commands'));
      const pluginCommand = await pluginService.get(name);
      if (pluginCommand) return { command: { ...pluginCommand, source: 'plugin' as const, pluginId: id } };
    }

    return reply.status(404).send({ error: 'Command not found' });
  });
};
