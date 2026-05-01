import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { closeDatabase, openDatabase } from './db.js'
import { ingestSession } from './ingest.js'

import type Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../test/fixtures')

describe('ingestSession', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-ingest-test-'))
    db = openDatabase({ dbPath: path.join(tmpDir, 'timeline.db') })
  })

  afterEach(() => {
    closeDatabase(db)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('ingests a simple session from fixture', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const result = ingestSession(db, 'test-session-001', transcriptPath)

    expect(result.sessionId).toBe('test-session-001')
    expect(result.sessionsInserted).toBe(1)
    expect(result.sessionsUpdated).toBe(0)

    const session = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-001') as {
      turns: number
      tokens_input: number
      tokens_output: number
      tokens_cached: number
      summary: string | null
      summary_source: string
      last_offset: number
    }

    expect(session.turns).toBe(2)
    expect(session.tokens_input).toBe(18)
    expect(session.tokens_output).toBe(37)
    expect(session.tokens_cached).toBe(80)
    expect(session.summary).toBe('Helped user set up timeline feature in their project. Next: review the wireframe. (disable recaps in /config)')
    expect(session.summary_source).toBe('auto')
    expect(session.last_offset).toBeGreaterThan(0)

    const tools = db
      .prepare('SELECT * FROM session_tools WHERE session_id = ?')
      .all('test-session-001') as { tool_name: string; call_count: number }[]
    expect(tools).toHaveLength(0)

    const skills = db
      .prepare('SELECT * FROM session_skills WHERE session_id = ?')
      .all('test-session-001') as { skill_name: string }[]
    expect(skills).toHaveLength(0)
  })

  it('is idempotent: re-ingesting same file updates with identical data', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const result1 = ingestSession(db, 'test-session-001', transcriptPath)
    expect(result1.sessionsInserted).toBe(1)
    expect(result1.sessionsUpdated).toBe(0)

    const result2 = ingestSession(db, 'test-session-001', transcriptPath)
    expect(result2.sessionsInserted).toBe(0)
    expect(result2.sessionsUpdated).toBe(1)

    const session = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-001') as { turns: number }
    expect(session.turns).toBe(2)
  })

  it('ingests with correct project from path', () => {
    const transcriptPath = path.join(tmpDir, 'projects', '-home-user-project-a', 'test-session-001.jsonl')
    const transcriptDir = path.dirname(transcriptPath)
    mkdirSync(transcriptDir, { recursive: true })
    writeFileSync(transcriptPath, '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","sessionId":"test-session-path","message":{"role":"user","content":"Hello"},"cwd":"/home/user/project-a"}\n')

    const result = ingestSession(db, 'test-session-path', transcriptPath)
    expect(result.project).toBe('/home/user/project/a')

    const session = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-path') as { project: string }
    expect(session.project).toBe('/home/user/project/a')
  })

  it('counts tool calls correctly', () => {
    const transcriptPath = path.join(fixturesDir, 'session-with-tools.jsonl')
    const result = ingestSession(db, 'test-session-tools', transcriptPath)

    expect(result.sessionsInserted).toBe(1)

    const tools = db
      .prepare('SELECT * FROM session_tools WHERE session_id = ? ORDER BY tool_name')
      .all('test-session-tools') as { tool_name: string; call_count: number }[]

    expect(tools).toHaveLength(2)
    expect(tools[0].tool_name).toBe('Bash')
    expect(tools[0].call_count).toBe(1)
    expect(tools[1].tool_name).toBe('Read')
    expect(tools[1].call_count).toBe(1)
  })

  it('detects skill invocations', () => {
    const transcriptPath = path.join(fixturesDir, 'session-with-skills.jsonl')
    const result = ingestSession(db, 'test-session-skills', transcriptPath)

    expect(result.sessionsInserted).toBe(1)

    const skills = db
      .prepare('SELECT * FROM session_skills WHERE session_id = ?')
      .all('test-session-skills') as { skill_name: string }[]

    expect(skills).toHaveLength(1)
    expect(skills[0].skill_name).toBe('design-consultation')
  })

  it('correctly decodes project path from real Claude Code path format', () => {
    const transcriptPath = path.join(tmpDir, 'projects', '-Volumes-Users-foo-work-project', 'session.jsonl')
    mkdirSync(path.dirname(transcriptPath), { recursive: true })
    writeFileSync(transcriptPath, '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","sessionId":"test-session-real","message":{"role":"user","content":"Hello"},"cwd":"/Volumes/Users/foo/work/project"}\n')

    const result = ingestSession(db, 'test-session-real', transcriptPath)
    expect(result.project).toBe('/Volumes/Users/foo/work/project')

    const session = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-real') as { project: string }
    expect(session.project).toBe('/Volumes/Users/foo/work/project')
  })

  it('incremental ingest captures complete session data', () => {
    const transcriptPath = path.join(tmpDir, 'incremental-session.jsonl')

    // First batch: initial transcript with a user turn and a tool call
    const batch1 = `${[
      '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","message":{"role":"user","content":"First message"}}',
      '{"type":"assistant","timestamp":"2026-04-30T10:01:00.000Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_001","name":"Bash","input":{"command":"echo test"}}],"usage":{"input_tokens":10,"output_tokens":20}}}',
    ].join('\n')}\n`

    writeFileSync(transcriptPath, batch1)
    const result1 = ingestSession(db, 'test-session-incremental', transcriptPath)
    expect(result1.sessionsInserted).toBe(1)
    expect(result1.sessionsUpdated).toBe(0)

    const session1 = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-incremental') as { turns: number }
    expect(session1.turns).toBe(1)

    const tools1 = db
      .prepare('SELECT * FROM session_tools WHERE session_id = ? ORDER BY tool_name')
      .all('test-session-incremental') as { tool_name: string; call_count: number }[]
    expect(tools1).toHaveLength(1)
    expect(tools1[0].tool_name).toBe('Bash')
    expect(tools1[0].call_count).toBe(1)

    // Second batch: append more lines (simulating stop hook writing more data)
    const batch2 = `${[
      '{"type":"user","timestamp":"2026-04-30T10:02:00.000Z","message":{"role":"user","content":"Second message"}}',
      '{"type":"assistant","timestamp":"2026-04-30T10:03:00.000Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_002","name":"Read","input":{"file_path":"/tmp/test.txt"}}],"usage":{"input_tokens":15,"output_tokens":25}}}',
    ].join('\n')}\n`

    writeFileSync(transcriptPath, batch1 + batch2)
    const result2 = ingestSession(db, 'test-session-incremental', transcriptPath)
    expect(result2.sessionsInserted).toBe(0)
    expect(result2.sessionsUpdated).toBe(1)

    // After incremental ingest, data from BOTH batches must be present
    const session2 = db
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get('test-session-incremental') as { turns: number; tokens_input: number; tokens_output: number }
    expect(session2.turns).toBe(2)
    expect(session2.tokens_input).toBe(25)
    expect(session2.tokens_output).toBe(45)

    const tools2 = db
      .prepare('SELECT * FROM session_tools WHERE session_id = ? ORDER BY tool_name')
      .all('test-session-incremental') as { tool_name: string; call_count: number }[]
    expect(tools2).toHaveLength(2)
    expect(tools2[0].tool_name).toBe('Bash')
    expect(tools2[0].call_count).toBe(1)
    expect(tools2[1].tool_name).toBe('Read')
    expect(tools2[1].call_count).toBe(1)
  })
})
