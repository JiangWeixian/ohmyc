# Usage ledger rollout and rollback

The v5 upgrade adds `token_usage_events` and `usage_event_coverage`. It preserves
`sessions`, `session_tools`, `session_skills`, transcripts and cumulative token
values. Backfill writes only the two new tables. Schema changes and each session
write are transactional. Legacy `INSERT OR REPLACE` cannot cascade-delete usage
because the ledger deliberately has no foreign key to the session table;
readers join source and session ID to exclude orphaned events.

## Statistics

- `meta.usage_mode=events`: count disjoint input, output and cache at source event
  timestamps. Codex cumulative snapshots become deltas; Claude and OpenCode
  message updates replace the same event. Missing timestamps/counter resets are
  marked partial, never assigned to the import time.
- `meta.usage_mode=session` (also the default when absent): previous session-start
  queries, including session lifetime token totals.
- Native tray: current local calendar week, Monday inclusive to next Monday
  exclusive. Popover: 16 weeks; Sessions counts distinct sessions across the
  whole range. Token heatmaps use local days in event mode. Turns, session lists,
  session details and Monitor remain lifetime/session-start views.
- Coverage is conservative: missing sources, partial parses and disagreement
  with stored session totals are recorded in coverage metadata. Historic data can remain partial; the popover retains its original layout without an added scope line.
- Updates arrive when the host emits its collection hook/message update. The
  native tray polls SQLite every 30 seconds; this is not streaming token telemetry.

## Normal rollback (preserves new data)

Right-click the menu bar and uncheck **Count usage when it occurred**. Both sets
of records remain in place. Rechecking returns to event-time statistics.

If the app cannot open, from the repository after building `@ohmyc/timeline`:

```sh
node packages/timeline/scripts/usage-ledger.mjs session "$HOME/.config/ohmyc/timeline.db"
```

The database path is `$OHMYC_HOME/timeline.db` when OHMYC_HOME is configured.
Keep the current database, including its WAL, when reverting application or
plugin binaries. The old plugin can keep writing sessions; event coverage then
becomes stale until a new collector/backfill reconciles it. Never downgrade
`schema_version` or drop the new tables as part of normal rollback.

## Backfill and backup

```sh
pnpm --filter @ohmyc/timeline build
node packages/timeline/scripts/usage-ledger.mjs backfill "$HOME/.config/ohmyc/timeline.db" "$HOME/.local/share/opencode/opencode.db"
node packages/timeline/scripts/usage-ledger.mjs events "$HOME/.config/ohmyc/timeline.db"
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

Tests cover cross-day/week attribution, cache counted once, duplicate snapshots,
transaction rollback, and stale coverage. On a copy of the real database,
backfill preserved every original session/tool/skill field; the archived Codex
plugin wrote successfully to v5 without removing new events; the archived app
started successfully against that same v5 copy. SQLite integrity check passed.

The plugin repository pins the rebuilt shared package as a hash-named vendored
tarball so its bundled Node and Bun runtimes use the same schema/writer. Replace
that development dependency with a published package version during release.
