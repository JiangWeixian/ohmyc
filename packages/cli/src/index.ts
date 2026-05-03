#!/usr/bin/env node
import { cac } from 'cac'

import {
  runDoctor,
  runIngest,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
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

cli
  .command('dashboard', 'Manage Timeline dashboard data and plugin')
  .option('--install', 'Install the timeline plugin and run initial backfill')
  .option('--uninstall', 'Remove the timeline plugin (preserves database)')
  .option('--sync', 'Scan all transcripts and import missing sessions')
  .option('--ingest', 'Ingest a single session')
  .option('--session <id>', 'Session ID to ingest (used with --ingest)')
  .option('--file <path>', 'Path to transcript file (used with --ingest)')
  .option('--doctor', 'Diagnose plugin, hooks, and database health')
  .action(async (options) => {
    try {
      if (options.install) {
        await runInstall()
      } else if (options.uninstall) {
        await runUninstall()
      } else if (options.sync) {
        await runSync()
      } else if (options.ingest) {
        if (!options.session) {
          console.error('--session <id> is required')
          process.exit(1)
        }
        await runIngest(options.session, options.file)
      } else if (options.doctor) {
        await runDoctor()
      } else {
        console.log('No action specified. Use one of: --install, --uninstall, --sync, --ingest, --doctor')
        cli.outputHelp()
        process.exit(1)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli.help()
cli.version('0.1.0')

cli.parse()
