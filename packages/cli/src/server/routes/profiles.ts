import { FastifyPluginAsync } from 'fastify';
import { ProfileService, ActivationBlockedError } from '../services/profileService';
import { CreateProfileBodySchema, UpdateProfileBodySchema } from '@claudeui/shared';

interface ProfilesRoutesOptions {
  baseDir: string;
}

export const profilesRoutes: FastifyPluginAsync<ProfilesRoutesOptions> = async (fastify, options) => {
  const service = new ProfileService(options.baseDir);

  fastify.get('/api/profiles', async () => {
    return service.list();
  });

  fastify.get<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const profile = await service.get(request.params.name);
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });
    return { profile };
  });

  fastify.post('/api/profiles', async (request, reply) => {
    const parsed = CreateProfileBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    try {
      const profile = await service.create(parsed.data);
      return reply.status(201).send({ profile });
    } catch (err: any) {
      if (err.message.includes('already exists')) return reply.status(409).send({ error: err.message });
      if (err.message.includes('invalid') || err.message.includes('reserved')) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  fastify.put<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const parsed = UpdateProfileBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const profile = await service.update(request.params.name, parsed.data);
    if (!profile) return reply.status(404).send({ error: 'Profile not found' });
    return { profile };
  });

  fastify.delete<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    // Check if this is the active profile
    const { active } = await service.list();
    if (active === request.params.name) {
      return reply.status(409).send({ error: `Cannot delete active profile. Deactivate ${request.params.name} before deleting it.` });
    }

    const deleted = await service.delete(request.params.name);
    if (!deleted) return reply.status(404).send({ error: 'Profile not found' });
    return { success: true };
  });

  fastify.get<{ Params: { name: string } }>('/api/profiles/:name/preflight', async (request, reply) => {
    try {
      const result = await service.preflight(request.params.name);
      return result;
    } catch (err: any) {
      if (err.message.includes('not found')) return reply.status(404).send({ error: err.message });
      throw err;
    }
  });

  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/activate', async (request, reply) => {
    try {
      const result = await service.activate(request.params.name);
      return { success: true, warnings: result.warnings };
    } catch (err: any) {
      if (err.message.includes('not found')) return reply.status(404).send({ error: err.message });
      if (err.message.includes('Another activation is in progress')) return reply.status(423).send({ error: err.message });
      if (err instanceof ActivationBlockedError) {
        return reply.status(422).send({ error: 'Cannot activate profile: missing store components', missing: err.missing });
      }
      throw err;
    }
  });

  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/deactivate', async (request, reply) => {
    await service.deactivate();
    return { success: true };
  });
};
