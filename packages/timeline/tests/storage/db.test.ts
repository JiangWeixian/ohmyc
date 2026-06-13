import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  closeDatabase,
  getDefaultDbPath,
  migrate,
  openDatabase,
} from '../../src/db.js'

describe('db', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-db-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a database with all tables', () => {
    const dbPath = path.join(tmpDir, 'timeline.db')
    const db = openDatabase({ dbPath })

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as { name: string }[]
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('meta')
    expect(tableNames).toContain('session_skills')
    expect(tableNames).toContain('session_tools')
    expect(tableNames).toContain('sessions')

    const versionRow = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(versionRow.value).toBe('3')

    closeDatabase(db)
  })

  it('getDefaultDbPath respects OHMYC_HOME', () => {
    const originalOhmycHome = process.env.OHMYC_HOME
    process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
    try {
      const dbPath = getDefaultDbPath()
      expect(dbPath).toContain('custom-home')
      expect(dbPath).toMatch(/timeline\.db$/)
    } finally {
      if (originalOhmycHome === undefined) {
        delete process.env.OHMYC_HOME
      } else {
        process.env.OHMYC_HOME = originalOhmycHome
      }
    }
  })

  it('getDefaultDbPath ignores CUI_HOME', () => {
    const originalCuiHome = process.env.CUI_HOME
    const originalOhmycHome = process.env.OHMYC_HOME
    delete process.env.OHMYC_HOME
    process.env.CUI_HOME = path.join(tmpDir, 'should-be-ignored')
    try {
      const dbPath = getDefaultDbPath()
      expect(dbPath).not.toContain('should-be-ignored')
      expect(dbPath).toContain(path.join('.config', 'ohmyc'))
    } finally {
      if (originalCuiHome === undefined) {
        delete process.env.CUI_HOME
      } else {
        process.env.CUI_HOME = originalCuiHome
      }
      if (originalOhmycHome === undefined) {
        delete process.env.OHMYC_HOME
      } else {
        process.env.OHMYC_HOME = originalOhmycHome
      }
    }
  })

  it('reopening existing database does not throw', () => {
    const dbPath = path.join(tmpDir, 'timeline.db')
    const db1 = openDatabase({ dbPath })
    closeDatabase(db1)

    const db2 = openDatabase({ dbPath })
    const versionRow = db2
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string }
    expect(versionRow.value).toBe('3')
    closeDatabase(db2)
  })

  it('missing migration throws error', () => {
    const dbPath = path.join(tmpDir, 'timeline.db')
    const db = openDatabase({ dbPath })
    // Set schema_version to 1 so migrations are attempted
    db.prepare("UPDATE meta SET value = '1' WHERE key = 'schema_version'").run()
    closeDatabase(db)

    const db2 = new Database(dbPath)
    // Missing migration for version 2 (only have version 3)
    expect(() =>
      migrate(db2, {
        currentSchemaVersion: 3,
        migrations: { 3: 'CREATE TABLE test_migration (id INTEGER);' },
      }),
    ).toThrow('Missing migration for version 2')
    db2.close()
  })

  it('WAL mode is enabled', () => {
    const dbPath = path.join(tmpDir, 'timeline.db')
    const db = openDatabase({ dbPath })
    const result = db.pragma('journal_mode') as { journal_mode: string }[]
    expect(result[0].journal_mode).toBe('wal')
    closeDatabase(db)
  })

  it('foreign keys are enabled', () => {
    const dbPath = path.join(tmpDir, 'timeline.db')
    const db = openDatabase({ dbPath })
    const result = db.pragma('foreign_keys') as { foreign_keys: number }[]
    expect(result[0].foreign_keys).toBe(1)
    closeDatabase(db)
  })
})
