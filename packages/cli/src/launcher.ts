// Orchestrates server startup, port selection, browser opening, and graceful shutdown.
import open from 'open'

import { logger } from './logger'
import { startServer, type StartServerOptions } from './server/index'

/** Options accepted by {@link launchApp}. */
export interface LaunchOptions {
  /** Preferred port. Falls back to the next available if busy. */
  defaultPort?: number
  /** Skip static file serving and open browser; start API only. */
  apiOnly?: boolean
  /** Working directory for project discovery (defaults to `process.cwd()`). */
  cwd?: string
}

// Guard to prevent double-shutdown on repeated signals.
let closing = false

export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
    apiOnly: options.apiOnly,
    cwd: options.cwd,
  }

  logger.info('Starting OhMyC server...')

  let result
  try {
    result = await startServer(serverOptions)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to start OhMyC: ${message}`)
  }

  const url = `http://localhost:${result.port}`

  if (result.fallback) {
    logger.info(`OhMyC is ready at ${url} (port ${serverOptions.defaultPort} was busy, using ${result.port})`)
  } else {
    logger.info(`OhMyC is ready at ${url}`)
  }

  async function shutdown() {
    if (closing) {
      return
    }
    closing = true
    logger.info('Shutting down...')
    try {
      await result.close()
      logger.info('Server closed.')
    } catch (error) {
      logger.error(error, 'Error closing server')
    }
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  if (!options.apiOnly) {
    logger.info('Opening browser...')
    await open(url)
  }
}
