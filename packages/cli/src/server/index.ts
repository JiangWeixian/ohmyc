import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import getPort from 'get-port'

import { logger } from '../logger'
import { agentsRoutes } from './routes/agents'
import { commandsRoutes } from './routes/commands'
import { configRoutes } from './routes/config'
import { configsRoutes } from './routes/configs'
import { pluginsRoutes } from './routes/plugins'
import { profilesRoutes } from './routes/profiles'
import { settingsRoutes } from './routes/settings'
import { skillsRoutes } from './routes/skills'
import { storeRoutes } from './routes/store'
import { timelineRoutes } from './routes/timeline'
import { ConfigLocator } from './services/config-locator'

// Handling import.meta.dirname in ESM context
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Candidate paths to search for packaged UI assets, ordered by priority.
 * 1. Packaged location inside CLI build output (production)
 * 2. Workspace-relative from dist/index.js (monorepo dev)
 * 3. Workspace-relative from dist/server/index.js (monorepo dev, alternate)
 * 4. Source-relative fallback (local development)
 */
function getDefaultCandidatePaths(): string[] {
  return [
    path.resolve(import.meta.dirname, 'ui'), // packaged: dist/ui/ or dist/server/ui/
    path.resolve(import.meta.dirname, '../../ui/dist'), // monorepo: dist/index.js -> ../../ui/dist
    path.resolve(import.meta.dirname, '../../../ui/dist'), // monorepo: dist/server/index.js -> ../../../ui/dist
    path.resolve(import.meta.dirname, '../../../../ui/dist'), // source: src/server/index.ts -> ../../../../ui/dist
  ]
}

/**
 * Resolve the static asset root directory.
 *
 * If an explicit `staticRoot` is given, it is validated for index.html presence.
 * Otherwise, candidate paths are tried in priority order.
 *
 * Throws a descriptive error when no valid UI asset directory is found.
 */
export function resolveStaticRoot(staticRoot?: string): string | undefined {
  const candidates = staticRoot ? [staticRoot] : getDefaultCandidatePaths()

  for (const candidate of candidates) {
    if (existsSync(candidate) && existsSync(path.join(candidate, 'index.html'))) {
      return candidate
    }
  }

  return undefined
}

export interface CreateServerOptions {
  staticRoot?: string
  apiOnly?: boolean
  cwd?: string
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger,
  })

  const serverCwd = options.cwd || process.cwd()
  const config = new ConfigLocator({ cwd: serverCwd })

  // Health check + debug
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      debug: {
        cwd: serverCwd,
        agentsDir: config.agentsDir,
        projectAgentsDir: config.projectAgentsDir,
        projectPath: config.projectPath,
      },
    }
  })

  if (!options.apiOnly) {
    const uiDistributionPath = resolveStaticRoot(options.staticRoot)

    if (uiDistributionPath) {
      logger.info(`Serving static files from: ${uiDistributionPath}`)
      fastify.register(fastifyStatic, {
        root: uiDistributionPath,
        prefix: '/',
        wildcard: false,
      })
    }
  }

  // REST API (must be registered before the SPA fallback)
  await fastify.register(configRoutes)
  await fastify.register(settingsRoutes, { cwd: serverCwd })

  const claudeSettingsPaths = config.claudeSettingsPaths

  await fastify.register(agentsRoutes, { agentsDir: config.agentsDir, projectAgentsDir: config.projectAgentsDir, pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir })
  await fastify.register(skillsRoutes, { skillsDir: config.skillsDir, projectSkillsDir: config.projectSkillsDir, pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir })
  await fastify.register(commandsRoutes, { commandsDir: config.commandsDir, projectCommandsDir: config.projectCommandsDir, pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir })
  await fastify.register(pluginsRoutes, { pluginsDir: config.pluginsDir, claudeSettingsPaths })
  await fastify.register(configsRoutes, { baseDir: config.baseDir, projectBaseDir: config.projectPath, pluginsDir: config.pluginsDir, claudeSettingsPaths })
  await fastify.register(profilesRoutes, { baseDir: config.baseDir, claudeSettingsPath: config.claudeSettingsPath, pluginsDir: config.pluginsDir })
  await fastify.register(storeRoutes, { baseDir: config.baseDir })
  await fastify.register(timelineRoutes)

  if (options.apiOnly) {
    fastify.setNotFoundHandler((request, reply) => {
      reply.status(404).send({ error: 'Not found' })
    })
  } else {
    fastify.setNotFoundHandler((request, reply) => {
      reply.sendFile('index.html')
    })
  }

  return fastify
}

export interface StartServerOptions {
  defaultPort?: number
  staticRoot?: string
  apiOnly?: boolean
  cwd?: string
}

export interface StartServerResult {
  port: number
  address: string
  staticRoot?: string
  fallback: boolean
  close: () => Promise<void>
}

export async function startServer(options: StartServerOptions | number = {}): Promise<StartServerResult> {
  const options_: StartServerOptions = typeof options === 'number'
    ? { defaultPort: options }
    : options

  const defaultPort = options_.defaultPort ?? 3000

  const port = await getPort({ port: [defaultPort, defaultPort + 1, defaultPort + 2, 0] })
  const fastify = await createServer({ staticRoot: options_.staticRoot, apiOnly: options_.apiOnly, cwd: options_.cwd })

  try {
    const address = await fastify.listen({ port, host: '0.0.0.0' })
    logger.info(`Server listening on ${address}`)
    return {
      port,
      address,
      staticRoot: resolveStaticRoot(options_.staticRoot),
      fallback: defaultPort !== 0 && port !== defaultPort,
      close: () => fastify.close(),
    }
  } catch (error) {
    fastify.log.error(error)
    throw error
  }
}
