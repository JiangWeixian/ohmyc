# Timeline Node SQLite Migration — Design Spec

**Date:** 2026-06-13
**Status:** Approved, implementation planned
**Owner:** OhMyC core
**Related:** `plugins/timeline/`, `packages/timeline/`, `packages/cli/`

## Problem

Timeline's Node-side SQLite path still depends on `better-sqlite3`, a native npm addon. That worked for workspace development and the original CLI, but it is fragile for plugin distribution:

- `tsup` cannot bundle the native addon into `dist/ingest.mjs`.
- Codex installs plugins into a copied cache directory where pnpm workspace symlinks and native dependency layout are not reliable.
- A static import of `better-sqlite3` can fail before fallback code runs.
- Keeping `better-sqlite3` in `packages/cli`, `packages/timeline`, and `plugins/timeline` creates duplicated dependency/config cleanup work.

Node 22 includes `node:sqlite`, which matches Timeline's synchronous write model closely enough for the current schema, query, ingest, and backfill paths.

## Goal

Short-term, remove `better-sqlite3` from the Node runtime surface and make Timeline depend on Node 22's built-in SQLite module instead.

After this change:

- `packages/timeline` opens databases with `node:sqlite`.
- `packages/cli` uses the same `openDatabase()` API without depending on `better-sqlite3`.
- `plugins/timeline` Stop-hook ingest uses `node:sqlite` directly and no longer has a `better-sqlite3` dynamic fallback.
- Codex/Claude plugin installs do not need npm native SQLite dependencies.
- OpenCode continues to use `bun:sqlite`.

## Non-goals

- Do not build a native Rust/Go/Zig binary.
- Do not depend on the system `sqlite3` command.
- Do not rewrite query, ingest, or writer logic.
- Do not change the database schema.
- Do not change OpenCode's `bun:sqlite` runtime.
- Do not remove old design docs that mention `better-sqlite3`; update active README/runtime docs only.

## Runtime Decision

OhMyC's Node runtime baseline becomes **Node >= 22** for Timeline Node paths.

`node:sqlite` is preferred over `/usr/bin/sqlite3` even though macOS ships a SQLite CLI. The CLI is not consistently available across Windows and Linux distributions, and shelling out would duplicate TypeScript writer logic into command-line SQL scripts. `node:sqlite` keeps database writes inside the existing TypeScript modules while avoiding npm native addons.

Node 22 currently emits an experimental warning for `node:sqlite`. Hook scripts already call Node with `--no-warnings`; CLI commands may either inherit that choice through their launcher or tolerate the warning during local command execution. The implementation plan should make this explicit for the packaged CLI path.

## Architecture

### Driver Boundary

Timeline already has a useful boundary:

```ts
export interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  transaction(fn: () => void): () => void
}
```

The migration keeps this interface. The only driver-specific code should live near database opening/adaptation.

New shape:

```text
packages/timeline/src/
├── db.ts              # Node 22 node:sqlite open/close/default path
├── node-sqlite.ts     # optional adapter helper if db.ts gets crowded
├── migrate.ts         # driver-neutral migrations
├── writer.ts          # unchanged driver-neutral writes
├── ingest.ts          # parser + writer orchestration, no driver import
├── query.ts           # accepts SqliteDatabase, no driver import
└── backfill.ts        # accepts SqliteDatabase, no driver import
```

`db.ts` returns an object compatible with the existing `SqliteDatabase` contract. It may also expose `closeDatabase(db)` as today.

### Package Exports

Keep the current public shape:

- `@ohmyc/timeline`
- `@ohmyc/timeline/ingest`
- `@ohmyc/timeline/writer`
- `@ohmyc/timeline/migrate`
- `@ohmyc/timeline/schema`

The main entry may still export `openDatabase()`, but it must no longer pull in `better-sqlite3`.

### Plugin Ingest

`plugins/timeline/src/ingest.ts` should stop attempting `await import('better-sqlite3')`.

Instead, it should either:

1. call `openDatabase()` from `@ohmyc/timeline`, or
2. call a shared `openNodeSqliteDatabase()` helper from a subpath export if the plugin needs tighter control over warnings/close behavior.

The recommendation is option 1 unless bundling proves it pulls in unrelated CLI code. It keeps the plugin using the same database opener as the CLI.

### OpenCode

`plugins/timeline/opencode.ts` remains on `bun:sqlite`. It already writes through the shared writer contract and does not need Node 22.

The writer comments should be updated from "better-sqlite3 and bun:sqlite" to "node:sqlite and bun:sqlite".

## Dependency Cleanup

Remove these runtime dependencies:

- `packages/timeline/package.json`: `better-sqlite3`
- `packages/cli/package.json`: `better-sqlite3`
- `plugins/timeline/package.json`: `better-sqlite3`

Remove these type dependencies:

- `@types/better-sqlite3` from the same packages.

Remove bundler externals:

- `packages/cli/tsup.config.ts`: remove `better-sqlite3`
- `plugins/timeline/tsup.config.ts`: remove `better-sqlite3`, keep `node:sqlite` external

Remove root build allowance:

- root `package.json`: remove `better-sqlite3` from `pnpm.onlyBuiltDependencies`

The lockfile should no longer contain `better-sqlite3` after install cleanup, except through an unrelated transitive dependency if one appears.

## Data Flow

No data model change.

```text
Claude/Codex Stop hook
  -> plugins/timeline/hooks/ingest-*.sh
  -> node --no-warnings plugins/timeline/dist/ingest.mjs
  -> @ohmyc/timeline openDatabase() using node:sqlite
  -> createWriter(db).writeSession(data)
  -> ~/.config/ohmyc/timeline.db

OhMyC CLI
  -> packages/cli dashboard commands
  -> @ohmyc/timeline openDatabase() using node:sqlite
  -> query/read/write helpers

OpenCode
  -> plugins/timeline/opencode.ts
  -> bun:sqlite
  -> createWriter(db).writeSession(data)
```

## Error Handling

- Missing Node 22 capability should fail clearly with a message that `node:sqlite` requires Node 22+.
- Hook scripts should keep non-blocking behavior: log to stderr and exit 0 so failed ingest does not block the agent session.
- CLI commands may fail normally because they are user-triggered.
- WAL and foreign keys should still be enabled after opening the DB.
- Migration errors should keep their current messages, including missing migration version errors.

## Testing

Use TDD for the implementation.

Required tests:

- A failing dependency-boundary test proving no source file imports `better-sqlite3`.
- `packages/timeline` storage tests passing with `node:sqlite`.
- `packages/timeline` ingest/backfill/query tests passing with the new DB handle.
- `plugins/timeline` ingest CLI tests passing from a copied cache directory without `node_modules`.
- Hook tests for Claude and Codex still passing.
- A lock/dependency assertion or `rg` check proving `better-sqlite3` is gone from active code/config.

Manual smoke:

1. Build `@ohmyc/timeline`.
2. Build `@ohmyc/timeline-plugin`.
3. Install the Codex plugin.
4. Trigger the installed hook against a real Codex JSONL transcript.
5. Query `~/.config/ohmyc/timeline.db` and confirm the codex session and skills are written.

## Risks

- `node:sqlite` is still marked experimental/release-candidate depending on Node version. The short-term mitigation is pinning the runtime baseline to Node 22+ and suppressing hook warnings.
- `DatabaseSync` statement return shapes may differ slightly from `better-sqlite3`; tests should cover all query and writer paths.
- TypeScript's Node type package may need to move beyond `@types/node@20` or use a small local type shim if `node:sqlite` types are unavailable.
- If a user runs the CLI with Node < 22, Timeline commands will fail. The CLI should report this directly.

## Acceptance Criteria

- No active source/config dependency on `better-sqlite3` remains.
- `packages/timeline`, `packages/cli`, and `plugins/timeline` no longer declare `better-sqlite3`.
- Node-side Timeline DB access uses `node:sqlite`.
- OpenCode still uses `bun:sqlite`.
- All package/plugin tests pass.
- Installed Codex plugin can ingest a real JSONL session without `node_modules/better-sqlite3`.
