import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

const CODEX_LINES = [
  '{"timestamp":"2026-06-13T01:00:00.000Z","type":"session_meta","payload":{"id":"codex-session-001","cwd":"/tmp/codex-project"}}',
  '{"timestamp":"2026-06-13T01:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5.5","cwd":"/tmp/codex-project"}}',
  '{"timestamp":"2026-06-13T01:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"hello codex"}]}}',
  String.raw`{"timestamp":"2026-06-13T01:00:03.000Z","type":"response_item","payload":{"type":"function_call","name":"functions.exec_command","arguments":"{\"cmd\":\"pwd\"}"}}`,
  '{"timestamp":"2026-06-13T01:00:04.000Z","type":"event_msg","payload":{"type":"token_count","info":{"input_tokens":10,"output_tokens":5,"cached_input_tokens":2}}}',
]

function writeTranscript(dir: string, sessionId: string, lines: readonly string[]): string {
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${sessionId}.jsonl`)
  writeFileSync(filePath, `${lines.join('\n')}\n`)
  return filePath
}

describe('ingest-codex.sh', () => {
  let tmpDir: string
  let capturePath: string
  let pluginHook: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'codex-hook-test-'))

    const tempPluginDir = path.join(tmpDir, 'plugin')
    mkdirSync(path.join(tempPluginDir, 'hooks'), { recursive: true })
    mkdirSync(path.join(tempPluginDir, 'dist'), { recursive: true })

    const realHook = readFileSync(path.resolve(import.meta.dirname, '../../../hooks/ingest-codex.sh'), 'utf8')
    pluginHook = path.join(tempPluginDir, 'hooks/ingest-codex.sh')
    writeFileSync(pluginHook, realHook)
    chmodSync(pluginHook, 0o755)

    capturePath = path.join(tmpDir, 'captured.json')
    const stub = 'import { writeFileSync } from \'node:fs\';\n'
      + 'if (process.argv.includes(\'--raw\')) {\n'
      + '  let buf = \'\';\n'
      + '  for await (const chunk of process.stdin) { buf += chunk; }\n'
      + `  writeFileSync(${JSON.stringify(capturePath)}, buf);\n`
      + '  console.log(\'INGEST_RAW_OK\');\n'
      + '} else {\n'
      + `  writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({ args: process.argv.slice(2) }));\n`
      + '  console.log(\'INGEST_SLOW_OK\');\n'
      + '}\n'
    writeFileSync(path.join(tempPluginDir, 'dist/ingest.mjs'), stub)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function runCodexHook(stdin: string, env?: Record<string, string>) {
    return spawnSync('bash', [pluginHook], {
      env: {
        ...process.env,
        CODEX_HOME: path.join(tmpDir, '.codex'),
        OHMYC_HOME: path.join(tmpDir, '.ohmyc-data'),
        ...env,
      },
      input: stdin,
      encoding: 'utf8',
    })
  }

  function readCaptured(): Record<string, unknown> {
    return JSON.parse(readFileSync(capturePath, 'utf8'))
  }

  it('uses jq fast path for Codex transcript_path stdin', () => {
    const transcriptPath = writeTranscript(
      path.join(tmpDir, '.codex', 'sessions', '2026', '06', '13'),
      'codex-session-001',
      CODEX_LINES,
    )

    const result = runCodexHook(JSON.stringify({
      session_id: 'codex-session-001',
      transcript_path: transcriptPath,
    }))

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('INGEST_RAW_OK')
    expect(readCaptured()).toMatchObject({
      sessionId: 'codex-session-001',
      agentName: 'codex',
      project: '/tmp/codex-project',
      turns: 1,
      tokensInput: 10,
      tokensOutput: 5,
      tokensCached: 2,
      summary: 'hello codex',
      summarySource: 'first_message',
      model: 'gpt-5.5',
    })
  })

  it('finds Codex transcript by session_id and falls back to Node parser when jq is unavailable', () => {
    const transcriptPath = writeTranscript(
      path.join(tmpDir, '.codex', 'sessions', '2026', '06', '13'),
      'codex-session-002',
      CODEX_LINES,
    )
    const fakeJq = path.join(tmpDir, 'jq')
    writeFileSync(fakeJq, '#!/bin/bash\nexit 1\n')
    chmodSync(fakeJq, 0o755)

    const result = runCodexHook(JSON.stringify({ session_id: 'codex-session-002' }), {
      PATH: `${tmpDir}:${process.env.PATH}`,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('INGEST_SLOW_OK')
    expect(readCaptured()).toEqual({
      args: [
        '--session-id',
        'codex-session-002',
        '--transcript-path',
        transcriptPath,
        '--agent-name',
        'codex',
      ],
    })
  })
})
