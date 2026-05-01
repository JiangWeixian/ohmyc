import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { backfillAll, getDefaultProjectsDir } from './backfill.js'
import { closeDatabase, openDatabase } from './db.js'

import type Database from 'better-sqlite3'

describe('backfillAll', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-backfill-test-'))
    db = openDatabase({ dbPath: path.join(tmpDir, 'timeline.db') })
  })

  afterEach(() => {
    closeDatabase(db)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('indexes all transcripts in the projects directory', () => {
    const projectsDir = path.join(tmpDir, 'projects', 'test-project')
    mkdirSync(projectsDir, { recursive: true })

    writeFileSync(
      path.join(projectsDir, 'session-001.jsonl'),
      '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","sessionId":"session-001","message":{"role":"user","content":"Hello"}}\n',
    )
    writeFileSync(
      path.join(projectsDir, 'session-002.jsonl'),
      '{"type":"user","timestamp":"2026-04-30T11:00:00.000Z","sessionId":"session-002","message":{"role":"user","content":"World"}}\n',
    )

    const result = backfillAll(db, { claudeProjectsDir: path.dirname(projectsDir) })

    expect(result.indexed).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)

    const sessions = db.prepare('SELECT * FROM sessions ORDER BY session_id').all() as { session_id: string }[]
    expect(sessions).toHaveLength(2)
    expect(sessions[0].session_id).toBe('session-001')
    expect(sessions[1].session_id).toBe('session-002')
  })

  it('skips already-indexed sessions', () => {
    const projectsDir = path.join(tmpDir, 'projects', 'test-project')
    mkdirSync(projectsDir, { recursive: true })

    writeFileSync(
      path.join(projectsDir, 'session-001.jsonl'),
      '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","sessionId":"session-001","message":{"role":"user","content":"Hello"}}\n',
    )
    writeFileSync(
      path.join(projectsDir, 'session-002.jsonl'),
      '{"type":"user","timestamp":"2026-04-30T11:00:00.000Z","sessionId":"session-002","message":{"role":"user","content":"World"}}\n',
    )

    // Pre-insert one session
    db.prepare(`
      INSERT INTO sessions (
        session_id, project, started_at, ended_at, duration_ms,
        turns, tokens_input, tokens_output, tokens_cached,
        summary, summary_source, transcript_path, last_offset, ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'session-001',
      'test-project',
      Date.now(),
      Date.now(),
      0,
      1,
      0,
      0,
      0,
      'Existing',
      'first_message',
      path.join(projectsDir, 'session-001.jsonl'),
      0,
      Date.now(),
    )

    const result = backfillAll(db, { claudeProjectsDir: path.dirname(projectsDir) })

    expect(result.indexed).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('records last_full_backfill_at in meta', () => {
    const projectsDir = path.join(tmpDir, 'projects', 'test-project')
    mkdirSync(projectsDir, { recursive: true })

    writeFileSync(
      path.join(projectsDir, 'session-001.jsonl'),
      '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","sessionId":"session-001","message":{"role":"user","content":"Hello"}}\n',
    )

    const before = Date.now()
    backfillAll(db, { claudeProjectsDir: path.dirname(projectsDir) })
    const after = Date.now()

    const metaRow = db
      .prepare("SELECT value FROM meta WHERE key = 'last_full_backfill_at'")
      .get() as { value: string } | undefined

    expect(metaRow).toBeDefined()
    const timestamp = Number.parseInt(metaRow!.value, 10)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('handles missing directories gracefully', () => {
    const result = backfillAll(db, { claudeProjectsDir: path.join(tmpDir, 'nonexistent') })

    expect(result.indexed).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
  })
})

describe('getDefaultProjectsDir', () => {
  it('returns ~/.claude/projects by default', () => {
    const dir = getDefaultProjectsDir()
    expect(dir).toBe(path.join(os.homedir(), '.claude', 'projects'))
  })

  it('respects AGENT_HOME environment variable', () => {
    const original = process.env.AGENT_HOME
    process.env.AGENT_HOME = '/custom/agent/home'
    try {
      const dir = getDefaultProjectsDir()
      expect(dir).toBe('/custom/agent/home/projects')
    } finally {
      if (original === undefined) {
        delete process.env.AGENT_HOME
      } else {
        process.env.AGENT_HOME = original
      }
    }
  })
})
