#!/usr/bin/env node
// CLI entry point — only the `dashboard` subcommand remains. The OhMyC UI is
// shipped exclusively as the Tauri desktop app; this binary exists to install
// and maintain the Claude Code capture plugin that writes session data to
// ~/.claude/db.sqlite.
import { cac } from 'cac'

import {
  runDoctor,
  runIngest,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
import { logger } from './logger'

const cli = cac('ohmyc')

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
          logger.error('--session <id> is required')
          process.exit(1)
        }
        await runIngest(options.session, options.file)
      } else if (options.doctor) {
        await runDoctor()
      } else {
        logger.info('No action specified. Use one of: --install, --uninstall, --sync, --ingest, --doctor')
        cli.outputHelp()
        process.exit(1)
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli.help()
cli.version('0.1.0')
cli.parse()
