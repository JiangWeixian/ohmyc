import path from 'node:path'

import { AgentService } from '../services/agent-service'
import { PluginResolver } from '../services/plugin-resolver'
import { resolveInventorySource } from './inventory-source'
import { parseOriginsQuery } from './origins-query'

import type { Origin, ParsedAgent } from '@ohmyc/shared'
import type { FastifyPluginAsync } from 'fastify'
import type { ProviderRegistry } from '../services/provider-registry'

const PROVIDER_ORIGINS: readonly Origin[] = ['claude', 'opencode', 'agents']

interface AgentsRoutesOptions {
  agentsDir: string
  projectAgentsDir: string | null | undefined
  pluginsDir: string
  claudeSettingsPaths: readonly string[]
  baseDir?: string
  registry?: ProviderRegistry
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.claudeSettingsPaths)

  fastify.get<{ Querystring: { origins?: string } }>('/api/agents', async (request) => {
    const origins = parseOriginsQuery(request.query.origins)

    const agents: any[] = []

    if (options.registry) {
      const entries = await options.registry.listAgents(origins ? { origins } : undefined)
      for (const entry of entries) {
        const primary = entry.origins[0]
        let source: string
        if (primary === 'claude' && entry.scope === 'global') {
          source = await resolveInventorySource(entry.sourceFile, options.baseDir)
        } else if (primary === 'claude' && entry.scope === 'project') {
          source = 'project'
        } else {
          source = primary
        }
        const provider = options.registry.getProvider(primary)
        const badges = provider ? provider.agentBadges(entry.data) : []
        agents.push({
          ...entry.data,
          origins: entry.origins,
          scope: entry.scope,
          source,
          badges,
        })
      }
    } else {
      const list = await service.list()
      for (const agent of list) {
        const filePath = path.join(options.agentsDir, agent.filename)
        ;(agent as any).source = await resolveInventorySource(filePath, options.baseDir)
        ;(agent as any).scope = 'global'
        agents.push(agent)
      }

      if (options.projectAgentsDir) {
        const projectService = new AgentService(options.projectAgentsDir)
        const projectAgents = await projectService.list()
        for (const agent of projectAgents) {
          agents.push({ ...agent, source: 'project' as const, scope: 'project' as const })
        }
      }
    }

    const includeClaude = !origins || origins.includes('claude')
    if (includeClaude) {
      const claudeProvider = options.registry?.getProvider('claude')
      const pluginPaths = await resolver.getEnabledPluginPaths()
      for (const { id, installPath } of pluginPaths) {
        const pluginService = new AgentService(path.join(installPath, 'agents'))
        const pluginAgents = await pluginService.list()
        for (const agent of pluginAgents) {
          const badges = claudeProvider ? claudeProvider.agentBadges(agent as ParsedAgent) : []
          agents.push({
            ...agent,
            source: 'plugin' as const,
            scope: 'global' as const,
            pluginId: id,
            origins: ['claude'],
            badges,
          })
        }
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

    if (options.registry && source && (PROVIDER_ORIGINS as readonly string[]).includes(source)) {
      const origin = source as Origin
      const entries = await options.registry.listAgents({ origins: [origin] })
      const match = entries.find(e => e.data.id === name)
      if (match) {
        const provider = options.registry.getProvider(origin)
        const badges = provider ? provider.agentBadges(match.data) : []
        return {
          agent: {
            ...match.data,
            origins: match.origins,
            scope: match.scope,
            source,
            badges,
          },
        }
      }
      return reply.status(404).send({ error: 'Agent not found' })
    }

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
