---
"@ohmyc/cli": minor
"@ohmyc/timeline": minor
---

Rename `CUI_HOME` to `OHMYC_HOME` and move the default managed-data directory from `~/.cui/` to `~/.config/ohmyc/`.

**Breaking:** `CUI_HOME` is no longer read. Anyone exporting it must rename to `OHMYC_HOME`.

- New env var: `OHMYC_HOME` (absolute path). The old `CUI_HOME` is no longer read by the CLI or `@ohmyc/timeline`.
- New default directory: `~/.config/ohmyc/`. Profiles, store, settings, timeline DB, and logs all live here.
- Existing users: on first launch of the new CLI, `~/.cui/` is automatically renamed to `~/.config/ohmyc/`. No manual action needed unless `~/.config/ohmyc/` already exists, in which case the CLI leaves both alone — move data manually if desired.
- The `timeline` plugin hook keeps reading from `~/.cui/` as a final fallback (only when `OHMYC_HOME` is unset and neither `~/.config/ohmyc/` nor `~/.cui/` was migrated yet).
