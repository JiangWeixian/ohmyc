import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { AGENT_DIR_NAME } from '../services/config-locator'

import type { FastifyInstance } from 'fastify'

interface SettingsQuery {
  project?: string
}

interface SettingsBody {
  content: unknown
}

interface SettingsRouteOptions {
  cwd?: string
}

export async function settingsRoutes(fastify: FastifyInstance, options: SettingsRouteOptions = {}) {
  const baseCwd = options.cwd || process.cwd()

  // GET /api/settings?project=<path> - reads {AGENT_DIR_NAME}/settings.json from project directory
  fastify.get<{ Querystring: SettingsQuery }>('/api/settings', async (request) => {
    const project = request.query.project || baseCwd
    const settingsPath = path.join(project, AGENT_DIR_NAME, 'settings.json')

    try {
      if (!existsSync(settingsPath)) {
        return {
          path: settingsPath,
          content: null,
          exists: false,
        }
      }

      const content = readFileSync(settingsPath, 'utf8')
      return {
        path: settingsPath,
        content: JSON.parse(content),
        exists: true,
      }
    } catch (error) {
      return {
        path: settingsPath,
        content: null,
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to read settings',
      }
    }
  })

  // POST /api/settings?project=<path> - writes content to {AGENT_DIR_NAME}/settings.json
  fastify.post<{ Querystring: SettingsQuery; Body: SettingsBody }>('/api/settings', async (request) => {
    const project = request.query.project || baseCwd
    const claudeDir = path.join(project, AGENT_DIR_NAME)
    const settingsPath = path.join(claudeDir, 'settings.json')

    const { content } = request.body

    // Validate content is an object
    if (content === null || content === undefined) {
      return {
        success: false,
        path: settingsPath,
        error: 'Content is required',
      }
    }

    if (typeof content !== 'object' || Array.isArray(content)) {
      return {
        success: false,
        path: settingsPath,
        error: 'Content must be an object',
      }
    }

    try {
      // Create agent directory if it doesn't exist
      if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true })
      }

      // Write the settings file
      writeFileSync(settingsPath, JSON.stringify(content, null, 2), 'utf8')

      return {
        success: true,
        path: settingsPath,
      }
    } catch (error) {
      return {
        success: false,
        path: settingsPath,
        error: error instanceof Error ? error.message : 'Failed to write settings',
      }
    }
  })

  // GET /api/settings/schema - returns JSON Schema from Zod (lazy import)
  fastify.get('/api/settings/schema', async (request, reply) => {
    try {
      const { SettingsJsonSchema } = await import('@ohmyc/shared')
      const { zodToJsonSchema } = await import('zod-to-json-schema')

      const jsonSchema = zodToJsonSchema(SettingsJsonSchema as any, 'settings')
      return jsonSchema
    } catch (error) {
      reply.status(500)
      return {
        error: error instanceof Error ? error.message : 'Failed to generate schema',
      }
    }
  })
}
