// ============================================================
// @ohmyc/timeline — Driver-neutral Schema Migration
// ============================================================

import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  SCHEMA_SQL,
} from './schema.js'

import type { SqliteDatabase } from './writer.js'

/** Options for {@link migrate}. */
export interface MigrateOptions {
  /** Target schema version. Defaults to {@link CURRENT_SCHEMA_VERSION}. */
  currentSchemaVersion?: number
  /** Custom migration map. Defaults to the built-in {@link MIGRATIONS}. */
  migrations?: Record<number, string>
}

/**
 * Applies pending schema migrations to an open SQLite-like database.
 * For a fresh database (no `meta` table) it runs the full schema creation SQL.
 * For existing databases it increments the schema version one step at a time
 * inside a transaction, recording each applied version in the `meta` table.
 *
 * @param db - Open database handle conforming to {@link SqliteDatabase}.
 * @param options - Target version and custom migration map overrides.
 */
export function migrate(db: SqliteDatabase, options?: MigrateOptions): void {
  const targetVersion = options?.currentSchemaVersion ?? CURRENT_SCHEMA_VERSION
  const migrations = options?.migrations ?? MIGRATIONS

  const metaTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get()

  if (!metaTable) {
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
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
      .run(String(targetVersion))
    return
  }

  const applyMigrations = db.transaction(() => {
    while (currentVersion < targetVersion) {
      const nextVersion = currentVersion + 1
      const migrationSql = migrations[nextVersion]
      if (migrationSql === undefined) {
        throw new Error(`Missing migration for version ${nextVersion}`)
      }
      if (migrationSql) {
        try {
          db.exec(migrationSql)
        } catch (error: any) {
          if (!/duplicate column name/i.test(error?.message ?? '')) {
            throw error
          }
        }
      }
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
        .run(String(nextVersion))
      currentVersion = nextVersion
    }
  })

  applyMigrations()
}
