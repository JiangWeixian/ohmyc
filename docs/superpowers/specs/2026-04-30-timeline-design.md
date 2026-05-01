# Timeline — Design

**Status:** Draft · **Date:** 2026-04-30 · **Author:** brainstorm session

## Summary

Timeline is a session-activity view for ClaudeUI. It records every Claude Code session the user runs (across all projects) and presents them as (1) a GitHub-style contribution heatmap and (2) a chronological grouped event list. Data is ingested from Claude Code's session transcripts (`~/.claude/projects/**/*.jsonl`) and persisted in a local SQLite database. Ingest is triggered by a Claude Code **Stop hook** so the database stays in near-real-time sync without a long-running watcher.

The killer question Timeline answers: **"What have I actually been doing with Claude Code?"** — surfaced as a calendar of activity intensity plus a scannable, expandable list of sessions with token / turn / tool / skill metadata.

## Goals

- Give the user a scannable view of their Claude Code usage history with day-level granularity.
- Per session, show: summary, project, start time, duration, turns, tokens (in/out/cached), distinct tools used, distinct skills used.
- Stay in sync with Claude Code's transcripts automatically (no manual refresh in the common case).
- Cross-platform: zero-friction install on macOS (Intel + Apple Silicon), Windows x64, standard Linux.

## Non-goals (V1)

- Per-session detail page. The expanded event-list row is the deepest level.
- Per-entity contextual timelines (e.g., "sessions that used skill X" from the Skills page). Future work.
- Filters for skill or tool. Project + date range only.
- Multi-event-type timeline (config changes, profile activations). Sessions only.
- Agent-count metric. Tools / turns / tokens / skills only.

## Architecture

### Package layout

A new workspace package `packages/timeline`:

```
packages/timeline/
├── package.json
├── src/
│   ├── db.ts            # better-sqlite3 connection + migrations
│   ├── schema.ts        # SQL schema + types
│   ├── ingest.ts        # parse a single .jsonl and upsert
│   ├── backfill.ts      # walk all transcripts on first run
│   ├── query.ts         # read API used by the UI
│   └── index.ts         # public exports
└── test/
```

Consumed by:
- `@claudeui/cli` — `claudeui timeline ingest|backfill` subcommands invoked by the Stop hook and on first install.
- `@claudeui/cli` server — exposes HTTP endpoints (`GET /api/timeline/heatmap`, `GET /api/timeline/events`) that delegate to `query.ts`.
- `@claudeui/ui` — Timeline route, no direct DB access; goes through the server endpoints.

### Database

- **Engine:** `better-sqlite3`. Synchronous, fast (~50k inserts/sec), prebuilt binaries for macOS x64/arm64, Windows x64, Linux x64/arm64. Edge cases (Win ARM64, Alpine/musl) need build-from-source — documented but not blockers.
- **Location:** `~/.cui/timeline.db` (created on first run; directory is `mkdir -p`'d).
- **Schema** (V1):

```sql
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,        -- Claude Code's session UUID
  project           TEXT NOT NULL,           -- decoded cwd from ~/.claude/projects/<encoded>/
  started_at        INTEGER NOT NULL,        -- unix ms, from first message timestamp
  ended_at          INTEGER NOT NULL,        -- unix ms, from last message timestamp
  duration_ms       INTEGER NOT NULL,        -- ended_at - started_at
  turns             INTEGER NOT NULL,        -- count of user/assistant turn pairs
  tokens_input      INTEGER NOT NULL DEFAULT 0,
  tokens_output     INTEGER NOT NULL DEFAULT 0,
  tokens_cached     INTEGER NOT NULL DEFAULT 0,
  summary           TEXT,                    -- auto-generated title if present, else first user message
  summary_source    TEXT NOT NULL,           -- 'auto' | 'first_message'
  transcript_path   TEXT NOT NULL,           -- absolute path to the .jsonl
  last_offset       INTEGER NOT NULL,        -- byte offset of last parsed line (for incremental ingest)
  ingested_at       INTEGER NOT NULL         -- unix ms, when this row was last upserted
);

CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);

CREATE TABLE session_tools (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,                 -- e.g., 'Read', 'Edit', 'Bash'
  call_count  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tool_name)
);

CREATE TABLE session_skills (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,                 -- e.g., 'brainstorming', 'investigate'
  PRIMARY KEY (session_id, skill_name)
);

CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
-- meta keys: 'schema_version', 'last_full_backfill_at'
```

- **Migrations:** keyed off `meta.schema_version`. V1 ships as version 1.

### Ingest

**Per-session upsert flow** (`ingest.ts`):

1. Open the `.jsonl` file at `transcript_path`. If a row exists for this `session_id`, seek to `last_offset` and stream forward; otherwise stream from byte 0.
2. Parse new JSONL lines. For each line, derive:
   - First/last timestamps (for `started_at` / `ended_at`).
   - Turn count (count of user-role messages).
   - Token usage from message metadata (Claude Code logs `usage` per assistant message).
   - Tool calls (assistant messages with `tool_use` content blocks → bump `session_tools.call_count`).
   - Skill invocations (tool calls to the `Skill` tool → record `tool_input.skill` in `session_skills`).
   - Summary: if a `summary` field is present in the transcript header, use it (`summary_source = 'auto'`). Otherwise, the first user-role message text, truncated to 140 chars (`summary_source = 'first_message'`).
3. UPSERT the `sessions` row inside a transaction. Update `last_offset` to current EOF position. Bump `ingested_at`.
4. Idempotency: re-running on the same file with no new bytes is a no-op (offset already at EOF).

**Triggers:**

- **Primary — Claude Code Stop hook.** Configured in `~/.claude/settings.json`:
  ```json
  {
    "hooks": {
      "Stop": [
        {
          "matcher": "",
          "hooks": [
            { "type": "command", "command": "claudeui timeline ingest --session $CLAUDE_SESSION_ID" }
          ]
        }
      ]
    }
  }
  ```
  Stop fires on every agent turn — fine because ingest is idempotent and incremental.
- **Fallback — SessionEnd hook.** Documented as an alternative for users who find Stop too chatty.
- **One-time backfill.** `claudeui timeline backfill` walks `~/.claude/projects/**/*.jsonl` and ingests every transcript not yet in the DB. Runs automatically on first launch (gated by `meta.last_full_backfill_at`); also invokable manually.

**CLI surface:**

```
claudeui timeline ingest [--session <id>] [--file <path>]   # one session, idempotent
claudeui timeline backfill [--force]                        # walk all transcripts
claudeui timeline doctor                                     # diagnose hook setup, DB health
```

### Read API

`packages/timeline/src/query.ts` exposes:

- `getHeatmap({ from, to, metric, project? }) → { date, value }[]` — 365 days of daily aggregates. `metric` ∈ `'sessions' | 'turns' | 'tokens'`.
- `getEvents({ from, to, project?, limit, cursor }) → { day, projectGroups: [{ project, sessions: [...] }] }[]` — paged by day; one cursor per call.
- `getSession(sessionId) → SessionDetail` — used if/when expanded rows want to lazy-load the per-session tool/skill list (default: prefetched in `getEvents`).

The CLI dev server exposes these as JSON over HTTP at `/api/timeline/*`.

## UI

### Route and navigation

- New route: `/timeline`.
- Default route remains `/profiles` (per DESIGN.md 2026-04-26 decision; not changed).
- Sidebar entry — appears in **both** Profiles' sidebar and Explorer's sidebar (Interpretation 1: same route, two entry points for discoverability).
  - Label: `Timeline`
  - Icon: `lucide-react Activity` (heartbeat line)
- Header chrome propagation: active-profile chip and ⌘K pill render on this route per DESIGN.md rules.

### Page layout

Top to bottom:

1. **Heatmap controls bar**
   - Metric toggle (segmented control): `Activity` (default) · `Tokens`. **Activity** = `sessions + turns` per day (composite intensity signal — turns dominate naturally and that's the better signal for "how busy was this day"). **Tokens** = sum of input + output + cached tokens per day.
   - Project filter (dropdown): `All projects` (default) + one entry per known project.
   - Year picker (dropdown): defaults to current year. Lists only years with ≥1 session — empty years are not selectable.
   - Right-aligned summary meta (Berkeley Mono `text-quaternary`): `<N> sessions · <N> turns · <N> tokens` for the selected window. Mirrors the dimensions of the metric toggle.
2. **Heatmap** — single 53×7 grid covering the selected calendar year (Jan 1 → Dec 31). Future cells in the current year render as bucket 0.
   - Cell size 10×10, gap 4. Grayscale luminance steps per DESIGN.md (5 buckets), scaled relative to the selected metric's distribution within the window.
   - Hover tooltip:
     - `Activity` mode → `<N> sessions · <N> turns` headline + `<date>` subline.
     - `Tokens` mode → `<N> tokens` headline + `<date>` subline.
   - Click a cell → scrolls the event list to that day's heading.
3. **Event list** — chronological, newest first. Grouped by day, then by project.

### Event list anatomy (V1 — two-level)

Day heading (text-primary, 13px Berkeley Mono, sticky, fade-to-page-bg gradient under it):
```
Apr 30, 2026 · Today                  5 sessions · 142 turns · 410k tokens
```
The trailing summary is `text-quaternary` Berkeley Mono.

Per-project rollup row (one per project that had activity that day):
```
▸ claudeui    3 sessions · 84 turns · 240k tokens · 6 tools · 3 skills    10:14 → 18:42
```
- Collapsed: `padding 7px 14px`, `margin-bottom 1px`, `rounded-md`. Open: `padding 10px 14px` for breathing room above the expanded block.
- Hover bg `rgba(255,255,255,0.02)`.
- Disclosure caret rotates 90° on open (lucide ChevronRight).
- Project name in Inter `13px / weight 510 / text-primary`. Counts in Berkeley Mono `text-tertiary`. Time-range on the right in Berkeley Mono `text-quaternary`.
- **Counts only — no names.** Tools and skills shown as totals (`6 tools · 3 skills`), not as comma-separated lists. Names are too noisy for the rollup row; if needed, surface in a future hover or detail view.

Expanded session rows (indented 28px under their rollup, separated by a 1px `border-subtle` left rail — no connector lines):
```
●  Add timeline view to the explorer                          14:32 · 38 min
   23 turns · 84k tokens · 4 tools · 1 skill
```
- Line 1: dot (8px, grayscale per DESIGN.md) · summary (text-primary 14px/510, truncate with ellipsis) · right: `HH:MM · <duration>` (Berkeley Mono, text-tertiary).
- Line 2: meta (Berkeley Mono 11px text-tertiary) — `<turns> · <tokens> · <N> tools · <N> skills`. **Counts only**, mirroring the rollup row.
- Summary rendering rule:
  - `summary_source = 'auto'` → render plain (curated title).
  - `summary_source = 'first_message'` → render wrapped in typographic quotes (`""`) — the quote marks are the trust signal that this is raw user input, not a generated title.

### Loading and empty states

- **First load (no DB yet):** show a centered card — "Setting up your timeline. This runs once and indexes your past Claude Code sessions." Backfill runs in the background; UI polls `/api/timeline/status` and renders the page when ready. Per DESIGN.md, no skeletons.
- **No sessions ever:** centered card — "No Claude Code sessions yet. Run a Claude Code session in any project and your activity will show up here." Includes link to docs on the Stop hook.
- **Filter yields no results:** inline `text-tertiary` row — "No sessions match the current filters."

### Pagination / scrolling

- Event list lazy-loads in **day-sized batches**. Initial render = today + previous 14 days. Scroll to bottom → loads next 30 days.
- Cursor = oldest day already loaded. Server returns up to N days at a time.

## Cross-cutting concerns

### Performance

- Backfill of ~1k sessions × ~5k JSONL lines each ≈ 5M lines. With better-sqlite3's prepared-statement upserts in a single transaction, target backfill < 30s on a 2024 MacBook. Show a progress indicator if it exceeds 2s.
- Heatmap query is one indexed `GROUP BY date(started_at, 'unixepoch')` — sub-10ms for 365-day window even with 10k sessions.
- Event list query is paged by day; never returns more than ~50 sessions per request.

### Privacy

- All data stays local in `~/.cui/timeline.db`. No network calls. Document this in the README and on the Timeline empty-state card.

### Failure modes

- **Malformed JSONL line:** skip the line, log to stderr, continue. Do not abort the whole session ingest.
- **Transcript file deleted:** corresponding session row is retained (last known state). A future "purge orphans" command can clean these up; not in V1.
- **Two parallel `ingest` invocations on the same session** (e.g., overlapping Stop hooks): better-sqlite3's transaction + `last_offset` check serializes them safely. The second sees no new bytes and no-ops.
- **Stop hook not configured:** `claudeui timeline doctor` detects this and prints the snippet to add to `~/.claude/settings.json`.

### Testing

- Unit tests for the JSONL parser using fixture transcripts checked into `packages/timeline/test/fixtures/`.
- Integration test: ingest a fixture, query, assert shape.
- Idempotency test: ingest the same file twice, assert exactly one row and identical aggregates.
- Migration test: open a V0 DB, apply migrations, assert schema_version = 1.

## Open questions

- **Hook installation UX:** Should `claudeui` offer a one-shot `claudeui timeline install-hook` that edits `~/.claude/settings.json` for the user, or should we document the snippet and let the user paste it? Lean toward the auto-install with a confirmation prompt.
- **Token formatting in dense rows:** `84k` vs `84,231`? Lean toward `k`/`m` rounding everywhere — the wireframe uses rounded throughout. Exact numbers add visual weight that fights the "scannable list" job.
- **Cell luminance scaling:** absolute (a global threshold) or relative (per-user p95 = darkest)? GitHub uses a per-user dynamic scale — we match, but the buckets stay fixed at 5.
- **Tool/skill names:** rollup and session meta lines now show counts only (`4 tools · 1 skill`). If users need to see *which* tools/skills, a hover popover on the count is the natural V2 affordance — costs nothing to add later.

## Design decisions (locked, 2026-05-01)

These were resolved during wireframe iteration. Decisions Log entries in DESIGN.md mirror these.

- **Metric toggle is `Activity | Tokens`, not `Sessions | Turns | Tokens`.** Activity is a composite (`sessions + turns`); turns dominate naturally and that's the better intensity signal. Tooltip surfaces both sessions and turns so users still see the breakdown.
- **Year selector, not date-range presets.** Calendar year is the heatmap's native unit (53 weeks ≈ 1 year). Custom ranges and "last N days" presets would either break the 53×7 grid shape or scale weirdly. Picker only lists years with activity.
- **Counts over names in dense rows.** Rollup and session meta lines show `N tools · N skills`. Names belong in a hover/detail surface, not the row.
- **No connector lines between rollup and expanded sessions.** A 28px indent + 1px `border-subtle` left rail is enough; vertical connectors read as gantt-energy.
- **Sticky day headings with fade-to-bg gradient.** Content slides under the heading cleanly without a hard rule.

## Wireframe

Pixel-level reference: `~/.gstack/projects/JiangWeixian-claudeui/designs/timeline-20260430/wireframe.html`

Open it before changing controls bar / heatmap / event list layout — the placement is settled there.

## References

- DESIGN.md — Timeline component spec (visual), Layout & Interaction rules, Decisions Log.
- `~/.claude/projects/**/*.jsonl` — Claude Code transcript format (one JSON object per line: user/assistant messages with `usage`, `content`, tool calls).
- Claude Code hooks reference (Stop, SessionEnd) — used for ingest triggers.
