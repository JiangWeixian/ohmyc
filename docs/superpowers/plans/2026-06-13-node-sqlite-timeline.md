# Node SQLite Timeline Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Timeline's Node-side `better-sqlite3` dependency with Node 22's built-in `node:sqlite`, while keeping OpenCode on `bun:sqlite`.

**Architecture:** Keep the existing `SqliteDatabase` abstraction and move all Node-specific driver code into a small `node:sqlite` adapter used by `packages/timeline/src/db.ts` and the plugin ingest bundle. Query, ingest, backfill, migration, and writer code should depend on the shared SQLite-like interface rather than a concrete driver.

**Tech Stack:** TypeScript, Node 22 `node:sqlite`, Bun `bun:sqlite` for OpenCode, tsup, Vitest, pnpm workspaces.

---

## File Structure

- Create `packages/timeline/src/node-sqlite.ts` — adapts Node 22 `DatabaseSync` to the existing `SqliteDatabase` interface.
- Modify `packages/timeline/src/db.ts` — open/close Timeline DBs with `node:sqlite`, keep public `openDatabase()`, `closeDatabase()`, and migration exports.
- Modify `packages/timeline/src/{ingest,query,backfill,writer}.ts` — remove `better-sqlite3` type coupling and update comments.
- Modify `packages/timeline/tests/storage/db.test.ts` — verify PRAGMAs through standard prepared statements, not `better-sqlite3`'s `.pragma()`.
- Modify package and plugin tests that read DBs directly — use `openDatabase()` or Node sqlite wrapper instead of importing `better-sqlite3`.
- Modify `plugins/timeline/src/ingest.ts` — call `openDatabase()` from `@ohmyc/timeline`, removing the dynamic `better-sqlite3` fallback.
- Modify package manifests and tsup configs — remove `better-sqlite3`, remove `@types/better-sqlite3`, set Node 22 build/runtime targets.
- Modify active docs — update references that describe current runtime dependencies.
- Keep `plugins/timeline/opencode.ts` unchanged except comments if needed; it remains `bun:sqlite`.

## Task 1: Add Dependency Boundary Tests

**Files:**
- Create temporarily: `packages/timeline/tests/config/dependency-boundary.test.ts`
- Modify: `plugins/timeline/tests/config/plugin.test.ts`

- [ ] **Step 1: Write the failing dependency-boundary test**

Create `packages/timeline/tests/config/dependency-boundary.test.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')

function readJson(relativePath: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8')) as Record<string, any>
}

describe('Timeline SQLite dependency boundary', () => {
  it('does not import better-sqlite3 from active source or tests', () => {
    let output = ''
    try {
      output = execFileSync(
        'rg',
        [
          '-n',
          'better-sqlite3',
          'packages',
          'plugins/timeline',
          '-g',
          '*.ts',
          '-g',
          '*.json',
          '-g',
          '!dist/**',
          '-g',
          '!node_modules/**',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf8',
        },
      )
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 1) {
        output = ''
      } else {
        throw error
      }
    }

    expect(output.trim()).toBe('')
  })

  it('declares Node 22 for Node-side packages', () => {
    const root = readJson('package.json')
    const timeline = readJson('packages/timeline/package.json')
    const cli = readJson('packages/cli/package.json')
    const plugin = readJson('plugins/timeline/package.json')

    expect(root.engines?.node).toBe('>=22')
    expect(timeline.engines?.node).toBe('>=22')
    expect(cli.engines?.node).toBe('>=22')
    expect(plugin.engines?.node).toBe('>=22')
  })
})
```

- [ ] **Step 2: Tighten the plugin boundary test**

In `plugins/timeline/tests/config/plugin.test.ts`, update the `ingest CLI package boundaries` test to require `openDatabase()` and forbid the old fallback:

```ts
describe('ingest CLI package boundaries', () => {
  it('uses @ohmyc/timeline public APIs and does not import better-sqlite3', () => {
    const source = readFileSync(path.resolve(import.meta.dirname, '../../src/ingest.ts'), 'utf8')

    expect(source).toContain('from \'@ohmyc/timeline\'')
    expect(source).toContain('from \'@ohmyc/timeline/ingest\'')
    expect(source).toContain('from \'@ohmyc/timeline/writer\'')
    expect(source).not.toContain('@ohmyc/timeline/migrate')
    expect(source).not.toContain('../../../packages/timeline/src')
    expect(source).not.toContain('better-sqlite3')
    expect(source).not.toContain('node:${\'sqlite\'}')
  })
})
```

- [ ] **Step 3: Run the boundary tests to verify they fail**

Run:

```bash
pnpm --filter @ohmyc/timeline test -- tests/config/dependency-boundary.test.ts --reporter=verbose
pnpm --filter @ohmyc/timeline-plugin test -- tests/config/plugin.test.ts --reporter=verbose
```

Expected:

- `dependency-boundary.test.ts` fails because active files still reference `better-sqlite3` and `engines.node` is absent.
- `plugin.test.ts` fails because `plugins/timeline/src/ingest.ts` still contains the dynamic `better-sqlite3` fallback.

- [ ] **Step 4: Commit the failing tests**

```bash
git add packages/timeline/tests/config/dependency-boundary.test.ts plugins/timeline/tests/config/plugin.test.ts
git commit -m "test(timeline): pin node sqlite dependency boundary"
```

This test is a migration scaffold. It should be deleted in Task 7 after the dependency cleanup is complete and the final `rg` verification passes.

## Task 2: Add the Node SQLite Adapter

**Files:**
- Create: `packages/timeline/src/node-sqlite.ts`
- Modify: `packages/timeline/src/db.ts`
- Modify: `packages/timeline/src/writer.ts`
- Test: `packages/timeline/tests/storage/db.test.ts`

- [ ] **Step 1: Write the failing DB behavior updates**

In `packages/timeline/tests/storage/db.test.ts`, remove:

```ts
import Database from 'better-sqlite3'
```

Add this helper below the imports:

```ts
function getPragmaValue<T>(db: ReturnType<typeof openDatabase>, pragma: string): T {
  return db.prepare(`PRAGMA ${pragma}`).get() as T
}
```

Replace the missing migration setup:

```ts
const db2 = new Database(dbPath)
// Missing migration for version 2 (only have version 3)
expect(() =>
  migrate(db2, {
    currentSchemaVersion: 3,
    migrations: { 3: 'CREATE TABLE test_migration (id INTEGER);' },
  }),
).toThrow('Missing migration for version 2')
db2.close()
```

with:

```ts
const db2 = openDatabase({ dbPath })
expect(() =>
  migrate(db2, {
    currentSchemaVersion: 3,
    migrations: { 3: 'CREATE TABLE test_migration (id INTEGER);' },
  }),
).toThrow('Missing migration for version 2')
closeDatabase(db2)
```

Replace WAL and foreign key tests:

```ts
const result = db.pragma('journal_mode') as { journal_mode: string }[]
expect(result[0].journal_mode).toBe('wal')
```

with:

```ts
const result = getPragmaValue<{ journal_mode: string }>(db, 'journal_mode')
expect(result.journal_mode).toBe('wal')
```

and:

```ts
const result = db.pragma('foreign_keys') as { foreign_keys: number }[]
expect(result[0].foreign_keys).toBe(1)
```

with:

```ts
const result = getPragmaValue<{ foreign_keys: number }>(db, 'foreign_keys')
expect(result.foreign_keys).toBe(1)
```

- [ ] **Step 2: Run the DB test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/timeline test -- tests/storage/db.test.ts --reporter=verbose
```

Expected: FAIL while `openDatabase()` still returns the old `better-sqlite3` concrete type or TypeScript/test code still references the removed import.

- [ ] **Step 3: Implement `packages/timeline/src/node-sqlite.ts`**

Create `packages/timeline/src/node-sqlite.ts`:

```ts
import { DatabaseSync } from 'node:sqlite'

import type {
  SqliteDatabase,
  SqliteStatement,
} from './writer.js'

export interface NodeSqliteDatabase extends SqliteDatabase {
  close: () => void
}

export function openNodeSqliteDatabase(dbPath: string): NodeSqliteDatabase {
  let nativeDb: DatabaseSync
  try {
    nativeDb = new DatabaseSync(dbPath)
  } catch (error) {
    if (isMissingNodeSqlite(error)) {
      throw new Error('Timeline requires Node 22+ because it uses node:sqlite')
    }
    throw error
  }

  return wrapNodeSqlite(nativeDb)
}

function wrapNodeSqlite(nativeDb: DatabaseSync): NodeSqliteDatabase {
  return {
    exec: sql => nativeDb.exec(sql),
    prepare: (sql) => {
      const statement = nativeDb.prepare(sql)
      return {
        run: (...params: unknown[]) => {
          statement.run(...params)
        },
        get: (...params: unknown[]) => statement.get(...params),
        all: (...params: unknown[]) => statement.all(...params),
      } satisfies SqliteStatement
    },
    transaction: (fn: () => void) => () => {
      nativeDb.exec('BEGIN IMMEDIATE')
      try {
        fn()
        nativeDb.exec('COMMIT')
      } catch (error) {
        nativeDb.exec('ROLLBACK')
        throw error
      }
    },
    close: () => nativeDb.close(),
  }
}

function isMissingNodeSqlite(error: unknown): boolean {
  return (
    error instanceof Error
    && (
      error.message.includes('node:sqlite')
      || error.message.includes('No such built-in module')
      || error.message.includes('Unknown built-in module')
    )
  )
}
```

- [ ] **Step 4: Update `packages/timeline/src/db.ts`**

Replace the `better-sqlite3` import with:

```ts
import { openNodeSqliteDatabase } from './node-sqlite.js'

import type { NodeSqliteDatabase } from './node-sqlite.js'
```

Replace `openDatabase()` and `closeDatabase()` with:

```ts
export function openDatabase(options?: OpenDatabaseOptions): NodeSqliteDatabase {
  const dbPath = options?.dbPath ?? getDefaultDbPath()
  const dbDir = path.dirname(dbPath)
  mkdirSync(dbDir, { recursive: true })

  const db = openNodeSqliteDatabase(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  migrate(db)

  return db
}

export function closeDatabase(db: NodeSqliteDatabase): void {
  db.close()
}
```

Update comments in the same file so they say "Node sqlite database handle" rather than "`better-sqlite3` instance".

- [ ] **Step 5: Update writer comments**

In `packages/timeline/src/writer.ts`, replace the driver comment with:

```ts
/**
 * Minimal SQLite-like interface that works with both node:sqlite and bun:sqlite.
 * Abstracting over the driver lets the same writer logic run in Node and Bun
 * without changes.
 */
```

- [ ] **Step 6: Run DB tests to verify they pass**

Run:

```bash
pnpm --filter @ohmyc/timeline test -- tests/storage/db.test.ts --reporter=verbose
```

Expected: PASS, with no `better-sqlite3` import in `db.test.ts`.

- [ ] **Step 7: Commit the adapter**

```bash
git add packages/timeline/src/node-sqlite.ts packages/timeline/src/db.ts packages/timeline/src/writer.ts packages/timeline/tests/storage/db.test.ts
git commit -m "feat(timeline): open databases with node sqlite"
```

## Task 3: Remove Driver Types from Timeline Source and Tests

**Files:**
- Modify: `packages/timeline/src/ingest.ts`
- Modify: `packages/timeline/src/query.ts`
- Modify: `packages/timeline/src/backfill.ts`
- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/timeline/tests/{storage/writer.test.ts,ingest/session-ingest.test.ts,ingest/backfill.test.ts,query/read-model.test.ts}`

- [ ] **Step 1: Update source type imports**

In `packages/timeline/src/ingest.ts`, remove:

```ts
import type Database from 'better-sqlite3'
```

Change `ingestSession()` to:

```ts
export function ingestSession(
  db: SqliteDatabase,
  sessionId: string,
  transcriptPath: string,
  options?: TranscriptParseOptions,
): IngestResult {
  const data = parseTranscript(sessionId, transcriptPath, options)
  return upsertSessionData(db, sessionId, data)
}
```

In `packages/timeline/src/query.ts`, remove the `better-sqlite3` type import and add:

```ts
import type { SqliteDatabase } from './writer.js'
```

Change every exported function parameter from `db: Database.Database` to `db: SqliteDatabase`.

In `packages/timeline/src/backfill.ts`, remove the `better-sqlite3` type import and add:

```ts
import type { SqliteDatabase } from './writer.js'
```

Change `backfillAll(db: Database.Database, ...)` to:

```ts
export function backfillAll(
  db: SqliteDatabase,
  options?: BackfillOptions,
): BackfillResult {
```

In `packages/cli/src/commands/dashboard.ts`, remove:

```ts
import type Database from 'better-sqlite3'
```

Add:

```ts
import type { NodeSqliteDatabase } from '@ohmyc/timeline/node-sqlite'
```

Change the local DB variable from:

```ts
let db: Database.Database | null = null
```

to:

```ts
let db: NodeSqliteDatabase | null = null
```

- [ ] **Step 2: Export the adapter type**

In `packages/timeline/package.json`, add:

```json
"./node-sqlite": {
  "types": "./dist/node-sqlite.d.ts",
  "default": "./dist/node-sqlite.js"
}
```

Update the build scripts:

```json
"build": "tsup src/index.ts src/writer.ts src/ingest.ts src/migrate.ts src/node-sqlite.ts src/schema.ts --format esm --dts",
"dev": "tsup src/index.ts src/writer.ts src/ingest.ts src/migrate.ts src/node-sqlite.ts src/schema.ts --format esm --dts --watch"
```

In `packages/timeline/src/index.ts`, add:

```ts
export type { NodeSqliteDatabase } from './node-sqlite.js'
```

- [ ] **Step 3: Update test type annotations**

In each listed test file, remove:

```ts
import type Database from 'better-sqlite3'
```

Add:

```ts
import type { NodeSqliteDatabase } from '../../src/node-sqlite.js'
```

Change local DB declarations from:

```ts
let db: Database.Database
```

to:

```ts
let db: NodeSqliteDatabase
```

For `packages/timeline/tests/query/read-model.test.ts`, use the correct relative import:

```ts
import type { NodeSqliteDatabase } from '../../src/node-sqlite.js'
```

- [ ] **Step 4: Run Timeline package tests**

Run:

```bash
pnpm --filter @ohmyc/timeline test -- --reporter=verbose
```

Expected: PASS for all Timeline package tests.

- [ ] **Step 5: Commit driver-neutral source types**

```bash
git add packages/timeline/src packages/timeline/tests packages/cli/src/commands/dashboard.ts packages/timeline/package.json
git commit -m "refactor(timeline): remove better sqlite types"
```

## Task 4: Switch Plugin Ingest to `openDatabase()`

**Files:**
- Modify: `plugins/timeline/src/ingest.ts`
- Modify: `plugins/timeline/tests/runtime/cli/ingest-cli.test.ts`
- Test: `plugins/timeline/tests/runtime/cli/ingest-cli.test.ts`

- [ ] **Step 1: Update plugin CLI tests to inspect DB through `openDatabase()`**

In `plugins/timeline/tests/runtime/cli/ingest-cli.test.ts`, remove:

```ts
import Database from 'better-sqlite3'
```

Add:

```ts
import {
  closeDatabase,
  openDatabase,
} from '@ohmyc/timeline'
```

Add this helper inside `describe('dist/ingest.mjs (node entry)', () => { ... })`:

```ts
function readDb<T>(query: (db: ReturnType<typeof openDatabase>) => T): T {
  const db = openDatabase({ dbPath: path.join(dbDir, 'timeline.db') })
  try {
    return query(db)
  } finally {
    closeDatabase(db)
  }
}
```

Replace each direct read:

```ts
const db = new Database(path.join(dbDir, 'timeline.db'), { readonly: true })
const row = db.prepare('SELECT session_id, turns FROM sessions WHERE session_id = ?').get('session-aaa') as { session_id: string; turns: number } | undefined
db.close()
```

with:

```ts
const row = readDb(db =>
  db.prepare('SELECT session_id, turns FROM sessions WHERE session_id = ?').get('session-aaa') as
    | { session_id: string; turns: number }
    | undefined,
)
```

Apply the same `readDb()` pattern for the Codex row, raw row, and cache row/skill assertions.

- [ ] **Step 2: Run plugin CLI test to verify it fails before implementation**

Run:

```bash
pnpm --filter @ohmyc/timeline-plugin test -- tests/runtime/cli/ingest-cli.test.ts --reporter=verbose
```

Expected: FAIL because `plugins/timeline/src/ingest.ts` still contains `better-sqlite3` and the plugin boundary test from Task 1 rejects it.

- [ ] **Step 3: Replace plugin DB opening**

In `plugins/timeline/src/ingest.ts`, replace the current imports:

```ts
import {
  mkdirSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  migrate,
} from '@ohmyc/timeline/migrate'
```

with:

```ts
import {
  closeDatabase,
  openDatabase,
} from '@ohmyc/timeline'
```

Remove the local `OpenedTimelineDatabase`, `openTimelineDatabase()`, `getDefaultDbPath()`, `isMissingBetterSqlite()`, `wrapNodeSqlite()`, `NodeSqliteDatabase`, and `NodeSqliteStatement` definitions.

Update `runDiskMode()`:

```ts
async function runDiskMode(sessionId: string, transcriptPath: string, agentName: string): Promise<void> {
  const db = openDatabase()
  try {
    const data = parseTranscript(sessionId, transcriptPath, { agentName })
    createWriter(db).writeSession(data)
  } finally {
    closeDatabase(db)
  }
}
```

Update `runRawMode()`:

```ts
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

- [ ] **Step 4: Run plugin CLI tests**

Run:

```bash
pnpm --filter @ohmyc/timeline build
pnpm --filter @ohmyc/timeline-plugin build
pnpm --filter @ohmyc/timeline-plugin test -- tests/runtime/cli/ingest-cli.test.ts --reporter=verbose
```

Expected: PASS. `rg -n "better-sqlite3|node:\\$\\{\\\"sqlite\\\"\\}" plugins/timeline/dist/ingest.mjs` should show no `better-sqlite3` and may show `node:sqlite`.

- [ ] **Step 5: Commit plugin ingest migration**

```bash
git add plugins/timeline/src/ingest.ts plugins/timeline/tests/runtime/cli/ingest-cli.test.ts packages/timeline/dist plugins/timeline/dist
git commit -m "refactor(timeline-plugin): use node sqlite database opener"
```

If `dist/` files are not tracked, omit them from `git add`.

## Task 5: Remove Dependencies and Set Node 22 Runtime

**Files:**
- Modify: `package.json`
- Modify: `packages/timeline/package.json`
- Modify: `packages/cli/package.json`
- Modify: `plugins/timeline/package.json`
- Modify: `packages/cli/tsup.config.ts`
- Modify: `plugins/timeline/tsup.config.ts`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Update package manifests**

In root `package.json`, add:

```json
"engines": {
  "node": ">=22"
}
```

Remove `"better-sqlite3"` from `pnpm.onlyBuiltDependencies`, leaving:

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "esbuild"
  ]
}
```

In `packages/timeline/package.json`, add:

```json
"engines": {
  "node": ">=22"
}
```

Remove:

```json
"dependencies": {
  "better-sqlite3": "^11.5.0"
},
"devDependencies": {
  "@types/better-sqlite3": "^7.6.12"
}
```

Keep the remaining `devDependencies`, and update `@types/node` to:

```json
"@types/node": "^22.13.0"
```

In `packages/cli/package.json`, add:

```json
"engines": {
  "node": ">=22"
}
```

Remove `better-sqlite3` from `dependencies`, remove `@types/better-sqlite3` from `devDependencies`, and set:

```json
"@types/node": "^22.13.0"
```

In `plugins/timeline/package.json`, add:

```json
"engines": {
  "node": ">=22"
}
```

Remove `better-sqlite3` from `dependencies`, remove `@types/better-sqlite3` from `devDependencies`, and add:

```json
"@types/node": "^22.13.0"
```

if `@types/node` is not already present in plugin `devDependencies`.

- [ ] **Step 2: Update tsup configs**

In `packages/cli/tsup.config.ts`, change:

```ts
target: 'node18',
```

to:

```ts
target: 'node22',
```

Remove:

```ts
banner: {
  js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
},
external: ['better-sqlite3'],
```

Add:

```ts
external: ['node:sqlite'],
```

In `plugins/timeline/tsup.config.ts`, remove the `createRequire` banner and change:

```ts
external: ['better-sqlite3', 'node:sqlite'],
```

to:

```ts
external: ['node:sqlite'],
```

- [ ] **Step 3: Refresh the lockfile**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` removes direct `better-sqlite3` and `@types/better-sqlite3` entries for `packages/timeline`, `packages/cli`, and `plugins/timeline`.

- [ ] **Step 4: Run dependency boundary tests**

Run:

```bash
pnpm --filter @ohmyc/timeline test -- tests/config/dependency-boundary.test.ts --reporter=verbose
pnpm --filter @ohmyc/timeline-plugin test -- tests/config/plugin.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit dependency cleanup**

```bash
git add package.json packages/timeline/package.json packages/cli/package.json plugins/timeline/package.json packages/cli/tsup.config.ts plugins/timeline/tsup.config.ts pnpm-lock.yaml
git commit -m "chore(timeline): remove better sqlite dependency"
```

## Task 6: Update Active Runtime Docs

**Files:**
- Modify: `plugins/timeline/README.md`
- Modify: `packages/cli/README.md`
- Modify: `docs/superpowers/specs/2026-06-13-node-sqlite-timeline-design.md`

- [ ] **Step 1: Update plugin README runtime notes**

In `plugins/timeline/README.md`, replace any statement saying the plugin depends on `better-sqlite3` with:

```md
The Node hook runtime requires Node 22+ and uses Node's built-in `node:sqlite` module. The plugin does not require `better-sqlite3` or a system `sqlite3` command.
```

- [ ] **Step 2: Update CLI README dependencies**

In `packages/cli/README.md`, replace the "Key dependencies" line:

```md
Key dependencies: **Fastify**, **cac**, **better-sqlite3** (via `@ohmyc/timeline`), **pino**/**pino-roll**.
```

with:

```md
Key dependencies: **cac**, **node:sqlite** (via `@ohmyc/timeline`), **pino**/**pino-roll**.
```

If `Fastify` is still accurately listed elsewhere in that README, leave it; only remove the stale SQLite dependency claim.

- [ ] **Step 3: Mark the design spec approved for implementation**

In `docs/superpowers/specs/2026-06-13-node-sqlite-timeline-design.md`, change:

```md
**Status:** Draft, pending review
```

to:

```md
**Status:** Approved, implementation planned
```

- [ ] **Step 4: Run docs grep**

Run:

```bash
rg -n "better-sqlite3|system sqlite3|node:sqlite" plugins/timeline/README.md packages/cli/README.md docs/superpowers/specs/2026-06-13-node-sqlite-timeline-design.md
```

Expected:

- No active README says Timeline requires `better-sqlite3`.
- The design spec still mentions `better-sqlite3` only as the removed dependency.
- The plugin README says no system `sqlite3` command is required.

- [ ] **Step 5: Commit docs**

```bash
git add plugins/timeline/README.md packages/cli/README.md docs/superpowers/specs/2026-06-13-node-sqlite-timeline-design.md
git commit -m "docs(timeline): document node sqlite runtime"
```

## Task 7: Full Verification and Installed Plugin Smoke

**Files:**
- Delete: `packages/timeline/tests/config/dependency-boundary.test.ts`
- May modify: `plugins/timeline/.codex-plugin/plugin.json`, `plugins/timeline/.claude-plugin/plugin.json`, `plugins/timeline/.claude-plugin/marketplace.json`, `plugins/timeline/package.json`, `plugins/timeline/tests/config/plugin.test.ts` if a version bump is needed for Codex cache refresh.

- [ ] **Step 1: Run full package tests**

Delete the temporary migration scaffold:

```bash
rm packages/timeline/tests/config/dependency-boundary.test.ts
```

Run:

```bash
pnpm --filter @ohmyc/timeline test -- --reporter=verbose
pnpm --filter @ohmyc/timeline-plugin test -- --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 2: Run builds**

Run:

```bash
pnpm --filter @ohmyc/timeline build
pnpm --filter @ohmyc/cli build
pnpm --filter @ohmyc/timeline-plugin build
```

Expected:

- All builds PASS.
- `plugins/timeline/dist/ingest.mjs` has no `better-sqlite3`.
- `packages/cli/dist/index.mjs` has no `better-sqlite3`.

Verify with:

```bash
rg -n "better-sqlite3" packages/cli/dist plugins/timeline/dist packages/timeline/dist || true
```

Expected: no output. This command replaces the temporary dependency-boundary test as the long-term verification.

- [ ] **Step 3: Check active repo references**

Run:

```bash
rg -n "better-sqlite3|@types/better-sqlite3" package.json packages plugins/timeline -g '!node_modules' -g '!dist'
```

Expected: no output.

- [ ] **Step 4: Install the plugin into Codex cache**

Run:

```bash
codex plugin add timeline@ohmyc --json
```

Expected: JSON output with `"pluginId": "timeline@ohmyc"` and the current plugin version.

- [ ] **Step 5: Trigger installed hook against a real Codex JSONL**

Run:

```bash
set -euo pipefail
LATEST=$(find "$HOME/.codex/sessions" -type f -name '*.jsonl' -print0 | xargs -0 stat -f '%m %N' | sort -nr | head -1 | cut -d' ' -f2-)
SESSION_ID=$(node --no-warnings - "$LATEST" <<'NODE'
const fs = require('node:fs')
const path = process.argv[2]
let found = ''
for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
  if (!line.trim()) continue
  try {
    const item = JSON.parse(line)
    if (item?.type === 'session_meta' && typeof item?.payload?.id === 'string') {
      found = item.payload.id
      break
    }
  } catch {}
}
process.stdout.write(found || require('node:path').basename(path, '.jsonl'))
NODE
)
PLUGIN_ROOT="$HOME/.codex/plugins/cache/ohmyc/timeline/$(node -e "console.log(require('./plugins/timeline/package.json').version)")"
printf '{"session_id":"%s","transcript_path":"%s"}\n' "$SESSION_ID" "$LATEST" \
  | PLUGIN_ROOT="$PLUGIN_ROOT" sh -c 'if [ -n "${PLUGIN_ROOT:-}" ]; then "${PLUGIN_ROOT}/hooks/ingest-codex.sh"; else "${CLAUDE_PLUGIN_ROOT}/hooks/ingest-claude.sh" "$CLAUDE_SESSION_ID"; fi'
sqlite3 -header -column "$HOME/.config/ohmyc/timeline.db" "select session_id, agent_name, turns from sessions where session_id='$SESSION_ID'; select skill_name from session_skills where session_id='$SESSION_ID' order by skill_name limit 20;"
```

Expected:

- Hook exits 0.
- Output includes `[timeline] Using jq fast path for Codex session ...` or the Node parser path.
- DB query returns the Codex session.
- Skill rows are present if the transcript contains skill invocations.

- [ ] **Step 6: Commit final verification adjustments**

If only the temporary boundary test was deleted, include that deletion in the final cleanup commit. If version files changed too, include them in the same commit:

```bash
git add packages/timeline/tests/config/dependency-boundary.test.ts plugins/timeline/package.json plugins/timeline/.codex-plugin/plugin.json plugins/timeline/.claude-plugin/plugin.json plugins/timeline/.claude-plugin/marketplace.json plugins/timeline/tests/config/plugin.test.ts
git commit -m "chore(timeline-plugin): refresh node sqlite plugin version"
```

If no version files changed, use:

```bash
git add packages/timeline/tests/config/dependency-boundary.test.ts
git commit -m "test(timeline): remove temporary sqlite dependency guard"
```

## Self-Review

- Spec coverage: The plan removes `better-sqlite3`, uses Node 22 `node:sqlite`, keeps OpenCode on `bun:sqlite`, avoids system `sqlite3`, updates docs, includes installed Codex smoke testing, and deletes the temporary migration-only dependency-boundary test before completion.
- Placeholder scan: No `TBD`, `TODO`, or "implement later" placeholders are present.
- Type consistency: `NodeSqliteDatabase` is created in Task 2, exported in Task 3, then used by CLI/tests. `SqliteDatabase` remains the cross-driver interface for writer/query/ingest/backfill.
