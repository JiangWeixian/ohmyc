# Desktop Migration — Slice 6: Plugins + Marketplaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `use-plugins.ts` (4 read-only hooks: `usePlugins`, `useMarketplaces` + their getters) onto native Rust Tauri commands. Completes the Explorer surface — by the end of this slice the main window is fully read-functional, satisfying the spec's "main window fully read-functional by end of slice 6" invariant before Profiles (slice 7) lands.

**Architecture:** New `ohmyc-core::plugins` module reads `<claude_home>/plugins/installed_plugins.json` and `<claude_home>/plugins/known_marketplaces.json` and walks each plugin's install dir to scan `agents/`, `skills/`, `commands/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`. Enabled state merges `enabledPlugins` from the ordered settings paths (low → high precedence). Scope cut mirrors slice 4 settings: only `<claude_home>/settings.json` for now — project-level settings paths land alongside profiles in slice 7. Read-only by design; no writes, no watchers (the existing `~/.claude/` recursive watcher already emits `fs:changed` for these files — we just add invalidation matchers).

**Tech Stack:** Rust (`serde_json::Value` for opaque pass-through of installs/manifest/hooks/mcp/lsp; reuses `dirs`, `gray_matter` deps from prior slices — but plugins doesn't parse Markdown, only JSON). TypeScript (existing transport seam + React Query infrastructure).

---

## Scope cut

In scope:
- 4 read hooks: `plugins.list`, `plugins.get`, `marketplaces.list`, `marketplaces.get`.
- Install-dir component scan (agents/skills/commands/hooks/mcp/lsp).
- Enabled-plugin merge from a single settings path (`<claude_home>/settings.json`).
- `fs:changed` invalidation matchers for `installed_plugins.json`, `known_marketplaces.json`, and `settings.json` (since enabled state lives there).

Out of scope (explicit deferrals):
- **Multi-path settings merge** (user + project + project-local). Slice 4 already deferred project settings paths; slice 7 (profiles) is the natural home since profiles introduce per-project context.
- **Configs plugin/project merge** (a comment in `crates/ohmyc-core/src/configs.rs:1-3` says "plugin contributions and project-local overrides land in slice 6"). This is a separate broader refactor of `configs.rs::mcp_servers/hooks/lsp_servers` to merge contributions across plugin install dirs + project paths. Keeping slice 6 to `use-plugins.ts` only mirrors the slice-5 scope-cut discipline that defers bulk-import. Track as a follow-up after slice 8.
- **Plugin enable/disable mutation.** The TS server never exposed it; the UI doesn't either. Out for now.
- **TS server deletion** (`packages/cli/src/server/routes/plugins.ts`, `services/plugin-service.ts`, their tests). Per spec line 241: "Keep the TS server endpoint alive until the last slice." Deletion happens in slice 8.

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/plugins.rs` — domain types + `list_plugins`, `get_plugin`, `list_marketplaces`, `get_marketplace`, plus internal helpers (`read_enabled_plugins`, `load_manifest`, `scan_components`).
- `packages/desktop/src-tauri/src/api/plugins.rs` — 4 Tauri command wrappers.
- `packages/ui/src/hooks/use-plugins.test.tsx` — new vitest coverage against the mock transport.

**Modified files:**
- `crates/ohmyc-core/src/lib.rs` — `pub mod plugins;`.
- `crates/ohmyc-core/src/claude_home.rs` — add `plugins_dir()` and `settings_path()` helpers (parallel to slice-3 `agents_dir()` pattern, keeps path resolution out of the plugins module so tests can use `tempdir().join(...)` directly).
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod plugins;`.
- `packages/desktop/src-tauri/src/main.rs` — register 4 new commands.
- `packages/ui/src/lib/transport/fetch.ts` — 4 new wire-name entries (all GET).
- `packages/ui/src/hooks/use-plugins.ts` — replace raw `fetch()` calls with `request()`; preserve query keys.
- `packages/ui/src/hooks/use-fs-changed.ts` — add matchers for `installed_plugins.json` + `known_marketplaces.json`; extend settings.json matcher to invalidate `['plugins']`.

---

## Wire-name convention

- `plugins.list` → Rust `plugins_list` (`.replace('.', '_')`). Args: `{}`.
- `plugins.get` → Rust `plugins_get`. Args: `{ id: string }` (id is `name@marketplace`).
- `marketplaces.list` → Rust `marketplaces_list`. Args: `{}`.
- `marketplaces.get` → Rust `marketplaces_get`. Args: `{ id: string }`.

All four are GET — the fetch.ts entries return bare URL strings (the slice-4 `{ url, method, body }` shape is unused here, kept for the existing write entries from slices 4 and 5).

---

## Task 1: Add `plugins_dir()` and `settings_path()` helpers on `claude_home`

**Files:**
- Modify: `crates/ohmyc-core/src/claude_home.rs`

The slice-4 `settings::settings_path()` exists but lives inside the settings module; pulling it up to `claude_home` makes it reusable from `plugins`. `plugins_dir()` is the new helper.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/claude_home.rs`, inside the existing `#[cfg(test)] mod tests` block, after `join_concatenates_relative_path`, append:

```rust
    #[test]
    fn plugins_dir_resolves_under_claude_home() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = plugins_dir().unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude/plugins"));
        });
    }

    #[test]
    fn settings_path_resolves_under_claude_home() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = settings_path().unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude/settings.json"));
        });
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib claude_home 2>&1 | tail -10`
Expected: compile errors — `plugins_dir`, `settings_path` not defined.

- [ ] **Step 3: Implement the helpers**

In `crates/ohmyc-core/src/claude_home.rs`, after the existing `join` function (and before `#[cfg(test)]`), add:

```rust
/// `<claude_home>/plugins/` — where Claude Code stores `installed_plugins.json`
/// and `known_marketplaces.json`.
pub fn plugins_dir() -> Result<PathBuf, ApiError> {
    Ok(resolve()?.join("plugins"))
}

/// `<claude_home>/settings.json` — global Claude Code settings. Source of
/// the `enabledPlugins` map.
pub fn settings_path() -> Result<PathBuf, ApiError> {
    Ok(resolve()?.join("settings.json"))
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib claude_home 2>&1 | tail -10`
Expected: `test result: ok. 6 passed` (4 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/claude_home.rs
git commit -m "feat(core): claude_home::plugins_dir + settings_path helpers (slice 6 prep)"
```

---

## Task 2: Define plugin domain types

**Files:**
- Create: `crates/ohmyc-core/src/plugins.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

Mirror the TS shared schemas (`packages/shared/src/plugin-schema.ts`). TS uses `z.passthrough()` on `PluginInstallSchema` and `PluginManifestSchema`, so the Rust types capture known fields and bag everything else in `extra: Map<String, Value>` via `#[serde(flatten)]`. UI only reads `installs.length` + a few manifest fields, but preserving extras keeps JSON parity with the TS server during the dual-implementation window.

- [ ] **Step 1: Create the file with types and a failing test**

Create `crates/ohmyc-core/src/plugins.rs` with:

```rust
//! Read installed plugins and known marketplaces from
//! `<claude_home>/plugins/`. Read-only; mirrors the TS
//! `PluginService` in `packages/cli/src/server/services/plugin-service.ts`.
//!
//! Slice-6 scope cut: enabled-state merge uses a single settings path
//! (`<claude_home>/settings.json`). Multi-path merge (user + project +
//! project-local) lands with slice 7 (profiles), where per-project
//! settings context is introduced.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::ApiError;

/// One install record from `installed_plugins.json`. Known fields are
/// surfaced; arbitrary extras (passthrough on the TS side) ride in
/// `extra` so JSON round-trips don't lose data.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstall {
    pub version: String,
    pub installed_at: String,
    pub last_updated: String,
    pub install_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit_sha: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_local: Option<bool>,
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_by_presets: Option<Vec<String>>,
    /// Any additional fields preserved verbatim from the JSON source.
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// Loaded from `<installPath>/plugin.json` (or `.claude-plugin/plugin.json`).
/// All fields optional to match the TS `PluginManifestSchema.passthrough()`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginManifest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keywords: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// Components discovered by walking the install dir.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PluginComponentSummary {
    pub agents: Vec<String>,
    pub skills: Vec<String>,
    pub commands: Vec<String>,
    pub hooks: Option<Value>,
    pub mcp_servers: Option<Value>,
    pub lsp_servers: Option<Value>,
}

impl PluginComponentSummary {
    fn empty() -> Self {
        Self {
            agents: Vec::new(),
            skills: Vec::new(),
            commands: Vec::new(),
            hooks: None,
            mcp_servers: None,
            lsp_servers: None,
        }
    }
}

/// Resolved plugin for the API response. Mirrors `InstalledPluginSchema`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InstalledPlugin {
    pub id: String,
    pub name: String,
    pub marketplace: String,
    pub enabled: bool,
    pub installs: Vec<PluginInstall>,
    pub manifest: Option<PluginManifest>,
    pub components: PluginComponentSummary,
}

/// Marketplace source — `{ source, repo?, url? }` with passthrough.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketplaceSource {
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repo: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// One entry from `known_marketplaces.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Marketplace {
    pub id: String,
    pub source: MarketplaceSource,
    pub install_location: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_update: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plugin_install_passthrough_preserves_extra_fields() {
        let raw = r#"{
            "version": "1.0",
            "installedAt": "2026-01-01",
            "lastUpdated": "2026-01-01",
            "installPath": "/p",
            "scope": "user",
            "weirdField": 42
        }"#;
        let p: PluginInstall = serde_json::from_str(raw).unwrap();
        assert_eq!(p.version, "1.0");
        assert_eq!(p.scope, "user");
        assert_eq!(p.extra.get("weirdField"), Some(&serde_json::json!(42)));
        // Roundtrip
        let back = serde_json::to_value(&p).unwrap();
        assert_eq!(back["weirdField"], 42);
    }
}
```

Then open `crates/ohmyc-core/src/lib.rs` and add the module declaration:

```rust
pub mod plugins;
```

Insert it alphabetically between `pub mod error;` and `pub mod settings;` (the file already lists modules alphabetically).

- [ ] **Step 2: Run the test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: `test result: ok. 1 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): plugin domain types (mirror of shared/plugin-schema)"
```

---

## Task 3: Implement `list_marketplaces` + `get_marketplace`

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`

Marketplaces are simpler than plugins — just read `known_marketplaces.json`, transform `{ id1: info, id2: info }` → sorted `[{ id, ...info }]`. TDD-driven, matches the TS test scenarios at `packages/cli/tests/server/services/plugin-service.test.ts:278-326`.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/plugins.rs`, inside the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn list_marketplaces_returns_empty_when_no_file() {
        let dir = tempfile::tempdir().unwrap();
        let m = list_marketplaces(dir.path()).unwrap();
        assert!(m.is_empty());
    }

    #[test]
    fn list_marketplaces_parses_known_entries() {
        let dir = tempfile::tempdir().unwrap();
        let raw = serde_json::json!({
            "my-market": {
                "source": { "source": "git", "url": "https://github.com/test/repo" },
                "installLocation": "/tmp/market",
                "lastUpdated": "2026-01-01",
                "autoUpdate": true
            }
        });
        std::fs::write(dir.path().join("known_marketplaces.json"), raw.to_string()).unwrap();
        let m = list_marketplaces(dir.path()).unwrap();
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].id, "my-market");
        assert_eq!(m[0].source.url.as_deref(), Some("https://github.com/test/repo"));
        assert_eq!(m[0].auto_update, Some(true));
    }

    #[test]
    fn list_marketplaces_sorts_by_id() {
        let dir = tempfile::tempdir().unwrap();
        let raw = serde_json::json!({
            "zebra": { "source": { "source": "git" }, "installLocation": "/z" },
            "alpha": { "source": { "source": "git" }, "installLocation": "/a" }
        });
        std::fs::write(dir.path().join("known_marketplaces.json"), raw.to_string()).unwrap();
        let m = list_marketplaces(dir.path()).unwrap();
        assert_eq!(m[0].id, "alpha");
        assert_eq!(m[1].id, "zebra");
    }

    #[test]
    fn get_marketplace_returns_by_id_or_none() {
        let dir = tempfile::tempdir().unwrap();
        let raw = serde_json::json!({
            "test": { "source": { "source": "git", "url": "https://test.com" }, "installLocation": "/t" }
        });
        std::fs::write(dir.path().join("known_marketplaces.json"), raw.to_string()).unwrap();
        let found = get_marketplace(dir.path(), "test").unwrap().unwrap();
        assert_eq!(found.source.url.as_deref(), Some("https://test.com"));
        assert!(get_marketplace(dir.path(), "nope").unwrap().is_none());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: compile errors — `list_marketplaces`, `get_marketplace` not defined.

- [ ] **Step 3: Implement the marketplace functions**

In `crates/ohmyc-core/src/plugins.rs`, after the type definitions (and before `#[cfg(test)]`), add:

```rust
/// Read `<plugins_dir>/known_marketplaces.json`. Missing or malformed file
/// → empty list (matches the TS `readJson(...) ?? null` path: a corrupt
/// registry should not crash the app, it should look empty).
pub fn list_marketplaces(plugins_dir: &Path) -> Result<Vec<Marketplace>, ApiError> {
    let path = plugins_dir.join("known_marketplaces.json");
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    };
    let map: BTreeMap<String, Value> = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out: Vec<Marketplace> = Vec::with_capacity(map.len());
    for (id, info) in map {
        // Inject `id` into the value so a single `from_value` builds the
        // whole struct. Skip entries whose shape doesn't match — matches
        // the TS implicit "shape mismatch" handling (z.parse would throw,
        // but the service uses readJson which catches and treats as null).
        let Some(obj) = info.as_object() else { continue };
        let mut merged = obj.clone();
        merged.insert("id".to_string(), Value::String(id));
        if let Ok(m) = serde_json::from_value::<Marketplace>(Value::Object(merged)) {
            out.push(m);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

/// Look up a single marketplace by id. Returns `Ok(None)` when missing.
pub fn get_marketplace(plugins_dir: &Path, id: &str) -> Result<Option<Marketplace>, ApiError> {
    let all = list_marketplaces(plugins_dir)?;
    Ok(all.into_iter().find(|m| m.id == id))
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: `test result: ok. 5 passed` (1 from Task 2 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs
git commit -m "feat(core): plugins::list_marketplaces + get_marketplace"
```

---

## Task 4: Implement `read_enabled_plugins(settings_path)` helper

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`

Reads one settings.json, extracts `enabledPlugins` map. The TS service merges across multiple paths in low → high precedence; Rust uses a single path for slice 6 (per the scope cut at the top of this plan). The function is named with the multi-path future in mind (`read_enabled_plugins_from` is the single-path version; `merge_enabled_plugins` will compose them when slice 7 lifts the cut).

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/plugins.rs`, inside the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn read_enabled_plugins_from_returns_empty_when_no_file() {
        let dir = tempfile::tempdir().unwrap();
        let map = read_enabled_plugins_from(&dir.path().join("settings.json")).unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn read_enabled_plugins_from_returns_empty_when_no_field() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        std::fs::write(&settings, r#"{"other":"thing"}"#).unwrap();
        assert!(read_enabled_plugins_from(&settings).unwrap().is_empty());
    }

    #[test]
    fn read_enabled_plugins_from_parses_map() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        std::fs::write(
            &settings,
            r#"{"enabledPlugins":{"gitlab@m":true,"other@m":false}}"#,
        )
        .unwrap();
        let map = read_enabled_plugins_from(&settings).unwrap();
        assert_eq!(map.get("gitlab@m"), Some(&true));
        assert_eq!(map.get("other@m"), Some(&false));
    }

    #[test]
    fn read_enabled_plugins_from_tolerates_corrupt_json() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        std::fs::write(&settings, "not json {").unwrap();
        // A malformed settings file should not crash the plugins view —
        // mirror the TS readJson behavior (try/catch → null).
        assert!(read_enabled_plugins_from(&settings).unwrap().is_empty());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: compile error — `read_enabled_plugins_from` not defined.

- [ ] **Step 3: Implement the helper**

In `crates/ohmyc-core/src/plugins.rs`, after `get_marketplace` (and before `#[cfg(test)]`), add:

```rust
/// Read `enabledPlugins: { [id]: bool }` from one settings file. Missing
/// file, missing field, or malformed JSON → empty map. Slice-6 scope cut:
/// callers pass a single path. Slice 7 will add a multi-path variant that
/// folds with later sources overriding earlier (user → project → local).
pub fn read_enabled_plugins_from(settings_path: &Path) -> Result<BTreeMap<String, bool>, ApiError> {
    let raw = match std::fs::read_to_string(settings_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(BTreeMap::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", settings_path.display()))),
    };
    let json: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(BTreeMap::new()),
    };
    let Some(map) = json.get("enabledPlugins").and_then(|v| v.as_object()) else {
        return Ok(BTreeMap::new());
    };
    let mut out = BTreeMap::new();
    for (k, v) in map {
        if let Some(b) = v.as_bool() {
            out.insert(k.clone(), b);
        }
    }
    Ok(out)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: `test result: ok. 9 passed` (5 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs
git commit -m "feat(core): plugins::read_enabled_plugins_from (single-path slice-6 cut)"
```

---

## Task 5: Implement `load_manifest(install_path)` helper

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`

Looks for `<install>/plugin.json` first, then `<install>/.claude-plugin/plugin.json` (TS fallback path). Returns `None` if neither exists or both fail to parse.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/plugins.rs`, inside the test module, append:

```rust
    #[test]
    fn load_manifest_returns_none_when_no_files() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load_manifest(dir.path()).unwrap().is_none());
    }

    #[test]
    fn load_manifest_reads_root_plugin_json() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("plugin.json"),
            r#"{"name":"my","version":"1.0.0","description":"d"}"#,
        )
        .unwrap();
        let m = load_manifest(dir.path()).unwrap().unwrap();
        assert_eq!(m.name.as_deref(), Some("my"));
        assert_eq!(m.description.as_deref(), Some("d"));
    }

    #[test]
    fn load_manifest_falls_back_to_dot_claude_plugin() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude-plugin")).unwrap();
        std::fs::write(
            dir.path().join(".claude-plugin").join("plugin.json"),
            r#"{"name":"nested"}"#,
        )
        .unwrap();
        let m = load_manifest(dir.path()).unwrap().unwrap();
        assert_eq!(m.name.as_deref(), Some("nested"));
    }

    #[test]
    fn load_manifest_prefers_root_over_dot_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".claude-plugin")).unwrap();
        std::fs::write(dir.path().join("plugin.json"), r#"{"name":"root"}"#).unwrap();
        std::fs::write(
            dir.path().join(".claude-plugin").join("plugin.json"),
            r#"{"name":"nested"}"#,
        )
        .unwrap();
        let m = load_manifest(dir.path()).unwrap().unwrap();
        assert_eq!(m.name.as_deref(), Some("root"));
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: compile error — `load_manifest` not defined.

- [ ] **Step 3: Implement the helper**

In `crates/ohmyc-core/src/plugins.rs`, after `read_enabled_plugins_from`, add:

```rust
/// Load `plugin.json` from the install root, falling back to
/// `.claude-plugin/plugin.json`. Missing file or malformed JSON → `None`.
pub fn load_manifest(install_path: &Path) -> Result<Option<PluginManifest>, ApiError> {
    let primary = install_path.join("plugin.json");
    if let Some(m) = read_manifest_or_none(&primary)? {
        return Ok(Some(m));
    }
    let fallback = install_path.join(".claude-plugin").join("plugin.json");
    read_manifest_or_none(&fallback)
}

fn read_manifest_or_none(path: &Path) -> Result<Option<PluginManifest>, ApiError> {
    match std::fs::read_to_string(path) {
        Ok(raw) => match serde_json::from_str::<PluginManifest>(&raw) {
            Ok(m) => Ok(Some(m)),
            Err(_) => Ok(None),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -10`
Expected: `test result: ok. 13 passed` (9 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs
git commit -m "feat(core): plugins::load_manifest (root + .claude-plugin fallback)"
```

---

## Task 6: Implement `scan_components(install_path)` helper

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`

Walks the install dir for:
- `agents/` — flat `.md` files; ids = filename without `.md`, sorted.
- `skills/` — subdirectories containing `SKILL.md`; ids = dir name, sorted. Empty dirs (no `SKILL.md`) are skipped.
- `commands/` — flat `.md` files; ids = filename without `.md`, sorted.
- `hooks/hooks.json` — raw passthrough as `Value`.
- `.mcp.json` — raw passthrough as `Value`.
- `.lsp.json` — raw passthrough as `Value`.

Missing sub-dirs/files surface as empty arrays / `None`, not errors.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/plugins.rs`, inside the test module, append:

```rust
    fn write_file(p: &Path, contents: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, contents).unwrap();
    }

    #[test]
    fn scan_components_empty_dir_returns_empty_summary() {
        let dir = tempfile::tempdir().unwrap();
        let c = scan_components(dir.path()).unwrap();
        assert!(c.agents.is_empty());
        assert!(c.skills.is_empty());
        assert!(c.commands.is_empty());
        assert!(c.hooks.is_none());
        assert!(c.mcp_servers.is_none());
        assert!(c.lsp_servers.is_none());
    }

    #[test]
    fn scan_components_lists_agents_and_commands_sorted() {
        let dir = tempfile::tempdir().unwrap();
        write_file(&dir.path().join("agents/reviewer.md"), "---\nname: reviewer\n---\nx");
        write_file(&dir.path().join("agents/debugger.md"), "---\nname: debugger\n---\nx");
        write_file(&dir.path().join("commands/commit-push.md"), "x");
        // Non-.md is ignored:
        write_file(&dir.path().join("commands/notes.txt"), "x");
        let c = scan_components(dir.path()).unwrap();
        assert_eq!(c.agents, vec!["debugger".to_string(), "reviewer".to_string()]);
        assert_eq!(c.commands, vec!["commit-push".to_string()]);
    }

    #[test]
    fn scan_components_lists_skills_only_when_skill_md_present() {
        let dir = tempfile::tempdir().unwrap();
        write_file(&dir.path().join("skills/deploy-skill/SKILL.md"), "x");
        std::fs::create_dir_all(dir.path().join("skills/empty-dir")).unwrap();
        let c = scan_components(dir.path()).unwrap();
        assert_eq!(c.skills, vec!["deploy-skill".to_string()]);
    }

    #[test]
    fn scan_components_passes_through_hooks_mcp_lsp_json() {
        let dir = tempfile::tempdir().unwrap();
        let hooks = r#"{"hooks":{"PostToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"echo"}]}]}}"#;
        let mcp = r#"{"mcpServers":{"db":{"command":"node","args":["s.js"]}}}"#;
        let lsp = r#"{"python":{"command":"pyright"}}"#;
        write_file(&dir.path().join("hooks/hooks.json"), hooks);
        write_file(&dir.path().join(".mcp.json"), mcp);
        write_file(&dir.path().join(".lsp.json"), lsp);
        let c = scan_components(dir.path()).unwrap();
        assert_eq!(c.hooks, Some(serde_json::from_str::<Value>(hooks).unwrap()));
        assert_eq!(c.mcp_servers, Some(serde_json::from_str::<Value>(mcp).unwrap()));
        assert_eq!(c.lsp_servers, Some(serde_json::from_str::<Value>(lsp).unwrap()));
    }

    #[test]
    fn scan_components_returns_empty_when_install_path_missing() {
        let dir = tempfile::tempdir().unwrap();
        // Non-existent path — TS service silently tolerates this.
        let bogus = dir.path().join("does-not-exist");
        let c = scan_components(&bogus).unwrap();
        assert!(c.agents.is_empty());
        assert!(c.hooks.is_none());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -15`
Expected: compile error — `scan_components` not defined.

- [ ] **Step 3: Implement the helper**

In `crates/ohmyc-core/src/plugins.rs`, after `load_manifest` (and its private `read_manifest_or_none`), add:

```rust
/// Walk an install dir and discover bundled components. Each component
/// type is independent: missing `agents/` doesn't suppress `commands/`.
/// The hooks/mcp/lsp configs ride through as opaque `Value` so the UI
/// can render them without us schema-locking the format.
pub fn scan_components(install_path: &Path) -> Result<PluginComponentSummary, ApiError> {
    let mut out = PluginComponentSummary::empty();
    out.agents = list_md_basenames(&install_path.join("agents"))?;
    out.commands = list_md_basenames(&install_path.join("commands"))?;
    out.skills = list_skill_dirs(&install_path.join("skills"))?;
    out.hooks = read_json_or_none(&install_path.join("hooks").join("hooks.json"))?;
    out.mcp_servers = read_json_or_none(&install_path.join(".mcp.json"))?;
    out.lsp_servers = read_json_or_none(&install_path.join(".lsp.json"))?;
    Ok(out)
}

/// Flat `.md` files in a directory → sorted list of basenames without
/// the `.md` extension. Missing dir → empty list, not an error.
fn list_md_basenames(dir: &Path) -> Result<Vec<String>, ApiError> {
    let entries = match std::fs::read_dir(dir) {
        Ok(it) => it,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(ApiError::Io(format!("read_dir {}: {e}", dir.display()))),
    };
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            out.push(stem.to_string());
        }
    }
    out.sort();
    Ok(out)
}

/// Sub-directories that contain a `SKILL.md`. Missing parent dir → empty.
fn list_skill_dirs(dir: &Path) -> Result<Vec<String>, ApiError> {
    let entries = match std::fs::read_dir(dir) {
        Ok(it) => it,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(ApiError::Io(format!("read_dir {}: {e}", dir.display()))),
    };
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if !path.join("SKILL.md").exists() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            out.push(name.to_string());
        }
    }
    out.sort();
    Ok(out)
}

/// Read a JSON file as opaque `Value`. Missing or malformed → `None`
/// (matches the TS `readJson(...) ?? null` pattern).
fn read_json_or_none(path: &Path) -> Result<Option<Value>, ApiError> {
    let raw = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    };
    Ok(serde_json::from_str::<Value>(&raw).ok())
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -15`
Expected: `test result: ok. 18 passed` (13 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs
git commit -m "feat(core): plugins::scan_components (agents/skills/commands/hooks/mcp/lsp)"
```

---

## Task 7: Implement `list_plugins` + `get_plugin`

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`

Composes Tasks 3-6: reads `installed_plugins.json`, walks each plugin, joins manifest + components + enabled state. Sorted by name. Mirrors `PluginService.listPlugins` at `packages/cli/src/server/services/plugin-service.ts:121-156`.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/plugins.rs`, inside the test module, append:

```rust
    fn write_installed_plugins(dir: &Path, body: Value) {
        write_file(&dir.join("installed_plugins.json"), &body.to_string());
    }

    #[test]
    fn list_plugins_returns_empty_when_no_file() {
        let dir = tempfile::tempdir().unwrap();
        let p = list_plugins(dir.path(), &dir.path().join("missing-settings.json")).unwrap();
        assert!(p.is_empty());
    }

    #[test]
    fn list_plugins_returns_empty_for_empty_plugins_object() {
        let dir = tempfile::tempdir().unwrap();
        write_installed_plugins(dir.path(), serde_json::json!({"version": 2, "plugins": {}}));
        let p = list_plugins(dir.path(), &dir.path().join("missing-settings.json")).unwrap();
        assert!(p.is_empty());
    }

    #[test]
    fn list_plugins_parses_id_into_name_and_marketplace() {
        let dir = tempfile::tempdir().unwrap();
        write_installed_plugins(
            dir.path(),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "gitlab@tmates-plugins": [{
                        "version": "0.0.1",
                        "installedAt": "2026-02-04",
                        "lastUpdated": "2026-02-04",
                        "installPath": "/tmp/nonexistent-install",
                        "scope": "user"
                    }]
                }
            }),
        );
        let plugins = list_plugins(dir.path(), &dir.path().join("missing-settings.json")).unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].id, "gitlab@tmates-plugins");
        assert_eq!(plugins[0].name, "gitlab");
        assert_eq!(plugins[0].marketplace, "tmates-plugins");
        assert!(!plugins[0].enabled);
        assert!(plugins[0].manifest.is_none());
    }

    #[test]
    fn list_plugins_marks_enabled_from_settings() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        std::fs::write(&settings, r#"{"enabledPlugins":{"gitlab@m":true}}"#).unwrap();
        write_installed_plugins(
            dir.path(),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "gitlab@m": [{"version":"1","installedAt":"","lastUpdated":"","installPath":"/x","scope":"user"}],
                    "other@m":  [{"version":"1","installedAt":"","lastUpdated":"","installPath":"/x","scope":"user"}]
                }
            }),
        );
        let plugins = list_plugins(dir.path(), &settings).unwrap();
        let by_name: BTreeMap<_, _> = plugins.iter().map(|p| (p.name.clone(), p.enabled)).collect();
        assert_eq!(by_name.get("gitlab"), Some(&true));
        assert_eq!(by_name.get("other"), Some(&false));
    }

    #[test]
    fn list_plugins_walks_install_dir_for_manifest_and_components() {
        let dir = tempfile::tempdir().unwrap();
        let install = dir.path().join("install/full");
        write_file(&install.join("plugin.json"), r#"{"name":"full","description":"x"}"#);
        write_file(&install.join("agents/reviewer.md"), "x");
        write_file(&install.join("commands/cp.md"), "x");
        let install_path_str = install.to_string_lossy().to_string();
        write_installed_plugins(
            dir.path(),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "full@m": [{
                        "version": "1.0.0",
                        "installedAt": "2026-01-01",
                        "lastUpdated": "2026-01-01",
                        "installPath": install_path_str,
                        "scope": "user"
                    }]
                }
            }),
        );
        let plugins = list_plugins(dir.path(), &dir.path().join("missing-settings.json")).unwrap();
        assert_eq!(plugins.len(), 1);
        let p = &plugins[0];
        assert_eq!(p.manifest.as_ref().and_then(|m| m.name.as_deref()), Some("full"));
        assert_eq!(p.components.agents, vec!["reviewer".to_string()]);
        assert_eq!(p.components.commands, vec!["cp".to_string()]);
    }

    #[test]
    fn list_plugins_sorts_by_name() {
        let dir = tempfile::tempdir().unwrap();
        write_installed_plugins(
            dir.path(),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "zebra@m": [{"version":"1","installedAt":"","lastUpdated":"","installPath":"","scope":"user"}],
                    "alpha@m": [{"version":"1","installedAt":"","lastUpdated":"","installPath":"","scope":"user"}]
                }
            }),
        );
        let plugins = list_plugins(dir.path(), &dir.path().join("missing-settings.json")).unwrap();
        assert_eq!(plugins[0].name, "alpha");
        assert_eq!(plugins[1].name, "zebra");
    }

    #[test]
    fn get_plugin_returns_by_id_or_none() {
        let dir = tempfile::tempdir().unwrap();
        write_installed_plugins(
            dir.path(),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "test@market": [{"version":"1","installedAt":"","lastUpdated":"","installPath":"","scope":"user"}]
                }
            }),
        );
        let settings = dir.path().join("missing-settings.json");
        let found = get_plugin(dir.path(), &settings, "test@market").unwrap().unwrap();
        assert_eq!(found.name, "test");
        assert!(get_plugin(dir.path(), &settings, "nope").unwrap().is_none());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -15`
Expected: compile errors — `list_plugins`, `get_plugin` not defined.

- [ ] **Step 3: Implement the two functions**

In `crates/ohmyc-core/src/plugins.rs`, after `scan_components` and its helpers, add:

```rust
/// Read `<plugins_dir>/installed_plugins.json` and return one
/// `InstalledPlugin` per top-level id (`name@marketplace`). For each, walk
/// the first install's `installPath` to read manifest and components.
/// Sorts by name. Missing registry or empty `plugins` → empty list.
pub fn list_plugins(
    plugins_dir: &Path,
    settings_path: &Path,
) -> Result<Vec<InstalledPlugin>, ApiError> {
    let registry_path = plugins_dir.join("installed_plugins.json");
    let raw = match std::fs::read_to_string(&registry_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", registry_path.display()))),
    };
    // Shape: { version?: number, plugins: { id: PluginInstall[] } }
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    let Some(plugins_obj) = parsed.get("plugins").and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };
    let enabled_map = read_enabled_plugins_from(settings_path)?;
    let mut out: Vec<InstalledPlugin> = Vec::with_capacity(plugins_obj.len());
    for (id, installs_value) in plugins_obj {
        let (name, marketplace) = split_id(id);
        let installs: Vec<PluginInstall> =
            serde_json::from_value(installs_value.clone()).unwrap_or_default();
        let (manifest, components) = match installs.first() {
            Some(first) if !first.install_path.is_empty() => {
                let install_path = PathBuf::from(&first.install_path);
                (load_manifest(&install_path)?, scan_components(&install_path)?)
            }
            _ => (None, PluginComponentSummary::empty()),
        };
        out.push(InstalledPlugin {
            id: id.clone(),
            name: name.to_string(),
            marketplace: marketplace.to_string(),
            enabled: enabled_map.get(id).copied().unwrap_or(false),
            installs,
            manifest,
            components,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

/// Look up a single installed plugin by id.
pub fn get_plugin(
    plugins_dir: &Path,
    settings_path: &Path,
    id: &str,
) -> Result<Option<InstalledPlugin>, ApiError> {
    let all = list_plugins(plugins_dir, settings_path)?;
    Ok(all.into_iter().find(|p| p.id == id))
}

/// Split `name@marketplace` into `(name, marketplace)`. If no `@`,
/// marketplace is empty (matches TS `id.indexOf('@')` behavior).
fn split_id(id: &str) -> (&str, &str) {
    match id.find('@') {
        Some(i) => (&id[..i], &id[i + 1..]),
        None => (id, ""),
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib plugins 2>&1 | tail -15`
Expected: `test result: ok. 25 passed` (18 prior + 7 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/plugins.rs
git commit -m "feat(core): plugins::list_plugins + get_plugin"
```

---

## Task 8: Wire 4 Tauri command wrappers

**Files:**
- Create: `packages/desktop/src-tauri/src/api/plugins.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

Mirrors the slice-3 `api/agents.rs` shape: thin wrappers that resolve paths via `claude_home::plugins_dir()` + `claude_home::settings_path()` and call into the core. Responses wrap the lists/items in the same `{ plugins }` / `{ plugin }` / `{ marketplaces }` / `{ marketplace }` envelopes the TS server uses, so the UI hook unwrapping doesn't need to change.

- [ ] **Step 1: Create the file**

Create `packages/desktop/src-tauri/src/api/plugins.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::plugins.

use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
use ohmyc_core::plugins::{self, InstalledPlugin, Marketplace};
use serde::Serialize;

#[derive(Serialize)]
pub struct PluginsResponse {
    pub plugins: Vec<InstalledPlugin>,
}

#[derive(Serialize)]
pub struct PluginResponse {
    pub plugin: InstalledPlugin,
}

#[derive(Serialize)]
pub struct MarketplacesResponse {
    pub marketplaces: Vec<Marketplace>,
}

#[derive(Serialize)]
pub struct MarketplaceResponse {
    pub marketplace: Marketplace,
}

#[tauri::command]
pub fn plugins_list() -> Result<PluginsResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    Ok(PluginsResponse { plugins: plugins::list_plugins(&dir, &settings)? })
}

#[tauri::command]
pub fn plugins_get(id: String) -> Result<PluginResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    let Some(plugin) = plugins::get_plugin(&dir, &settings, &id)? else {
        return Err(ApiError::NotFound { kind: "plugin", name: id });
    };
    Ok(PluginResponse { plugin })
}

#[tauri::command]
pub fn marketplaces_list() -> Result<MarketplacesResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    Ok(MarketplacesResponse { marketplaces: plugins::list_marketplaces(&dir)? })
}

#[tauri::command]
pub fn marketplaces_get(id: String) -> Result<MarketplaceResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let Some(marketplace) = plugins::get_marketplace(&dir, &id)? else {
        return Err(ApiError::NotFound { kind: "marketplace", name: id });
    };
    Ok(MarketplaceResponse { marketplace })
}
```

- [ ] **Step 2: Add the module to `api/mod.rs`**

Open `packages/desktop/src-tauri/src/api/mod.rs` and add `pub mod plugins;` after `pub mod configs;` (keep alphabetical):

```rust
pub mod agents;
pub mod commands;
pub mod configs;
pub mod plugins;
pub mod settings;
pub mod skills;
pub mod store;
pub mod timeline;
```

- [ ] **Step 3: Verify the desktop crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: `Finished` (no errors). The commands aren't registered with `tauri::generate_handler!` yet — that's Task 9 — but the module must compile.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/plugins.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): tauri command wrappers for plugins + marketplaces"
```

---

## Task 9: Register the 4 commands in `main.rs`

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add the commands to `tauri::generate_handler!`**

Open `packages/desktop/src-tauri/src/main.rs`. The existing block ends with `store_model_configs_delete,` at line 54. Insert the 4 new registrations right after it (still inside `generate_handler!`, before the closing `]`):

```rust
            ohmyc_desktop_lib::api::plugins::plugins_list,
            ohmyc_desktop_lib::api::plugins::plugins_get,
            ohmyc_desktop_lib::api::plugins::marketplaces_list,
            ohmyc_desktop_lib::api::plugins::marketplaces_get,
```

- [ ] **Step 2: Verify the desktop crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: `Finished`.

- [ ] **Step 3: Add a smoke test that the commands round-trip**

Open `packages/desktop/src-tauri/src/api/plugins.rs`. Append to the bottom (the file currently has no test module — this adds one):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    /// Smoke test that the command serializes a sensible response when
    /// `<claude_home>/plugins/` is missing — exercises the same
    /// path-resolution chain main.rs hits, but without spinning up the
    /// Tauri app. Catches missing dep/module wiring.
    #[test]
    fn plugins_list_returns_empty_envelope_when_no_registry() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        let result = plugins_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        let r = result.unwrap();
        assert!(r.plugins.is_empty());
    }

    #[test]
    fn marketplaces_list_returns_empty_envelope_when_no_registry() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        let result = marketplaces_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        assert!(result.unwrap().marketplaces.is_empty());
    }
}
```

Note on env safety: these tests touch a process-global env var. The desktop crate's existing tests already follow this pattern (see `api/store.rs` tests). Adjacent runs may race in theory, but the smoke tests don't assert env-dependent values — they just assert "empty" — so a race window doesn't cause false failures.

- [ ] **Step 4: Run the desktop tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: all desktop tests pass, including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs packages/desktop/src-tauri/src/api/plugins.rs
git commit -m "feat(desktop): register plugins + marketplaces tauri commands"
```

---

## Task 10: Add 4 entries to `fetch.ts` URL table

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`

All 4 are GET — plain string returns, no `{ url, method, body }` needed. Insert between the existing `'configs.lsp'` line (line 38) and the blank line before `'store.agents.list'` (line 40).

- [ ] **Step 1: Add the entries**

Open `packages/ui/src/lib/transport/fetch.ts`. Replace the block from line 36 to line 39:

```ts
  'configs.mcp': () => '/api/mcp',
  'configs.hooks': () => '/api/hooks',
  'configs.lsp': () => '/api/lsp',

  'store.agents.list': () => '/api/store/agents',
```

with:

```ts
  'configs.mcp': () => '/api/mcp',
  'configs.hooks': () => '/api/hooks',
  'configs.lsp': () => '/api/lsp',

  'plugins.list': () => '/api/plugins',
  'plugins.get': a => `/api/plugins/${encodeURIComponent(String(a.id ?? ''))}`,
  'marketplaces.list': () => '/api/marketplaces',
  'marketplaces.get': a => `/api/marketplaces/${encodeURIComponent(String(a.id ?? ''))}`,

  'store.agents.list': () => '/api/store/agents',
```

- [ ] **Step 2: Add a routing test for path-param id**

Open `packages/ui/src/lib/transport/transport.test.ts`. Append at the bottom of the `describe('transport seam', ...)` block (just before the closing `})`):

```ts
  it('fetch transport routes plugins.get via the id path-param table', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ plugin: { id: 'gitlab@m' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('plugins.get', { id: 'gitlab@m' })
      // `@` must be percent-encoded so route-matching works on the server.
      expect(calls).toEqual(['/api/plugins/gitlab%40m'])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 3: Run the transport test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/lib/transport/transport.test.ts 2>&1 | tail -15`
Expected: all transport tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(transport): wire plugins + marketplaces URL table entries"
```

---

## Task 11: Migrate `use-plugins.ts` to `request()`

**Files:**
- Modify: `packages/ui/src/hooks/use-plugins.ts`

Replace the raw `fetch()` calls with the transport seam. Preserve `queryKey: ['plugins']` and `['marketplaces']` so the existing `invalidateQueries` (and new fs-watcher matchers in Task 13) keep working. Add `getPlugin`/`getMarketplace` hook stubs only if Explorer needs them — checking confirms no consumer uses single-id fetches today, so we keep `usePlugins` + `useMarketplaces` unchanged in shape (still return arrays).

- [ ] **Step 1: Replace the file**

Open `packages/ui/src/hooks/use-plugins.ts` and replace the contents entirely with:

```ts
// React Query hooks for installed plugins and marketplace listing.
import { useQuery } from '@tanstack/react-query'

import { request } from '../lib/transport'

import type {
  InstalledPlugin,
  Marketplace,
  PluginInstall,
  PluginManifest,
} from '@ohmyc/shared'

/** Normalized view of an installed plugin with resolved component counts. */
export interface PluginInventoryItem {
  id: string
  name: string
  marketplace: string
  enabled: boolean
  installs: PluginInstall[]
  manifest: PluginManifest | null
  componentCounts: {
    agents: number
    skills: number
    commands: number
  }
}

/** Normalizes raw InstalledPlugin data into a safe, UI-ready shape. */
function normalizePlugin(plugin: InstalledPlugin): PluginInventoryItem {
  const installs = Array.isArray(plugin.installs) ? plugin.installs : []

  return {
    id: plugin.id,
    name: plugin.name,
    marketplace: plugin.marketplace,
    enabled: plugin.enabled === true,
    installs,
    manifest: plugin.manifest ?? null,
    componentCounts: {
      agents: Array.isArray(plugin.components?.agents) ? plugin.components.agents.length : 0,
      skills: Array.isArray(plugin.components?.skills) ? plugin.components.skills.length : 0,
      commands: Array.isArray(plugin.components?.commands) ? plugin.components.commands.length : 0,
    },
  }
}

/** Query hook for listing installed plugins with normalized component counts. */
export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const data = await request<{ plugins?: InstalledPlugin[] }>('plugins.list', {})
      return Array.isArray(data.plugins) ? data.plugins.map(plugin => normalizePlugin(plugin)) : []
    },
  })
}

/** Query hook for listing available plugin marketplaces. */
export function useMarketplaces() {
  return useQuery({
    queryKey: ['marketplaces'],
    queryFn: async () => {
      const data = await request<{ marketplaces?: Marketplace[] }>('marketplaces.list', {})
      return Array.isArray(data.marketplaces) ? data.marketplaces : []
    },
  })
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no type errors.

- [ ] **Step 3: Run the explorer-page test (if any)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test 2>&1 | tail -10`
Expected: existing tests pass. Pre-existing 3 failures in `src/components/menubar/menubar-page.test.tsx` (flagged in slices 4 and 5 reviews) remain — that's separate triage.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-plugins.ts
git commit -m "feat(ui): migrate use-plugins.ts to request() transport seam"
```

---

## Task 12: Add `use-plugins.test.tsx` covering mock + wire shape

**Files:**
- Create: `packages/ui/src/hooks/use-plugins.test.tsx`

Mirror the slice-5 `use-store.test.tsx` shape: bind `mock` transport, register handlers per wire name, assert hook unwrap behavior. The realistic-shape rule from the slice-5 review (handlers throw with the actual `code` + `detail` shape, not generic strings) applies here too.

- [ ] **Step 1: Write the file**

Create `packages/ui/src/hooks/use-plugins.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useMarketplaces, usePlugins } from './use-plugins'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('usePlugins', () => {
  it('unwraps the plugins envelope and normalizes component counts', async () => {
    setMockHandler('plugins.list', async () => ({
      plugins: [
        {
          id: 'gitlab@m',
          name: 'gitlab',
          marketplace: 'm',
          enabled: true,
          installs: [{ version: '1', installedAt: '', lastUpdated: '', installPath: '/p', scope: 'user' }],
          manifest: { name: 'gitlab', description: 'd' },
          components: {
            agents: ['reviewer', 'debugger'],
            skills: ['deploy'],
            commands: ['commit-push'],
            hooks: null,
            mcpServers: null,
            lspServers: null,
          },
        },
      ],
    }))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    const p = result.current.data![0]
    expect(p.id).toBe('gitlab@m')
    expect(p.enabled).toBe(true)
    expect(p.componentCounts).toEqual({ agents: 2, skills: 1, commands: 1 })
    expect(p.manifest?.description).toBe('d')
  })

  it('returns an empty array when the wire response has no plugins field', async () => {
    setMockHandler('plugins.list', async () => ({}))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('tolerates a plugin with missing components/manifest', async () => {
    // Realistic dual-implementation guard: the Rust serializer emits
    // components with empty arrays + null configs, but a defensive UI
    // should still render when the wire returns absent fields entirely.
    setMockHandler('plugins.list', async () => ({
      plugins: [
        { id: 'bare@m', name: 'bare', marketplace: 'm', enabled: false, installs: [] },
      ],
    }))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const p = result.current.data![0]
    expect(p.componentCounts).toEqual({ agents: 0, skills: 0, commands: 0 })
    expect(p.manifest).toBeNull()
  })

  it('surfaces transport errors with their wire shape', async () => {
    // The Rust ApiError serializes as { code, detail }. Use that shape
    // here so the test would have caught the slice-5 review issue of
    // mocks that don't reflect the real wire.
    setMockHandler('plugins.list', async () => {
      throw Object.assign(new Error('boom'), {
        code: 'Internal',
        detail: 'disk on fire',
      })
    })
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string, detail?: unknown }
    expect(err.code).toBe('Internal')
  })
})

describe('useMarketplaces', () => {
  it('unwraps marketplaces envelope into an array', async () => {
    setMockHandler('marketplaces.list', async () => ({
      marketplaces: [
        { id: 'm1', source: { source: 'git', url: 'https://x' }, installLocation: '/m1' },
        { id: 'm2', source: { source: 'git' }, installLocation: '/m2' },
      ],
    }))
    const { result } = renderHook(() => useMarketplaces(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].id).toBe('m1')
  })

  it('returns empty when wire response has no marketplaces field', async () => {
    setMockHandler('marketplaces.list', async () => ({}))
    const { result } = renderHook(() => useMarketplaces(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
```

- [ ] **Step 2: Run the new tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/hooks/use-plugins.test.tsx 2>&1 | tail -20`
Expected: all 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-plugins.test.tsx
git commit -m "test(ui): coverage for use-plugins on the mock transport"
```

---

## Task 13: Extend `use-fs-changed.ts` to invalidate plugins/marketplaces

**Files:**
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

The Tauri watcher already covers `<claude_home>/` recursively, so writes to `plugins/installed_plugins.json`, `plugins/known_marketplaces.json`, and `settings.json` already fire `fs:changed` events with `kind: 'claude_home'`. Add matchers that invalidate the corresponding query keys.

The settings.json branch already invalidates settings/hooks/lsp; we extend it to also invalidate plugins (since enabled state lives in settings.json — the plugin list visually changes when a user toggles a plugin elsewhere).

- [ ] **Step 1: Replace the matcher block**

Open `packages/ui/src/hooks/use-fs-changed.ts`. The current settings.json branch at lines 45-49 reads:

```ts
            if (path.endsWith('/settings.json')) {
              void qc.invalidateQueries({ queryKey: ['settings'] })
              void qc.invalidateQueries({ queryKey: ['hooks'] })
              void qc.invalidateQueries({ queryKey: ['lsp'] })
            }
```

Replace it (and the `.mcp.json` branch immediately after it at lines 50-52) with:

```ts
            if (path.endsWith('/settings.json')) {
              void qc.invalidateQueries({ queryKey: ['settings'] })
              void qc.invalidateQueries({ queryKey: ['hooks'] })
              void qc.invalidateQueries({ queryKey: ['lsp'] })
              // enabledPlugins lives in settings.json — a toggle elsewhere
              // should refresh the Explorer plugins view.
              void qc.invalidateQueries({ queryKey: ['plugins'] })
            }
            if (path.endsWith('/.mcp.json')) {
              void qc.invalidateQueries({ queryKey: ['mcp'] })
            }
            if (path.endsWith('/installed_plugins.json')) {
              void qc.invalidateQueries({ queryKey: ['plugins'] })
            }
            if (path.endsWith('/known_marketplaces.json')) {
              void qc.invalidateQueries({ queryKey: ['marketplaces'] })
            }
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no type errors.

- [ ] **Step 3: Smoke-test the desktop dev loop manually (after merging)**

This step is informational — there is no automated test for the watcher → invalidation chain. After all 13 tasks are committed and the slice is merged to `feat/menubar-chart`, the integrating reviewer should:

1. `pnpm --filter @ohmyc/desktop tauri dev`
2. Open the Explorer's plugins surface in the main window.
3. Touch `~/.claude/plugins/installed_plugins.json` (e.g. `touch ...`) and confirm the React Query devtools show `plugins` query refetching.
4. Edit `enabledPlugins` in `~/.claude/settings.json` and confirm `plugins` also refetches.

If this step is impractical at slice-merge time (e.g. no fresh claude-home), defer to the slice-7 integration window; the matcher logic is mechanically the same shape as the existing settings.json branch which already works.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(ui): invalidate plugins + marketplaces on fs:changed"
```

---

## Verification (after all tasks)

- [ ] **Full workspace test sweep**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
cargo test -p ohmyc-core 2>&1 | tail -5
cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -5
pnpm -r test 2>&1 | tail -10
```

Expected:
- core: 25 new plugin tests added on top of the 128 from slice 5 → ~153 passing.
- desktop: 2 new smoke tests on top of slice 5's 24 → 26 passing.
- ui: ~6 new use-plugins tests added on top of slice 5's ~158 → ~164 passing; the 3 pre-existing menubar-page failures remain (separate triage).

- [ ] **Web bundle still builds (TS server fallback path is alive)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm -r build 2>&1 | tail -10`
Expected: `Done` / no errors. The `fetch` transport entries we added are exercised by `pnpm dev` against the TS server until slice 8 deletes it.

---

## Self-review notes

**Spec coverage:**
- "Completes Explorer (`/explore/plugins`)" → Tasks 8 + 11 wire the read hook into native commands; Explorer already consumes `usePlugins`/`useMarketplaces`.
- "Main window fully read-functional by end of this slice" → all read endpoints from slices 2-6 are now native; remaining slices touch only writes (slice 7 profiles, slice 8 cleanup).
- Per-slice cadence (each commit green, web build alive, dual implementation) → Tasks 1-13 each end in a commit; TS server retained.

**Scope cuts documented (top of plan):**
- Multi-path settings merge (deferred to slice 7).
- Configs project/plugin merge (separate follow-up after slice 8 — not the same migration shape as `use-plugins.ts`).
- Plugin enable/disable mutation (never existed on TS side).
- TS server deletion (slice 8).

**Type consistency:**
- Rust `InstalledPlugin` fields (`id`, `name`, `marketplace`, `enabled`, `installs`, `manifest`, `components`) match the TS shared schema. `components` uses `serde(rename_all = "camelCase")` so `mcp_servers`/`lsp_servers` serialize as `mcpServers`/`lspServers` — matching the TS shape consumed by `useStorePlugins`/UI.
- `PluginInstall` uses `serde(rename_all = "camelCase")` so `installed_at`/`last_updated`/`install_path` serialize as `installedAt`/`lastUpdated`/`installPath`.
- Wire names use dot-style on JS side; `.replace('.', '_')` round-trips to the Rust function names (`plugins_list`, `plugins_get`, `marketplaces_list`, `marketplaces_get`).
- Query keys preserved: `['plugins']`, `['marketplaces']`.

**Placeholder scan:** None — all code blocks contain full, runnable content.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-desktop-migration-slice-6-plugins-marketplaces.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
