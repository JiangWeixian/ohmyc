import {
  describe,
  expect,
  it,
} from 'vitest'

import { closeDatabase, openDatabase } from '../../src/db.js'
import { migrate } from '../../src/migrate.js'
import {
  getHeatmap,
  getRangeSummary,
  getStatus,
  getSummary,
  getYears,
} from '../../src/query.js'
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

it.each([undefined, 'session', 'events'] as const)('counts distinct event sessions on local event days with stored mode %s', (mode) => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    if (mode) {
      setUsageMode(db, mode)
    }
    const monday = new Date(2026, 8, 21).getTime()
    const writer = createWriter(db)
    writer.writeSession({ ...sample(), startedAt: monday - 86_400_000 })
    for (const sessionId of ['zero', 'missing', 'partial']) {
      writer.writeSession({ ...sample(), sessionId, startedAt: monday + 43_200_000, tokensInput: 0, tokensOutput: 0, tokensCached: 0 })
    }
    writer.writeSession({ ...sample(), sessionId: 'other', project: 'other', startedAt: monday - 86_400_000 })
    const insert = db.prepare('INSERT INTO token_usage_events VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)')
    insert.run('codex', 's', 'before', monday - 1, 5, monday)
    insert.run('codex', 's', 'a', monday, 10, monday)
    insert.run('codex', 's', 'b', monday + 1000, 20, monday)
    insert.run('codex', 's', 'after', monday + 86_400_000, 5, monday)
    insert.run('codex', 'zero', 'c', monday, 0, monday)
    insert.run('codex', 'other', 'd', monday, 100, monday)
    insert.run('wrong-source', 'missing', 'e', monday, 999, monday)
    insert.run('codex', 'orphan', 'f', monday, 999, monday)
    expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-23', metric: 'event_sessions', project: 'p' }).map(p => p.value)).toEqual([1, 2, 1, 0])
    expect(getRangeSummary(db, '2026-09-21', '2026-09-21').sessions).toBe(3)
    db.exec('DROP TABLE token_usage_events')
    expect(getHeatmap(db, { from: '2026-09-21', to: '2026-09-21', metric: 'event_sessions' })).toEqual([{ date: '2026-09-21', value: 0 }])
    expect(getRangeSummary(db, '2026-09-21', '2026-09-21').sessions).toBe(3)
  } finally {
    closeDatabase(db)
  }
})

describe('usage ledger compatibility', () => {
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
      expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' }).map(p => p.value)).toEqual([110, 70])
      db.exec('CREATE TEMP TABLE old_session AS SELECT * FROM sessions; DELETE FROM sessions; INSERT OR REPLACE INTO sessions SELECT * FROM old_session;')
      db.exec('UPDATE sessions SET tokens_output=tokens_output+10')
      setUsageMode(db, 'events')
      expect(usageCoverage(db).usageIncomplete).toBe(1)
      expect(db.prepare('SELECT COUNT(*) AS n FROM token_usage_events').get()).toMatchObject({ n: 2 })
      setUsageMode(db, 'session')
      expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' })[0].value).toBe(110)
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

it.each([undefined, 'session', 'events'] as const)('counts session starts independently with stored mode %s', (mode) => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    if (mode) {
      setUsageMode(db, mode)
    }
    const writer = createWriter(db)
    const old = sample()
    old.usageDetails = parseUsageEvents([snapshot('2026-09-21T12:00:00Z', 100, 50, 10), snapshot('2026-09-21T13:00:00Z', 160, 90, 20)].join('\n'), 'codex')
    writer.writeSession(old)
    for (const sessionId of ['zero', 'missing', 'partial']) {
      writer.writeSession({ ...sample(), sessionId, startedAt: Date.parse('2026-09-21T12:00:00Z'), tokensInput: 0, tokensOutput: 0, tokensCached: 0 })
    }
    expect(getHeatmap(db, { from: '2026-09-21', to: '2026-09-21', metric: 'sessions' })).toEqual([{ date: '2026-09-21', value: 3 }])
    expect(getHeatmap(db, { from: '2026-09-21', to: '2026-09-21', metric: 'tokens' })).toEqual([{ date: '2026-09-21', value: 180 }])
    expect(getSummary(db, Date.parse('2026-09-21T00:00:00Z'), Date.parse('2026-09-22T00:00:00Z'))).toEqual({ sessions: 3, tokens: 180 })
    expect(getRangeSummary(db, '2026-09-21', '2026-09-21')).toEqual({ sessions: 3, tokens: 180 })
    expect(getStatus(db).usageMode).toBe('events')
  } finally {
    closeDatabase(db)
  }
})

it.each([undefined, 'session', 'events'] as const)('preserves legacy Tokens and Sessions without token tables for mode %s', (mode) => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    if (mode) {
      setUsageMode(db, mode)
    }
    createWriter(db).writeSession(sample())
    db.exec('DROP TABLE token_usage_events; DROP TABLE usage_event_coverage;')
    expect(getRangeSummary(db, '2026-09-20', '2026-09-21')).toEqual({ sessions: 1, tokens: 180 })
    expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'sessions' }).map(p => p.value)).toEqual([1, 0])
    expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens' }).map(p => p.value)).toEqual([180, 0])
    expect(getStatus(db)).toMatchObject({ sessionCount: 1, usageMode: 'events', usageIncomplete: 1 })
    expect(getYears(db)).toEqual([2026])
  } finally {
    closeDatabase(db)
  }
})

it('keeps range summary and session calendar on the same UTC date boundaries', () => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    const start = Date.parse('2026-09-21T00:00:00Z')
    const writer = createWriter(db)
    for (const [index, at] of [start - 1, start, start + 86_400_000 - 1, start + 86_400_000].entries()) {
      writer.writeSession({ ...sample(), sessionId: `boundary-${index}`, startedAt: at })
    }
    expect(getRangeSummary(db, '2026-09-21', '2026-09-21')).toEqual({ sessions: 2, tokens: 360 })
    expect(getHeatmap(db, { from: '2026-09-21', to: '2026-09-21', metric: 'sessions' })).toEqual([{ date: '2026-09-21', value: 2 }])
  } finally {
    closeDatabase(db)
  }
})

it.each([undefined, 'session', 'events'] as const)('includes legacy history once alongside source events with mode %s', (mode) => {
  const db = openDatabase({ dbPath: ':memory:' })
  try {
    if (mode) {
      setUsageMode(db, mode)
    }
    const writer = createWriter(db)
    const legacy: ParsedSessionData = { ...sample(), sessionId: 'legacy', tokensInput: 100, tokensOutput: 20, tokensCached: 80 }
    writer.writeSession(legacy)
    const resumed: ParsedSessionData = {
      ...sample(),
      sessionId: 'resumed',
      tokensInput: 900,
      usageDetails: parseUsageEvents([snapshot('2026-09-21T12:00:00Z', 100, 50, 10), snapshot('2026-09-21T13:00:00Z', 160, 90, 20)].join('\n'), 'codex'),
    }
    writer.writeSession(resumed)
    writer.writeSession({ ...sample(), sessionId: 'other', project: 'other' })
    expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens', project: 'p' }).map(p => p.value)).toEqual([120, 180])
    expect(getRangeSummary(db, '2026-09-20', '2026-09-20')).toEqual({ sessions: 3, tokens: 300 })
    expect(getRangeSummary(db, '2026-09-21', '2026-09-21')).toEqual({ sessions: 0, tokens: 180 })
    legacy.usageDetails = parseUsageEvents(snapshot('2026-09-21T12:00:00Z', 100, 80, 20), 'codex')
    writer.writeSession(legacy)
    expect(getHeatmap(db, { from: '2026-09-20', to: '2026-09-21', metric: 'tokens', project: 'p' }).map(p => p.value)).toEqual([0, 300])
    expect(getRangeSummary(db, '2026-09-20', '2026-09-21').tokens).toBe(480)
  } finally {
    closeDatabase(db)
  }
})
