import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import { AgentService } from '../services/agentService';
import { PluginResolver } from '../services/pluginResolver';
import { resolveInventorySource } from './inventorySource';

interface AgentsRoutesOptions {
  agentsDir: string;
  pluginsDir: string;
  settingsPath: string;
  baseDir?: string;
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir);
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath);

  fastify.get('/api/agents', async () => {
    const agents = await service.list();

    // Tag source: check if symlink (profile) or regular file (local)
    for (const agent of agents) {
      const filePath = path.join(options.agentsDir, agent.filename);
      (agent as any).source = await resolveInventorySource(filePath, options.baseDir);
    }

    // Aggregate from enabled plugins
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'));
      const pluginAgents = await pluginService.list();
      for (const agent of pluginAgents) {
        agents.push({ ...agent, source: 'plugin', pluginId: id });
      }
    }

    agents.sort((a, b) => a.id.localeCompare(b.id));
    return { agents };
  });

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params;
    const { source, pluginId } = request.query;

    // If source=plugin and pluginId specified, search that plugin directly
    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths();
      const target = pluginPaths.find(p => p.id === pluginId);
      if (target) {
        const pluginService = new AgentService(path.join(target.installPath, 'agents'));
        const pluginAgent = await pluginService.get(name);
        if (pluginAgent) return { agent: { ...pluginAgent, source: 'plugin' as const, pluginId } };
      }
      return reply.status(404).send({ error: 'Agent not found' });
    }

    // Search local
    const agent = await service.get(name);
    if (agent) {
      const filePath = path.join(options.agentsDir, agent.filename);
      (agent as any).source = await resolveInventorySource(filePath, options.baseDir);
      return { agent };
    }

    // Fallback: search all plugins
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'));
      const pluginAgent = await pluginService.get(name);
      if (pluginAgent) return { agent: { ...pluginAgent, source: 'plugin' as const, pluginId: id } };
    }

    return reply.status(404).send({ error: 'Agent not found' });
  });
};
