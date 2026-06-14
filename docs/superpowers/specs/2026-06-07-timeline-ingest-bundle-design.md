# Timeline Ingest Bundling — Design Spec

**Date:** 2026-06-07
**Status:** Approved, pending plan
**Owner:** OhMyC core
**Related:** [timeline-db-fork note](../../notes/2026-06-07-timeline-db-fork.md), slice 8 cleanup

## Problem

The `plugins/timeline/` plugin has two halves with very different shapes:

| Side | Entry | Runtime | Self-contained? |
|---|---|---|---|
| OpenCode | `opencode.ts` (bun plugin) | bun + `bun:sqlite` | Yes — writes DB directly |
| Claude Code | `hooks/ingest.sh` (Stop hook) | shell + jq + **external `ohmyc` CLI** | **No** — depends on `@ohmyc/cli` being installed and on PATH |

The Claude-side hook fails if the `ohmyc` binary is missing, mis-versioned, or shadowed by the legacy `cui` name. After the slice 8 cleanup, `packages/cli/` has only five subcommands left — `--install`, `--uninstall`, `--sync`, `--ingest`, `--doctor` — and the **only** thing in the whole repo (or any consumer's machine) that calls `ohmyc dashboard --ingest` is `hooks/ingest.sh`.

This creates a fragile two-package coupling for the hottest code path in the plugin: every Claude Code session-end. The fix is to bundle the ingest logic directly into the plugin so the Stop hook can call a co-located node script, with no PATH dependency.

## Goal

Make the Stop-hook hot path (`--ingest` + `--ingest-raw`) self-contained inside `plugins/timeline/`. After this change:

- `hooks/ingest.sh` calls `node $CLAUDE_PLUGIN_ROOT/dist/ingest.mjs` — a file sitting next to it.
- The plugin folder dropped at `~/.claude/plugins/ohmyc-timeline/` is fully sufficient for capturing Claude Code sessions. No `ohmyc` binary needed on PATH for the hot path.
- The jq fast-path (currently dead — see "Side effect" below) starts working again.

**Non-goals:** moving `--install`, `--uninstall`, `--sync`, `--doctor` out of `packages/cli/`. Those are user-triggered, run rarely, and a PATH dependency is tolerable. `packages/cli/` stays alive, just slimmed.

## Architecture

### File layout (additions)

```
plugins/timeline/
├── opencode.ts                  # unchanged — bun plugin entry
├── src/
│   └── ingest.ts                # NEW — node entry, cac-based, two modes
├── hooks/
│   ├── hooks.json               # unchanged
│   └── ingest.sh                # simplified — drops `command -v ohmyc`, calls node
├── dist/
│   ├── opencode.js              # existing bun bundle
│   └── ingest.mjs               # NEW — tsup output, node + better-sqlite3
└── tests/
    └── ingest.test.ts           # NEW — covers both modes
```

### Stop-hook flow (Claude side)

`hooks/hooks.json` is unchanged. The contract Claude Code sees is the same:

```json
{ "type": "command", "command": "$CLAUDE_PLUGIN_ROOT/hooks/ingest.sh $CLAUDE_SESSION_ID" }
```

Inside `ingest.sh`:

```
Stop event
  → hooks/ingest.sh $CLAUDE_SESSION_ID
    → if jq available:
        jq -s '...' transcript.jsonl | node $CLAUDE_PLUGIN_ROOT/dist/ingest.mjs --raw
      else:
        node $CLAUDE_PLUGIN_ROOT/dist/ingest.mjs \
          --session-id $SESSION_ID --transcript-path $TRANSCRIPT_PATH
```

The shell wrapper stays for three reasons:

1. **jq lives in shell.** The pre-parsing pipeline can't move into node without defeating the fast-path's purpose (avoiding node's JSONL re-parse).
2. **`node` resolution.** The script can find node via nvm/asdf shims that `hooks.json` can't reach.
3. **Graceful exits.** Existing `exit 0` on missing transcript keeps a broken hook from breaking the user's session — easier to keep in shell.

### OpenCode flow

Unchanged. `opencode.ts` keeps writing via `bun:sqlite` directly. The two halves stay symmetric in shape ("plugin folder = self-contained") even though their runtimes differ.

### Shared code

Both halves continue to import from `packages/timeline/src/{ingest,writer,schema}.ts`. The bundler inlines those into `dist/ingest.mjs` (no runtime dep on `@ohmyc/timeline`).

## Component contracts

### `plugins/timeline/src/ingest.ts`

Node entry point. Uses `cac` (already a peer-familiar CLI lib in this repo). Two mutually exclusive modes:

**Mode A — parse from disk:**
```
node dist/ingest.mjs --session-id <uuid> --transcript-path <path-to-jsonl>
```
Calls `ingestSession(db, sessionId, transcriptPath)` from `@ohmyc/timeline`. Matches today's `ohmyc dashboard --ingest --session X --file Y` exactly.

**Mode B — raw pre-parsed (fast-path):**
```
echo '<parsed-json>' | node dist/ingest.mjs --raw
```
Reads `ParsedSessionData` JSON from stdin (the jq pipeline's output), calls `writer.writeSession(data)` directly. Matches what the shell hook *thinks* it's calling today (`--ingest-raw`) but which is actually unimplemented — see "Side effect" below.

**Error handling:**
- Missing args → `process.exit(1)` with stderr message
- DB open failure → `process.exit(1)` with stderr message
- Write failure → `process.exit(1)` with stderr message
- Success → `process.exit(0)`, no stdout

The shell wrapper translates non-zero exits into a logged warning but **does not propagate** failure to Claude Code (existing behavior — failing the Stop hook would block the user). Spec keeps this.

### `plugins/timeline/hooks/ingest.sh`

Simplified body. Drops:
- `command -v ohmyc` / `command -v cui` lookups
- Repo-root path fallbacks (`$REPO_ROOT/packages/cli/dist/index.mjs`)
- `CLI_CMD` variable plumbing

Adds:
- `command -v node` check; if missing, log warning and `exit 0`
- Direct invocations of `$CLAUDE_PLUGIN_ROOT/dist/ingest.mjs`

DB path resolution logic (the `OHMYC_HOME` / `~/.config/ohmyc` / `~/.cui` fallback chain) **stays in the shell** — `ingest.mjs` reads `OHMYC_HOME` from the env that the shell exports. The shell remains the source of truth for that resolution so the OpenCode plugin's path logic (in `opencode.ts`) stays the only other producer of the resolved path.

### `plugins/timeline/package.json`

Gains:
```json
{
  "dependencies": {
    "better-sqlite3": "^11.5.0",
    "@ohmyc/timeline": "workspace:*"
  },
  "scripts": {
    "build": "bun build opencode.ts --outfile dist/opencode.js --target bun --external bun:sqlite --external @opencode-ai/plugin && tsup src/ingest.ts --format esm --out-dir dist --external better-sqlite3"
  }
}
```

`@ohmyc/timeline` is bundled inline by tsup; only `better-sqlite3` stays external (it's a native module — must come from the consumer's `node_modules`). When the plugin is published, npm/pnpm pulls in `better-sqlite3` with its prebuild for the host OS.

### `packages/cli/` (slimmed)

Edits to existing files:

- `src/index.ts`: remove `--ingest`, `--session`, `--file` flags from the `dashboard` command. The `--ingest` branch in the `.action()` handler goes too.
- `src/commands/dashboard.ts`: delete `runIngest()`, `searchForTranscript()`, `readDirRecursive()`. The other four exported functions stay.
- `tests/`: remove any ingest-specific tests. (Slice 8 already nuked most of `packages/cli/tests/` — this is a sweep, not a rewrite.)
- `package.json`: no dep changes — `--sync` still uses the same `@ohmyc/timeline` parser internally.

## Side effect: jq fast-path becomes real

Today `hooks/ingest.sh:155` pipes parsed JSON to `$CLI_CMD dashboard --ingest-raw`. But `packages/cli/src/index.ts:20-27` never declares `--ingest-raw` as a flag. `cac` rejects the unknown option, the command exits non-zero, the `&& exit 0` short-circuit doesn't fire, and the script falls through to the slow path (`--ingest --session ... --file ...`) which re-parses the JSONL in node.

This means the jq optimization has been silently disabled for an unknown duration. Implementing `--raw` correctly in `ingest.mjs` resurrects it. Free perf win on Claude Code session-end (skip node's JSONL re-parse for every session).

## Data flow

Unchanged. Both halves write to `$OHMYC_HOME/timeline.db` (default `~/.config/ohmyc/timeline.db`) using the schema defined in `packages/timeline/src/schema.ts`. SQLite's WAL mode + `INSERT OR IGNORE` on `(session_id)` PK already serialize concurrent writes from the two runtimes.

## Testing

New `plugins/timeline/tests/ingest.test.ts`:

- **Mode A — disk path:** synthesize a JSONL fixture, invoke `ingest.mjs --session-id X --transcript-path Y` as a child process, assert a row exists in a temp DB.
- **Mode B — raw stdin:** craft a `ParsedSessionData` JSON, pipe to `ingest.mjs --raw`, assert the row.
- **Failure modes:** missing args exit 1; bad path exits 1; malformed JSON on stdin exits 1.
- **Idempotency:** running Mode A twice on the same session = one row (relies on `INSERT OR IGNORE`).

Test isolation: each test sets `OHMYC_HOME` to a `tmpdir()`, mirroring the pattern already used in `packages/desktop/src-tauri/src/api/profiles.rs` smoke tests.

## Migration cost

**Users:** zero. The Stop hook is a file inside the plugin folder. When the plugin updates (next install or `git pull`), `ingest.sh` and `dist/ingest.mjs` update together. No user-visible install step.

**Devs:** trivial. `pnpm --filter @ohmyc/timeline-plugin build` produces both bundles. CI build matrix unchanged.

**Rollback:** revert the commits. `packages/cli/src/commands/dashboard.ts:runIngest` and its callers come back; `hooks/ingest.sh` reverts to looking up `ohmyc` on PATH.

## Out of scope (explicit)

- Moving `--install` / `--uninstall` / `--sync` / `--doctor` into the plugin or the desktop UI. They stay where they are. Re-litigate later if `packages/cli/` becomes a maintenance burden.
- Switching the Claude side to bun. Stays on node + `better-sqlite3` to avoid forcing bun on Claude-only users.
- Bundling `better-sqlite3`'s native binary into the plugin. Comes from consumer's `node_modules` like every other native dep.
- Fixing the `~/.cui` vs `~/.config/ohmyc` DB fork — that's a separate problem with its own note.

## Decision log

- **2026-06-07** — Scope cut from "absorb the entire CLI" to "absorb only `--ingest`/`--ingest-raw`". Rationale: the hot path is the only one whose external-CLI dependency is fragile. Leftover commands are user-triggered and survive a missing PATH entry gracefully.
- **2026-06-07** — Keep the shell wrapper instead of pointing `hooks.json` directly at `dist/ingest.mjs`. Rationale: jq fast-path stays in shell; node resolution may need shim search; graceful exit on missing transcript already lives there.
- **2026-06-07** — Node + `better-sqlite3` over bun + `bun:sqlite` on the Claude side. Rationale: Claude-only users would otherwise need to install bun for the hook to fire. The two halves can stay asymmetric on driver without code duplication — shared writer is runtime-agnostic.
