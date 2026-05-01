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

  db.exec(SCHEMA_SQL)

  const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined

  const currentVersion = versionRow ? Number.parseInt(versionRow.value, 10) : 0

  if (currentVersion === 0) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(CURRENT_SCHEMA_VERSION),
    )
  } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
    for (let v = currentVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      const migrationSql = MIGRATIONS[v]
      if (migrationSql) {
        db.exec(migrationSql)
      }
    }
    db.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(
      String(CURRENT_SCHEMA_VERSION),
    )
  }

  return db
}

export function closeDatabase(db: Database.Database): void {
  db.close()
}
