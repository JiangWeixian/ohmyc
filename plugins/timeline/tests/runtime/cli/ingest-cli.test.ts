import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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

const INGEST_MJS = path.resolve(import.meta.dirname, '../../../dist/ingest.mjs')

const MINIMAL_TRANSCRIPT = [
  '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","message":{"role":"user","content":"hello"}}',
  '{"type":"assistant","timestamp":"2026-04-30T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":5,"output_tokens":3}}}',
].join('\n')

describe('dist/ingest.mjs (node entry)', () => {
  let tmpDir: string
  let dbDir: string
  let transcriptPath: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ingest-node-'))
    dbDir = path.join(tmpDir, 'ohmyc')
    mkdirSync(dbDir, { recursive: true })
    transcriptPath = path.join(tmpDir, 'session-aaa.jsonl')
    writeFileSync(transcriptPath, `${MINIMAL_TRANSCRIPT}\n`)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function run(args: string[], stdin?: string) {
    return spawnSync('node', [INGEST_MJS, ...args], {
      env: { ...process.env, OHMYC_HOME: dbDir },
      input: stdin,
      encoding: 'utf8',
    })
  }

  it('ingests from disk via --session-id + --transcript-path', () => {
    const result = run(['--session-id', 'session-aaa', '--transcript-path', transcriptPath])

    expect(result.status).toBe(0)

    const db = new Database(path.join(dbDir, 'timeline.db'), { readonly: true })
    const row = db.prepare('SELECT session_id, turns FROM sessions WHERE session_id = ?').get('session-aaa') as { session_id: string; turns: number } | undefined
    db.close()

    expect(row).toBeDefined()
    expect(row?.session_id).toBe('session-aaa')
    expect(row?.turns).toBe(1)
  })

  it('ingests pre-parsed JSON from stdin via --raw', () => {
    const parsed = {
      sessionId: 'session-bbb',
      project: 'demo',
      agentName: 'claude',
      startedAt: 1_714_478_400_000,
      endedAt: 1_714_478_405_000,
      durationMs: 5000,
      turns: 1,
      tokensInput: 5,
      tokensOutput: 3,
      tokensCached: 0,
      summary: 'hello',
      summarySource: 'first_message',
      transcriptPath: '/dev/null',
      fileSize: 0,
      tools: [],
      skills: [],
      model: null,
    }

    const result = run(['--raw'], JSON.stringify(parsed))
    expect(result.status).toBe(0)

    const db = new Database(path.join(dbDir, 'timeline.db'), { readonly: true })
    const row = db.prepare('SELECT session_id, project FROM sessions WHERE session_id = ?').get('session-bbb') as { session_id: string; project: string } | undefined
    db.close()

    expect(row?.session_id).toBe('session-bbb')
    expect(row?.project).toBe('demo')
  })

  it('exits 1 when neither --raw nor required disk args are provided', () => {
    const result = run([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--session-id and --transcript-path are required')
  })

  it('exits 1 when --raw receives empty stdin', () => {
    const result = run(['--raw'], '')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--raw expects JSON on stdin')
  })

  it('exits 1 when --raw receives invalid JSON', () => {
    const result = run(['--raw'], 'not json')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('invalid JSON on stdin')
  })
})
