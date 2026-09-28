import {
  describe,
  expect,
  it,
} from 'vitest'

import { closeDatabase, openDatabase } from '../../src/db.js'
import { migrate } from '../../src/migrate.js'
import { getHeatmap } from '../../src/query.js'
import { parseUsageEvents } from '../../src/usage-events.js'
import { setUsageMode, usageCoverage } from '../../src/usage-query.js'
import { backfillUsageDetails } from '../../src/usage-storage.js'
import { createWriter } from '../../src/writer.js'

import type { ParsedSessionData } from '../../src/schema.js'

const sample = (): ParsedSessionData => ({
  sessionId: 's',
  agentName: 'codex',
  project: 'p',
  startedAt: Date.parse('2026-09-20T12:00:00Z'),
  endedAt: Date.parse('2026-09-21T12:00:00Z'),
  durationMs: 86_400_000,
  turns: 2,
  tokensInput: 160,
  tokensOutput: 20,
  tokensCached: 90,
  summary: '',
  summarySource: 'auto',
  transcriptPath: '/tmp/a',
  fileSize: 10,
  tools: [],
  skills: [],
  model: 'test',
})
const snapshot = (date: string, input: number, cached: number, output: number) => JSON.stringify({ timestamp: date, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } } })

describe('usage ledger and rollback', () => {
  it('attributes cumulative deltas to source times, survives replay and legacy REPLACE', () => {
    const db = openDatabase({ dbPath: ':memory:' })
    try {
      const data = sample()
      data.usageDetails = parseUsageEvents([snapshot('2026-09-20T12:00:00Z', 100, 50, 10), snapshot('2026-09-21T12:00:00Z', 160, 90, 20), snapshot('2026-09-21T12:01:00Z', 160, 90, 20)].join('\n'), 'codex')
      expect(data.usageDetails.events.map(e => e.tokensInput + e.tokensOutput + e.tokensCached)).toEqual([110, 70])
      const writer = createWriter(db)
      writer.writeSession(data)
      writer.writeSession(data)
      expect(db.prepare('SELECT COUNT(*) AS n FROM token_usage_events').get()).toMatchObject({ n: 2 })
      setUsageMode(db, 'events')
      const points = getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' })
      expect(points.map(p => p.value)).toEqual([110, 70])
      expect(usageCoverage(db).usageIncomplete).toBe(0)
      setUsageMode(db, 'session')
      expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' }).map(p => p.value)).toEqual([180, 0])
      db.exec('CREATE TEMP TABLE old_session AS SELECT * FROM sessions; DELETE FROM sessions; INSERT OR REPLACE INTO sessions SELECT * FROM old_session;')
      db.exec('UPDATE sessions SET tokens_output=tokens_output+10')
      setUsageMode(db, 'events')
      expect(usageCoverage(db).usageIncomplete).toBe(1)
      expect(db.prepare('SELECT COUNT(*) AS n FROM token_usage_events').get()).toMatchObject({ n: 2 })
      setUsageMode(db, 'session')
      expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' })[0].value).toBe(190)
    } finally {
      closeDatabase(db)
    }
  })
  it('rolls back session updates if event validation fails', () => {
    const db = openDatabase({ dbPath: ':memory:' })
    try {
      const data = sample()
      createWriter(db).writeSession(data)
      data.tokensInput = 999
      data.usageDetails = { status: 'partial', events: [{ eventKey: 'bad', occurredAt: 1, tokensInput: -1, tokensOutput: 0, tokensCached: 0, model: null }] }
      expect(() => createWriter(db).writeSession(data)).toThrow('Invalid usage event')
      expect(db.prepare('SELECT tokens_input FROM sessions').get()).toMatchObject({ tokens_input: 160 })
    } finally {
      closeDatabase(db)
    }
  })
  it('marks counter resets and missing timestamps partial instead of inventing usage', () => {
    const details = parseUsageEvents([snapshot('2026-09-20T12:00:00Z', 100, 50, 10), snapshot('invalid', 160, 90, 20), snapshot('2026-09-21T12:00:00Z', 10, 0, 2)].join('\n'), 'codex')
    expect(details.status).toBe('partial')
    expect(details.events).toHaveLength(1)
  })
})

it('backfills without modifying session metadata, tools, skills or cumulative usage', () => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    const data = sample()
    data.tools = [{ toolName: 'Read', callCount: 3 }]
    data.skills = ['review']
    createWriter(db).writeSession(data)
    const before = db.prepare('SELECT * FROM sessions').all()
    backfillUsageDetails(db, 's', parseUsageEvents(snapshot('2026-09-21T12:00:00Z', 160, 90, 20), 'codex'))
    expect(db.prepare('SELECT * FROM sessions').all()).toEqual(before)
    expect(db.prepare('SELECT call_count FROM session_tools').get()).toMatchObject({ call_count: 3 })
    expect(db.prepare('SELECT skill_name FROM session_skills').get()).toMatchObject({ skill_name: 'review' })
  } finally {
    closeDatabase(db)
  }
})

it('rolls back a failed schema upgrade without changing version or dropping session data', () => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    createWriter(db).writeSession(sample())
    expect(() => migrate(db, { currentSchemaVersion: 6, migrations: { 6: 'CREATE TABLE rollback_probe(id INTEGER); INVALID SQL;' } })).toThrow()
    expect(db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()).toMatchObject({ value: '5' })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='rollback_probe'").get()).toBeUndefined()
    expect(db.prepare('SELECT session_id FROM sessions').get()).toMatchObject({ session_id: 's' })
  } finally {
    closeDatabase(db)
  }
})

const claudeSnapshot = (output: number) => JSON.stringify({ type: 'assistant', timestamp: '2026-09-21T00:00:00Z', message: { id: 'msg', role: 'assistant', usage: { input_tokens: 10, output_tokens: output, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 } } })

it('deduplicates Claude message updates at source time', () => {
  const details = parseUsageEvents([claudeSnapshot(1), claudeSnapshot(3)].join('\n'), 'claude')
  expect(details.status).toBe('complete')
  expect(details.events).toHaveLength(1)
  expect(details.events[0]).toMatchObject({ tokensInput: 10, tokensOutput: 3, tokensCached: 25 })
})
