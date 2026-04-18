import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { existsSync } from 'fs';
import getPort from 'get-port';
import { configRoutes } from './routes/config';
import { settingsRoutes } from './routes/settings';
import { agentsRoutes } from './routes/agents';
import { skillsRoutes } from './routes/skills';
import { commandsRoutes } from './routes/commands';
import { pluginsRoutes } from './routes/plugins';
import { configsRoutes } from './routes/configs';
import { profilesRoutes } from './routes/profiles';
import { storeRoutes } from './routes/store';
import { ConfigLocator } from './services/configLocator';
import { fileURLToPath } from 'url';

// Handling __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Candidate paths to search for packaged UI assets, ordered by priority.
 * 1. Packaged location inside CLI build output (production)
 * 2. Workspace-relative from dist/index.js (monorepo dev)
 * 3. Workspace-relative from dist/server/index.js (monorepo dev, alternate)
 * 4. Source-relative fallback (local development)
 */
function getDefaultCandidatePaths(): string[] {
  return [
    path.resolve(__dirname, 'ui'),              // packaged: dist/ui/ or dist/server/ui/
    path.resolve(__dirname, '../../ui/dist'),    // monorepo: dist/index.js -> ../../ui/dist
    path.resolve(__dirname, '../../../ui/dist'), // monorepo: dist/server/index.js -> ../../../ui/dist
    path.resolve(__dirname, '../../../../ui/dist'), // source: src/server/index.ts -> ../../../../ui/dist
  ];
}

/**
 * Resolve the static asset root directory.
 *
 * If an explicit `staticRoot` is given, it is validated for index.html presence.
 * Otherwise, candidate paths are tried in priority order.
 *
 * Throws a descriptive error when no valid UI asset directory is found.
 */
export function resolveStaticRoot(staticRoot?: string): string {
  const candidates = staticRoot ? [staticRoot] : getDefaultCandidatePaths();

  for (const candidate of candidates) {
    if (existsSync(candidate) && existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  const searched = candidates.map(c => `  - ${c}`).join('\n');
  throw new Error(
    `Cannot resolve static UI assets: no directory containing index.html found.\nSearched:\n${searched}`
  );
}

export interface CreateServerOptions {
  /** Explicit static asset root. If omitted, resolveStaticRoot() is used. */
  staticRoot?: string;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Resolve and validate the static asset root
  const uiDistPath = resolveStaticRoot(options.staticRoot);

  console.log(`Serving static files from: ${uiDistPath}`);

  fastify.register(fastifyStatic, {
    root: uiDistPath,
    prefix: '/',
    wildcard: false,
  });

  // REST API (must be registered before the SPA fallback)
  await fastify.register(configRoutes);
  await fastify.register(settingsRoutes);

  const config = new ConfigLocator();

  await fastify.register(agentsRoutes, { agentsDir: config.agentsDir, projectAgentsDir: config.projectAgentsDir, pluginsDir: config.pluginsDir, settingsPath: config.settingsPath, baseDir: config.baseDir });
  await fastify.register(skillsRoutes, { skillsDir: config.skillsDir, projectSkillsDir: config.projectSkillsDir, pluginsDir: config.pluginsDir, settingsPath: config.settingsPath, baseDir: config.baseDir });
  await fastify.register(commandsRoutes, { commandsDir: config.commandsDir, projectCommandsDir: config.projectCommandsDir, pluginsDir: config.pluginsDir, settingsPath: config.settingsPath, baseDir: config.baseDir });
  await fastify.register(pluginsRoutes, { pluginsDir: config.pluginsDir, settingsPath: config.settingsPath });
  await fastify.register(configsRoutes, { baseDir: config.baseDir, projectBaseDir: config.projectPath, pluginsDir: config.pluginsDir, settingsPath: config.settingsPath });
  await fastify.register(profilesRoutes, { baseDir: config.baseDir });
  await fastify.register(storeRoutes, { baseDir: config.baseDir });

  // Serve index.html for all other routes to support client-side routing
  fastify.setNotFoundHandler((request, reply) => {
    reply.sendFile('index.html');
  });

  return fastify;
}

export interface StartServerOptions {
  defaultPort?: number;
  /** Explicit static asset root. If omitted, resolveStaticRoot() is used. */
  staticRoot?: string;
}

export interface StartServerResult {
  port: number;
  address: string;
  staticRoot: string;
  /** True when the chosen port differs from the requested defaultPort. */
  fallback: boolean;
  /** Close the running server. */
  close: () => Promise<void>;
}

export async function startServer(options: StartServerOptions | number = {}): Promise<StartServerResult> {
  // Backward-compatible: accept a plain number for defaultPort
  const opts: StartServerOptions = typeof options === 'number'
    ? { defaultPort: options }
    : options;

  const defaultPort = opts.defaultPort ?? 3000;
  const staticRoot = resolveStaticRoot(opts.staticRoot);

  const port = await getPort({ port: [defaultPort, defaultPort + 1, defaultPort + 2, 0] });
  const fastify = await createServer({ staticRoot });

  try {
    const address = await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on ${address}`);
    return {
      port,
      address,
      staticRoot,
      fallback: defaultPort !== 0 && port !== defaultPort,
      close: () => fastify.close(),
    };
  } catch (err) {
    fastify.log.error(err);
    throw err;
  }
}
