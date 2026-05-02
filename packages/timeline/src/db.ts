// ============================================================
// @claudeui/timeline — Database Lifecycle & Schema Migration
// Opens/creates the SQLite database and applies pending migrations.
// ============================================================

import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'

import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  SCHEMA_SQL,
} from './schema.js'

/**
 * Returns the default database path: `$CUI_HOME/timeline.db` (defaults to `~/.cui/timeline.db`).
 *
 * @returns Absolute path to the database file.
 */
export function getDefaultDbPath(): string {
  const home = process.env.CUI_HOME ?? path.join(os.homedir(), '.cui')
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

/** Options for {@link migrate}. */
export interface MigrateOptions {
  /** Target schema version. Defaults to {@link CURRENT_SCHEMA_VERSION}. */
  currentSchemaVersion?: number
  /** Custom migration map. Defaults to the built-in {@link MIGRATIONS}. */
  migrations?: Record<number, string>
}

/**
 * Applies pending schema migrations to an open database.
 * For a fresh database (no `meta` table) it runs the full schema creation SQL.
 * For existing databases it increments the schema version one step at a time
 * inside a transaction, recording each applied version in the `meta` table.
 *
 * @param db - Open `better-sqlite3` database instance.
 * @param options - Target version and custom migration map overrides.
 */
export function migrate(db: Database.Database, options?: MigrateOptions): void {
  const targetVersion = options?.currentSchemaVersion ?? CURRENT_SCHEMA_VERSION
  const migrations = options?.migrations ?? MIGRATIONS

  // Check if meta table exists
  const metaTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get()

  if (!metaTable) {
    // Fresh DB — run schema creation
    db.exec(SCHEMA_SQL)
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
      .run(String(targetVersion))
    return
  }

  const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined

  let currentVersion = versionRow ? Number.parseInt(versionRow.value, 10) : 0
  if (Number.isNaN(currentVersion)) {
    currentVersion = 0
  }

  if (currentVersion === 0) {
    // Schema exists but no version recorded — just set version
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
      .run(String(targetVersion))
    return
  }

  // Apply missing migrations in a transaction
  const applyMigrations = db.transaction(() => {
    while (currentVersion < targetVersion) {
      const nextVersion = currentVersion + 1
      const migrationSql = migrations[nextVersion]
      if (migrationSql === undefined) {
        throw new Error(`Missing migration for version ${nextVersion}`)
      }
      if (migrationSql) {
        db.exec(migrationSql)
      }
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
        .run(String(nextVersion))
      currentVersion = nextVersion
    }
  })

  applyMigrations()
}

/**
 * Closes the database connection.
 *
 * @param db - The `better-sqlite3` instance to close.
 */
export function closeDatabase(db: Database.Database): void {
  db.close()
}
