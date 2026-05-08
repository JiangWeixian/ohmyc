import {
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { logger } from './logger'

export type MigrationResult
  = 'migrated' | 'skipped-env-set' | 'skipped-no-legacy' | 'skipped-target-exists'

export interface MigrateLegacyHomeOptions {
  /** Override the home directory. Defaults to `os.homedir()`. */
  home?: string
}

/**
 * One-shot migration from `~/.cui/` to `~/.config/ohmyc/`.
 *
 * Skipped if `OHMYC_HOME` is set (user chose a custom location), if the new
 * directory already exists, or if `~/.cui/` does not exist. On success, the
 * legacy directory is renamed atomically.
 *
 * Throws if the rename fails for any reason other than the skip conditions
 * above — callers are expected to surface the error and exit.
 */
export function migrateLegacyHome(options: MigrateLegacyHomeOptions = {}): MigrationResult {
  if (process.env.OHMYC_HOME) {
    return 'skipped-env-set'
  }

  const home = options.home ?? os.homedir()
  const target = path.join(home, '.config', 'ohmyc')
  const legacy = path.join(home, '.cui')

  if (existsSync(target)) {
    return 'skipped-target-exists'
  }
  if (!existsSync(legacy)) {
    return 'skipped-no-legacy'
  }

  mkdirSync(path.dirname(target), { recursive: true })
  renameSync(legacy, target)
  logger.info({ from: legacy, to: target }, 'Migrated legacy ~/.cui directory')
  return 'migrated'
}
