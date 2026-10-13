# Usage ledger rollout and rollback

The v5 upgrade adds `token_usage_events` and `usage_event_coverage`. It preserves
`sessions`, `session_tools`, `session_skills`, transcripts and cumulative token
values. Backfill writes only the two new tables. Schema changes and each session
write are transactional. Legacy `INSERT OR REPLACE` cannot cascade-delete usage
because the ledger deliberately has no foreign key to the session table;
readers join source and session ID to exclude orphaned events.

## Statistics

- Tokens use source-event `occurred_at` when a matching `(source, session_id)`
  has any event records. Sessions with no matching events retain their cumulative
  token totals at `sessions.started_at`. Codex cache is counted once in both paths.
  Event records and legacy totals are mutually exclusive per source/session.
  The existence check spans all dates, so events outside the selected range do
  not cause the same session's lifetime total to be counted again inside it.
- An absent or empty event table preserves the old token totals. When an event
  collector or optional backfill later supplies events, those events replace
  that session's fallback in the query; nothing is rewritten in the database.
  Partial event-backed sessions use their recorded events only, without adding
  an undated difference or a second lifetime total.
- Sessions totals independently count `sessions.started_at`. Zero tokens, missing
  events, incomplete coverage and multiple events never change that count.
  Session calendar days retain the existing UTC date boundaries; token calendar
  days use local time for events and the original UTC creation date for legacy totals.
  Summary date ranges use the same boundaries as the creation-based `sessions`
  heatmap metric.
- Popover charts currently show usage by events. Both the heatmap and area-chart
  tooltips use `event_sessions`: distinct sessions with matching events on each
  local `occurred_at` date. Continued old sessions count that day; multiple events
  count once. Daily active counts do not determine the Sessions KPI. Missing event
  records (including a missing event table) contribute no event sessions; legacy
  Tokens remain visible without inventing historical active sessions. A future
  by-session chart can use the existing creation-based `sessions` metric.
- Native tray: current local calendar week, Monday inclusive to next Monday
  exclusive, applied independently to event time and session creation time.
  Popover: rolling 16 weeks. Turns, session lists and session details retain their
  session-start/lifetime semantics.
- Timeline header: Sessions, Turns and Tokens all cover the complete selected
  Year and Project, regardless of list pagination or the Activity/Tokens tab.
  Sessions and Turns sum the corresponding creation-date daily aggregates;
  Tokens sum the same event-time/legacy daily dataset rendered by the Tokens
  heatmap. Header values are no longer taken from global status or the most
  recent 60 loaded session dates. Loading/query errors show an em dash, while a
  valid empty range shows zero.
- `meta.usage_mode` is ignored by the new app whether `session`, `events` or
  absent. Installing and restarting the app is sufficient; no plugin update,
  preference change, migration or maintenance command enables this behavior.
  The native menu now contains only **Open OhMyC** and **Quit OhMyC**.
- Summaries keep numeric `tokens` values, including for old databases. Only
  actual database/query failures display unavailable data. Historical fallback
  totals are never assigned to today unless the session itself was created today.
- Coverage remains conservative: missing sources, partial parses and disagreement
  with session totals remain incomplete. Missing coverage metadata marks all
  sessions incomplete without hiding session statistics.
- Updates arrive when the host emits its collection hook/message update. The
  native tray polls SQLite every 30 seconds; this is not streaming token telemetry.

## Binary rollback (preserves data)

The old preference field and the maintenance script's `session`/`events`
commands remain for compatibility with older binaries only. They do not change
statistics in the new app. Keep the current database, including its WAL, when
reverting application or plugin binaries. Never downgrade `schema_version` or
remove historical tables/data as part of rollback.

The database path is `$OHMYC_HOME/timeline.db` when OHMYC_HOME is configured,
otherwise `~/.config/ohmyc/timeline.db`.

## Backfill and backup

Optional historical backfill is separate from the app statistics fix. This fix
does not repair Grok Node setup, add event adapters, or reconstruct missing source-event timestamps.


```sh
pnpm --filter @ohmyc/timeline build
node packages/timeline/scripts/usage-ledger.mjs backfill "$HOME/.config/ohmyc/timeline.db" "$HOME/.local/share/opencode/opencode.db"
node packages/timeline/scripts/usage-ledger.mjs status "$HOME/.config/ohmyc/timeline.db"
```

The OpenCode source database argument is optional. Backfill first makes a
consistent SQLite backup (including committed WAL contents), checks integrity,
and prints its location. It aborts before migration if the backup fails. It is
safe to repeat. Source databases/transcripts are read-only.

A pre-upgrade app/plugin/database snapshot for this local rollout is recorded in
`~/.config/ohmyc/backups/before-usage-events-20260927-145111/manifest.json`.
It contains the runnable previous app and installed runtime directories. To
revert code, quit OhMyC, restore those runtime files at the paths in the manifest,
launch the saved app, and restart the relevant host when necessary. Retain the
**current** database.

Restoring the old database snapshot is disaster recovery only: stop writers and
back up the current database first. Replacing it would otherwise discard usage
collected since that snapshot. Ordinary rollback never needs this operation.

## Verification

The 2026-10-12 compatibility revision was checked against a consistent SQLite
backup, leaving the original untouched. For 2026-06-23 through 2026-10-12 (112
days), direct session SQL, Rust/TypeScript summaries and summed creation-day counts all
returned **7,183 sessions**. Tokens total **15,486,511,327**: **630,072,064** from
events plus **14,856,439,263** from 7,168 sessions without matching events.
Both readers' daily token sums match that total. Nonzero token dates increase
from **15** with events alone to **100** with compatibility fallback; peak is
**2,410,041,085** on 2026-06-25. Absent, `session` and `events` preferences all
produce identical results after closing and reopening the copy. No migration
or backfill was run on it.

The event-tooltip revision separately compared all 112 daily `event_sessions`
values with direct event-date SQL in both readers. The copy has 15 dates with
events and 35 summed daily active-session counts; these are not the Sessions
KPI. On 2026-10-12 it has 5 event-active sessions versus 4 created sessions.
The 7,183-session KPI and 15,486,511,327 Tokens remain unchanged. UI regression
coverage exercises both chart tooltips with 2 event-active sessions while the
16-week creation-based KPI shows 5; the same case is available in Storybook as
`Menubar/MenubarPage — Event Sessions Tooltips`.

The Timeline header revision was checked on the same copy for two years and
four project scopes (all projects, two selectable projects, and a missing
project). All eight combinations matched direct session/turn SQL and the
event-plus-legacy token aggregate. For 2026 / All projects, the full totals are
**7,233 sessions · 22,632 turns · 15,571,162,657 tokens**, versus
6,640,717,478 Tokens in the first 60 session-date groups. The `Full Range Totals`
Storybook case and UI regressions cover filtered totals, pagination independence,
unchanged totals when switching chart tabs, empty results and unavailable data.

Regression tests cover independent zero-token/uncovered sessions, multiple
usage events, cross-week continued sessions, all three old preferences, missing
event tables and exact session calendar boundaries. The native tray and popover
retain historical cumulative Tokens when matching event records are absent. Mixed-data tests cover cache semantics, project filters,
events outside the selected range and replacement of fallback by later events.
Event-session tests cover local midnight boundaries, daily deduplication, continued
old sessions, project/source matching, orphan events and missing ledger tables.

Earlier ledger rollout verification:

Tests cover cross-day/week attribution, cache counted once, duplicate snapshots,
transaction rollback, and stale coverage. On a copy of the real database,
backfill preserved every original session/tool/skill field; the archived Codex
plugin wrote successfully to v5 without removing new events; the archived app
started successfully against that same v5 copy. SQLite integrity check passed.

The plugin repository pins the rebuilt shared package as a hash-named vendored
tarball so its bundled Node and Bun runtimes use the same schema/writer. Replace
that development dependency with a published package version during release.
