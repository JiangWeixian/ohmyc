# Timeline Contract Test Fixtures

Frozen inputs + expected outputs for the slice-2 desktop-migration contract test.
The TS `packages/timeline` query layer and the Rust `ohmyc-core::timeline` module
both read `seed.sql` and must produce JSON identical (after the
aggregated-projection step) to the files in `expected/`.

Both test sides:
- Build a fresh in-memory SQLite DB from `seed.sql`.
- Run the same queries (heatmap with `from=2026-01-01, to=2026-01-03, metric=tokens`,
  events with no filters, years, projects, status).
- Project to the comparable shape (strip `sessions[]` from events, normalize
  camelCase vs snake_case keys).
- `assertEqual` against the `expected/*.json` file.

To regenerate the expected outputs after intentional schema changes:
1. Update `seed.sql` and the test query parameters.
2. Run the TS contract test once with a "write expected on mismatch" env flag
   (see `packages/timeline/tests/contract.test.ts`).
3. Manually inspect the diff; commit if intentional.
4. Run the Rust contract test (`cargo test -p ohmyc-core --test timeline_contract`)
   and confirm it agrees.

Drop this directory when slice 7 (Cleanup) deletes `packages/cli/src/server`
and the TS `packages/timeline` query layer is no longer used by any UI.
