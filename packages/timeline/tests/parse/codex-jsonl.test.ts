import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

import { parseTranscript } from '../../src/ingest.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures')

function withTranscript(lines: string[], run: (transcriptPath: string) => void): void {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'codex-jsonl-test-'))
  try {
    const transcriptPath = path.join(tmpDir, 'session.jsonl')
    writeFileSync(transcriptPath, `${lines.join('\n')}\n`)
    run(transcriptPath)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

describe('parseTranscript (Codex JSONL)', () => {
  it('normalizes Codex JSONL sessions into ParsedSessionData', () => {
    const transcriptPath = path.join(fixturesDir, 'codex-session.jsonl')
    const data = parseTranscript('019ebc25-b5ab-72a0-b391-0364d948be20', transcriptPath, {
      agentName: 'codex',
    })

    expect(data.sessionId).toBe('019ebc25-b5ab-72a0-b391-0364d948be20')
    expect(data.agentName).toBe('codex')
    expect(data.project).toBe('~/projects/ohmyc')
    expect(data.turns).toBe(1)
    expect(data.summary).toBe('把我 review timeline codex compat plan')
    expect(data.summarySource).toBe('first_message')
    expect(data.tools).toEqual([
      { toolName: 'exec_command', callCount: 1 },
      { toolName: 'functions.exec_command', callCount: 2 },
    ])
    expect(data.skills).toEqual(['superpowers:writing-plans', 'test-driven-development'])
    expect(data.tokensInput).toBe(1200)
    expect(data.tokensOutput).toBe(350)
    expect(data.tokensCached).toBe(200)
    expect(data.model).toBe('gpt-5.5')
    expect(data.durationMs).toBe(55_909)
  })

  it('reads Codex Desktop cumulative token usage from event_msg total_token_usage', () => {
    withTranscript([
      '{"timestamp":"2026-06-13T08:15:13.000Z","type":"session_meta","payload":{"id":"codex-token-session","cwd":"/tmp/project"}}',
      '{"timestamp":"2026-06-13T08:15:14.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}}',
      '{"timestamp":"2026-06-13T08:15:15.000Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":19368,"cached_input_tokens":4992,"output_tokens":176}}}}',
      '{"timestamp":"2026-06-13T08:15:16.000Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":40256,"cached_input_tokens":24320,"output_tokens":222,"reasoning_output_tokens":65,"total_tokens":40478},"last_token_usage":{"input_tokens":20888,"cached_input_tokens":19328,"output_tokens":46}}}}',
    ], (transcriptPath) => {
      const data = parseTranscript('codex-token-session', transcriptPath, {
        agentName: 'codex',
      })

      expect(data.tokensInput).toBe(40_256)
      expect(data.tokensOutput).toBe(222)
      expect(data.tokensCached).toBe(24_320)
    })
  })

  it('reads Codex turn.completed usage events', () => {
    withTranscript([
      '{"timestamp":"2026-06-13T08:15:13.000Z","type":"session_meta","payload":{"id":"codex-turn-session","cwd":"/tmp/project"}}',
      '{"timestamp":"2026-06-13T08:15:14.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}}',
      '{"timestamp":"2026-06-13T08:15:15.000Z","type":"turn.completed","usage":{"input_tokens":123,"cached_input_tokens":45,"output_tokens":67,"reasoning_output_tokens":8}}',
    ], (transcriptPath) => {
      const data = parseTranscript('codex-turn-session', transcriptPath, {
        agentName: 'codex',
      })

      expect(data.tokensInput).toBe(123)
      expect(data.tokensOutput).toBe(67)
      expect(data.tokensCached).toBe(45)
    })
  })
})
