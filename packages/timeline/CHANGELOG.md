# @ohmyc/timeline

## 0.2.0

### Minor Changes

- f655fa1: Rename `CUI_HOME` to `OHMYC_HOME` and move the default managed-data directory from `~/.cui/` to `~/.config/ohmyc/`.

  **Breaking:** `CUI_HOME` is no longer read. Anyone exporting it must rename to `OHMYC_HOME`.

  - New env var: `OHMYC_HOME` (absolute path). The old `CUI_HOME` is no longer read by the CLI or `@ohmyc/timeline`.
  - New default directory: `~/.config/ohmyc/`. Profiles, store, settings, timeline DB, and logs all live here.
  - Existing users: on first launch of the new CLI, `~/.cui/` is automatically renamed to `~/.config/ohmyc/`. No manual action needed unless `~/.config/ohmyc/` already exists, in which case the CLI leaves both alone — move data manually if desired.
  - The `timeline` plugin hook keeps reading from `~/.cui/` as a final fallback (only when `OHMYC_HOME` is unset and neither `~/.config/ohmyc/` nor `~/.cui/` was migrated yet).

- a12e63f: Show current calendar-week usage in the macOS menu bar and format token totals consistently without counting Codex cache twice. Add timestamped usage records for activity charts, with historical backfill and a reversible session-based statistics mode that preserves existing data.

### Patch Changes

- efd97e1: Count Sessions independently by creation time and show Tokens by usage-event time, preserving historical totals for sessions without events. Remove the statistics-mode switch, keep chart tooltips event-based, and calculate Timeline header totals across the full selected year and project with automatic refresh.
- e01ec9c: Rebrand all ClaudeUI references to OhMyC across CLI output, UI components, plugin names, and docs.
