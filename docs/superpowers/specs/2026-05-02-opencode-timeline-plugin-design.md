# OpenCode Timeline Plugin Design

**Date:** 2026-05-02
**Status:** Approved
**Scope:** Real-time session capture only (backfill is a future feature)

## Problem Statement

The `@claudeui/timeline` package currently only supports Claude Code via transcript file parsing. We need to add OpenCode support so that timeline data can be captured from both agents into the same SQLite database (`~/.cui/timeline.db`).

## Key Constraint

OpenCode runs on **Bun**, which does not support `better-sqlite3` (native C++ bindings). The plugin must use `bun:sqlite` instead.

## Architecture

### 1. `@claudeui/timeline` Sub-exports

Add two new sub-exports to `packages/timeline/package.json`:

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./writer": { "types": "./dist/writer.d.ts", "default": "./dist/writer.js" },
    "./schema": { "types": "./dist/schema.d.ts", "default": "./dist/schema.js" }
  }
}
```

**`@claudeui/timeline/writer`**
- Export: `createWriter(db: SQLiteDatabase)`
- Returns: `{ writeSession(data: ParsedSessionData): void }`
- The `db` parameter accepts any SQLite-like object with `.run()` and `.prepare()` methods (works with both `better-sqlite3` and `bun:sqlite`)
- Contains all INSERT/REPLACE logic for `sessions`, `session_tools`, and `session_skills` tables

**`@claudeui/timeline/schema`**
- Export: `SCHEMA_SQL`, `CURRENT_SCHEMA_VERSION`, `MIGRATIONS`
- Export types: `ParsedSessionData`, `SessionRow`, etc.

### 2. Plugin File: `plugins/timeline/opencode.ts`

Located at `plugins/timeline/opencode.ts` (not in `.opencode/plugins/` directly, to keep plugin source with the timeline package).

**Responsibilities:**
- Import `createWriter` from `@claudeui/timeline/writer`
- Open `bun:sqlite` connection to `~/.cui/timeline.db`
- Initialize database schema if not exists
- Hook into OpenCode events to accumulate session data in memory
- Call `writer.writeSession()` when session ends

**Hooks captured:**

| Hook | Action |
|------|--------|
| `session.created` | Initialize session accumulator |
| `message.updated` | Count turns, tokens, capture model ID |
| `message.part.updated` | Capture user message text for summary |
| `tool.execute.before` | Count tool calls |
| `tool.execute.after` | Capture skill names from `Skill` tool args |
| `session.idle` | Write session to DB |
| `session.deleted` | Write session to DB, cleanup accumulator |

### 3. Plugin Registration

**File location:**
- Source: `plugins/timeline/opencode.ts`
- Runtime link: `.opencode/plugins/timeline.ts` → `../../plugins/timeline/opencode.ts`

**Configuration:**
`opencode.json` references the plugin:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["./.opencode/plugins/timeline.ts"]
}
```

## Data Flow

```
OpenCode Events
    ↓
Plugin accumulates data in Map<sessionId, accumulator>
    ↓
Session ends (idle/deleted)
    ↓
writer.writeSession(data)  ← from @claudeui/timeline/writer
    ↓
~/.cui/timeline.db  (bun:sqlite)
```

## Future Feature: Backfill from OpenCode DB

OpenCode stores historical session data in `~/.local/share/opencode/opencode.db` (SQLite).

**Schema:**
- `session` — session metadata
- `message` — messages with JSON `data` column
- `part` — message parts with JSON `data` column

**Implementation idea (not in scope):**
- Read `session` table for historical sessions
- Join `message`/`part` to extract turns, tokens, tools
- Parse JSON `data` columns for tool usage and token counts
- Convert to `ParsedSessionData` format and write via `createWriter`

## Files Changed

1. `packages/timeline/package.json` — add sub-exports
2. `packages/timeline/src/writer.ts` — new file (extracted from ingest.ts)
3. `packages/timeline/src/index.ts` — optionally re-export writer
4. `plugins/timeline/opencode.ts` — new file
5. `.opencode/plugins/timeline.ts` — symlink to plugin
6. `opencode.json` — add plugin reference

## Testing

- Build `packages/timeline` and verify sub-exports work
- Build plugin with `bun build --target=bun`
- Verify plugin loads without errors in OpenCode
- Check that sessions appear in `~/.cui/timeline.db`
