# `/api/plugins` always returns `enabled: false`

**Date:** 2026-05-03
**Symptom:** `GET /api/plugins` reports every installed plugin as `"enabled": false`, even when the plugin is installed and intended to be active.
**Status:** Root cause identified, fix not yet implemented (decision pending on profile-vs-Claude-Code semantics).

---

## Reproduction

```bash
curl -s http://localhost:5173/api/plugins | jq '.plugins[] | {id, enabled}'
```

Returns:

```json
{ "id": "superpowers@superpowers-marketplace", "enabled": false }
{ "id": "timeline@ohmyc",                       "enabled": false }
```

Both plugins are installed (`~/.claude/plugins/installed_plugins.json` lists them) and the marketplaces are registered.

---

## Root cause

`PluginService.getEnabledPlugins()` reads `enabledPlugins` from the wrong file:

```ts
// packages/cli/src/server/services/plugin-service.ts:100-103
private async getEnabledPlugins(): Promise<Record<string, boolean>> {
  const settings = await this.readJson<{ enabledPlugins?: Record<string, boolean> }>(this.settingsPath)
  return settings?.enabledPlugins ?? {}
}
```

`this.settingsPath` is wired in `server/index.ts:108` as `config.settingsPath`, which `ConfigLocator.settingsPath` resolves to **`~/.cui/settings.json`** (`config-locator.ts:49-51`, comment "D-01"). But Claude Code stores plugin enable state in **`~/.claude/settings.json`** (and project-scoped `<project>/.claude/settings.json`). The two files are owned by different systems and never synchronized.

Effect: the read always returns `{}` for the keys we care about, so `enabledMap[id] === true` is always false.

The same bug exists in `PluginResolver.getEnabledPluginPaths()` (`plugin-resolver.ts:30`) — used by `/api/agents`, `/api/skills`, `/api/commands`, and `/api/hooks` to filter plugin contributions. So the blast radius is broader than just `/api/plugins`: those routes silently exclude all plugin-contributed components.

---

## Why fixing only the file path is not enough

Even after redirecting reads to `~/.claude/settings.json`, the displayed values won't change immediately. The current state of that file is:

```json
{
  "model": "opus",
  "enabledPlugins": {},
  "extraKnownMarketplaces": { ... },
  "effortLevel": "medium"
}
```

Claude Code only writes into `enabledPlugins` when the user toggles a plugin via `/plugin` inside the Claude Code TUI. Plugin *installation* doesn't auto-enable. So the fix corrects *where* state is read from; the values surface once Claude Code itself has persisted them.

---

## Where `~/.cui/settings.json` actually fits

This file is **not** a mirror of Claude Code's settings. It is CUI's own "active-profile-merged view," populated only when a CUI profile is activated.

### Reads (5 sites)

| Location | Purpose |
|---|---|
| `plugin-service.ts:101` | Compute `enabled` flag per plugin (the bug) |
| `plugin-resolver.ts:30` | Filter plugin contributions in `/api/agents`, `/api/skills`, `/api/commands`, `/api/hooks` (same bug) |
| `configs.ts:115` | Merge user-defined `hooks` with plugin/project hooks for `/api/hooks` |
| `profile-service.ts:213` (`readSettings`) | Snapshot during profile preflight and activate |
| `profile-service.ts:319` (via `readSettings`) | Compute "would overwrite key X" warnings before activation |

### Writes (only `ProfileService`)

| Location | Trigger | What it does |
|---|---|---|
| `profile-service.ts:417` | `POST /api/profiles/:name/activate` | Back up current settings → `settings.backup.<name>.json` |
| `profile-service.ts:595` | same call | Deep-merge `current ⊕ profile.settings ⊕ model-config env vars ⊕ enabledPlugins` and write back |
| `profile-service.ts:639/647` | `POST /api/profiles/:name/deactivate` | Restore from backup |

The only way `enabledPlugins` ever gets populated in this file is profile activation (`profile-service.ts:587-593`), which seeds it from `profile.plugins` plus a synthetic `profile-<name>` entry.

### Profile state at time of investigation

- `GET /api/profiles` → `"active": null`
- `~/.cui/profiles/.active` does not exist
- Both existing profiles (`p1`, `P2`) have `plugins: []`

So no profile is active, and even activating one wouldn't populate `enabledPlugins` for `superpowers@…` or `timeline@ohmyc`.

---

## Architectural note: profile activation is partially disconnected

Profile activation writes `enabledPlugins` into `~/.cui/settings.json`, but Claude Code only reads `~/.claude/settings.json`. As a result, **activating a CUI profile does not actually enable plugins in Claude Code** — it only records the intent in CUI's own file. Either:

1. Profile activation should also write the relevant `enabledPlugins` keys into `~/.claude/settings.json` (and undo on deactivate), or
2. Profiles are intentionally a CUI-only concept and `enabledPlugins` in `~/.cui/settings.json` is dead data for the plugin-system semantics.

This needs a product decision before the fix is finalized.

---

## Proposed fix (pending decision)

### Option A — minimal: fix the read site only

1. Add `claudeSettingsPath` getter on `ConfigLocator` resolving to `path.join(this.claudeCodeDir, 'settings.json')` (parallels the existing `pluginsDir` which already resolves under `claudeCodeDir`).
2. Add a separate `claudeSettingsPath` constructor argument to `PluginService` and `PluginResolver`. Use it for `enabledPlugins` lookup. Leave the existing `settingsPath` (= CUI's file) untouched — it's still used legitimately by `configs.ts:115` (user-defined hooks) and by `ProfileService` reads/writes.
3. Update wiring in `server/index.ts` for `pluginsRoutes`, `agentsRoutes`, `skillsRoutes`, `commandsRoutes`, `configsRoutes`.
4. Update `plugin-service.test.ts` and `plugins.test.ts` fixtures to write `enabledPlugins` into a separate `claudeSettingsPath` file.

Does **not** address the profile-activation disconnect.

### Option B — also wire profile activation into `~/.claude/settings.json`

In addition to A:

1. `ProfileService.activate()` writes the profile's `plugins` to `enabledPlugins` in `~/.claude/settings.json` (with merge + backup).
2. `ProfileService.deactivateInternal()` removes those keys (or restores backup).

This makes profiles actually toggle Claude Code's plugin state. Bigger surface area, more failure modes (CUI now mutates Claude Code's settings file), but it's the only way profile activation has real semantics.

### Recommendation

Implement A first as the literal bug fix. Treat B as a follow-up that requires explicit product confirmation that profiles should drive Claude Code's plugin state.

---

## Files referenced

- `packages/cli/src/server/services/plugin-service.ts` — bug site
- `packages/cli/src/server/services/plugin-resolver.ts` — same bug, broader impact
- `packages/cli/src/server/services/config-locator.ts` — path wiring
- `packages/cli/src/server/services/profile-service.ts` — profile-driven writes to `~/.cui/settings.json`
- `packages/cli/src/server/index.ts:105-109` — route registration
- `packages/cli/src/server/routes/configs.ts:115` — legitimate non-plugin read of `~/.cui/settings.json`
