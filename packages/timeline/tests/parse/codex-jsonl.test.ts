import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

import { parseTranscript } from '../../src/ingest.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures')

describe('parseTranscript (Codex JSONL)', () => {
  it('normalizes Codex JSONL sessions into ParsedSessionData', () => {
    const transcriptPath = path.join(fixturesDir, 'codex-session.jsonl')
    const data = parseTranscript('019ebc25-b5ab-72a0-b391-0364d948be20', transcriptPath, {
      agentName: 'codex',
    })

    expect(data.sessionId).toBe('019ebc25-b5ab-72a0-b391-0364d948be20')
    expect(data.agentName).toBe('codex')
    expect(data.project).toBe('~/projects/claudeui')
    expect(data.turns).toBe(1)
    expect(data.summary).toBe('把我 review timeline codex compat plan')
    expect(data.summarySource).toBe('first_message')
    expect(data.tools).toEqual([
      { toolName: 'functions.exec_command', callCount: 2 },
    ])
    expect(data.skills).toEqual([])
    expect(data.tokensInput).toBe(1200)
    expect(data.tokensOutput).toBe(350)
    expect(data.tokensCached).toBe(200)
    expect(data.model).toBe('gpt-5.5')
    expect(data.durationMs).toBe(55_909)
  })
})
