# Timeline Ingest Bundling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `--ingest` + `--ingest-raw` (the Stop-hook hot path) out of `packages/cli/` and into `plugins/timeline/dist/ingest.mjs` so the Claude Code hook no longer depends on the external `ohmyc` binary being on PATH.

**Architecture:** New TypeScript entry at `plugins/timeline/src/ingest.ts` (cac-based, two modes — disk path or stdin raw JSON) bundled via tsup to `dist/ingest.mjs` with `better-sqlite3` external. `hooks/ingest.sh` swaps its `command -v ohmyc` lookup for direct `node "$CLAUDE_PLUGIN_ROOT/dist/ingest.mjs"` invocations. `packages/cli/` keeps `--install`, `--uninstall`, `--sync`, `--doctor`; loses the ingest flags.

**Tech Stack:** TypeScript, cac (argv parsing), better-sqlite3 (SQLite driver), tsup (bundler), vitest (tests), `@ohmyc/timeline` (shared ingest/writer).

**Spec:** [`docs/superpowers/specs/2026-06-07-timeline-ingest-bundle-design.md`](../specs/2026-06-07-timeline-ingest-bundle-design.md)

---

## File map

**Create:**
- `plugins/timeline/src/ingest.ts` — node entry, two modes
- `plugins/timeline/tsup.config.ts` — bundler config for the node entry
- `plugins/timeline/tests/ingest.node.test.ts` — unit tests for the node entry

**Modify:**
- `plugins/timeline/package.json` — add `better-sqlite3`/`@ohmyc/timeline`/`tsup` deps, extend `build` script
- `plugins/timeline/hooks/ingest.sh` — drop CLI lookup, call node directly
- `plugins/timeline/tests/ingest.sh.test.ts` — replace fake-CLI mock with fake-node-script mock
- `packages/cli/src/index.ts` — remove `--ingest`, `--session`, `--file`, `--ingest-raw` not-actually-declared
- `packages/cli/src/commands/dashboard.ts` — delete `runIngest`, `searchForTranscript`, `readDirRecursive`

**Delete:** (none — the CLI package stays, just slimmed)

---

## Task 1: Add tsup config + dependencies to the plugin

**Files:**
- Create: `plugins/timeline/tsup.config.ts`
- Modify: `plugins/timeline/package.json`

- [ ] **Step 1: Create the tsup config**

Write `plugins/timeline/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/ingest.ts'],
  format: ['esm'],
  splitting: false,
  clean: false,
  bundle: true,
  platform: 'node',
  target: 'node18',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: ['better-sqlite3'],
  noExternal: [/@[\w-]+\/[\w-]+/, 'cac'],
})
```

This mirrors `packages/cli/tsup.config.ts` exactly (the banner is required so the ESM bundle can `require` better-sqlite3's CJS native binding). `clean: false` so the existing bun bundle (`dist/opencode.js`) isn't wiped on every node rebuild.

- [ ] **Step 2: Update `plugins/timeline/package.json`**

Edit the file to add `dependencies`, extend `devDependencies`, and extend the `build` script. Resulting state:

```json
{
  "name": "@ohmyc/timeline-plugin",
  "version": "1.0.0",
  "type": "module",
  "files": ["dist", "hooks", "README.md"],
  "main": "dist/index.js",
  "scripts": {
    "build": "bun build opencode.ts --outfile dist/index.js --target bun --external bun:sqlite --external @opencode-ai/plugin && tsup",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@ohmyc/timeline": "workspace:*",
    "better-sqlite3": "^11.5.0",
    "cac": "^6.7.14"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.14.31"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.14.31",
    "@types/better-sqlite3": "^7.6.12",
    "@vitest/coverage-v8": "^3.2.4",
    "tsup": "^8.0.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 3: Install the new deps**

Run: `pnpm install --filter @ohmyc/timeline-plugin`
Expected: lockfile updates; `plugins/timeline/node_modules/better-sqlite3` exists with a prebuilt binary for the host OS.

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/tsup.config.ts plugins/timeline/package.json pnpm-lock.yaml
git commit -m "chore(plugin): scaffold tsup config and runtime deps for node ingest"
```

---

## Task 2: TDD — write failing test for Mode A (disk path)

**Files:**
- Create: `plugins/timeline/tests/ingest.node.test.ts`

- [ ] **Step 1: Write the failing test**

Create `plugins/timeline/tests/ingest.node.test.ts`:

```ts
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

const INGEST_MJS = path.resolve(import.meta.dirname, '../dist/ingest.mjs')

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
    const row = db.prepare('SELECT session_id, turns FROM sessions WHERE session_id = ?').get('session-aaa') as { session_id: string, turns: number } | undefined
    db.close()

    expect(row).toBeDefined()
    expect(row?.session_id).toBe('session-aaa')
    expect(row?.turns).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.node`
Expected: FAIL — `dist/ingest.mjs` does not exist yet (spawnSync returns ENOENT).

---

## Task 3: Implement Mode A (disk path)

**Files:**
- Create: `plugins/timeline/src/ingest.ts`

- [ ] **Step 1: Write the source**

Create `plugins/timeline/src/ingest.ts`:

```ts
#!/usr/bin/env node
// Timeline plugin ingest entry — Claude Code Stop-hook hot path.
// Replaces `ohmyc dashboard --ingest` and `--ingest-raw`.

import { cac } from 'cac'

import {
  closeDatabase,
  createWriter,
  ingestSession,
  openDatabase,
} from '@ohmyc/timeline'

import type { ParsedSessionData } from '@ohmyc/timeline'

const cli = cac('ohmyc-timeline-ingest')

cli
  .command('', 'Ingest a single session into the timeline DB')
  .option('--session-id <id>', 'Session UUID (disk-path mode)')
  .option('--transcript-path <path>', 'Path to JSONL transcript (disk-path mode)')
  .option('--raw', 'Read pre-parsed ParsedSessionData JSON from stdin')
  .action(async (options: { sessionId?: string, transcriptPath?: string, raw?: boolean }) => {
    if (options.raw) {
      await runRawMode()
      return
    }
    if (!options.sessionId || !options.transcriptPath) {
      console.error('error: --session-id and --transcript-path are required when --raw is not set')
      process.exit(1)
    }
    runDiskMode(options.sessionId, options.transcriptPath)
  })

cli.help()
cli.parse()

function runDiskMode(sessionId: string, transcriptPath: string): void {
  const db = openDatabase()
  try {
    ingestSession(db, sessionId, transcriptPath)
  } finally {
    closeDatabase(db)
  }
}

async function runRawMode(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    console.error('error: --raw expects JSON on stdin')
    process.exit(1)
  }
  let data: ParsedSessionData
  try {
    data = JSON.parse(raw) as ParsedSessionData
  } catch (parseError) {
    console.error(`error: invalid JSON on stdin: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    process.exit(1)
  }
  const db = openDatabase()
  try {
    createWriter(db).writeSession(data)
  } finally {
    closeDatabase(db)
  }
}
```

Notes:
- `openDatabase()` (from `@ohmyc/timeline`) reads `OHMYC_HOME` itself — no need to pass a path.
- The shebang is informational; the shell hook invokes via `node` explicitly so executability of the bundle isn't required.
- Disk mode is sync (matches `ingestSession`'s signature). Raw mode is async only because stdin is a stream.

- [ ] **Step 2: Build the bundle**

Run: `pnpm --filter @ohmyc/timeline-plugin build`
Expected: `dist/ingest.mjs` exists; no tsup errors.

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.node`
Expected: PASS — the `ingests from disk` test now writes a row into the temp DB.

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/src/ingest.ts plugins/timeline/tests/ingest.node.test.ts
git commit -m "feat(plugin): node ingest entry with disk-path mode"
```

---

## Task 4: TDD — write failing test for Mode B (raw stdin)

**Files:**
- Modify: `plugins/timeline/tests/ingest.node.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe('dist/ingest.mjs ...')` block, after the existing `it(...)`:

```ts
  it('ingests pre-parsed JSON from stdin via --raw', () => {
    const parsed = {
      sessionId: 'session-bbb',
      project: 'demo',
      agentName: 'claude',
      startedAt: 1714478400000,
      endedAt: 1714478405000,
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
    const row = db.prepare('SELECT session_id, project FROM sessions WHERE session_id = ?').get('session-bbb') as { session_id: string, project: string } | undefined
    db.close()

    expect(row?.session_id).toBe('session-bbb')
    expect(row?.project).toBe('demo')
  })
```

- [ ] **Step 2: Run the test to verify it passes immediately**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.node`
Expected: PASS — Mode B was implemented in Task 3 alongside Mode A. The test exists to lock in the contract for future changes.

If FAIL: implementation gap; re-check `runRawMode()` matches the field set the test sends.

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/tests/ingest.node.test.ts
git commit -m "test(plugin): cover --raw stdin mode of node ingest"
```

---

## Task 5: TDD — write failing tests for error paths

**Files:**
- Modify: `plugins/timeline/tests/ingest.node.test.ts`

- [ ] **Step 1: Add error-path tests**

Append inside the same `describe(...)` block:

```ts
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
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.node`
Expected: PASS — error paths were already implemented in Task 3.

If FAIL on the first assertion (missing args), the `.action()` handler isn't matching the option-naming kebab→camel conversion that cac performs. Double-check `--session-id` maps to `options.sessionId` (cac's default behavior).

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/tests/ingest.node.test.ts
git commit -m "test(plugin): cover error paths of node ingest"
```

---

## Task 6: Rewrite `hooks/ingest.sh` to call node directly

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh`

- [ ] **Step 1: Replace the file contents**

Overwrite `plugins/timeline/hooks/ingest.sh` with:

```bash
#!/bin/bash
# OhMyC Timeline Stop Hook — ingests Claude Code session transcripts.
# Calls the bundled node entry at $CLAUDE_PLUGIN_ROOT/dist/ingest.mjs.
# No external CLI binary required.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"

if [ -n "${OHMYC_HOME:-}" ]; then
  OHMYC_DIR="$OHMYC_HOME"
elif [ -d "$HOME/.config/ohmyc" ]; then
  OHMYC_DIR="$HOME/.config/ohmyc"
elif [ -d "$HOME/.cui" ]; then
  OHMYC_DIR="$HOME/.cui"
else
  OHMYC_DIR="$HOME/.config/ohmyc"
fi
export OHMYC_HOME="$OHMYC_DIR"

log_error() { echo "[timeline] $1" >&2; }
log_info()  { echo "[timeline] $1" >&2; }

# ---------------------------------------------------------------------------
# Resolve node
# ---------------------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  log_error "node not found on PATH. Cannot ingest session."
  exit 0
fi

if [ ! -f "$INGEST_MJS" ]; then
  log_error "ingest bundle not found at $INGEST_MJS (did you run \`pnpm --filter @ohmyc/timeline-plugin build\`?)"
  exit 0
fi

# ---------------------------------------------------------------------------
# Determine transcript path
# ---------------------------------------------------------------------------

if [ -n "${1:-}" ]; then
  SESSION_ID="$1"
  CLAUDE_HOME="${AGENT_HOME:-$HOME/.claude}"
  TRANSCRIPT_PATH=$(find "$CLAUDE_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "Transcript not found for session $SESSION_ID"
    exit 0
  fi
else
  HOOK_INPUT=$(cat)
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "No transcript path in hook input or file not found"
    exit 0
  fi

  SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)
fi

FILE_SIZE=$(stat -f%z "$TRANSCRIPT_PATH" 2>/dev/null || stat -c%s "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)

# ---------------------------------------------------------------------------
# Fast path: jq preprocessing → node --raw via stdin
# ---------------------------------------------------------------------------

if command -v jq >/dev/null 2>&1; then
  log_info "Using jq fast path for session $SESSION_ID"

  set +e
  EXTRACTED=$(jq -s '
    ($transcriptPath | split("/") | .[] | select(. == "projects") as $marker |
      ($transcriptPath | split("/") | index($marker)) as $idx |
      ($transcriptPath | split("/")[($idx + 1):][0]) as $encoded |
      if ($encoded | startswith("-"))
        then ("/" + ($encoded[1:] | gsub("-"; "/")))
        else ($encoded | gsub("-"; "/"))
      end) as $rawProject |
    (($rawProject | startswith($HOME)) as $isHome |
      if $isHome then ("~" + ($rawProject | ltrimstr($HOME))) else $rawProject end) as $project |

    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | min // (now * 1000)) as $startedAt |
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | max // (now * 1000)) as $endedAt |
    (map(select(.type == "user" and .message.role == "user" and (.message.content | type) == "string") | .message.content) | first) as $firstUserMessage |
    ([.[] | select(.type == "system" and .subtype == "away_summary") | .content] | last) as $awaySummary |

    {
      sessionId: $sessionId,
      project: $project,
      agentName: "claude",
      startedAt: $startedAt,
      endedAt: $endedAt,
      durationMs: ($endedAt - $startedAt),
      turns: ([.[] | select(.type == "user" and .message.role == "user" and (.message.content | type) == "string")] | length),
      tokensInput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.input_tokens // 0) | add) else (.input_tokens // 0) end] | add // 0),
      tokensOutput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.output_tokens // 0) | add) else (.output_tokens // 0) end] | add // 0),
      tokensCached: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) | add) else ((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) end] | add // 0),
      summary: (if $awaySummary then $awaySummary elif $firstUserMessage then (if ($firstUserMessage | length) > 140 then ($firstUserMessage[:140]) else $firstUserMessage end) else "(untitled session)" end),
      summarySource: (if $awaySummary then "auto" elif $firstUserMessage then "first_message" else "auto" end),
      transcriptPath: $transcriptPath,
      fileSize: ($fileSize | tonumber),
      tools: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use") | .name] | group_by(.) | map({toolName: .[0], callCount: length})),
      skills: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use" and .name == "Skill" and .input.skill) | .input.skill] | unique),
      model: ([.[] | select(.type == "assistant" and .message.model) | .message.model] | last // null)
    }
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" --arg HOME "$HOME" --arg fileSize "$FILE_SIZE" "$TRANSCRIPT_PATH" 2>/dev/null)
  JQ_STATUS=$?
  set -e

  if [ $JQ_STATUS -eq 0 ] && [ -n "$EXTRACTED" ] && [ "$EXTRACTED" != "null" ]; then
    echo "$EXTRACTED" | node "$INGEST_MJS" --raw && exit 0
    log_error "Fast path failed for $SESSION_ID, falling back to slow path"
  else
    log_error "jq extraction failed for $SESSION_ID, falling back to slow path"
  fi
fi

# ---------------------------------------------------------------------------
# Slow path: node parses JSONL itself
# ---------------------------------------------------------------------------

log_info "Using slow path for session $SESSION_ID"
node "$INGEST_MJS" --session-id "$SESSION_ID" --transcript-path "$TRANSCRIPT_PATH"
```

Key changes from the old script:
- Drops `CLI_CMD` resolution and the `command -v ohmyc / cui` chain
- Adds `command -v node` and existence check for `dist/ingest.mjs`
- Exports `OHMYC_HOME` (the node script reads it via `getDefaultDbPath`)
- jq fast-path pipes to `node "$INGEST_MJS" --raw` (was the broken `$CLI_CMD dashboard --ingest-raw`)
- Slow path calls `node "$INGEST_MJS" --session-id ... --transcript-path ...`
- `FILE_SIZE` is computed but no longer directly consumed by the slow path — the node parser re-stats the file. It's kept because the jq pipeline expects it as an `--arg`.

- [ ] **Step 2: Smoke-test the script manually**

Run from the repo root:

```bash
# Re-resolve a recent session
SID=$(ls ~/.claude/projects/*/*.jsonl 2>/dev/null | head -1 | xargs -I{} basename {} .jsonl)
TP=$(ls ~/.claude/projects/*/*.jsonl 2>/dev/null | head -1)

OHMYC_HOME=/tmp/ohmyc-smoke bash plugins/timeline/hooks/ingest.sh "$SID"
```

Expected:
- stderr shows `[timeline] Using jq fast path for session <SID>` (or slow path if jq is missing)
- stderr does NOT contain `ohmyc CLI not found`
- exit code 0
- `/tmp/ohmyc-smoke/timeline.db` exists with a row matching `$SID`

If you don't have a real transcript handy, skip this step — Task 7 covers it via the test suite.

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh
git commit -m "feat(plugin): hooks/ingest.sh calls bundled node entry, drops ohmyc PATH dep"
```

---

## Task 7: Update `tests/ingest.sh.test.ts` to mock the node bundle

**Files:**
- Modify: `plugins/timeline/tests/ingest.sh.test.ts`

The existing test mocks the `ohmyc` CLI by placing a fake bash script at the front of PATH. Now the hook calls `node "$INGEST_MJS"` directly, so we mock by replacing `dist/ingest.mjs` with a fake stub that captures stdin/args.

- [ ] **Step 1: Replace the `beforeEach` mock setup**

In `plugins/timeline/tests/ingest.sh.test.ts`, locate the existing `beforeEach` block (currently lines 64-75 — creates `fakeCli` at `$tmpDir/ohmyc`) and replace it with:

```ts
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ingest-sh-test-'))
    fakeClaudeDir = path.join(tmpDir, '.claude', 'projects', '-tmp-my-project')
    mkdirSync(fakeClaudeDir, { recursive: true })

    // The hook resolves the bundle as $PLUGIN_DIR/dist/ingest.mjs, where
    // $PLUGIN_DIR is the parent of hooks/. Override by copying the hook
    // script into a temp plugin dir and pointing its INGEST_MJS at a stub.
    const tempPluginDir = path.join(tmpDir, 'plugin')
    mkdirSync(path.join(tempPluginDir, 'hooks'), { recursive: true })
    mkdirSync(path.join(tempPluginDir, 'dist'), { recursive: true })

    // Copy the real shell hook into the temp plugin layout
    const realHook = readFileSync(path.resolve(import.meta.dirname, '../hooks/ingest.sh'), 'utf8')
    writeFileSync(path.join(tempPluginDir, 'hooks/ingest.sh'), realHook)
    chmodSync(path.join(tempPluginDir, 'hooks/ingest.sh'), 0o755)

    // Stub ingest.mjs: echo INGEST_RAW_OK on --raw, capture stdin to file
    capturePath = path.join(tmpDir, 'captured.json')
    const stub = `#!/usr/bin/env node\n`
      + `const { writeFileSync } = require('node:fs')\n`
      + `if (process.argv.includes('--raw')) {\n`
      + `  let buf = ''\n`
      + `  process.stdin.on('data', (c) => { buf += c })\n`
      + `  process.stdin.on('end', () => {\n`
      + `    writeFileSync(${JSON.stringify(capturePath)}, buf)\n`
      + `    console.log('INGEST_RAW_OK')\n`
      + `  })\n`
      + `} else {\n`
      + `  writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({ args: process.argv.slice(2) }))\n`
      + `  console.log('INGEST_SLOW_OK')\n`
      + `}\n`
    writeFileSync(path.join(tempPluginDir, 'dist/ingest.mjs'), stub)

    pluginHook = path.join(tempPluginDir, 'hooks/ingest.sh')
  })
```

Also update the file-level variable declarations (replace the `let fakeCli: string` line) and the `INGEST_SH` constant usage:

```ts
  let tmpDir: string
  let fakeClaudeDir: string
  let capturePath: string
  let pluginHook: string
```

Remove the `INGEST_SH` top-level constant; the hook now lives at `pluginHook` per-test.

Remove the `createCapturingCli()` and `readCaptured()` helpers (still used by some `describe('jq extraction')` blocks — replace them too):

```ts
  function readCaptured(): Record<string, unknown> {
    return JSON.parse(readFileSync(capturePath, 'utf8'))
  }
```

The `createCapturingCli()` helper goes away — the stub installed in `beforeEach` already captures.

Update `runIngest()` to use `pluginHook`:

```ts
  function runIngest(args: string[], opts?: { stdin?: string, env?: Record<string, string> }): { stdout: string, stderr: string, status: number | null } {
    const env = {
      ...process.env,
      AGENT_HOME: path.join(tmpDir, '.claude'),
      OHMYC_HOME: path.join(tmpDir, '.ohmyc-data'),
      ...opts?.env,
    }
    const result = spawnSync('bash', [pluginHook, ...args], {
      env,
      input: opts?.stdin,
      encoding: 'utf8',
    })
    return { stdout: result.stdout, stderr: result.stderr, status: result.status }
  }
```

(PATH override and fake-CLI plumbing is gone.)

- [ ] **Step 2: Update the assertion strings**

Within the test bodies, find every:

```
expect(result.stdout).toContain('INGEST_RAW_OK')
```

— and leave it. The stub still emits that string.

For tests that previously asserted on `FAKE_CLI: ...` output, change to assert on `readCaptured()` behavior or `INGEST_SLOW_OK`.

- [ ] **Step 3: Run the suite**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.sh`
Expected: PASS — all existing fast-path and slow-path tests now exercise the new hook + node stub.

If FAIL: most likely the stub script's `process.stdin.on('end', ...)` never fires because `set -euo pipefail` caused early exit. Diagnose by adding `set -x` at the top of the temp hook and re-running once.

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/tests/ingest.sh.test.ts
git commit -m "test(plugin): rework ingest.sh tests to mock node bundle instead of ohmyc CLI"
```

---

## Task 8: Remove ingest flags from `packages/cli/src/index.ts`

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Replace the file contents**

Overwrite `packages/cli/src/index.ts` with:

```ts
#!/usr/bin/env node
// CLI entry point — install/uninstall/sync/doctor for the timeline plugin.
// Session ingest moved into plugins/timeline/dist/ingest.mjs (called by the
// Stop hook directly); this binary no longer participates in the hot path.
import { cac } from 'cac'

import {
  runDoctor,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
import { logger } from './logger'

const cli = cac('ohmyc')

cli
  .command('dashboard', 'Manage Timeline dashboard install and data')
  .option('--install', 'Install the timeline plugin and run initial backfill')
  .option('--uninstall', 'Remove the timeline plugin (preserves database)')
  .option('--sync', 'Scan all transcripts and import missing sessions')
  .option('--doctor', 'Diagnose plugin, hooks, and database health')
  .action(async (options) => {
    try {
      if (options.install) {
        await runInstall()
      } else if (options.uninstall) {
        await runUninstall()
      } else if (options.sync) {
        await runSync()
      } else if (options.doctor) {
        await runDoctor()
      } else {
        logger.info('No action specified. Use one of: --install, --uninstall, --sync, --doctor')
        cli.outputHelp()
        process.exit(1)
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli.help()
cli.version('0.1.0')
cli.parse()
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @ohmyc/cli build`
Expected: tsup output succeeds; `dist/index.mjs` is regenerated; no references to `runIngest` (the dashboard module still exports it but nothing imports it — that's cleaned up in Task 9).

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "refactor(cli): drop --ingest/--session/--file (moved to plugin bundle)"
```

---

## Task 9: Delete `runIngest` + helpers from `dashboard.ts`

**Files:**
- Modify: `packages/cli/src/commands/dashboard.ts`

- [ ] **Step 1: Remove the dead exports**

Open `packages/cli/src/commands/dashboard.ts`. Delete the following spans (current state):

1. The "runIngest" section at lines 175-212 — the entire `export async function runIngest(...)` function and the comment header above it.
2. The `searchForTranscript` helper at lines 214-223.
3. The `readDirRecursive` helper at lines 225-242.

Also clean up unused imports at the top of the file. After deletion, the only `node:fs` imports needed are `existsSync`, `mkdirSync`, `readFileSync`, `writeFileSync` (used by registry helpers). Remove `readdirSync` since it was only used by `readDirRecursive`. From `@ohmyc/timeline`, drop `getDefaultProjectsDir` and `ingestSession` (only used by `runIngest`); keep `backfillAll`, `closeDatabase`, `getStatus`, `openDatabase`.

Resulting import block:

```ts
import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  backfillAll,
  closeDatabase,
  getStatus,
  openDatabase,
} from '@ohmyc/timeline'

import { logger } from '../logger'

import type { PluginInstall } from '@ohmyc/shared'
import type Database from 'better-sqlite3'
```

- [ ] **Step 2: Build and run CLI tests**

Run: `pnpm --filter @ohmyc/cli build && pnpm --filter @ohmyc/cli test`
Expected: build succeeds; tests pass (slice 8 left `vitest.config.ts` with `passWithNoTests: true`, so an empty suite is OK).

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/dashboard.ts
git commit -m "refactor(cli): drop runIngest and transcript-search helpers"
```

---

## Task 10: Final verification

**Files:** (none — pure validation)

- [ ] **Step 1: Rebuild everything**

Run: `pnpm -r build`
Expected: clean build of all workspaces. Critical outputs:
- `plugins/timeline/dist/opencode.js` (bun bundle, unchanged)
- `plugins/timeline/dist/ingest.mjs` (new node bundle)
- `packages/cli/dist/index.mjs` (slimmed CLI; the post-build hook copies `plugins/timeline/dist/` into `packages/cli/dist/plugins/timeline/`)

- [ ] **Step 2: Run all tests**

Run: `pnpm -r test`
Expected: all workspaces pass. Particularly:
- `plugins/timeline` — `ingest.node.test.ts` + `ingest.sh.test.ts` + existing `opencode.test.ts` all green
- `packages/cli` — passes (no tests left, `passWithNoTests` honored)
- `packages/timeline` — unchanged, passes

- [ ] **Step 3: Confirm the Stop-hook path is bun-free for Claude users**

Run: `grep -n 'bun\|ohmyc' plugins/timeline/hooks/ingest.sh`
Expected output: zero lines mentioning `bun`; zero lines mentioning `ohmyc` outside the `OHMYC_HOME` env var and the `~/.config/ohmyc` path resolution.

- [ ] **Step 4: Confirm `packages/cli/` no longer participates in the hot path**

Run: `grep -rn 'packages/cli\|ohmyc dashboard --ingest\|@ohmyc/cli' plugins/timeline/`
Expected output: zero matches.

- [ ] **Step 5: Commit the lockfile if it moved**

```bash
git status pnpm-lock.yaml
# if dirty:
git add pnpm-lock.yaml && git commit -m "chore: refresh lockfile after plugin dep additions"
```

---

## Self-review notes

Walked the spec → plan mapping after drafting:

| Spec requirement | Plan task |
|---|---|
| New `src/ingest.ts`, two modes | Tasks 2–5 |
| New `dist/ingest.mjs` bundle | Tasks 1, 3 |
| `hooks/ingest.sh` simplified | Task 6 |
| jq fast-path resurrected (`--raw` actually works) | Task 6 (calls `--raw`) + Task 4 (verifies) |
| `packages/cli/` slimmed (drop `--ingest`/`--session`/`--file` + `runIngest`) | Tasks 8, 9 |
| Plugin tests cover both modes + errors | Tasks 2, 4, 5 |
| `hooks/ingest.sh` integration tests adjusted | Task 7 |
| No bun requirement on Claude side | Task 10 step 3 |

No placeholders. Function names consistent across tasks (`runDiskMode`, `runRawMode`, the cac options `sessionId`/`transcriptPath`/`raw`). No code blocks deferred to "later". File-paths are absolute repo-relative.
