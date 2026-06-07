// Dashboard CLI subcommands for the OhMyC timeline plugin — install, uninstall, sync, ingest, doctor.
import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  backfillAll,
  closeDatabase,
  getStatus,
  openDatabase,
} from '@ohmyc/timeline'

import { logger } from '../logger'

import type { PluginInstall } from '@ohmyc/shared'
import type Database from 'better-sqlite3'

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Returns the Claude Code plugins directory (respects AGENT_HOME env var). */
function getPluginsDir(): string {
  const base = process.env.AGENT_HOME ?? path.join(process.env.HOME ?? '~', '.claude')
  return path.join(base, 'plugins')
}

/** Path to the `installed_plugins.json` registry file. */
export function getInstalledPluginsPath(): string {
  return path.join(getPluginsDir(), 'installed_plugins.json')
}

/** Reads the plugin registry, returning a default empty record on missing or invalid JSON. */
export function readInstalledPlugins(): { version?: number; plugins: Record<string, PluginInstall[]> } {
  try {
    const raw = readFileSync(getInstalledPluginsPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { version: 1, plugins: {} }
  }
}

/** Persists the plugin registry back to disk, creating the directory if necessary. */
export function writeInstalledPlugins(data: { version?: number; plugins: Record<string, PluginInstall[]> }): void {
  const pluginsDir = getPluginsDir()
  mkdirSync(pluginsDir, { recursive: true })
  writeFileSync(getInstalledPluginsPath(), JSON.stringify(data, null, 2), 'utf8')
}

/** Checks whether `jq` is available on PATH (used for some plugin operations). */
export function hasJq(): boolean {
  try {
    execSync('jq --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Resolves the timeline plugin source directory, preferring the production bundled copy. */
export function getPluginSourceDir(): string {
  // In development: resolve from src/commands/dashboard.ts → ../../plugins/timeline
  // In production (bundled): resolve from dist/index.mjs → ./plugins/timeline
  const srcPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', 'plugins', 'timeline')
  const distPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'plugins', 'timeline')

  if (existsSync(distPath)) {
    return distPath
  }
  return srcPath
}

/** Formats a Unix timestamp into a human-readable string, or "never" when undefined/invalid. */
function formatDate(ts: number | undefined): string {
  if (ts === undefined || Number.isNaN(ts)) {
    return 'never'
  }
  return new Date(ts).toLocaleString()
}

// ------------------------------------------------------------------
// runInstall
// ------------------------------------------------------------------

/** Registers the timeline plugin and runs an initial backfill if the database is empty. */
export async function runInstall(): Promise<void> {
  const pluginSourceDir = getPluginSourceDir()

  if (!hasJq()) {
    logger.warn('jq is not installed. Some plugin operations may be limited.')
  }

  // Read / create registry
  const registry = readInstalledPlugins()

  const now = new Date().toISOString()
  const installRecord: PluginInstall = {
    version: '1.0.0',
    installedAt: now,
    lastUpdated: now,
    installPath: pluginSourceDir,
    isLocal: true,
    scope: 'user',
  }

  registry.plugins['ohmyc-timeline'] = [installRecord]
  writeInstalledPlugins(registry)
  logger.info('Plugin ohmyc-timeline registered.')

  // Open database and optionally backfill
  const db = openDatabase()
  try {
    const status = getStatus(db)
    if (status.lastSyncAt === undefined) {
      logger.info('Database empty. Running initial backfill...')
      const result = backfillAll(db, {
        onProgress: (done, total) => {
          logger.info(`Backfill: ${done}/${total}`)
        },
      })
      logger.info(`Backfill complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`)
    } else {
      logger.info(`Database already has ${status.sessionCount} sessions (last sync: ${formatDate(status.lastSyncAt)})`)
    }
  } finally {
    closeDatabase(db)
  }

  logger.info(`Install complete. Plugin source: ${pluginSourceDir}`)
}

// ------------------------------------------------------------------
// runUninstall
// ------------------------------------------------------------------

/** Removes the timeline plugin from the registry without deleting the database. */
export async function runUninstall(): Promise<void> {
  const registry = readInstalledPlugins()
  if (registry.plugins['ohmyc-timeline']) {
    delete registry.plugins['ohmyc-timeline']
    writeInstalledPlugins(registry)
  }
  logger.info('Plugin removed. Database preserved — run `cu dashboard --install` to re-register.')
}

// ------------------------------------------------------------------
// runSync
// ------------------------------------------------------------------

/** Scans all transcript files and imports any missing sessions into the timeline database. */
export async function runSync(): Promise<void> {
  const db = openDatabase()
  try {
    logger.info('Running sync...')
    const result = backfillAll(db, {
      onProgress: (done, total) => {
        logger.info(`Sync: ${done}/${total}`)
      },
    })
    logger.info(`Sync complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`)
  } finally {
    closeDatabase(db)
  }
}

// ------------------------------------------------------------------
// runDoctor
// ------------------------------------------------------------------

/** Runs diagnostic checks on the plugin installation, jq availability, and database integrity. */
export async function runDoctor(): Promise<void> {
  const issues: string[] = []

  // 1. Check plugin installed
  const registry = readInstalledPlugins()
  const pluginInstalled = !!registry.plugins['ohmyc-timeline']
  if (!pluginInstalled) {
    issues.push('Plugin ohmyc-timeline is not installed.')
  }

  // 2. Check jq available
  const jqAvailable = hasJq()
  if (!jqAvailable) {
    issues.push('jq is not available on PATH.')
  }

  // 3. Check DB exists and integrity
  let db: Database.Database | null = null
  try {
    db = openDatabase()
    const integrityResult = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    const integrityOk = integrityResult.length > 0 && integrityResult[0].integrity_check === 'ok'
    if (!integrityOk) {
      issues.push(`Database integrity check failed: ${JSON.stringify(integrityResult)}`)
    }

    const status = getStatus(db)
    logger.info(`Sessions: ${status.sessionCount}`)
    logger.info(`Last sync: ${formatDate(status.lastSyncAt)}`)
  } catch (error) {
    issues.push(`Database error: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (db) {
      closeDatabase(db)
    }
  }

  if (issues.length > 0) {
    const summary = issues.join('\n  - ')
    throw new Error(`Issues found:\n  - ${summary}`)
  }

  logger.info('All checks passed.')
}
