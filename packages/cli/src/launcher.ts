import open from 'open'

import { startServer, type StartServerOptions } from './server/index'

export interface LaunchOptions {
  defaultPort?: number
  apiOnly?: boolean
  cwd?: string
}

let closing = false

export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
    apiOnly: options.apiOnly,
    cwd: options.cwd,
  }

  console.log('Starting ClaudeUI server...')

  const result = await startServer(serverOptions)

  const url = `http://localhost:${result.port}`

  if (result.fallback) {
    console.log(`ClaudeUI is ready at ${url} (port ${serverOptions.defaultPort} was busy, using ${result.port})`)
  } else {
    console.log(`ClaudeUI is ready at ${url}`)
  }

  async function shutdown() {
    if (closing) {
      return
    }
    closing = true
    console.log('\nShutting down...')
    try {
      await result.close()
      console.log('Server closed.')
    } catch (error) {
      console.error('Error closing server:', error)
    }
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  if (!options.apiOnly) {
    console.log('Opening browser...')
    await open(url)
  }
}
