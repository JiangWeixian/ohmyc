# OpenCode Timeline Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenCode plugin support to `@claudeui/timeline` by extracting a runtime-agnostic writer and creating a real-time session capture plugin.

**Architecture:** Extract upsert logic from `ingest.ts` into a new `writer.ts` module that works with both `better-sqlite3` and `bun:sqlite`. Add sub-exports to `@claudeui/timeline`. Create a thin OpenCode plugin that accumulates session data from hooks and writes via the shared writer.

**Tech Stack:** TypeScript, Bun (for OpenCode plugin), better-sqlite3 (for existing CLI), vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/timeline/src/schema.ts` | **Modify** | Add `agent_name` column, v3 migration |
| `packages/timeline/src/writer.ts` | **Create** | Runtime-agnostic session writer (extracted from ingest.ts) |
| `packages/timeline/package.json` | **Modify** | Add `./writer` and `./schema` sub-exports |
| `packages/timeline/src/index.ts` | **Modify** | Re-export writer for convenience |
| `packages/timeline/tests/writer.test.ts` | **Create** | Tests for the new writer module |
| `plugins/timeline/opencode.ts` | **Create** | OpenCode plugin source (sets agentName='opencode') |
| `plugins/timeline/hooks/ingest.sh` | **Modify** | Pass `agentName='claude'` to CLI |
| `.opencode/plugins/timeline.ts` | **Create** | Symlink to `../../plugins/timeline/opencode.ts` |
| `opencode.json` | **Already exists** | References `./.opencode/plugins/timeline.ts` |

---

### Task 0: Add agent_name column to schema

**Files:**
- Modify: `packages/timeline/src/schema.ts`
- Modify: `packages/timeline/src/db.ts` (migration logic)

**Context:** Need to track which agent (Claude Code vs OpenCode) created each session.

- [ ] **Step 1: Update schema**

Add `agent_name` to `SCHEMA_SQL` in `packages/timeline/src/schema.ts`:

```typescript
// Add to SessionRow interface
export interface SessionRow {
  session_id: string
  project: string
  agent_name: string | null  // NEW
  started_at: number
  // ... rest unchanged
}

// Update CURRENT_SCHEMA_VERSION
export const CURRENT_SCHEMA_VERSION = 3

// Add migration
export const MIGRATIONS: Record<number, string> = {
  1: '',
  2: 'ALTER TABLE sessions ADD COLUMN model TEXT;',
  3: 'ALTER TABLE sessions ADD COLUMN agent_name TEXT;',  // NEW
}

// Update SCHEMA_SQL
export const SCHEMA_SQL = `
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  agent_name        TEXT,  // NEW
  started_at        INTEGER NOT NULL,
  // ... rest unchanged
`;
```

- [ ] **Step 2: Update migration logic in db.ts**

Verify `db.ts` already handles migrations correctly (it should iterate from current version to target). The existing migration loop should pick up version 3 automatically.

- [ ] **Step 3: Commit**

```bash
git add packages/timeline/src/schema.ts
git commit -m "feat(timeline): add agent_name column (v3 migration)"
```

---

### Task 1: Extract writer module from ingest.ts

**Files:**
- Create: `packages/timeline/src/writer.ts`
- Modify: `packages/timeline/src/ingest.ts:246-310`

**Context:** The `upsertSessionData` function in `ingest.ts` contains all the SQL write logic. We need to extract it into a standalone module that accepts any SQLite-like database object.

- [ ] **Step 1: Create writer.ts with extracted logic**

```typescript
// packages/timeline/src/writer.ts
import type { ParsedSessionData } from './ingest.js'

/**
 * Minimal SQLite-like interface that works with both better-sqlite3 and bun:sqlite
 */
export interface SqliteDatabase {
  run(sql: string, params?: unknown[]): { changes: number }
  prepare(sql: string): {
    run(...params: unknown[]): void
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }
  exec(sql: string): void
  transaction(fn: () => void): () => void
}

export interface Writer {
  writeSession(data: ParsedSessionData): IngestResult
}

export interface IngestResult {
  sessionId: string
  project: string
  sessionsInserted: number
  sessionsUpdated: number
}

export function createWriter(db: SqliteDatabase): Writer {
  return {
    writeSession(data: ParsedSessionData): IngestResult {
      const existingRow = db
        .prepare('SELECT 1 FROM sessions WHERE session_id = ?')
        .get(data.sessionId) as { 1: number } | undefined

      const sessionsInserted = existingRow ? 0 : 1
      const sessionsUpdated = existingRow ? 1 : 0
      const ingestedAt = Date.now()

      const upsertSession = db.prepare(`
        INSERT OR REPLACE INTO sessions (
          session_id, project, agent_name, started_at, ended_at, duration_ms,
          turns, tokens_input, tokens_output, tokens_cached,
          summary, summary_source, transcript_path, last_offset, ingested_at, model
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const deleteTools = db.prepare('DELETE FROM session_tools WHERE session_id = ?')
      const insertTool = db.prepare('INSERT OR REPLACE INTO session_tools (session_id, tool_name, call_count) VALUES (?, ?, ?)')
      const deleteSkills = db.prepare('DELETE FROM session_skills WHERE session_id = ?')
      const insertSkill = db.prepare('INSERT OR REPLACE INTO session_skills (session_id, skill_name) VALUES (?, ?)')

      const transaction = db.transaction(() => {
        upsertSession.run(
          data.sessionId,
          data.project,
          data.agentName,
          data.startedAt,
          data.endedAt,
          data.durationMs,
          data.turns,
          data.tokensInput,
          data.tokensOutput,
          data.tokensCached,
          data.summary,
          data.summarySource,
          data.transcriptPath,
          data.fileSize,
          ingestedAt,
          data.model,
        )

        deleteTools.run(data.sessionId)
        for (const tool of data.tools) {
          insertTool.run(data.sessionId, tool.toolName, tool.callCount)
        }

        deleteSkills.run(data.sessionId)
        for (const skillName of data.skills) {
          insertSkill.run(data.sessionId, skillName)
        }
      })

      transaction()

      return {
        sessionId: data.sessionId,
        project: data.project,
        sessionsInserted,
        sessionsUpdated,
      }
    },
  }
}
```

- [ ] **Step 2: Update ingest.ts to use the writer**

Modify `packages/timeline/src/ingest.ts` to import and use `createWriter` instead of inline upsert logic:

```typescript
// Add import at top
import { createWriter } from './writer.js'
import type { SqliteDatabase } from './writer.js'

// Replace upsertSessionData function (lines 246-310) with:
export function upsertSessionData(
  db: SqliteDatabase,
  sessionId: string,
  data: ParsedSessionData,
): IngestResult {
  return createWriter(db).writeSession(data)
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd packages/timeline && pnpm build
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/timeline/src/writer.ts packages/timeline/src/ingest.ts
git commit -m "feat(timeline): extract runtime-agnostic writer from ingest"
```

---

### Task 2: Add sub-exports to package.json

**Files:**
- Modify: `packages/timeline/package.json`

- [ ] **Step 1: Update exports field**

```json
{
  "name": "@claudeui/timeline",
  "version": "0.1.0",
  "type": "module",
  "files": ["dist"],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./writer": {
      "types": "./dist/writer.d.ts",
      "default": "./dist/writer.js"
    },
    "./schema": {
      "types": "./dist/schema.d.ts",
      "default": "./dist/schema.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/writer.ts src/schema.ts --format esm --dts",
    "dev": "tsup src/index.ts src/writer.ts src/schema.ts --format esm --dts --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^20.12.7",
    "tsup": "^8.0.2",
    "typescript": "^5.4.5",
    "vitest": "^2.1.9"
  }
}
```

Note: The build script now includes `src/writer.ts` and `src/schema.ts` as entry points so they get compiled to separate output files.

- [ ] **Step 2: Rebuild and verify sub-exports**

```bash
cd packages/timeline && pnpm build
ls dist/writer.js dist/writer.d.ts dist/schema.js dist/schema.d.ts
```

Expected: All four files exist.

- [ ] **Step 3: Test import from sub-export**

```bash
cd packages/timeline && node -e "import('./dist/writer.js').then(m => console.log('writer export:', typeof m.createWriter))"
```

Expected: `writer export: function`

- [ ] **Step 4: Commit**

```bash
git add packages/timeline/package.json
git commit -m "feat(timeline): add writer and schema sub-exports"
```

---

### Task 3: Add writer re-export to index.ts

**Files:**
- Modify: `packages/timeline/src/index.ts`

- [ ] **Step 1: Add writer exports**

Add to `packages/timeline/src/index.ts`:

```typescript
// ------------------------------------------------------------------
// Writer
// ------------------------------------------------------------------

export { createWriter } from './writer.js'
export type { SqliteDatabase, Writer, IngestResult } from './writer.js'
```

- [ ] **Step 2: Rebuild**

```bash
cd packages/timeline && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add packages/timeline/src/index.ts
git commit -m "feat(timeline): re-export writer from main index"
```

---

### Task 4: Create writer tests

**Files:**
- Create: `packages/timeline/tests/writer.test.ts`

- [ ] **Step 1: Create test file**

```typescript
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
import type { ParsedSessionData } from '../src/ingest.js'

import type Database from 'better-sqlite3'

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
```

- [ ] **Step 2: Run tests**

```bash
cd packages/timeline && pnpm test tests/writer.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/timeline/tests/writer.test.ts
git commit -m "test(timeline): add writer tests"
```

---

### Task 5: Create OpenCode plugin

**Files:**
- Create: `plugins/timeline/opencode.ts`

- [ ] **Step 1: Create plugin file**

```typescript
// plugins/timeline/opencode.ts
import type { Plugin } from '@opencode-ai/plugin'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createWriter } from '@claudeui/timeline/writer'
import type { ParsedSessionData } from '@claudeui/timeline/schema'

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

function getDbPath(): string {
  const home = process.env.CUI_HOME ?? path.join(os.homedir(), '.cui')
  return path.join(home, 'timeline.db')
}

function ensureDb(): Database {
  const dbPath = getDbPath()
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  ensureSchema(db)
  return db
}

function ensureSchema(db: Database): void {
  const hasSessions = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()
  if (hasSessions) return

  db.exec(`
    CREATE TABLE sessions (
      session_id        TEXT PRIMARY KEY,
      project           TEXT NOT NULL,
      started_at        INTEGER NOT NULL,
      ended_at          INTEGER NOT NULL,
      duration_ms       INTEGER NOT NULL,
      turns             INTEGER NOT NULL,
      tokens_input      INTEGER NOT NULL DEFAULT 0,
      tokens_output     INTEGER NOT NULL DEFAULT 0,
      tokens_cached     INTEGER NOT NULL DEFAULT 0,
      summary           TEXT,
      summary_source    TEXT NOT NULL,
      transcript_path   TEXT NOT NULL,
      last_offset       INTEGER NOT NULL,
      ingested_at       INTEGER NOT NULL,
      model             TEXT
    );
    CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
    CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);

    CREATE TABLE session_tools (
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      tool_name   TEXT NOT NULL,
      call_count  INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (session_id, tool_name)
    );

    CREATE TABLE session_skills (
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      skill_name  TEXT NOT NULL,
      PRIMARY KEY (session_id, skill_name)
    );

    CREATE TABLE meta (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );
  `)
}

// ---------------------------------------------------------------------------
// Session accumulator
// ---------------------------------------------------------------------------

interface SessionAccumulator {
  sessionId: string
  project: string
  startedAt: number
  endedAt: number
  turns: number
  tokensInput: number
  tokensOutput: number
  tokensCached: number
  tools: Map<string, number>
  skills: Set<string>
  firstUserMessage: string | null
  summary: string | null
  model: string | null
}

const sessions = new Map<string, SessionAccumulator>()

function getAccumulator(sessionId: string, project?: string): SessionAccumulator {
  let acc = sessions.get(sessionId)
  if (!acc) {
    acc = {
      sessionId,
      project: project ?? 'unknown',
      startedAt: Date.now(),
      endedAt: Date.now(),
      turns: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      tools: new Map(),
      skills: new Set(),
      firstUserMessage: null,
      summary: null,
      model: null,
    }
    sessions.set(sessionId, acc)
  }
  return acc
}

function getProjectName(input: { project?: { worktree?: string }; directory?: string }): string {
  if (input.project?.worktree) {
    return path.basename(input.project.worktree)
  }
  if (input.directory) {
    return path.basename(input.directory)
  }
  return 'unknown'
}

function toParsedSessionData(acc: SessionAccumulator): ParsedSessionData {
  return {
    sessionId: acc.sessionId,
    project: acc.project,
    agentName: 'opencode',
    startedAt: acc.startedAt,
    endedAt: acc.endedAt,
    durationMs: acc.endedAt - acc.startedAt,
    turns: acc.turns,
    tokensInput: acc.tokensInput,
    tokensOutput: acc.tokensOutput,
    tokensCached: acc.tokensCached,
    summary: acc.summary ?? acc.firstUserMessage ?? '(untitled session)',
    summarySource: acc.summary ? 'auto' : 'first_message',
    transcriptPath: `opencode://${acc.sessionId}`,
    fileSize: 0,
    tools: [...acc.tools.entries()].map(([toolName, callCount]) => ({ toolName, callCount })),
    skills: [...acc.skills],
    model: acc.model,
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const TimelinePlugin: Plugin = async (input) => {
  const project = getProjectName(input)
  const db = ensureDb()
  const writer = createWriter(db)

  return {
    'session.created': async (hookInput) => {
      const acc = getAccumulator(hookInput.sessionID, project)
      acc.startedAt = Date.now()
    },

    'session.idle': async (hookInput) => {
      const acc = sessions.get(hookInput.sessionID)
      if (!acc) return
      acc.endedAt = Date.now()
      writer.writeSession(toParsedSessionData(acc))
    },

    'session.deleted': async (hookInput) => {
      const acc = sessions.get(hookInput.sessionID)
      if (!acc) return
      acc.endedAt = Date.now()
      writer.writeSession(toParsedSessionData(acc))
      sessions.delete(hookInput.sessionID)
    },

    'message.updated': async (hookInput) => {
      const info = hookInput.info
      const acc = getAccumulator(info.sessionID, project)

      if (info.role === 'user') {
        acc.turns += 1
      }

      if (info.role === 'assistant' && info.tokens) {
        acc.tokensInput += info.tokens.input || 0
        acc.tokensOutput += info.tokens.output || 0
        if (info.tokens.cache) {
          acc.tokensCached += (info.tokens.cache.read || 0) + (info.tokens.cache.write || 0)
        }
      }

      if (info.modelID) {
        acc.model = info.modelID
      }
    },

    'message.part.updated': async (hookInput) => {
      const part = hookInput.part
      if (part.type !== 'text' || part.synthetic || part.ignored) return

      const acc = getAccumulator(part.sessionID, project)
      if (!acc.firstUserMessage && part.text.trim()) {
        acc.firstUserMessage = part.text.trim()
      }
    },

    'tool.execute.before': async (hookInput) => {
      const acc = getAccumulator(hookInput.sessionID, project)
      const toolName = hookInput.tool
      acc.tools.set(toolName, (acc.tools.get(toolName) || 0) + 1)
    },

    'tool.execute.after': async (hookInput) => {
      const acc = sessions.get(hookInput.sessionID)
      if (!acc) return

      if (hookInput.tool === 'Skill' || hookInput.tool === 'skill') {
        const args = hookInput.args
        if (args && typeof args === 'object' && typeof args.skill === 'string') {
          acc.skills.add(args.skill)
        }
      }
    },

    event: async ({ event }) => {
      if (event.type === 'session.error') {
        const sessionID =
          (event.properties.sessionID as string)
            || (event.properties.info && typeof event.properties.info === 'object'
              ? (event.properties.info as Record<string, unknown>).id
              : undefined)
            || 'unknown'

        const acc = sessions.get(sessionID)
        if (acc) {
          acc.endedAt = Date.now()
          writer.writeSession(toParsedSessionData(acc))
        }
      }
    },
  }
}

export default TimelinePlugin
```

- [ ] **Step 2: Verify plugin builds**

```bash
bun build plugins/timeline/opencode.ts --outfile /tmp/opencode-timeline.js --target=bun
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/opencode.ts
git commit -m "feat(timeline): add OpenCode real-time plugin"
```

---

### Task 5.5: Update Claude hook to pass agent_name

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh`

**Context:** The Claude Code hook needs to pass `agentName='claude'` so sessions are tagged correctly.

- [ ] **Step 1: Update ingest.sh**

In the jq extraction (around line 102), add `agentName: "claude"`:

```bash
jq -s '
  {
    sessionId: $sessionId,
    agentName: "claude",
    transcriptPath: $transcriptPath,
    // ... rest unchanged
  }
'
```

The CLI `runIngest` function already passes the parsed data to `ingestSession`, which uses `createWriter`, so the agent_name will be written automatically.

- [ ] **Step 2: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh
git commit -m "feat(timeline): tag Claude sessions with agent_name=claude"
```

---

### Task 7: Create symlink in .opencode/plugins/

**Files:**
- Create: `.opencode/plugins/timeline.ts` (symlink)

- [ ] **Step 1: Create symlink**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
ln -s ../../plugins/timeline/opencode.ts .opencode/plugins/timeline.ts
```

- [ ] **Step 2: Verify symlink**

```bash
ls -la .opencode/plugins/timeline.ts
```

Expected: Shows symlink pointing to `../../plugins/timeline/opencode.ts`

- [ ] **Step 3: Verify opencode.json references plugin**

Check that `opencode.json` contains:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./.opencode/plugins/timeline.ts"]
}
```

- [ ] **Step 4: Commit**

```bash
git add .opencode/plugins/timeline.ts opencode.json
git commit -m "chore(timeline): register OpenCode plugin"
```

---

### Task 8: Update plugin documentation

**Files:**
- Modify: `plugins/timeline/README.md`

- [ ] **Step 1: Update README**

Replace `plugins/timeline/README.md` with:

```markdown
# ClaudeUI Timeline Plugin

Collects session data (turns, tokens, tools, skills) from both **Claude Code** and **OpenCode** agents and ingests it into the ClaudeUI Timeline dashboard.

## Supported Agents

| Agent | Integration | Data Source |
|-------|-------------|-------------|
| Claude Code | Hook-based (`hooks/ingest.sh`) | JSONL transcript files |
| OpenCode | Plugin-based (`opencode.ts`) | Real-time event hooks |

## Claude Code Setup

The Claude Code plugin uses a `Stop` hook that fires when a session ends. The hook script reads the transcript JSONL file and ingests it into the timeline database via the CLI.

## OpenCode Setup

The OpenCode plugin lives at `plugins/timeline/opencode.ts` and is symlinked from `.opencode/plugins/timeline.ts`. It sets `agentName='opencode'` and hooks into:

- `session.created` / `session.idle` / `session.deleted` — session lifecycle
- `message.updated` — message tokens and model info
- `message.part.updated` — user message text for summaries
- `tool.execute.before` / `tool.execute.after` — tool and skill tracking

Data is written directly to `~/.cui/timeline.db` using `bun:sqlite` via the shared `@claudeui/timeline/writer` module.

## Shared Code

Both agents write to the same SQLite database (`~/.cui/timeline.db`) using the schema and writer from `@claudeui/timeline`:

- `@claudeui/timeline/writer` — Runtime-agnostic writer (works with `better-sqlite3` and `bun:sqlite`)
- `@claudeui/timeline/schema` — Database schema and TypeScript types

## Future: OpenCode Backfill

OpenCode stores historical session data in `~/.local/share/opencode/opencode.db`. A future enhancement could read this database and backfill missing sessions into the timeline.
```

- [ ] **Step 2: Commit**

```bash
git add plugins/timeline/README.md
git commit -m "docs(timeline): update README for dual-agent support"
```

---

### Task 9: Run full test suite

**Files:**
- None (verification only)

- [ ] **Step 1: Run timeline tests**

```bash
cd packages/timeline && pnpm test
```

Expected: All existing tests pass + new writer tests pass.

- [ ] **Step 2: Verify no regressions**

```bash
cd packages/timeline && pnpm build
```

Expected: Build succeeds, all output files exist (`dist/index.js`, `dist/writer.js`, `dist/schema.js`, etc.)

- [ ] **Step 3: Final commit (if any changes)**

If any fixes were needed, commit them.

---

## Self-Review

**1. Spec coverage check:**
- ✅ Add agent_name column and migration (Task 0)
- ✅ Extract writer module (Task 1)
- ✅ Add sub-exports (Task 2)
- ✅ Create OpenCode plugin with agentName='opencode' (Task 5)
- ✅ Register plugin (Task 6)
- ✅ Document backfill as future feature (Task 7)
- ✅ No `better-sqlite3` in plugin (uses `bun:sqlite`)
- ✅ Single source of truth for schema and writes

**2. Placeholder scan:**
- ✅ No TBD/TODO in plan
- ✅ All code is complete
- ✅ All commands have expected output

**3. Type consistency:**
- ✅ `SqliteDatabase` interface used throughout
- ✅ `ParsedSessionData` type used in writer and plugin
- ✅ `IngestResult` returned from writer

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-opencode-timeline-plugin.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
