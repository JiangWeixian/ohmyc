// packages/timeline/tests/writer.test.ts
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { closeDatabase, openDatabase } from '../src/db.js'
import { createWriter } from '../src/writer.js'

import type Database from 'better-sqlite3'
import type { ParsedSessionData } from '../src/ingest.js'

describe('createWriter', () => {
  let db: Database.Database
  let writer: ReturnType<typeof createWriter>

  beforeEach(() => {
    db = openDatabase({ dbPath: ':memory:' })
    writer = createWriter(db)
  })

  afterEach(() => {
    closeDatabase(db)
  })

  const mockSession: ParsedSessionData = {
    sessionId: 'test-session-001',
    project: 'test-project',
    agentName: 'opencode',
    startedAt: 1000,
    endedAt: 2000,
    durationMs: 1000,
    turns: 3,
    tokensInput: 100,
    tokensOutput: 200,
    tokensCached: 50,
    summary: 'Test session',
    summarySource: 'first_message',
    transcriptPath: '/tmp/test.jsonl',
    fileSize: 1024,
    tools: [
      { toolName: 'Read', callCount: 2 },
      { toolName: 'Bash', callCount: 1 },
    ],
    skills: ['git', 'github'],
    model: 'claude-3-opus',
  }

  it('inserts a new session', () => {
    const result = writer.writeSession(mockSession)

    expect(result.sessionId).toBe('test-session-001')
    expect(result.sessionsInserted).toBe(1)
    expect(result.sessionsUpdated).toBe(0)

    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get('test-session-001')
    expect(row).toBeDefined()
    expect((row as any).project).toBe('test-project')
    expect((row as any).turns).toBe(3)
    expect((row as any).model).toBe('claude-3-opus')
  })

  it('updates an existing session', () => {
    writer.writeSession(mockSession)

    const updated = { ...mockSession, turns: 5 }
    const result = writer.writeSession(updated)

    expect(result.sessionsInserted).toBe(0)
    expect(result.sessionsUpdated).toBe(1)

    const row = db.prepare('SELECT turns FROM sessions WHERE session_id = ?').get('test-session-001')
    expect((row as any).turns).toBe(5)
  })

  it('writes tools and skills', () => {
    writer.writeSession(mockSession)

    const tools = db.prepare('SELECT * FROM session_tools WHERE session_id = ?').all('test-session-001')
    expect(tools).toHaveLength(2)

    const skills = db.prepare('SELECT * FROM session_skills WHERE session_id = ?').all('test-session-001')
    expect(skills).toHaveLength(2)
  })

  it('replaces tools and skills on update', () => {
    writer.writeSession(mockSession)

    const updated = {
      ...mockSession,
      tools: [{ toolName: 'Write', callCount: 1 }],
      skills: ['docker'],
    }
    writer.writeSession(updated)

    const tools = db.prepare('SELECT * FROM session_tools WHERE session_id = ?').all('test-session-001')
    expect(tools).toHaveLength(1)
    expect((tools[0] as any).tool_name).toBe('Write')

    const skills = db.prepare('SELECT * FROM session_skills WHERE session_id = ?').all('test-session-001')
    expect(skills).toHaveLength(1)
    expect((skills[0] as any).skill_name).toBe('docker')
  })

  it('writes agent_name', () => {
    writer.writeSession(mockSession)

    const row = db.prepare('SELECT agent_name FROM sessions WHERE session_id = ?').get('test-session-001')
    expect((row as any).agent_name).toBe('opencode')
  })
})
