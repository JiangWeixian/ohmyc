import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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
  openDatabase,
} from './db.js'

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
    expect(versionRow.value).toBe('1')

    closeDatabase(db)
  })

  it('getDefaultDbPath respects CUI_HOME', () => {
    const originalCuiHome = process.env.CUI_HOME
    process.env.CUI_HOME = path.join(tmpDir, 'custom-cui')
    try {
      const dbPath = getDefaultDbPath()
      expect(dbPath).toContain('custom-cui')
      expect(dbPath).toMatch(/timeline\.db$/)
    } finally {
      if (originalCuiHome === undefined) {
        delete process.env.CUI_HOME
      } else {
        process.env.CUI_HOME = originalCuiHome
      }
    }
  })
})
