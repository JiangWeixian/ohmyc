import path from 'node:path'

import { PluginResolver } from '../services/plugin-resolver'
import { SkillService } from '../services/skill-service'
import { resolveInventorySource } from './inventory-source'

import type { FastifyPluginAsync } from 'fastify'

interface SkillsRoutesOptions {
  skillsDir: string
  projectSkillsDir: string | null | undefined
  pluginsDir: string
  settingsPath: string
  baseDir?: string
}

export const skillsRoutes: FastifyPluginAsync<SkillsRoutesOptions> = async (fastify, options) => {
  const service = new SkillService(options.skillsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath)

  fastify.get('/api/skills', async () => {
    const skills = await service.list()

    for (const skill of skills) {
      const dirPath = path.join(options.skillsDir, skill.dirName);
      (skill as any).source = await resolveInventorySource(dirPath, options.baseDir);
      (skill as any).scope = 'global'
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new SkillService(path.join(installPath, 'skills'))
      const pluginSkills = await pluginService.list()
      for (const skill of pluginSkills) {
        skills.push({ ...skill, source: 'plugin' as const, scope: 'global' as const, pluginId: id })
      }
    }

    if (options.projectSkillsDir) {
      const projectService = new SkillService(options.projectSkillsDir)
      const projectSkills = await projectService.list()
      for (const skill of projectSkills) {
        skills.push({ ...skill, source: 'project' as const, scope: 'project' as const })
      }
    }

    skills.sort((a, b) => {
      const cmp = a.id.localeCompare(b.id)
      if (cmp !== 0) {
        return cmp
      }
      const aScope = (a as any).scope === 'project' ? 0 : 1
      const bScope = (b as any).scope === 'project' ? 0 : 1
      return aScope - bScope
    })
    return { skills }
  })

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string; scope?: string } }>('/api/skills/:name', async (request, reply) => {
    const { name } = request.params
    const { source, pluginId, scope } = request.query

    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      const target = pluginPaths.find(p => p.id === pluginId)
      if (target) {
        const pluginService = new SkillService(path.join(target.installPath, 'skills'))
        const pluginSkill = await pluginService.get(name)
        if (pluginSkill) {
          return { skill: { ...pluginSkill, source: 'plugin' as const, scope: 'global' as const, pluginId } }
        }
      }
      return reply.status(404).send({ error: 'Skill not found' })
    }

    if ((source === 'project' || scope === 'project') && options.projectSkillsDir) {
      const projectService = new SkillService(options.projectSkillsDir)
      const projectSkill = await projectService.get(name)
      if (projectSkill) {
        return { skill: { ...projectSkill, source: 'project' as const, scope: 'project' as const } }
      }
    }

    const skill = await service.get(name)
    if (skill) {
      const dirPath = path.join(options.skillsDir, skill.dirName);
      (skill as any).source = await resolveInventorySource(dirPath, options.baseDir);
      (skill as any).scope = 'global'
      return { skill }
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new SkillService(path.join(installPath, 'skills'))
      const pluginSkill = await pluginService.get(name)
      if (pluginSkill) {
        return { skill: { ...pluginSkill, source: 'plugin' as const, scope: 'global' as const, pluginId: id } }
      }
    }

    return reply.status(404).send({ error: 'Skill not found' })
  })
}
