// Agent inventory routes — merges agents from the store, enabled plugins, and the project directory.
import path from 'node:path'

import { AgentService } from '../services/agent-service'
import { PluginResolver } from '../services/plugin-resolver'
import { resolveInventorySource } from './inventory-source'

import type { FastifyPluginAsync } from 'fastify'

/** Route registration options for the agents API. */
interface AgentsRoutesOptions {
  agentsDir: string
  projectAgentsDir: string | null | undefined
  pluginsDir: string
  claudeSettingsPaths: readonly string[]
  baseDir?: string
}

/**
 * Registers agent listing and detail routes.
 * Agents are resolved from three sources in priority order:
 * 1. OhMyC store (`agentsDir`)
 * 2. Enabled plugins
 * 3. Project directory (`projectAgentsDir`)
 */
export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.claudeSettingsPaths)

  fastify.get('/api/agents', async () => {
    const agents = await service.list()

    for (const agent of agents) {
      const filePath = path.join(options.agentsDir, agent.filename);
      (agent as any).source = await resolveInventorySource(filePath, options.baseDir);
      (agent as any).scope = 'global'
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'))
      const pluginAgents = await pluginService.list()
      for (const agent of pluginAgents) {
        agents.push({ ...agent, source: 'plugin' as const, scope: 'global' as const, pluginId: id })
      }
    }

    if (options.projectAgentsDir) {
      const projectService = new AgentService(options.projectAgentsDir)
      const projectAgents = await projectService.list()
      for (const agent of projectAgents) {
        agents.push({ ...agent, source: 'project' as const, scope: 'project' as const })
      }
    }

    agents.sort((a, b) => {
      const cmp = a.id.localeCompare(b.id)
      if (cmp !== 0) {
        return cmp
      }
      const aScope = (a as any).scope === 'project' ? 0 : 1
      const bScope = (b as any).scope === 'project' ? 0 : 1
      return aScope - bScope
    })
    return { agents }
  })

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string; scope?: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params
    const { source, pluginId, scope } = request.query

    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      const target = pluginPaths.find(p => p.id === pluginId)
      if (target) {
        const pluginService = new AgentService(path.join(target.installPath, 'agents'))
        const pluginAgent = await pluginService.get(name)
        if (pluginAgent) {
          return { agent: { ...pluginAgent, source: 'plugin' as const, scope: 'global' as const, pluginId } }
        }
      }
      return reply.status(404).send({ error: 'Agent not found' })
    }

    if ((source === 'project' || scope === 'project') && options.projectAgentsDir) {
      const projectService = new AgentService(options.projectAgentsDir)
      const projectAgent = await projectService.get(name)
      if (projectAgent) {
        return { agent: { ...projectAgent, source: 'project' as const, scope: 'project' as const } }
      }
    }

    const agent = await service.get(name)
    if (agent) {
      const filePath = path.join(options.agentsDir, agent.filename);
      (agent as any).source = await resolveInventorySource(filePath, options.baseDir);
      (agent as any).scope = 'global'
      return { agent }
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'))
      const pluginAgent = await pluginService.get(name)
      if (pluginAgent) {
        return { agent: { ...pluginAgent, source: 'plugin' as const, scope: 'global' as const, pluginId: id } }
      }
    }

    return reply.status(404).send({ error: 'Agent not found' })
  })
}
