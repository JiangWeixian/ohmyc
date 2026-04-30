import open from 'open'

import { startServer, type StartServerOptions } from './server/index'

export interface LaunchOptions {
  defaultPort?: number
  apiOnly?: boolean
  cwd?: string
}

export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
    apiOnly: options.apiOnly,
    cwd: options.cwd,
  }

  console.log('Starting ClaudeUI server...')

  try {
    const result = await startServer(serverOptions)

    const url = `http://localhost:${result.port}`

    if (result.fallback) {
      console.log(`ClaudeUI is ready at ${url} (port ${serverOptions.defaultPort} was busy, using ${result.port})`)
    } else {
      console.log(`ClaudeUI is ready at ${url}`)
    }

    if (!options.apiOnly) {
      console.log('Opening browser...')
      await open(url)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to start ClaudeUI: ${message}`)
  }
}
