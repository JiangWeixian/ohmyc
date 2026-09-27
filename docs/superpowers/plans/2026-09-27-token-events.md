# Timestamped Usage and Reversible Rollout

**Goal:** Count tokens at their source event time while preserving session totals and a non-destructive legacy query mode.
**Architecture:** Add token_usage_events and independent coverage metadata. Keep sessions writable by old plugins. Events have no cascading foreign key because legacy INSERT OR REPLACE deletes the parent row; logical association uses source + session ID. New writers use UPSERT and update usage and sessions in one transaction.
**Tech stack:** SQLite, TypeScript/Node/Bun ingestion, Rust/chrono readers, Tauri tray control.
**Spec:** User-approved design and rollback agreement in this task.

## Constraints and rollback
- Backup live database with SQLite backup API, verify integrity, retain runnable app/plugin copies before migration.
- Preserve source transcripts, session IDs and cumulative values; do not fabricate event history from aggregates.
- meta.usage_mode is session or events; missing mode defaults to session. Switching does not delete or rewrite usage.
- Mode controls tray totals and time-series tokens/sessions. Session lists/details remain lifetime views; preserve their existing UI labels.
- Event mode uses local calendar boundaries, weekly Monday start. Events timestamp is source time, ingestion timestamp is separate.
- Codex cumulative counters need baseline/delta handling; missing timestamps or counter resets mark partial coverage, never assign history to current time.
- Claude deduplicates message snapshots; OpenCode deduplicates messages and includes reasoning. Unsupported sources retain session totals, marked unavailable.
- Coverage tracks reconciled aggregate totals: legacy plugin writes make it stale instead of pretending complete.

## Tasks
- [x] Add additive v5 schema (v4 token_status compatibility), transaction-safe writer and mode/coverage APIs; test rollback with legacy REPLACE.
- [x] Parse source-time Claude/Codex usage with stable identifiers; replay tests, counter resets, missing time, cross-midnight/week.
- [x] Integrate installed plugin pipelines using reproducible local package artifact; OpenCode message-event support; no fake Grok/Cursor timestamps.
- [x] Add mode-aware Rust/TS summary and daily readers with timezone boundaries; retain old session listing semantics.
- [x] Add tray toggle and native tooltip coverage/scope explanations; test/build UI.
- [x] Backup, migrate/backfill recoverable history, verify totals and old binary/plugin on a database copy, switch live mode, package and verify.

## Verification
Run timeline Vitest, desktop/core Rust tests and pinned 1.97 Clippy, pnpm build, affected Storybook tests, plugin tests. Exercise both modes after a new write and prove session/usage rows remain. Record backup path and rollback commands. Never restore an old snapshot over new data during ordinary rollback.

## Rollout evidence
- Original snapshot: ~/.config/ohmyc/backups/before-usage-events-20260927-145111 (app, plugins, DB).
- Latest DB snapshot: ~/.config/ohmyc/backups/usage-ledger-2026-09-27T07-13-17-139Z/timeline.db.
- Live backfill preserved all 99 original session rows and every tool/skill field. 71 sessions supplied events.
- Installed Codex runtime reconciled active session exactly: 44,375,431 tokens in both source aggregate and usage events at verification time.
- 74 historical sessions remain unavailable or unreconciled; coverage metadata and native tooltip report incomplete history.
- Archived plugin writes and archived app startup on v5 verified against a database copy. Live query rollback restored 2.2B / 74 sessions / 785.9M peak; event mode restored afterward.
- 59 timeline, 176 UI, 36 Storybook, 26 Rust timeline and 4 tray tests passed. Pinned Rust Clippy and pnpm build passed. Plugin serial suite: 236 passed; parallel suite retains the pre-existing intermittent journal reclamation race (235 passed, 1 failed).
- Both popover chart modes were visually verified. The added scope line was subsequently removed at the user's request and native height restored to 340pt; UI, Storybook and build checks passed afterward.
- Installed runtime files updated. Running OpenCode hosts still need a restart to load their new module.
- Operational instructions: docs/usage-ledger-rollback.md. No database restore, table drop, or historical session rewrite performed.
