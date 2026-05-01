#!/usr/bin/env node
import { cac } from 'cac'

import { launchApp } from './launcher'

const cli = cac('cu')

cli
  .command('start', 'Start the ClaudeUI server and open the browser')
  .option('--port <port>', 'Port to listen on', { default: 3000 })
  .option('--api-only', 'Start API server only, skip static file serving')
  .option('--cwd <cwd>', 'Working directory for project discovery (default: current directory)')
  .action(async (options) => {
    const port = Number.parseInt(options.port, 10)
    if (Number.isNaN(port) || port < 0 || port > 65_535) {
      console.error(`Invalid port: ${options.port}. Must be a number between 0 and 65535.`)
      process.exit(1)
    }
    try {
      await launchApp({ defaultPort: port, apiOnly: options.apiOnly, cwd: options.cwd })
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// Default command: just running `cu` starts the app
cli
  .command('[...args]', 'Start ClaudeUI (default)')
  .option('--cwd <cwd>', 'Working directory for project discovery (default: current directory)')
  .action(async (arguments_, options) => {
    if (arguments_.length === 0) {
      try {
        await launchApp({ defaultPort: 3000, cwd: options.cwd })
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    } else {
      console.error(`Unknown arguments: ${arguments_.join(' ')}. Did you mean 'cu start'?`)
      process.exit(1)
    }
  })

cli.help()
cli.version('0.1.0')

cli.parse()
