// Plugin and marketplace routes — exposes the Claude Code plugin registry.
import { PluginService } from '../services/plugin-service'

import type { FastifyPluginAsync } from 'fastify'

/** Route registration options for the plugins API. */
interface PluginsRoutesOptions {
  pluginsDir: string
  claudeSettingsPaths: readonly string[]
}

/**
 * Registers plugin and marketplace listing/detail routes.
 * Reads the `installed_plugins.json` and `known_marketplaces.json` files from the Claude Code plugins directory.
 */
export const pluginsRoutes: FastifyPluginAsync<PluginsRoutesOptions> = async (fastify, options) => {
  const service = new PluginService(options.pluginsDir, options.claudeSettingsPaths)

  /** GET /api/plugins — list all installed plugins with metadata and enabled state. */
  fastify.get('/api/plugins', async () => {
    const plugins = await service.listPlugins()
    return { plugins }
  })

  /** GET /api/plugins/:id — fetch a single installed plugin by its full ID (e.g. `name@marketplace`). */
  fastify.get<{ Params: { id: string } }>('/api/plugins/:id', async (request, reply) => {
    const plugin = await service.getPlugin(request.params.id)
    if (!plugin) {
      return reply.status(404).send({ error: 'Plugin not found' })
    }
    return { plugin }
  })

  /** GET /api/marketplaces — list all known plugin marketplaces. */
  fastify.get('/api/marketplaces', async () => {
    const marketplaces = await service.listMarketplaces()
    return { marketplaces }
  })

  /** GET /api/marketplaces/:id — fetch a single marketplace by ID. */
  fastify.get<{ Params: { id: string } }>('/api/marketplaces/:id', async (request, reply) => {
    const marketplace = await service.getMarketplace(request.params.id)
    if (!marketplace) {
      return reply.status(404).send({ error: 'Marketplace not found' })
    }
    return { marketplace }
  })
}
