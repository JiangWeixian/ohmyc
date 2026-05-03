# Timeline Adapter Architecture — Design

**Date:** 2026-05-02
**Branch:** hotfix/cli-ingest
**Status:** proposed
**Related:** `2026-05-02-opencode-timeline-plugin-design.md`

## Context

`@claudeui/timeline` currently ingests session data from two sources:

- **Claude Code** — JSONL transcripts under `~/.claude/projects/`, batch-read by `packages/timeline/src/ingest.ts` and `backfill.ts`.
- **opencode (live)** — event/hook stream from `plugins/timeline/opencode.ts`, a Bun-runtime opencode plugin.

A third path is coming: **opencode backfill** from `~/.local/share/opencode/opencode.db` (SQLite, drizzle schema, `session` + `message` tables; `message.data` is a JSON blob).

The current code has duplicated session-accumulation logic between `ingest.ts` and `opencode.ts`. Adding a third path without refactoring would duplicate it again and let the three implementations drift in their interpretation of the same input.

## Bug found during review

`plugins/timeline/opencode.ts` defines the `event:` handler **twice** (lines 208 and 361) inside the same returned object. The second silently overrides the first. The first is the richer one (handles `message.updated`, `message.part.updated` for token + turn accounting); the active handler is the slimmer second copy. This likely explains the "0 turns" symptom referenced in recent commits (`352502e debug(timeline): add message event logging to troubleshoot 0 turns`).

Fix this incidentally as part of the refactor — the new structure makes the bug class structurally impossible.

## Problem

1. Session-accumulation logic (turns, tokens, tools, skills, first-message capture, → `ParsedSessionData`) is reimplemented per source.
2. opencode-specific event translation lives in the plugin file. Backfill would need the same translation logic against a different input shape (DB rows, not live events).
3. Schema migration (`ensureSchema`) lives in the plugin instead of the shared `db.ts`.
4. Plugin is 427 lines, most of it not actually opencode-specific.

## Recommendation

Three layers, cleanly separated:

```
   ┌─ adapters/ ─────────────────────────────┐
   │  claude-jsonl/    (read JSONL files)    │
   │  opencode-db/     (read opencode.db)    │  ← new for backfill
   │  opencode-live/   (event stream)        │  ← current plugin
   └──────────┬──────────────────────────────┘
              │ emits normalized events
              ▼
   ┌─ accumulator (shared) ──────────────────┐
   │  recordTurn / recordTokens / recordTool │
   │  recordSkill / toParsedSessionData      │
   └──────────┬──────────────────────────────┘
              ▼
   ┌─ writer + db (shared) ──────────────────┐
   │  schema, migrations, upsert             │
   └─────────────────────────────────────────┘
```

Three adapters, one accumulator, one writer. The opencode live plugin and the opencode backfill share the **same translation logic** — both read opencode's data shape and emit normalized accumulator mutations. Only the *source* differs (live event vs DB row).

### Module surface (proposed)

`packages/timeline/src/accumulator.ts` (new):

```ts
export interface SessionAccumulator { /* sessionId, project, agentName, startedAt,
  endedAt, turns, tokensInput, tokensOutput, tokensCached, tools, skills,
  firstUserMessage, summary, model */ }

export function createAccumulator(sessionId, project, agentName): SessionAccumulator
export function recordTurn(acc): void
export function recordTokens(acc, tokens): void
export function recordTool(acc, name): void
export function recordSkill(acc, name): void
export function recordFirstMessage(acc, text): void
export function toParsedSessionData(acc): ParsedSessionData
```

`packages/timeline/src/adapters/opencode.ts` (new):

```ts
export function applyOpencodeEvent(acc, event): void
export function applyOpencodeMessage(acc, message): void  // reads `data` JSON
```

The plugin and the new backfill both import from this adapter. Translation lives in one place.

`packages/timeline/src/db.ts` (existing) — absorb `ensureSchema` from the plugin. Schema migration is a database concern, not a plugin concern.

### Backfill module

`packages/timeline/src/backfill-opencode.ts` (new, ~80 lines):

1. Open `~/.local/share/opencode/opencode.db` read-only.
2. For each `session` row, join `message` rows by `session_id`, ordered by `time_created`.
3. Replay messages through `applyOpencodeMessage` into an accumulator.
4. Call `writer.writeSession(toParsedSessionData(acc))`.

Rename existing `backfill.ts` → `backfill-claude.ts`. New unified `backfill.ts` exposes `--source claude|opencode|all`.

### Incremental backfill

opencode's `time_updated` column is the natural watermark. Store `last_ingested_at_opencode` and `last_ingested_at_claude` in the existing `meta` table. Subsequent backfill runs read only sessions updated since the watermark.

Path: cheap re-runs, safe to schedule periodically.

## Design decisions to lock in

| Decision | Choice | Reason |
|---|---|---|
| Agent identification | `agent_name` column (already added) — `'claude'` \| `'opencode'` \| null for legacy rows | Already in schema. No further migration needed. |
| Transcript path for opencode | `opencode://${sessionID}` URI scheme | Already used in live plugin. Keep consistent across live + backfill. |
| Incremental strategy | Watermark in `meta` table, keyed by source | Simple, source-agnostic, survives restarts. |
| Plugin vs package boundary | Plugin = thin event-shape adapter. All logic in `@claudeui/timeline`. | Plugin file becomes ~150 lines (from 427). Unbreakable by future opencode API changes that don't affect the live event shape. |

## Implementation order

1. **Extract `accumulator.ts`.** Mechanical refactor. No behavior change. Both `ingest.ts` and `opencode.ts` import from it. Delete duplicated code.
2. **Extract opencode event/message translation** into `adapters/opencode.ts`. Plugin re-imports it. Live behavior unchanged.
3. **Move `ensureSchema` into `db.ts`.** Plugin no longer touches schema.
4. **Fix the duplicate `event:` handler bug.** With logic now in pure functions outside the object literal, this is structurally impossible going forward.
5. **Add `backfill-opencode.ts`** using the shared adapter + accumulator. ~80 lines.
6. **Add unified `backfill` entry with `--source` flag.** Watermark logic in `meta` table.

Steps 1–4 are pure refactor and ship together. Steps 5–6 are the backfill feature on top.

## What this buys

- Adding a third agent later (cursor, aider, etc.) = one new adapter file. Accumulator and writer untouched.
- Backfill and live ingestion can't drift on opencode interpretation — they share `applyOpencodeMessage`.
- Plugin shrinks from 427 → ~150 lines.
- The duplicate-key bug class is gone.
- Bun (plugin runtime) and Node (CLI/backfill runtime) split stays where it belongs. The shared package compiles to plain ESM and runs under both.

## Out of scope

- Unifying live ingestion and batch ingestion behind one abstraction. Pull-from-files vs push-from-events is a real difference; forcing a common interface buys a leaky one. Keep them as sibling adapters.
- A generic "agent adapter" plugin API. Two adapters is not enough signal to design one. Revisit at three.
- Migrating the root project from pnpm/Node to Bun. Unrelated; the runtime split is correct (opencode plugins run under Bun by platform requirement).

## Open questions

- Should `agent_name` be backfilled for existing rows by inferring from `transcript_path` (file path → claude, `opencode://` → opencode)? One-time migration, low risk.
- Does opencode store tool calls and skill invocations in `message.data` in a recoverable shape? If not, backfilled rows will have empty `tools` / `skills` arrays. Verify against a real `message.data` blob before committing to the backfill design.
