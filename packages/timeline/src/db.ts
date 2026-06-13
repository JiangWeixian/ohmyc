// ============================================================
// @ohmyc/timeline — Database Lifecycle & Schema Migration
// Opens/creates the SQLite database and applies pending migrations.
// ============================================================

import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'

import { migrate } from './migrate.js'

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
}

/**
 * Opens (or creates) the timeline SQLite database, enables WAL mode and foreign
 * keys, and runs any pending schema migrations. Returns the raw `better-sqlite3`
 * instance — callers are responsible for closing it via {@link closeDatabase}.
 *
 * @param options - Optional database path override.
 * @returns The opened `better-sqlite3` database instance.
 */
export function openDatabase(options?: OpenDatabaseOptions): Database.Database {
  const dbPath = options?.dbPath ?? getDefaultDbPath()
  const dbDir = path.dirname(dbPath)
  mkdirSync(dbDir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrate(db)

  return db
}

/**
 * Closes the database connection.
 *
 * @param db - The `better-sqlite3` instance to close.
 */
export function closeDatabase(db: Database.Database): void {
  db.close()
}
