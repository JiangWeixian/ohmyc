# Timeline Universal Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `plugins/timeline/` a single plugin package that works for Claude Code, OpenCode, and Codex, with Codex sessions correctly ingested into the shared Timeline database.

**Architecture:** Keep the existing Claude Code shell hook and OpenCode TypeScript plugin intact, and add Codex as a third runtime path. Codex uses a valid `.codex-plugin/plugin.json`, a repo marketplace entry, a Codex hook command that invokes `hooks/ingest-codex.sh`, and a dedicated Codex transcript parser that normalizes Codex JSONL into the existing `ParsedSessionData` writer contract. Claude and Codex shell entrypoints stay separate because their hook inputs and transcript formats are materially different.

**Tech Stack:** TypeScript, Vitest, Node.js, shell, jq, Codex plugin manifest/marketplace JSON

**Execution note:** Implemented on `hotfix/codex-plugin`. Final test layout uses semantic folders:
`packages/timeline/tests/parse`, `packages/timeline/tests/ingest`, `packages/timeline/tests/storage`,
`packages/timeline/tests/query`, and plugin runtime folders under
`plugins/timeline/tests/runtime/{claude,codex,cli,opencode}`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `plugins/timeline/.codex-plugin/plugin.json` | Create | Valid Codex plugin manifest. No `hooks` field because the local Codex validator rejects it. |
| `plugins/timeline/hooks/hooks.json` | Modify | Claude Code hook config that invokes `hooks/ingest-claude.sh`. |
| `plugins/timeline/hooks.json` | Create | Codex hook config that invokes `hooks/ingest-codex.sh`. |
| `.agents/plugins/marketplace.json` | Create or update | Repo-local Codex marketplace entry for `timeline`. |
| `plugins/timeline/hooks/ingest-claude.sh` | Create | Claude Stop hook entrypoint: find `~/.claude/projects` transcript, use Claude jq fast path, fallback to Node parser with `--agent-name claude`. |
| `plugins/timeline/hooks/ingest-codex.sh` | Create | Codex Stop hook entrypoint: read stdin hook JSON, find `~/.codex` transcript, use Codex jq fast path, fallback to Node parser with `--agent-name codex`. |
| `plugins/timeline/hooks/ingest.sh` | Delete | Replaced by agent-specific shell entrypoints. |
| `packages/timeline/src/ingest.ts` | Modify | Add parser options, agent-aware dispatch, and a Codex parser for Codex JSONL transcripts. |
| `plugins/timeline/src/ingest.ts` | Modify | Add `--agent-name` CLI option and pass it to shared `ingestSession`. |
| `packages/timeline/tests/fixtures/codex-session.jsonl` | Create | Minimal realistic Codex JSONL fixture. |
| `packages/timeline/tests/parse/claude-jsonl.test.ts` | Create | Claude JSONL transcript parsing tests. |
| `packages/timeline/tests/parse/codex-jsonl.test.ts` | Create | Codex JSONL transcript parsing tests. |
| `packages/timeline/tests/ingest/session-ingest.test.ts` | Create | Database write tests for `ingestSession` integration. |
| `packages/timeline/tests/ingest/backfill.test.ts` | Move | Claude transcript backfill tests. |
| `packages/timeline/tests/storage/{db,writer}.test.ts` | Move | Storage schema and writer tests. |
| `packages/timeline/tests/query/read-model.test.ts` | Move | Timeline read-model/query tests. |
| `packages/timeline/tests/ingest.test.ts` | Delete | Split into parser and writer responsibility-specific test files. |
| `plugins/timeline/tests/runtime/cli/ingest-cli.test.ts` | Modify | Add CLI slow-path test for `--agent-name codex`. |
| `plugins/timeline/tests/runtime/claude/ingest-hook.test.ts` | Create | Runtime tests for `hooks/ingest-claude.sh`. |
| `plugins/timeline/tests/runtime/codex/ingest-hook.test.ts` | Create | Runtime tests for `hooks/ingest-codex.sh`. |
| `plugins/timeline/tests/config/plugin.test.ts` | Create | Codex/Claude plugin manifest, marketplace, and hook config tests. |
| `plugins/timeline/README.md` | Modify | Document Claude Code, OpenCode, and Codex setup and data sources. |
| `plugins/timeline/.claude-plugin/plugin.json` | Modify | Update description to mention Codex support. |

---

### Task 1: Add a Valid Codex Plugin Manifest

**Files:**
- Create: `plugins/timeline/.codex-plugin/plugin.json`
- Create: `plugins/timeline/tests/config/plugin.test.ts`

- [ ] **Step 1: Create the failing manifest validation test**

Create `plugins/timeline/tests/config/plugin.test.ts`:

```typescript
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

describe('Codex plugin manifest', () => {
  it('uses the validation-safe Codex manifest shape', () => {
    const manifestPath = path.resolve(import.meta.dirname, '../../.codex-plugin/plugin.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    const interfaceMeta = manifest.interface as Record<string, unknown>

    expect(manifest.name).toBe('timeline')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest).not.toHaveProperty('hooks')
    expect(interfaceMeta.defaultPrompt).toEqual([
      'Show my recent Claude Code, OpenCode, and Codex session activity.',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: FAIL with an error that `plugins/timeline/.codex-plugin/plugin.json` does not exist.

- [ ] **Step 3: Create `plugins/timeline/.codex-plugin/plugin.json`**

```json
{
  "name": "timeline",
  "version": "1.0.0",
  "description": "Auto-collects Claude Code, OpenCode, and Codex session data for the OhMyC Timeline dashboard.",
  "author": {
    "name": "JiangWeixian",
    "email": "jiangweixian1994@gmail.com"
  },
  "homepage": "https://github.com/JiangWeixian/ohmyc/tree/main/plugins/timeline",
  "repository": "https://github.com/JiangWeixian/ohmyc",
  "license": "MIT",
  "keywords": [
    "timeline",
    "analytics",
    "session-tracking",
    "codex",
    "claude-code",
    "opencode"
  ],
  "interface": {
    "displayName": "OhMyC Timeline",
    "shortDescription": "Session analytics for OhMyC",
    "longDescription": "Collects session data from Claude Code, OpenCode, and Codex agents and writes it to the shared Timeline SQLite database.",
    "developerName": "JiangWeixian",
    "category": "Productivity",
    "capabilities": [
      "Read"
    ],
    "defaultPrompt": [
      "Show my recent Claude Code, OpenCode, and Codex session activity."
    ]
  }
}
```

- [ ] **Step 4: Run manifest validation**

```bash
python3 -m pip install --user PyYAML >/tmp/timeline-pyyaml-install.log 2>&1 || true
python3 /Volumes/ORICO/Users/jiangwei/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/timeline
```

Expected: `Plugin validation passed: /Volumes/ORICO/Users/jiangwei/projects/ohmyc/plugins/timeline`

- [ ] **Step 5: Run the manifest test**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: PASS for `Codex plugin manifest`.

- [ ] **Step 6: Commit**

```bash
git add plugins/timeline/.codex-plugin/plugin.json plugins/timeline/tests/config/plugin.test.ts
git commit -m "feat(timeline): add valid Codex plugin manifest"
```

---

### Task 2: Add Repo Marketplace Entry for Codex

**Files:**
- Create or modify: `.agents/plugins/marketplace.json`
- Modify: `plugins/timeline/tests/config/plugin.test.ts`

- [ ] **Step 1: Add the failing marketplace test**

Add this block after the `Codex plugin manifest` describe block in `plugins/timeline/tests/config/plugin.test.ts`:

```typescript
describe('Codex marketplace entry', () => {
  it('points the timeline plugin entry at plugins/timeline', () => {
    const marketplacePath = path.resolve(import.meta.dirname, '../../../../.agents/plugins/marketplace.json')
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8')) as {
      name: string
      plugins: Array<{
        name: string
        source: { source: string; path: string }
        policy: { installation: string; authentication: string }
        category: string
      }>
    }

    const entry = marketplace.plugins.find(plugin => plugin.name === 'timeline')
    expect(marketplace.name).toBe('ohmyc')
    expect(entry).toEqual({
      name: 'timeline',
      source: {
        source: 'local',
        path: './plugins/timeline',
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL',
      },
      category: 'Productivity',
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: FAIL because `.agents/plugins/marketplace.json` does not exist or does not contain `timeline`.

- [ ] **Step 3: Create `.agents/plugins/marketplace.json`**

```json
{
  "name": "ohmyc",
  "interface": {
    "displayName": "OhMyC Plugins"
  },
  "plugins": [
    {
      "name": "timeline",
      "source": {
        "source": "local",
        "path": "./plugins/timeline"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 4: Run the marketplace test**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: PASS for `Codex marketplace entry`.

- [ ] **Step 5: Commit**

```bash
git add .agents/plugins/marketplace.json plugins/timeline/tests/config/plugin.test.ts
git commit -m "feat(timeline): add Codex marketplace entry"
```

---

### Task 3: Route Claude and Codex Hook Configs to Separate Scripts

**Files:**
- Create: `plugins/timeline/hooks.json`
- Modify: `plugins/timeline/hooks/hooks.json`
- Modify: `plugins/timeline/tests/config/plugin.test.ts`

- [ ] **Step 1: Add failing hook config tests**

Add this block to `plugins/timeline/tests/config/plugin.test.ts`:

```typescript
describe('hook configuration compatibility', () => {
  it('routes Claude Code Stop hook to ingest-claude.sh with CLAUDE_SESSION_ID', () => {
    const hooksJson = JSON.parse(readFileSync(
      path.resolve(import.meta.dirname, '../../hooks/hooks.json'),
      'utf8',
    )) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } }

    const command = hooksJson.hooks.Stop[0].hooks[0].command
    expect(command).toBe('${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/hooks/ingest-claude.sh $CLAUDE_SESSION_ID')
  })

  it('routes Codex Stop hook to ingest-codex.sh without Claude arguments', () => {
    const hooksJson = JSON.parse(readFileSync(
      path.resolve(import.meta.dirname, '../../hooks.json'),
      'utf8',
    )) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } }

    const command = hooksJson.hooks.Stop[0].hooks[0].command
    expect(command).toBe('${PLUGIN_ROOT}/hooks/ingest-codex.sh')
  })
})
```

- [ ] **Step 2: Run the hook config tests to verify they fail**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: FAIL because hook config still points at `hooks/ingest.sh`.

- [ ] **Step 3: Replace `plugins/timeline/hooks/hooks.json` for Claude Code**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/hooks/ingest-claude.sh $CLAUDE_SESSION_ID"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Create `plugins/timeline/hooks.json` for Codex**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${PLUGIN_ROOT}/hooks/ingest-codex.sh"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Run hook config tests**

```bash
npx vitest run plugins/timeline/tests/config/plugin.test.ts --reporter=verbose
```

Expected: PASS for `hook configuration compatibility`.

- [ ] **Step 6: Commit**

```bash
git add plugins/timeline/hooks.json plugins/timeline/hooks/hooks.json plugins/timeline/tests/config/plugin.test.ts
git commit -m "feat(timeline): route hooks to agent-specific ingest scripts"
```

---

### Task 4: Split Timeline Ingest Tests by Responsibility

**Files:**
- Create: `packages/timeline/tests/normalize/claude.test.ts`
- Create: `packages/timeline/tests/write/session.test.ts`
- Delete: `packages/timeline/tests/ingest.test.ts`

- [ ] **Step 1: Split the current ingest test file mechanically**

Run this script from the repo root:

```bash
node <<'NODE'
const fs = require('fs')
const path = require('path')

const src = path.join('packages', 'timeline', 'tests', 'ingest.test.ts')
const parseDest = path.join('packages', 'timeline', 'tests', 'normalize', 'claude.test.ts')
const writeDest = path.join('packages', 'timeline', 'tests', 'write', 'session.test.ts')
const input = fs.readFileSync(src, 'utf8')
const marker = '// ====================================================================\n// ingestSession — database writes via ingestSession / upsertSessionData\n// ===================================================================='
const markerIndex = input.indexOf(marker)
if (markerIndex === -1) {
  throw new Error('Could not find ingestSession split marker')
}

const parsePart = input.slice(0, markerIndex).trimEnd() + '\n'
const writePart = input.slice(markerIndex)
const fixturesDecl = "const __dirname = path.dirname(fileURLToPath(import.meta.url))\nconst fixturesDir = path.resolve(__dirname, '../fixtures')\n"

const writeHeader = `import {
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

import { closeDatabase, openDatabase } from '../../src/db.js'
import { ingestSession } from '../../src/ingest.js'

import type Database from 'better-sqlite3'

${fixturesDecl}
`

const normalizedWritePart = writePart
  .replace(marker, `${marker}\n`)
  .replace(/^\s*\/\/ ====================================================================\n\/\/ ingestSession/m, '// ====================================================================\n// ingestSession')

fs.mkdirSync(path.dirname(parseDest), { recursive: true })
fs.mkdirSync(path.dirname(writeDest), { recursive: true })
fs.writeFileSync(parseDest, parsePart)
fs.writeFileSync(writeDest, writeHeader + normalizedWritePart)
fs.rmSync(src)
NODE
```

- [ ] **Step 2: Remove database-only imports from `normalize/claude.test.ts`**

Edit the import block at the top of `packages/timeline/tests/normalize/claude.test.ts` so it contains exactly:

```typescript
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

import { parseTranscript } from '../../src/ingest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../fixtures')
```

- [ ] **Step 3: Run split test files to verify behavior is unchanged**

```bash
npx vitest run packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/write/session.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 4: Verify the old mixed test file is gone**

```bash
test ! -f packages/timeline/tests/ingest.test.ts && echo "split complete"
```

Expected: `split complete`

- [ ] **Step 5: Commit**

```bash
git add packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/write/session.test.ts
git rm --ignore-unmatch packages/timeline/tests/ingest.test.ts
git commit -m "test(timeline): split ingest parser and writer tests"
```

---

### Task 5: Add Agent-Aware Shared Ingest API

**Files:**
- Modify: `packages/timeline/src/ingest.ts`
- Modify: `packages/timeline/tests/normalize/claude.test.ts`
- Modify: `packages/timeline/tests/write/session.test.ts`

- [ ] **Step 1: Add failing tests for parser options**

Add these tests near the end of the existing `describe('parseTranscript', () => {` block in `packages/timeline/tests/normalize/claude.test.ts`:

```typescript
  it('keeps Claude as the default agent name', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const data = parseTranscript('test-session-default-agent', transcriptPath)

    expect(data.agentName).toBe('claude')
  })

  it('accepts an explicit non-Codex agentName option for Claude-shaped transcripts', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    const data = parseTranscript('test-session-explicit-agent', transcriptPath, {
      agentName: 'claude-cli',
    })

    expect(data.agentName).toBe('claude-cli')
  })
```

Add this test near the end of the existing `describe('ingestSession', () => {` block in `packages/timeline/tests/write/session.test.ts`, before that block's closing `})`:

```typescript
  it('passes agent options through ingestSession', () => {
    const transcriptPath = path.join(fixturesDir, 'simple-session.jsonl')
    ingestSession(db, 'test-session-agent-option', transcriptPath, {
      agentName: 'claude-cli',
    })

    const session = db
      .prepare('SELECT agent_name FROM sessions WHERE session_id = ?')
      .get('test-session-agent-option') as { agent_name: string }

    expect(session.agent_name).toBe('claude-cli')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/write/session.test.ts --reporter=verbose
```

Expected: FAIL because `parseTranscript` and `ingestSession` do not accept a third options argument.

- [ ] **Step 3: Update `packages/timeline/src/ingest.ts` types and defaults**

Replace the current parser function signature area near the top of `packages/timeline/src/ingest.ts` with:

```typescript
export interface ParseTranscriptOptions {
  agentName?: 'claude' | 'codex' | 'opencode' | string
}

export function parseTranscript(
  sessionId: string,
  transcriptPath: string,
  options: ParseTranscriptOptions = {},
): ParsedSessionData {
  const agentName = options.agentName ?? 'claude'
  const fileStat = statSync(transcriptPath)
  const fileSize = fileStat.size
```

Replace the return field:

```typescript
    agentName: 'claude', // Fixed for CLI-sourced transcripts; plugins override this
```

with:

```typescript
    agentName,
```

Replace the `ingestSession` signature and body with:

```typescript
export function ingestSession(
  db: Database.Database,
  sessionId: string,
  transcriptPath: string,
  options: ParseTranscriptOptions = {},
): IngestResult {
  const data = parseTranscript(sessionId, transcriptPath, options)
  return upsertSessionData(db, sessionId, data)
}
```

- [ ] **Step 4: Run agent-aware ingest tests**

```bash
npx vitest run packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/write/session.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timeline/src/ingest.ts packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/write/session.test.ts
git commit -m "feat(timeline): support agent-aware transcript ingest"
```

---

### Task 6: Add Codex Transcript Parser

**Files:**
- Create: `packages/timeline/tests/fixtures/codex-session.jsonl`
- Modify: `packages/timeline/src/ingest.ts`
- Create: `packages/timeline/tests/normalize/codex.test.ts`

- [ ] **Step 1: Create Codex fixture**

Create `packages/timeline/tests/fixtures/codex-session.jsonl`:

```jsonl
{"timestamp":"2026-06-12T14:05:24.091Z","type":"session_meta","payload":{"id":"019ebc25-b5ab-72a0-b391-0364d948be20","timestamp":"2026-06-12T14:04:08.529Z","cwd":"/Volumes/ORICO/Users/jiangwei/projects/ohmyc","originator":"Codex Desktop","model_provider":"openai"}}
{"timestamp":"2026-06-12T14:05:24.104Z","type":"event_msg","payload":{"type":"task_started","turn_id":"019ebc26-dca2-7460-a5ea-9db46cfd1e8d","started_at":1781273124,"model_context_window":258400,"collaboration_mode_kind":"default"}}
{"timestamp":"2026-06-12T14:05:24.153Z","type":"turn_context","payload":{"turn_id":"019ebc26-dca2-7460-a5ea-9db46cfd1e8d","cwd":"/Volumes/ORICO/Users/jiangwei/projects/ohmyc","model":"gpt-5.5"}}
{"timestamp":"2026-06-12T14:05:24.165Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"把我 review timeline codex compat plan"}]}}
{"timestamp":"2026-06-12T14:05:30.000Z","type":"response_item","payload":{"type":"function_call","name":"functions.exec_command","arguments":"{\"cmd\":\"sed -n '1,220p' docs/superpowers/plans/2026-06-12-timeline-codex-compat.md\"}"}}
{"timestamp":"2026-06-12T14:05:31.000Z","type":"response_item","payload":{"type":"function_call","name":"functions.exec_command","arguments":"{\"cmd\":\"sed -n '1,220p' plugins/timeline/hooks/ingest-codex.sh\"}"}}
{"timestamp":"2026-06-12T14:05:40.000Z","type":"event_msg","payload":{"type":"token_count","info":{"input_tokens":1200,"output_tokens":350,"cached_input_tokens":200}}}
{"timestamp":"2026-06-12T14:06:20.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Review complete."}]}}
```

- [ ] **Step 2: Add failing Codex parser tests**

Create `packages/timeline/tests/normalize/codex.test.ts`:

```typescript
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  describe,
  expect,
  it,
} from 'vitest'

import { parseTranscript } from '../../src/ingest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('parseCodexTranscript', () => {
  it('normalizes Codex JSONL sessions into ParsedSessionData', () => {
    const transcriptPath = path.join(fixturesDir, 'codex-session.jsonl')
    const data = parseTranscript('019ebc25-b5ab-72a0-b391-0364d948be20', transcriptPath, {
      agentName: 'codex',
    })

    expect(data.sessionId).toBe('019ebc25-b5ab-72a0-b391-0364d948be20')
    expect(data.agentName).toBe('codex')
    expect(data.project).toBe('/Volumes/ORICO/Users/jiangwei/projects/ohmyc')
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run packages/timeline/tests/normalize/codex.test.ts --reporter=verbose
```

Expected: FAIL because `parseTranscript(..., { agentName: 'codex' })` still uses the Claude parser and returns `project: 'unknown'`, `turns: 0`, and no tools.

- [ ] **Step 4: Add Codex parser helpers to `packages/timeline/src/ingest.ts`**

Add these helpers below `parseTranscript` and above `upsertSessionData`:

```typescript
function parseCodexTranscript(
  sessionId: string,
  transcriptPath: string,
): ParsedSessionData {
  const fileStat = statSync(transcriptPath)
  const fileSize = fileStat.size
  const lines = readFileSync(transcriptPath, 'utf8').split('\n')

  let firstTimestamp: number | null = null
  let lastTimestamp: number | null = null
  let project = 'unknown'
  let model: string | null = null
  let firstUserMessage: string | null = null
  let turns = 0
  let tokensInput = 0
  let tokensOutput = 0
  let tokensCached = 0
  const toolCounts = new Map<string, number>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      console.error(`Malformed JSON line in ${transcriptPath}: ${trimmed.slice(0, 200)}`)
      continue
    }

    const timestamp = parsed.timestamp
    if (typeof timestamp === 'string') {
      const ts = new Date(timestamp).getTime()
      if (!Number.isNaN(ts)) {
        firstTimestamp = firstTimestamp === null ? ts : Math.min(firstTimestamp, ts)
        lastTimestamp = lastTimestamp === null ? ts : Math.max(lastTimestamp, ts)
      }
    }

    const payload = parsed.payload as Record<string, unknown> | undefined
    if (!payload) {
      continue
    }

    if (parsed.type === 'session_meta' && typeof payload.cwd === 'string') {
      project = payload.cwd
    }

    if (parsed.type === 'turn_context') {
      if (typeof payload.cwd === 'string') {
        project = payload.cwd
      }
      if (typeof payload.model === 'string') {
        model = payload.model
      }
    }

    if (parsed.type === 'event_msg') {
      const eventType = payload.type
      if (eventType === 'token_count') {
        const info = payload.info as Record<string, unknown> | null | undefined
        if (info) {
          tokensInput = Number(info.input_tokens) || tokensInput
          tokensOutput = Number(info.output_tokens) || tokensOutput
          tokensCached = Number(info.cached_input_tokens) || tokensCached
        }
      }
    }

    if (parsed.type === 'response_item') {
      if (payload.type === 'message' && payload.role === 'user') {
        const text = extractCodexMessageText(payload.content)
        if (text) {
          turns++
          firstUserMessage ??= text
        }
      }

      if (payload.type === 'function_call' && typeof payload.name === 'string') {
        const toolName = payload.name
        toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1)
      }
    }
  }

  const summary = firstUserMessage
    ? truncateSummary(firstUserMessage)
    : '(untitled session)'
  const startedAt = firstTimestamp ?? Date.now()
  const endedAt = lastTimestamp ?? Date.now()

  return {
    sessionId,
    project: displayProject(project),
    agentName: 'codex',
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    turns,
    tokensInput,
    tokensOutput,
    tokensCached,
    summary,
    summarySource: firstUserMessage ? 'first_message' : 'auto',
    transcriptPath,
    fileSize,
    tools: [...toolCounts.entries()].map(([toolName, callCount]) => ({ toolName, callCount })),
    skills: [],
    model,
  }
}

function extractCodexMessageText(content: unknown): string | null {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return null
  }
  const text = content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return ''
      }
      const record = part as Record<string, unknown>
      if (typeof record.text === 'string') {
        return record.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
  return text || null
}

function truncateSummary(value: string): string {
  return value.length > 140 ? value.slice(0, 140) : value
}

function displayProject(project: string): string {
  const homeDir = os.homedir()
  if (project.startsWith(homeDir)) {
    return `~${project.slice(homeDir.length)}`
  }
  return project
}
```

Then replace this summary block in the Claude parser:

```typescript
  if (summary === null && firstUserMessage !== null) {
    // Truncate to keep summaries compact for list views
    summary = firstUserMessage.length > 140
      ? firstUserMessage.slice(0, 140)
      : firstUserMessage
  }
```

with:

```typescript
  if (summary === null && firstUserMessage !== null) {
    summary = truncateSummary(firstUserMessage)
  }
```

Finally, add this dispatch at the top of `parseTranscript`, immediately after `const agentName = options.agentName ?? 'claude'`:

```typescript
  if (agentName === 'codex') {
    return parseCodexTranscript(sessionId, transcriptPath)
  }
```

- [ ] **Step 5: Run Codex parser tests**

```bash
npx vitest run packages/timeline/tests/normalize/codex.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/timeline/src/ingest.ts packages/timeline/tests/normalize/codex.test.ts packages/timeline/tests/fixtures/codex-session.jsonl
git commit -m "feat(timeline): parse Codex session transcripts"
```

---

### Task 7: Add CLI Support for `--agent-name`

**Files:**
- Modify: `plugins/timeline/src/ingest.ts`
- Modify: `plugins/timeline/tests/runtime/ingest-cli.test.ts`

- [ ] **Step 1: Add failing CLI test**

Add this test to `plugins/timeline/tests/runtime/ingest-cli.test.ts` after the disk ingest test:

```typescript
  it('ingests Codex transcripts from disk via --agent-name codex', () => {
    const codexTranscript = [
      '{"timestamp":"2026-06-12T14:05:24.091Z","type":"session_meta","payload":{"id":"codex-session-001","timestamp":"2026-06-12T14:04:08.529Z","cwd":"/tmp/codex-project","originator":"Codex Desktop"}}',
      '{"timestamp":"2026-06-12T14:05:24.153Z","type":"turn_context","payload":{"turn_id":"turn-001","cwd":"/tmp/codex-project","model":"gpt-5.5"}}',
      '{"timestamp":"2026-06-12T14:05:24.165Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"review this plan"}]}}',
      '{"timestamp":"2026-06-12T14:05:30.000Z","type":"response_item","payload":{"type":"function_call","name":"functions.exec_command","arguments":"{\\"cmd\\":\\"pwd\\"}"}}',
      '{"timestamp":"2026-06-12T14:05:40.000Z","type":"event_msg","payload":{"type":"token_count","info":{"input_tokens":10,"output_tokens":5,"cached_input_tokens":2}}}',
    ].join('\n')
    writeFileSync(transcriptPath, `${codexTranscript}\n`)

    const result = run([
      '--session-id',
      'codex-session-001',
      '--transcript-path',
      transcriptPath,
      '--agent-name',
      'codex',
    ])

    expect(result.status).toBe(0)

    const db = new Database(path.join(dbDir, 'timeline.db'), { readonly: true })
    const row = db
      .prepare('SELECT session_id, agent_name, project, turns FROM sessions WHERE session_id = ?')
      .get('codex-session-001') as {
        session_id: string
        agent_name: string
        project: string
        turns: number
      } | undefined
    db.close()

    expect(row).toMatchObject({
      session_id: 'codex-session-001',
      agent_name: 'codex',
      project: '/tmp/codex-project',
      turns: 1,
    })
  })
```

- [ ] **Step 2: Build then run the CLI test to verify it fails**

```bash
cd plugins/timeline && npm run build
cd /Volumes/ORICO/Users/jiangwei/projects/ohmyc
npx vitest run plugins/timeline/tests/runtime/ingest-cli.test.ts --reporter=verbose
```

Expected: FAIL because `--agent-name` is ignored by the CLI.

- [ ] **Step 3: Modify `plugins/timeline/src/ingest.ts`**

Replace the command option chain with:

```typescript
cli
  .command('', 'Ingest a single session into the timeline DB')
  .option('--session-id <id>', 'Session UUID (disk-path mode)')
  .option('--transcript-path <path>', 'Path to JSONL transcript (disk-path mode)')
  .option('--agent-name <name>', 'Agent name for disk-path mode', { default: 'claude' })
  .option('--raw', 'Read pre-parsed ParsedSessionData JSON from stdin')
  .action(async (options: {
    sessionId?: string
    transcriptPath?: string
    agentName?: string
    raw?: boolean
  }) => {
    if (options.raw) {
      await runRawMode()
      return
    }
    if (!options.sessionId || !options.transcriptPath) {
      console.error('error: --session-id and --transcript-path are required when --raw is not set')
      process.exit(1)
    }
    runDiskMode(options.sessionId, options.transcriptPath, options.agentName ?? 'claude')
  })
```

Replace `runDiskMode` with:

```typescript
function runDiskMode(sessionId: string, transcriptPath: string, agentName: string): void {
  const db = openDatabase()
  try {
    ingestSession(db, sessionId, transcriptPath, { agentName })
  } finally {
    closeDatabase(db)
  }
}
```

- [ ] **Step 4: Build and run CLI tests**

```bash
cd plugins/timeline && npm run build
cd /Volumes/ORICO/Users/jiangwei/projects/ohmyc
npx vitest run plugins/timeline/tests/runtime/ingest-cli.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/timeline/src/ingest.ts plugins/timeline/tests/runtime/ingest-cli.test.ts
git commit -m "feat(timeline): add agent-name ingest CLI option"
```

---

### Task 8: Split Claude and Codex Stop Hook Scripts

**Files:**
- Create: `plugins/timeline/hooks/ingest-claude.sh`
- Create: `plugins/timeline/hooks/ingest-codex.sh`
- Delete: `plugins/timeline/hooks/ingest.sh`
- Create: `plugins/timeline/tests/runtime/claude-hook.test.ts`
- Create: `plugins/timeline/tests/runtime/codex-hook.test.ts`

- [ ] **Step 1: Rename the existing shell test for Claude**

Move the current shell hook tests to the Claude-specific runtime test file:

```bash
mkdir -p plugins/timeline/tests/runtime
git mv plugins/timeline/tests/ingest.sh.test.ts plugins/timeline/tests/runtime/claude-hook.test.ts
```

- [ ] **Step 2: Update `claude-hook.test.ts` to execute `ingest-claude.sh`**

In `plugins/timeline/tests/runtime/claude-hook.test.ts`, replace the hook fixture source path:

```typescript
const realHook = readFileSync(path.resolve(import.meta.dirname, '../../hooks/ingest.sh'), 'utf8')
```

with:

```typescript
const realHook = readFileSync(path.resolve(import.meta.dirname, '../../hooks/ingest-claude.sh'), 'utf8')
```

The existing Claude tests should continue to cover manual session-id invocation, stdin transcript path invocation, jq fast path extraction, and slow-path fallback when jq is unavailable.

- [ ] **Step 3: Create failing Codex hook runtime tests**

Create `plugins/timeline/tests/runtime/codex-hook.test.ts`:

```typescript
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

function writeTranscript(dir: string, sessionId: string, lines: readonly string[]): string {
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${sessionId}.jsonl`)
  writeFileSync(filePath, `${lines.join('\n')}\n`)
  return filePath
}

const CODEX_LINES = [
  '{"timestamp":"2026-06-13T01:00:00.000Z","type":"session_meta","payload":{"id":"codex-session-001","cwd":"/tmp/codex-project"}}',
  '{"timestamp":"2026-06-13T01:00:01.000Z","type":"turn_context","payload":{"model":"gpt-5.5","cwd":"/tmp/codex-project"}}',
  '{"timestamp":"2026-06-13T01:00:02.000Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"hello codex"}]}}',
  '{"timestamp":"2026-06-13T01:00:03.000Z","type":"response_item","payload":{"type":"function_call","name":"functions.exec_command","arguments":"{\\"cmd\\":\\"pwd\\"}"}}',
  '{"timestamp":"2026-06-13T01:00:04.000Z","type":"event_msg","payload":{"type":"token_count","info":{"input_tokens":10,"output_tokens":5,"cached_input_tokens":2}}}',
]

describe('ingest-codex.sh', () => {
  let tmpDir: string
  let capturePath: string
  let pluginHook: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'codex-hook-test-'))

    const tempPluginDir = path.join(tmpDir, 'plugin')
    mkdirSync(path.join(tempPluginDir, 'hooks'), { recursive: true })
    mkdirSync(path.join(tempPluginDir, 'dist'), { recursive: true })

    const realHook = readFileSync(path.resolve(import.meta.dirname, '../../hooks/ingest-codex.sh'), 'utf8')
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

    const result = runCodexHook(JSON.stringify({ session_id: 'codex-session-001', transcript_path: transcriptPath }))

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
```

- [ ] **Step 4: Run runtime tests to verify they fail**

```bash
npx vitest run plugins/timeline/tests/runtime/claude-hook.test.ts plugins/timeline/tests/runtime/codex-hook.test.ts --reporter=verbose
```

Expected: FAIL because `ingest-claude.sh` and `ingest-codex.sh` do not exist yet.

- [ ] **Step 5: Create `plugins/timeline/hooks/ingest-claude.sh` from the current script**

Copy the current `plugins/timeline/hooks/ingest.sh` to `plugins/timeline/hooks/ingest-claude.sh`, then make these exact changes:

```bash
# OhMyC Timeline Claude Code Stop Hook — ingests Claude Code session transcripts.
# Calls the bundled node entry at $PLUGIN_ROOT/dist/ingest.mjs or $CLAUDE_PLUGIN_ROOT/dist/ingest.mjs.
```

Use this plugin root resolution:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}}"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"
```

Keep the existing Claude jq fast path. Replace the final slow path call with:

```bash
node "$INGEST_MJS" --session-id "$SESSION_ID" --transcript-path "$TRANSCRIPT_PATH" --agent-name claude
```

- [ ] **Step 6: Create `plugins/timeline/hooks/ingest-codex.sh`**

Create `plugins/timeline/hooks/ingest-codex.sh`:

```bash
#!/bin/bash
# OhMyC Timeline Codex Stop Hook — ingests Codex session transcripts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"

export OHMYC_HOME="${OHMYC_HOME:-$HOME/.config/ohmyc}"

log_error() { echo "[timeline] $1" >&2; }
log_info()  { echo "[timeline] $1" >&2; }

if ! command -v node >/dev/null 2>&1; then
  log_error "node not found on PATH. Cannot ingest session."
  exit 0
fi

if [ ! -f "$INGEST_MJS" ]; then
  log_error "ingest bundle not found at $INGEST_MJS (did you run \`pnpm --filter @ohmyc/timeline-plugin build\`?)"
  exit 0
fi

HOOK_INPUT=$(cat)
HOOK_FIELDS=$(HOOK_INPUT="$HOOK_INPUT" node -e '
const input = process.env.HOOK_INPUT || ""
try {
  const parsed = JSON.parse(input)
  console.log(JSON.stringify({
    sessionId: typeof parsed.session_id === "string" ? parsed.session_id : "",
    transcriptPath: typeof parsed.transcript_path === "string" ? parsed.transcript_path : "",
  }))
} catch {
  console.log(JSON.stringify({ sessionId: "", transcriptPath: "" }))
}
')
TRANSCRIPT_PATH=$(echo "$HOOK_FIELDS" | node -e 'let b=""; process.stdin.on("data", c => b += c); process.stdin.on("end", () => { try { console.log(JSON.parse(b).transcriptPath || "") } catch { console.log("") } })')
SESSION_ID=$(echo "$HOOK_FIELDS" | node -e 'let b=""; process.stdin.on("data", c => b += c); process.stdin.on("end", () => { try { console.log(JSON.parse(b).sessionId || "") } catch { console.log("") } })')

if [ -z "$TRANSCRIPT_PATH" ] && [ -n "$SESSION_ID" ]; then
  CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  TRANSCRIPT_PATH=$(find "$CODEX_HOME/sessions" "$CODEX_HOME/archived_sessions" -name "*${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)
fi

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  log_error "No Codex transcript path in hook input or file not found"
  exit 0
fi

if [ -z "$SESSION_ID" ]; then
  SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)
  SESSION_ID="${SESSION_ID##rollout-*T*-}"
fi

FILE_SIZE=$(stat -f%z "$TRANSCRIPT_PATH" 2>/dev/null || stat -c%s "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)

if command -v jq >/dev/null 2>&1; then
  log_info "Using jq fast path for Codex session $SESSION_ID"
  set +e
  EXTRACTED=$(jq -s '
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | min // (now * 1000)) as $startedAt |
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | max // (now * 1000)) as $endedAt |
    ([.[] | select(.type == "session_meta" and (.payload.cwd | type) == "string") | .payload.cwd] | last) as $sessionProject |
    ([.[] | select(.type == "turn_context" and (.payload.cwd | type) == "string") | .payload.cwd] | last) as $turnProject |
    ([.[] | select(.type == "turn_context" and (.payload.model | type) == "string") | .payload.model] | last // null) as $model |
    ([.[] | select(.type == "response_item" and .payload.type == "message" and .payload.role == "user") | .payload.content |
      if type == "string" then .
      elif type == "array" then ([.[] | select((.text | type) == "string") | .text] | join("\n"))
      else empty end
    ] | map(select(length > 0))) as $userMessages |
    ([.[] | select(.type == "event_msg" and .payload.type == "token_count" and (.payload.info | type) == "object") | .payload.info] | last // {}) as $usage |
    {
      sessionId: $sessionId,
      project: ($turnProject // $sessionProject // "unknown"),
      agentName: "codex",
      startedAt: $startedAt,
      endedAt: $endedAt,
      durationMs: ($endedAt - $startedAt),
      turns: ($userMessages | length),
      tokensInput: ($usage.input_tokens // 0),
      tokensOutput: ($usage.output_tokens // 0),
      tokensCached: ($usage.cached_input_tokens // 0),
      summary: (if ($userMessages | length) > 0 then (if ($userMessages[0] | length) > 140 then $userMessages[0][:140] else $userMessages[0] end) else "(untitled session)" end),
      summarySource: (if ($userMessages | length) > 0 then "first_message" else "auto" end),
      transcriptPath: $transcriptPath,
      fileSize: ($fileSize | tonumber),
      tools: ([.[] | select(.type == "response_item" and .payload.type == "function_call" and (.payload.name | type) == "string") | .payload.name] | group_by(.) | map({toolName: .[0], callCount: length})),
      skills: [],
      model: $model
    }
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" --arg fileSize "$FILE_SIZE" "$TRANSCRIPT_PATH" 2>/dev/null)
  JQ_STATUS=$?
  set -e

  if [ $JQ_STATUS -eq 0 ] && [ -n "$EXTRACTED" ] && [ "$EXTRACTED" != "null" ]; then
    echo "$EXTRACTED" | node "$INGEST_MJS" --raw && exit 0
    log_error "Codex jq fast path failed for $SESSION_ID, falling back to slow path"
  else
    log_error "Codex jq extraction failed for $SESSION_ID, falling back to slow path"
  fi
fi

log_info "Using Node parser for Codex session $SESSION_ID"
node "$INGEST_MJS" --session-id "$SESSION_ID" --transcript-path "$TRANSCRIPT_PATH" --agent-name codex
```

- [ ] **Step 7: Remove the old shared hook script and make new scripts executable**

```bash
git rm plugins/timeline/hooks/ingest.sh
chmod +x plugins/timeline/hooks/ingest-claude.sh plugins/timeline/hooks/ingest-codex.sh
```

- [ ] **Step 8: Run syntax and runtime tests**

```bash
bash -n plugins/timeline/hooks/ingest-claude.sh
bash -n plugins/timeline/hooks/ingest-codex.sh
npx vitest run plugins/timeline/tests/runtime/claude-hook.test.ts plugins/timeline/tests/runtime/codex-hook.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add plugins/timeline/hooks/ingest-claude.sh plugins/timeline/hooks/ingest-codex.sh plugins/timeline/tests/runtime/claude-hook.test.ts plugins/timeline/tests/runtime/codex-hook.test.ts
git rm --ignore-unmatch plugins/timeline/hooks/ingest.sh
git commit -m "feat(timeline): split Claude and Codex hook ingest scripts"
```

---

### Task 9: Update Documentation and Claude Manifest Description

**Files:**
- Modify: `plugins/timeline/README.md`
- Modify: `plugins/timeline/.claude-plugin/plugin.json`

- [ ] **Step 1: Replace `plugins/timeline/README.md`**

```markdown
# OhMyC Timeline Plugin

Collects session data from **Claude Code**, **OpenCode**, and **Codex** agents and ingests it into the OhMyC Timeline dashboard.

## Supported Agents

| Agent | Integration | Data Source |
|-------|-------------|-------------|
| Claude Code | Stop hook via `hooks/hooks.json` and `hooks/ingest-claude.sh` | Claude JSONL transcripts in `~/.claude/projects/` |
| Codex | Codex plugin manifest, root `hooks.json`, and `hooks/ingest-codex.sh` | Codex JSONL sessions in `~/.codex/sessions/` and `~/.codex/archived_sessions/` |
| OpenCode | OpenCode plugin entry at `opencode.ts` | Real-time OpenCode lifecycle, message, and tool events |

## Claude Code Setup

Claude Code reads `plugins/timeline/.claude-plugin/plugin.json` and `plugins/timeline/hooks/hooks.json`. The Stop hook calls:

```bash
${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/hooks/ingest-claude.sh $CLAUDE_SESSION_ID
```

`ingest-claude.sh` searches `~/.claude/projects/` for the matching transcript and uses the Claude jq fast path when jq is available. If jq is unavailable or the fast path fails, the bundled Node entry at `dist/ingest.mjs` parses the transcript with `--agent-name claude`.

## Codex Setup

Codex discovers the plugin from `.agents/plugins/marketplace.json` and validates `plugins/timeline/.codex-plugin/plugin.json`. Runtime hooks live in the plugin root `hooks.json`; the Codex Stop hook calls:

```bash
${PLUGIN_ROOT}/hooks/ingest-codex.sh
```

`ingest-codex.sh` reads Codex hook input from stdin. It accepts `transcript_path` directly, or searches `~/.codex/sessions/` and `~/.codex/archived_sessions/` by `session_id`. It uses a Codex-specific jq fast path when jq is available, and falls back to the bundled Node parser with `--agent-name codex`; both paths emit the same `ParsedSessionData` shape.

## OpenCode Setup

The OpenCode plugin lives at `plugins/timeline/opencode.ts` and is symlinked from `.opencode/plugins/timeline.ts`. It sets `agentName='opencode'` and hooks into:

- `session.created`, `session.idle`, and `session.deleted`
- `message.updated`
- `message.part.updated`
- `tool.execute.before` and `tool.execute.after`

## Shared Output

All agents write to the same SQLite database:

```text
~/.config/ohmyc/timeline.db
```

The shared writer contract is `ParsedSessionData` from `@ohmyc/timeline`. Agent-specific collectors normalize their native event or transcript format into that contract before writing.
```

- [ ] **Step 2: Replace `plugins/timeline/.claude-plugin/plugin.json`**

```json
{
  "name": "timeline",
  "version": "1.0.0",
  "description": "Auto-collects Claude Code, Codex, and OpenCode session data for OhMyC Timeline dashboard"
}
```

- [ ] **Step 3: Validate docs-adjacent JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/timeline/.claude-plugin/plugin.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/README.md plugins/timeline/.claude-plugin/plugin.json
git commit -m "docs(timeline): document three-agent plugin support"
```

---

### Task 10: Final Verification and Codex Install Smoke Test

**Files:**
- None

- [ ] **Step 1: Run timeline unit tests**

```bash
npx vitest run packages/timeline/tests/normalize/claude.test.ts packages/timeline/tests/normalize/codex.test.ts packages/timeline/tests/write/session.test.ts plugins/timeline/tests/config/plugin.test.ts plugins/timeline/tests/runtime/claude-hook.test.ts plugins/timeline/tests/runtime/codex-hook.test.ts plugins/timeline/tests/runtime/ingest-cli.test.ts plugins/timeline/tests/opencode.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 2: Build the plugin**

```bash
cd plugins/timeline && npm run build
```

Expected: Build succeeds and `plugins/timeline/dist/ingest.mjs` exists.

- [ ] **Step 3: Validate Codex plugin manifest**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/ohmyc
python3 -m pip install --user PyYAML >/tmp/timeline-pyyaml-install.log 2>&1 || true
python3 /Volumes/ORICO/Users/jiangwei/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/timeline
```

Expected: `Plugin validation passed: /Volumes/ORICO/Users/jiangwei/projects/ohmyc/plugins/timeline`

- [ ] **Step 4: Validate all JSON files**

```bash
node -e "
const fs = require('fs')
for (const file of [
  '.agents/plugins/marketplace.json',
  'plugins/timeline/.codex-plugin/plugin.json',
  'plugins/timeline/.claude-plugin/plugin.json',
  'plugins/timeline/hooks.json',
  'plugins/timeline/hooks/hooks.json',
]) {
  JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log('OK', file)
}
"
```

Expected: `OK` for all five files.

- [ ] **Step 5: Reinstall Codex plugin from repo marketplace**

```bash
codex plugin marketplace add /Volumes/ORICO/Users/jiangwei/projects/ohmyc/.agents/plugins
codex plugin add timeline@ohmyc
codex plugin list | rg 'timeline|ohmyc'
```

Expected: `timeline` appears in the Codex plugin list. Start a new Codex thread before testing hook pickup, because Codex plugin capabilities and hooks are loaded at thread startup.

- [ ] **Step 6: Confirm no uncommitted files remain**

```bash
git status --short
```

Expected: no output. If there is output, return to the task that owns those files, apply the missing fix there, rerun Task 10, and use that task's commit command.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| One `plugins/timeline/` plugin supports Claude Code | Tasks 3, 8, 9 |
| One `plugins/timeline/` plugin supports OpenCode | Task 9 preserves and documents existing `opencode.ts`; Task 10 runs OpenCode tests |
| One `plugins/timeline/` plugin supports Codex | Tasks 1, 2, 3, 6, 7, 8, 10 |
| More files are acceptable when needed | File structure adds Codex manifest, root hook config, fixture, tests |
| Codex manifest validates | Tasks 1 and 10 |
| Codex transcript is not misparsed as Claude | Tasks 6, 7, 8 |
| Existing Claude behavior does not regress | Tasks 3, 4, 5, 8, 10 |
| Shared database writer remains the common output path | Tasks 5, 6, 7 |

### Placeholder Scan

No TBD, TODO, "implement later", "similar to", or vague "add tests" steps remain. Every code-changing task includes exact file paths, code snippets, commands, and expected results.

### Type Consistency

`ParseTranscriptOptions.agentName` is introduced in Task 5 and passed consistently through `parseTranscript`, `ingestSession`, and the plugin CLI. Codex parser returns the existing `ParsedSessionData` shape. `ingest-claude.sh` passes `--agent-name claude` on slow-path fallback, and `ingest-codex.sh` passes `--agent-name codex` on slow-path fallback; both fast paths emit `ParsedSessionData` JSON to `dist/ingest.mjs --raw`.
