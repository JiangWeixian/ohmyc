# @ohmyc/cli

## 0.2.0

### Minor Changes

- d40c494: Brand ASCII art banner, CLI rename, and logging improvements

  - Add slanted italic ASCII art banner displayed on every CLI command
  - Rename CLI from `cu` to `ohmyc` for consistency with package name
  - Replace console.\* with pino logger supporting file rotation via pino-roll
  - Logs written to ~/.cui/logs/ohmyc.log with daily rotation
  - Console logging disabled by default, enable with OHMYC_LOG_CONSOLE=true
  - Fix build script to use rimraf for cross-platform compatibility
  - Whitelist plugin assets to avoid copying unnecessary files
  - Disable pino-roll symlink in CI/test environments to prevent race conditions

- f655fa1: Rename `CUI_HOME` to `OHMYC_HOME` and move the default managed-data directory from `~/.cui/` to `~/.config/ohmyc/`.

  **Breaking:** `CUI_HOME` is no longer read. Anyone exporting it must rename to `OHMYC_HOME`.

  - New env var: `OHMYC_HOME` (absolute path). The old `CUI_HOME` is no longer read by the CLI or `@ohmyc/timeline`.
  - New default directory: `~/.config/ohmyc/`. Profiles, store, settings, timeline DB, and logs all live here.
  - Existing users: on first launch of the new CLI, `~/.cui/` is automatically renamed to `~/.config/ohmyc/`. No manual action needed unless `~/.config/ohmyc/` already exists, in which case the CLI leaves both alone — move data manually if desired.
  - The `timeline` plugin hook keeps reading from `~/.cui/` as a final fallback (only when `OHMYC_HOME` is unset and neither `~/.config/ohmyc/` nor `~/.cui/` was migrated yet).

- 5c5edd7: Explorer gains an opencode provider, per-source filtering, and origin-aware entity cards.

  - Shared: `Agent`/`Skill`/`Command` schemas carry optional `origins` and `badges` fields; new `OriginEnum` and `RenderBadgeSchema` Zod exports.
  - CLI: `/api/{agents,skills,commands}` and their detail routes flow through the provider registry; responses include provider-supplied `badges` and `origins`. Detail handlers resolve entities via the registry for any source (origin, project, local), fixing 404s on `source=opencode` and `source=project`.
  - UI: new Explorer-only `<SourceSwitcher>` header dropdown (last-on guard, persisted to `localStorage` as `ohmyc.sources`); `useAgents`/`useSkills`/`useCommands` thread the selection through a sorted `?origins=` query and cache key. `EntityCard` renders an origin chip plus provider-driven badges instead of per-type schema branching. Detail panel surfaces opencode `mode` and flattens one-level frontmatter objects (e.g. `permission.edit`).

### Patch Changes

- d361ce2: Read `enabledPlugins` from `~/.claude/settings.json`, project `.claude/settings.json`, and `.claude/settings.local.json` (in that precedence order) instead of `~/.cui/settings.json`. Fixes `/api/plugins` showing every plugin as disabled because Claude Code stores plugin enable state in its own settings file.
- d361ce2: Profile activation now registers the profile as a real Claude Code plugin so it's actually loaded:

  - Generates `~/.cui/.claude-plugin/marketplace.json` (id `ohmyc-profiles`) listing every profile as a plugin entry pointing at `./profiles/<name>`.
  - Registers `ohmyc-profiles` in `~/.claude/plugins/known_marketplaces.json` (directory source pointing at `~/.cui`) so Claude Code can resolve the marketplace by id.
  - Writes an install record to `~/.claude/plugins/installed_plugins.json` under qualified id `profile-<name>@ohmyc-profiles`.
  - `enabledPlugins` now uses the qualified id `profile-<name>@ohmyc-profiles` (was unqualified `profile-<name>`, which Claude Code couldn't resolve).
  - Deactivation removes the install entry; rollback restores the previous `installed_plugins.json` snapshot.

- d361ce2: Profile activation now reads, writes, and backs up `~/.claude/settings.json` instead of `~/.cui/settings.json`. `enabledPlugins`, env vars, hooks, and merged profile settings land in the file Claude Code actually reads, so an activated profile's plugin selection takes effect. `/api/hooks` reads hooks across the same `.claude` settings paths as `enabledPlugins`.
- e01ec9c: Rebrand all ClaudeUI references to OhMyC across CLI output, UI components, plugin names, and docs.
- d361ce2: Rename CLI bin entries: `cu` → `cui`, `claudeui` → `ohmyc`.
- Updated dependencies [d361ce2]
- Updated dependencies [efd97e1]
- Updated dependencies [f655fa1]
- Updated dependencies [ddb8ab2]
- Updated dependencies [e01ec9c]
- Updated dependencies [5c5edd7]
- Updated dependencies [a12e63f]
  - @ohmyc/shared@0.2.0
  - @ohmyc/timeline@0.2.0
