import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'

import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  SCHEMA_SQL,
} from './schema.js'

export function getDefaultDbPath(): string {
  const home = process.env.CUI_HOME ?? path.join(os.homedir(), '.cui')
  return path.join(home, 'timeline.db')
}

export interface OpenDatabaseOptions {
  dbPath?: string
}

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

export interface MigrateOptions {
  currentSchemaVersion?: number
  migrations?: Record<number, string>
}

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

export function closeDatabase(db: Database.Database): void {
  db.close()
}
