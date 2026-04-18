import { FastifyPluginAsync } from 'fastify';
import { PluginService } from '../services/pluginService';

interface PluginsRoutesOptions {
  pluginsDir: string;
  settingsPath: string;
}

export const pluginsRoutes: FastifyPluginAsync<PluginsRoutesOptions> = async (fastify, options) => {
  const service = new PluginService(options.pluginsDir, options.settingsPath);

  // GET /api/plugins — list installed plugins
  fastify.get('/api/plugins', async () => {
    const plugins = await service.listPlugins();
    return { plugins };
  });

  // GET /api/plugins/:id — get single plugin (id is "name@marketplace")
  fastify.get<{ Params: { id: string } }>('/api/plugins/:id', async (request, reply) => {
    const plugin = await service.getPlugin(request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });
    return { plugin };
  });

  // GET /api/marketplaces — list known marketplaces
  fastify.get('/api/marketplaces', async () => {
    const marketplaces = await service.listMarketplaces();
    return { marketplaces };
  });

  // GET /api/marketplaces/:id — get single marketplace
  fastify.get<{ Params: { id: string } }>('/api/marketplaces/:id', async (request, reply) => {
    const marketplace = await service.getMarketplace(request.params.id);
    if (!marketplace) return reply.status(404).send({ error: 'Marketplace not found' });
    return { marketplace };
  });
};
