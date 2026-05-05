import { CreateProfileBodySchema, UpdateProfileBodySchema } from '@ohmyc/shared'

import { ActivationBlockedError, ProfileService } from '../services/profile-service'

import type { FastifyPluginAsync } from 'fastify'

/** Route registration options for the profiles API. */
interface ProfilesRoutesOptions {
  baseDir: string
  claudeSettingsPath: string
  pluginsDir: string
}

/**
 * Registers profile CRUD and activation routes.
 * Profiles are stored as JSON files under `<baseDir>/profiles/<name>/profile.json`.
 */
export const profilesRoutes: FastifyPluginAsync<ProfilesRoutesOptions> = async (fastify, options) => {
  const service = new ProfileService(options.baseDir, options.claudeSettingsPath, options.pluginsDir)

  /** GET /api/profiles — list all profiles and the currently active one. */
  fastify.get('/api/profiles', async () => {
    return service.list()
  })

  /** GET /api/profiles/:name — fetch a single profile by name. */
  fastify.get<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const profile = await service.get(request.params.name)
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { profile }
  })

  /** POST /api/profiles — create a new profile. */
  fastify.post('/api/profiles', async (request, reply) => {
    const parsed = CreateProfileBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    try {
      const profile = await service.create(parsed.data)
      return reply.status(201).send({ profile })
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message })
      }
      if (error.message.includes('invalid') || error.message.includes('reserved')) {
        return reply.status(400).send({ error: error.message })
      }
      throw error
    }
  })

  /** PUT /api/profiles/:name — update an existing profile (all fields optional). */
  fastify.put<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const parsed = UpdateProfileBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    const profile = await service.update(request.params.name, parsed.data)
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { profile }
  })

  /** DELETE /api/profiles/:name — delete a profile (cannot delete the active profile). */
  fastify.delete<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const { active } = await service.list()
    if (active === request.params.name) {
      return reply.status(409).send({ error: `Cannot delete active profile. Deactivate ${request.params.name} before deleting it.` })
    }

    const deleted = await service.delete(request.params.name)
    if (!deleted) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { success: true }
  })

  /** GET /api/profiles/:name/preflight — preview what would change on activation. */
  fastify.get<{ Params: { name: string } }>('/api/profiles/:name/preflight', async (request, reply) => {
    try {
      const result = await service.preflight(request.params.name)
      return result
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message })
      }
      throw error
    }
  })

  /** POST /api/profiles/:name/activate — activate a profile, replacing symlinks and writing settings. */
  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/activate', async (request, reply) => {
    try {
      const result = await service.activate(request.params.name)
      return { success: true, warnings: result.warnings }
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message })
      }
      if (error.message.includes('Another activation is in progress')) {
        return reply.status(423).send({ error: error.message })
      }
      if (error instanceof ActivationBlockedError) {
        return reply.status(422).send({ error: 'Cannot activate profile: missing store components', missing: error.missing })
      }
      throw error
    }
  })

  /** POST /api/profiles/:name/deactivate — deactivate the current profile. */
  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/deactivate', async () => {
    await service.deactivate()
    return { success: true }
  })
}
