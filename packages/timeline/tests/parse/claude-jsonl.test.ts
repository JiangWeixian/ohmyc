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

import { parseTranscript } from '../../src/ingest.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures')

describe('parseTranscript (Claude JSONL)', () => {
  it('parses a simple session from fixture', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const data = parseTranscript('test-session-001', transcriptPath)

    expect(data.sessionId).toBe('test-session-001')
    expect(data.agentName).toBe('claude')
    expect(data.turns).toBe(2)
    expect(data.tokensInput).toBe(18)
    expect(data.tokensOutput).toBe(37)
    expect(data.tokensCached).toBe(30)
    expect(data.model).toBe('claude-sonnet-4')
    expect(data.summary).toBe('Helped user set up timeline feature in their project. Next: review the wireframe. (disable recaps in /config)')
    expect(data.summarySource).toBe('auto')
  })

  it('accepts an explicit agent name for shared writers', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const data = parseTranscript('test-session-001', transcriptPath, { agentName: 'claude-cli' })

    expect(data.agentName).toBe('claude-cli')
    expect(data.turns).toBe(2)
  })

  it('counts tool calls correctly', () => {
    const transcriptPath = path.join(fixturesDir, 'session-with-tools.jsonl')
    const data = parseTranscript('test-session-tools', transcriptPath)

    expect(data.tools).toHaveLength(2)
    const bash = data.tools.find(t => t.toolName === 'Bash')
    const read = data.tools.find(t => t.toolName === 'Read')
    expect(bash?.callCount).toBe(1)
    expect(read?.callCount).toBe(1)
  })

  it('detects skill invocations', () => {
    const transcriptPath = path.join(fixturesDir, 'session-with-skills.jsonl')
    const data = parseTranscript('test-session-skills', transcriptPath)

    expect(data.skills).toEqual(['design-consultation'])
  })

  it('excludes tool_result arrays from turns count', () => {
    const transcriptPath = path.join(fixturesDir, 'session-with-tool-results.jsonl')
    const data = parseTranscript('test-session-tool-results', transcriptPath)

    expect(data.turns).toBe(2)
    expect(data.summary).toBe('Helped user run commands')
  })

  describe('project path decoding', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-parse-test-'))
    })

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('decodes project from encoded Claude Code path format', () => {
      const transcriptPath = path.join(tmpDir, 'projects', '-home-user-project-a', 'session.jsonl')
      mkdirSync(path.dirname(transcriptPath), { recursive: true })
      writeFileSync(transcriptPath, '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","message":{"role":"user","content":"Hello"}}\n')

      const data = parseTranscript('test-session', transcriptPath)
      expect(data.project).toBe('/home/user/project/a')
    })

    it('decodes project from real Claude Code path format', () => {
      const transcriptPath = path.join(tmpDir, 'projects', '-Volumes-Users-foo-work-project', 'session.jsonl')
      mkdirSync(path.dirname(transcriptPath), { recursive: true })
      writeFileSync(transcriptPath, '{"type":"user","timestamp":"2026-04-30T10:00:00.000Z","message":{"role":"user","content":"Hello"}}\n')

      const data = parseTranscript('test-session', transcriptPath)
      expect(data.project).toBe('/Volumes/Users/foo/work/project')
    })
  })
})
