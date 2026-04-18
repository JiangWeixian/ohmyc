import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import { SkillService } from '../services/skillService';
import { PluginResolver } from '../services/pluginResolver';
import { resolveInventorySource } from './inventorySource';

interface SkillsRoutesOptions {
  skillsDir: string;
  pluginsDir: string;
  settingsPath: string;
  baseDir?: string;
}

export const skillsRoutes: FastifyPluginAsync<SkillsRoutesOptions> = async (fastify, options) => {
  const service = new SkillService(options.skillsDir);
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath);

  fastify.get('/api/skills', async () => {
    const skills = await service.list();

    // Tag source: check if symlink (profile) or regular file (local)
    for (const skill of skills) {
      const dirPath = path.join(options.skillsDir, skill.dirName);
      (skill as any).source = await resolveInventorySource(dirPath, options.baseDir);
    }

    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new SkillService(path.join(installPath, 'skills'));
      const pluginSkills = await pluginService.list();
      for (const skill of pluginSkills) {
        skills.push({ ...skill, source: 'plugin', pluginId: id });
      }
    }

    skills.sort((a, b) => a.id.localeCompare(b.id));
    return { skills };
  });

  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string } }>('/api/skills/:name', async (request, reply) => {
    const { name } = request.params;
    const { source, pluginId } = request.query;

    // If source=plugin and pluginId specified, search that plugin directly
    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths();
      const target = pluginPaths.find(p => p.id === pluginId);
      if (target) {
        const pluginService = new SkillService(path.join(target.installPath, 'skills'));
        const pluginSkill = await pluginService.get(name);
        if (pluginSkill) return { skill: { ...pluginSkill, source: 'plugin' as const, pluginId } };
      }
      return reply.status(404).send({ error: 'Skill not found' });
    }

    // Search local
    const skill = await service.get(name);
    if (skill) {
      const dirPath = path.join(options.skillsDir, skill.dirName);
      (skill as any).source = await resolveInventorySource(dirPath, options.baseDir);
      return { skill };
    }

    // Fallback: search all plugins
    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new SkillService(path.join(installPath, 'skills'));
      const pluginSkill = await pluginService.get(name);
      if (pluginSkill) return { skill: { ...pluginSkill, source: 'plugin' as const, pluginId: id } };
    }

    return reply.status(404).send({ error: 'Skill not found' });
  });
};
