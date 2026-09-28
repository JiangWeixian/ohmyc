// ============================================================
// @ohmyc/timeline — Database Lifecycle & Schema Migration
// Opens/creates the SQLite database and applies pending migrations.
// ============================================================

import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { migrate } from './migrate.js'
import { openNodeSqliteDatabase } from './node-sqlite.js'

import type { NodeSqliteDatabase } from './node-sqlite.js'

export { migrate } from './migrate.js'
export type { MigrateOptions } from './migrate.js'

/**
 * Returns the default database path: `$OHMYC_HOME/timeline.db` (defaults to `~/.config/ohmyc/timeline.db`).
 *
 * @returns Absolute path to the database file.
 */
export function getDefaultDbPath(): string {
  const home = process.env.OHMYC_HOME || path.join(os.homedir(), '.config', 'ohmyc')
  return path.join(home, 'timeline.db')
}

/** Options for {@link openDatabase}. */
export interface OpenDatabaseOptions {
  /** Custom path to the SQLite database file. Defaults to {@link getDefaultDbPath}. */
  dbPath?: string
  /** Bound lock waiting for hook pipelines that already retry. */
  busyTimeoutMs?: number
}

/**
 * Opens (or creates) the timeline SQLite database, enables WAL mode and foreign
 * keys, and runs any pending schema migrations. Returns a Node sqlite database
 * handle — callers are responsible for closing it via {@link closeDatabase}.
 *
 * @param options - Optional database path override.
 * @returns The opened Node sqlite database handle.
 */
export function openDatabase(options?: OpenDatabaseOptions): NodeSqliteDatabase {
  const dbPath = options?.dbPath ?? getDefaultDbPath()
  const dbDir = path.dirname(dbPath)
  mkdirSync(dbDir, { recursive: true })

  const db = openNodeSqliteDatabase(dbPath)
  const busyTimeoutMs = options?.busyTimeoutMs ?? 2000
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0) {
    db.close()
    throw new Error('Invalid SQLite busy timeout')
  }
  try {
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')

    migrate(db)
  } catch (error) {
    db.close()
    throw error
  }

  return db
}

/**
 * Closes the database connection.
 *
 * @param db - The Node sqlite database handle to close.
 */
export function closeDatabase(db: NodeSqliteDatabase): void {
  db.close()
}
