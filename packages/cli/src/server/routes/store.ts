import { FastifyPluginAsync } from 'fastify';
import { AgentService } from '../services/agentService';
import { SkillService } from '../services/skillService';
import { CommandService } from '../services/commandService';
import { ModelConfigService } from '../services/modelConfigService';
import { StoreService } from '../services/storeService';
import {
  SAFE_NAME_PATTERN,
  CreateAgentBodySchema, UpdateAgentBodySchema,
  CreateSkillBodySchema, UpdateSkillBodySchema,
  CreateCommandBodySchema, UpdateCommandBodySchema,
  CreateModelConfigBodySchema, UpdateModelConfigBodySchema,
  StoreImportRequestSchema,
} from '@claudeui/shared';
import path from 'path';

interface StoreRoutesOptions {
  baseDir: string;
}

export const storeRoutes: FastifyPluginAsync<StoreRoutesOptions> = async (fastify, options) => {
  const storeDir = path.join(options.baseDir, 'store');
  const profilesDir = path.join(options.baseDir, 'profiles');

  const agentService = new AgentService(path.join(storeDir, 'agents'));
  const skillService = new SkillService(path.join(storeDir, 'skills'));
  const commandService = new CommandService(path.join(storeDir, 'commands'));
  const modelConfigService = new ModelConfigService(path.join(storeDir, 'model-configs'));
  const storeService = new StoreService(storeDir, profilesDir);

  function validateName(name: string): string | null {
    if (!SAFE_NAME_PATTERN.test(name)) return 'Invalid name: must match [a-zA-Z0-9_-]';
    return null;
  }

  const MODEL_CONFIG_NAME_RE = /^[a-zA-Z0-9_./-]+$/;
  function validateModelConfigName(name: string): string | null {
    if (!MODEL_CONFIG_NAME_RE.test(name) || name.includes('..')) return 'Invalid name: must match [a-zA-Z0-9_./-]';
    return null;
  }

  async function attachProvenance<T extends { id: string }>(
    type: 'agents' | 'skills' | 'commands',
    item: T,
  ): Promise<T> {
    const provenance = await storeService.getProvenance(type, item.id);
    return provenance ? { ...item, provenance } : item;
  }

  async function attachProvenanceList<T extends { id: string }>(
    type: 'agents' | 'skills' | 'commands',
    items: T[],
  ): Promise<T[]> {
    return Promise.all(items.map(item => attachProvenance(type, item)));
  }

  // --- Store Agents ---
  fastify.get('/api/store/agents', async () => ({
    agents: await attachProvenanceList('agents', await agentService.list()),
  }));

  fastify.get<{ Params: { name: string } }>('/api/store/agents/:name', async (request, reply) => {
    const error = validateName(request.params.name);
    if (error) return reply.status(400).send({ error });
    const agent = await agentService.get(request.params.name);
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    return { agent: await attachProvenance('agents', agent) };
  });

  fastify.post('/api/store/agents', async (request, reply) => {
    const parsed = CreateAgentBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    try {
      const agent = await agentService.create(parsed.data.frontmatter, parsed.data.content);
      return reply.status(201).send({ agent });
    } catch (err: any) {
      if (err.message.includes('already exists')) return reply.status(409).send({ error: err.message });
      if (err.message.includes('invalid')) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { name: string } }>('/api/store/agents/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    const parsed = UpdateAgentBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const agent = await agentService.update(request.params.name, parsed.data);
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    return { agent };
  });

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/agents/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('agents', request.params.name);
      if (refs.length > 0) return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs });
    }
    const deleted = await agentService.delete(request.params.name);
    if (!deleted) return reply.status(404).send({ error: 'Agent not found' });
    return { success: true };
  });

  // --- Store Skills ---
  fastify.get('/api/store/skills', async () => ({
    skills: await attachProvenanceList('skills', await skillService.list()),
  }));

  fastify.get<{ Params: { name: string } }>('/api/store/skills/:name', async (request, reply) => {
    const error = validateName(request.params.name);
    if (error) return reply.status(400).send({ error });
    const skill = await skillService.get(request.params.name);
    if (!skill) return reply.status(404).send({ error: 'Skill not found' });
    return { skill: await attachProvenance('skills', skill) };
  });

  fastify.post('/api/store/skills', async (request, reply) => {
    const parsed = CreateSkillBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    try {
      const skill = await skillService.create(parsed.data.frontmatter, parsed.data.content);
      return reply.status(201).send({ skill });
    } catch (err: any) {
      if (err.message.includes('already exists')) return reply.status(409).send({ error: err.message });
      if (err.message.includes('invalid')) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { name: string } }>('/api/store/skills/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    const parsed = UpdateSkillBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const skill = await skillService.update(request.params.name, parsed.data);
    if (!skill) return reply.status(404).send({ error: 'Skill not found' });
    return { skill };
  });

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/skills/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('skills', request.params.name);
      if (refs.length > 0) return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs });
    }
    const deleted = await skillService.delete(request.params.name);
    if (!deleted) return reply.status(404).send({ error: 'Skill not found' });
    return { success: true };
  });

  // --- Store Commands ---
  fastify.get('/api/store/commands', async () => ({
    commands: await attachProvenanceList('commands', await commandService.list()),
  }));

  fastify.get<{ Params: { name: string } }>('/api/store/commands/:name', async (request, reply) => {
    const error = validateName(request.params.name);
    if (error) return reply.status(400).send({ error });
    const command = await commandService.get(request.params.name);
    if (!command) return reply.status(404).send({ error: 'Command not found' });
    return { command: await attachProvenance('commands', command) };
  });

  fastify.post('/api/store/commands', async (request, reply) => {
    const parsed = CreateCommandBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    try {
      const command = await commandService.create(parsed.data.frontmatter, parsed.data.content);
      return reply.status(201).send({ command });
    } catch (err: any) {
      if (err.message.includes('already exists')) return reply.status(409).send({ error: err.message });
      if (err.message.includes('invalid')) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { name: string } }>('/api/store/commands/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    const parsed = UpdateCommandBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const command = await commandService.update(request.params.name, parsed.data);
    if (!command) return reply.status(404).send({ error: 'Command not found' });
    return { command };
  });

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/commands/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('commands', request.params.name);
      if (refs.length > 0) return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs });
    }
    const deleted = await commandService.delete(request.params.name);
    if (!deleted) return reply.status(404).send({ error: 'Command not found' });
    return { success: true };
  });

  // --- Store Model Configs ---
  fastify.get('/api/store/model-configs', async () => {
    const configs = await modelConfigService.list();
    const withProvenance = await Promise.all(configs.map(async (config) => {
      const provenance = await storeService.getProvenance('model-configs', config.name);
      return provenance ? { ...config, provenance } : config;
    }));
    return { modelConfigs: withProvenance };
  });

  fastify.get<{ Params: { name: string } }>('/api/store/model-configs/:name', async (request, reply) => {
    const error = validateModelConfigName(request.params.name);
    if (error) return reply.status(400).send({ error });
    const config = await modelConfigService.get(request.params.name);
    if (!config) return reply.status(404).send({ error: 'Model config not found' });
    const provenance = await storeService.getProvenance('model-configs', config.name);
    return { modelConfig: provenance ? { ...config, provenance } : config };
  });

  fastify.post('/api/store/model-configs', async (request, reply) => {
    const parsed = CreateModelConfigBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    try {
      const config = await modelConfigService.create(parsed.data);
      return reply.status(201).send({ modelConfig: config });
    } catch (err: any) {
      if (err.message.includes('already exists')) return reply.status(409).send({ error: err.message });
      if (err.message.includes('invalid')) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { name: string } }>('/api/store/model-configs/:name', async (request, reply) => {
    const nameErr = validateModelConfigName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    const parsed = UpdateModelConfigBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const config = await modelConfigService.update(request.params.name, parsed.data);
    if (!config) return reply.status(404).send({ error: 'Model config not found' });
    return { modelConfig: config };
  });

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/model-configs/:name', async (request, reply) => {
    const nameErr = validateModelConfigName(request.params.name);
    if (nameErr) return reply.status(400).send({ error: nameErr });
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('model-configs', request.params.name);
      if (refs.length > 0) return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs });
    }
    const deleted = await modelConfigService.delete(request.params.name);
    if (!deleted) return reply.status(404).send({ error: 'Model config not found' });
    return { success: true };
  });

  // --- Import ---
  fastify.post('/api/store/import', async (request, reply) => {
    const parsed = StoreImportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    if (parsed.data.dryRun && parsed.data.overwrite) {
      return reply.status(400).send({ error: 'overwrite cannot be true when dryRun is true' });
    }

    const result = await storeService.import(parsed.data);
    return {
      imported: result.imported,
      skipped: result.skipped,
      overwritten: result.overwritten,
      errors: result.errors,
      conflicts: result.conflicts,
    };
  });
};
