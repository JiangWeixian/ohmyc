#!/usr/bin/env node
// CLI entry point — install/uninstall/sync/doctor for the timeline plugin.
// Session ingest moved into plugins/timeline/dist/ingest.mjs (called by the
// Stop hook directly); this binary no longer participates in the hot path.
import { cac } from 'cac'

import {
  runDoctor,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
import { logger } from './logger'

const cli = cac('ohmyc')

cli
  .command('dashboard', 'Manage Timeline dashboard install and data')
  .option('--install', 'Install the timeline plugin and run initial backfill')
  .option('--uninstall', 'Remove the timeline plugin (preserves database)')
  .option('--sync', 'Scan all transcripts and import missing sessions')
  .option('--doctor', 'Diagnose plugin, hooks, and database health')
  .action(async (options) => {
    try {
      if (options.install) {
        await runInstall()
      } else if (options.uninstall) {
        await runUninstall()
      } else if (options.sync) {
        await runSync()
      } else if (options.doctor) {
        await runDoctor()
      } else {
        logger.info('No action specified. Use one of: --install, --uninstall, --sync, --doctor')
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
