# Rename `CUI_HOME` → `OHMYC_HOME`, default to `~/.config/ohmyc`

**Date:** 2026-05-08
**Status:** Approved (brainstorming complete, awaiting implementation plan)

## Goal

Replace the legacy `CUI_HOME` environment variable and `~/.cui/` default directory with `OHMYC_HOME` and `~/.config/ohmyc/`. Existing users' data is migrated automatically on next CLI start.

## Motivation

- `CUI_HOME` predates the `ohmyc` brand and is inconsistent with the rest of the env var surface (`OHMYC_LOG_CONSOLE`, the `ohmyc` CLI binary, the `@ohmyc/*` package scope).
- `~/.cui/` is a top-level dotfile in `$HOME`; `~/.config/ohmyc/` follows the conventional XDG-style location and keeps `$HOME` cleaner.

## Scope

### Runtime call sites

1. `packages/cli/src/server/services/config-locator.ts` — drops the `WRITE_DIR_NAME = '.cui'` constant; reads `OHMYC_HOME`; default path becomes `path.join(os.homedir(), '.config', 'ohmyc')`.
2. `packages/cli/src/logger.ts` — hardcodes `~/.cui/logs`; switch to `~/.config/ohmyc/logs` (must agree with `ConfigLocator` so respect `OHMYC_HOME` here too).
3. `packages/timeline/src/db.ts` — reads `OHMYC_HOME`; default `~/.config/ohmyc/timeline.db`.
4. `plugins/timeline/hooks/ingest.sh` — reads `OHMYC_HOME` with a graceful fallback to `~/.cui` while un-migrated installs catch up (see below).
5. `plugins/timeline/opencode.ts` — reads `CUI_HOME`; switch to `OHMYC_HOME` with the same `~/.config/ohmyc` default. (OpenCode plugin runs from the same home as the CLI.)

### Docs

- `packages/cli/README.md` (env var table + directory layout block)
- `plugins/timeline/README.md`
- `docs/USER_GUIDE.md`
- `docs/DEVELOPER_GUIDE.md`

Search-replace `CUI_HOME` → `OHMYC_HOME` and `~/.cui` → `~/.config/ohmyc`. **Exclude** historical records under `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/superpowers/debug/`, and `.changeset/*.md` — these are frozen-in-time records.

### Tests

- `packages/cli/tests/server/services/config-locator.test.ts`
- `packages/cli/tests/server/routes/timeline.test.ts`
- `packages/timeline/tests/db.test.ts`
- `plugins/timeline/tests/ingest.sh.test.ts`

Update env-var references. Add one new test for the migration path (see below).

## Design

### Env var and default path

- New env var name: **`OHMYC_HOME`**
- New default path: **`~/.config/ohmyc/`**
- `CUI_HOME` is **not** read by the CLI or `packages/timeline/`. The hook reads the old default *path* as a fallback (see below) but does not honor the old env var.

### CLI auto-migration

Runs once on CLI startup (in `packages/cli/src/launcher.ts`), before any read/write touches the managed data directory:

```
if process.env.OHMYC_HOME is unset
  target = ~/.config/ohmyc
  legacy = ~/.cui
  if !exists(target) && exists(legacy)
    mkdirSync(~/.config, { recursive: true })
    fs.renameSync(legacy, target)
    log.info(`Migrated ${legacy} → ${target}`)
```

- Single `fs.renameSync` — atomic on the same filesystem.
- If `OHMYC_HOME` is explicitly set, the CLI does **not** migrate (user has chosen a custom location).
- If `rename` throws (cross-device link, permissions), log the error with both paths and exit with a non-zero code and a clear message: `"Could not migrate ~/.cui to ~/.config/ohmyc automatically. Please move it manually and restart."` No partial-state recovery — the rename either fully succeeds or fully fails.

### Hook fallback (`ingest.sh`)

The hook fires from Claude Code's hook system on every turn and may run before the user next launches `ohmyc`. It must read from the legacy path until migration occurs.

```sh
if [ -n "$OHMYC_HOME" ]; then
  OHMYC_DIR="$OHMYC_HOME"
elif [ -d "$HOME/.config/ohmyc" ]; then
  OHMYC_DIR="$HOME/.config/ohmyc"
elif [ -d "$HOME/.cui" ]; then
  OHMYC_DIR="$HOME/.cui"
else
  OHMYC_DIR="$HOME/.config/ohmyc"
fi
DB_PATH="$OHMYC_DIR/timeline.db"
```

The hook does **not** honor `CUI_HOME` (a stale shell export shouldn't silently keep working under the new name). Once the CLI migrates, `~/.cui/` is gone and the hook naturally settles on the new path.

### Test additions

- New test in `config-locator.test.ts` (or a new `launcher.test.ts` if migration logic lives there): pre-create a temp `~/.cui` with a file inside, run the migration step with `OHMYC_HOME` unset and a temp `$HOME`, assert the directory moved and the file is reachable at `~/.config/ohmyc/`.
- New test for the hook's fallback chain in `ingest.sh.test.ts`: with `OHMYC_HOME` unset and only `~/.cui` present, assert `DB_PATH` resolves under `~/.cui`.

## Out of scope

- Backward compatibility for the `CUI_HOME` env var at the CLI level.
- A `.migrated` marker file (the existence of `~/.config/ohmyc/` itself is sufficient signal).
- Changes to `AGENT_HOME` or `~/.claude/` paths.
- Renaming any internal symbol beyond the `WRITE_DIR_NAME` constant removal.

## Rollout

- Single PR, single changeset entry (minor — user-visible env var rename).
- README env var table updated alongside the code change.
- No deprecation period: hard cutover for the env var, automatic migration for the data directory.
