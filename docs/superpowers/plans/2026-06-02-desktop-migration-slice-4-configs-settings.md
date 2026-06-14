# Desktop Migration — Slice 4: Configs + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `use-settings.ts` (read + write of `~/.claude/settings.json`) and `use-configs.ts` (three read-only endpoints: MCP servers, hooks, LSP servers) onto native Rust Tauri commands. Lands the **write-endpoint shape** in the transport seam — `transport/fetch.ts` URL table entries can now return `{ url, method, body }` instead of a bare URL — on the simplest possible write target (settings: one JSON blob), so the pattern is proven on a low-risk surface before Slice 5 (Store) exercises it at scale.

**Architecture:** Two new `ohmyc-core` modules — `settings` (read + atomic write of `<claude_home>/settings.json`) and `configs` (flatten the `hooks` field, extract the `lspServers` field, read `<claude_home>/.mcp.json` for mcp servers). All sources are global-only this slice (plugin/project merge deferred to Slice 6, mirroring Slice 3's scope cut). The frontend `transport/fetch.ts` shape grows: a route entry now returns either a string (GET shorthand) or `{ url, method, body }` for writes. `tauriTransport` is unchanged — `invoke('cmd', args)` already handles arbitrary body shapes per the slice-2 `e2bf1a9` lesson (flat named params, no struct wrapping). `useFsChanged` extends invalidation to the new keys.

**Tech Stack:** Rust (`tempfile` for atomic file writes via `persist`, `serde_json::Value` for arbitrary settings shape), TypeScript (existing React Query + transport infrastructure).

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/settings.rs` — `read()` returns `{ path, content: Option<Value>, exists }`; `write(value)` does atomic file replace via temp + rename.
- `crates/ohmyc-core/src/configs.rs` — `mcp_servers()`, `hooks()`, `lsp_servers()` read from `<claude_home>/.mcp.json` and `<claude_home>/settings.json`.
- `packages/desktop/src-tauri/src/api/settings.rs` — `settings_get`, `settings_set` Tauri commands.
- `packages/desktop/src-tauri/src/api/configs.rs` — `configs_mcp`, `configs_hooks`, `configs_lsp` Tauri commands.

**Modified files:**
- `crates/ohmyc-core/src/lib.rs` — `pub mod configs; pub mod settings;`.
- `crates/ohmyc-core/src/error.rs` — add `Validation` variant (Settings write rejects non-object bodies; clearer than the catch-all `InvalidInput`).
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod configs; pub mod settings;`.
- `packages/desktop/src-tauri/src/main.rs` — register 5 new commands.
- `packages/ui/src/lib/transport/fetch.ts` — `routes` value type widens from `(args) => string` to `(args) => string | RequestSpec`; existing entries unchanged via string shorthand. Add 5 new entries.
- `packages/ui/src/lib/transport/transport.test.ts` — 2 new tests covering the `{ url, method, body }` shape.
- `packages/ui/src/hooks/use-settings.ts` — `request('settings.get', ...)` and `request('settings.set', ...)`.
- `packages/ui/src/hooks/use-configs.ts` — `request('configs.mcp/hooks/lsp', ...)`.
- `packages/ui/src/hooks/use-fs-changed.ts` — invalidate `['settings']`, `['mcp']`, `['hooks']`, `['lsp']` on `claude_home` matches.

---

## Task 1: Add `ApiError::Validation` variant

**Files:**
- Modify: `crates/ohmyc-core/src/error.rs`

- [ ] **Step 1: Add the failing test**

Open `crates/ohmyc-core/src/error.rs`. In the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn validation_serializes_with_code_and_string_detail() {
        let err = ApiError::Validation("content must be a JSON object".to_string());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "Validation");
        assert_eq!(json["detail"], "content must be a JSON object");
    }
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib error 2>&1 | tail -10`
Expected: compile error — `Validation` variant doesn't exist.

- [ ] **Step 3: Add the variant**

In the same file, find the `pub enum ApiError` block and add a new variant after `Conflict(String)`:

```rust
    #[error("validation error: {0}")]
    Validation(String),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib error 2>&1 | tail -10`
Expected: `test result: ok. 5 passed` (4 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/error.rs
git commit -m "feat(core): add ApiError::Validation variant"
```

---

## Task 2: Implement `ohmyc-core::settings` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/settings.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the settings module**

Create `crates/ohmyc-core/src/settings.rs`:

```rust
//! Read + atomic-write of `<claude_home>/settings.json`. Mirrors the
//! TS `/api/settings` GET/POST behavior:
//! - Read: `{ path, content: Option<Value>, exists }` — content is
//!   None when the file does not exist; `exists` is false in that case.
//! - Write: rejects non-object bodies with `ApiError::Validation`,
//!   creates the parent dir if missing, writes via temp-file + rename
//!   so a partial write never leaves a corrupt file.

use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value;

use crate::claude_home;
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SettingsRead {
    pub path: String,
    pub content: Option<Value>,
    pub exists: bool,
}

pub fn settings_path() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("settings.json"))
}

/// Read settings from the global `<claude_home>/settings.json`. Returns
/// `exists: false, content: None` when the file is missing — this is
/// not an error, it's the "no settings yet" state the UI surfaces as
/// defaults.
///
/// Other I/O failures (permission denied, etc.) surface as `ApiError::Io`.
/// Malformed JSON surfaces as `ApiError::Parse`.
pub fn read() -> Result<SettingsRead, ApiError> {
    let path = settings_path()?;
    let path_str = path.to_string_lossy().to_string();
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let content: Value = serde_json::from_str(&raw)
                .map_err(|e| ApiError::Parse(format!("settings.json: {e}")))?;
            Ok(SettingsRead { path: path_str, content: Some(content), exists: true })
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(SettingsRead { path: path_str, content: None, exists: false })
        }
        Err(e) => Err(ApiError::Io(format!("read {path_str}: {e}"))),
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SettingsWrite {
    pub path: String,
    pub success: bool,
}

/// Write `content` to `<claude_home>/settings.json` atomically. Rejects
/// non-object bodies with `ApiError::Validation` (matches the TS server's
/// "Content must be an object" check). Creates the parent directory if
/// missing. Writes via temp-file in the same directory + atomic rename.
pub fn write(content: &Value) -> Result<SettingsWrite, ApiError> {
    if !content.is_object() {
        return Err(ApiError::Validation(
            "content must be a JSON object".to_string(),
        ));
    }
    let path = settings_path()?;
    let path_str = path.to_string_lossy().to_string();

    let dir = path.parent().ok_or_else(|| {
        ApiError::Internal(format!("settings path has no parent: {path_str}"))
    })?;
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;

    let serialized = serde_json::to_string_pretty(content)
        .map_err(|e| ApiError::Internal(format!("serialize settings: {e}")))?;

    // Atomic replace: write to a sibling temp file, then rename.
    let mut tmp = tempfile::NamedTempFile::new_in(dir)
        .map_err(|e| ApiError::Io(format!("create temp in {}: {e}", dir.display())))?;
    use std::io::Write;
    tmp.write_all(serialized.as_bytes())
        .map_err(|e| ApiError::Io(format!("write temp: {e}")))?;
    tmp.persist(&path)
        .map_err(|e| ApiError::Io(format!("persist {path_str}: {e}")))?;

    Ok(SettingsWrite { path: path_str, success: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_claude_home<F: FnOnce()>(dir: &std::path::Path, f: F) {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", dir);
        f();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
    }

    #[test]
    fn read_returns_exists_false_when_file_missing() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let r = read().unwrap();
            assert!(!r.exists);
            assert!(r.content.is_none());
            assert!(r.path.ends_with("settings.json"));
        });
    }

    #[test]
    fn read_returns_parsed_content_when_file_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), r#"{"model":"sonnet-4","general":{"alwaysThinkingEnabled":true}}"#)
            .unwrap();
        with_claude_home(dir.path(), || {
            let r = read().unwrap();
            assert!(r.exists);
            let c = r.content.unwrap();
            assert_eq!(c["model"], "sonnet-4");
            assert_eq!(c["general"]["alwaysThinkingEnabled"], true);
        });
    }

    #[test]
    fn read_errors_on_malformed_json() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), "{not valid").unwrap();
        with_claude_home(dir.path(), || {
            let err = read().unwrap_err();
            match err {
                ApiError::Parse(msg) => assert!(msg.contains("settings.json")),
                other => panic!("expected Parse, got {other:?}"),
            }
        });
    }

    #[test]
    fn write_persists_object_atomically() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let content = serde_json::json!({"model": "sonnet-4"});
            let r = write(&content).unwrap();
            assert!(r.success);
            assert!(r.path.ends_with("settings.json"));

            // Read back
            let raw = std::fs::read_to_string(dir.path().join("settings.json")).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(parsed, content);
        });
    }

    #[test]
    fn write_creates_parent_directory_when_missing() {
        // Use a tempdir that doesn't have the claude_home dir yet.
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("does-not-exist");
        with_claude_home(&nested, || {
            let content = serde_json::json!({"k": "v"});
            let r = write(&content).unwrap();
            assert!(r.success);
            assert!(nested.join("settings.json").exists());
        });
    }

    #[test]
    fn write_rejects_non_object_with_validation_error() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let err = write(&serde_json::json!([1, 2, 3])).unwrap_err();
            match err {
                ApiError::Validation(msg) => assert!(msg.contains("object")),
                other => panic!("expected Validation, got {other:?}"),
            }
            let err2 = write(&serde_json::json!("a string")).unwrap_err();
            assert!(matches!(err2, ApiError::Validation(_)));
            let err3 = write(&serde_json::json!(null)).unwrap_err();
            assert!(matches!(err3, ApiError::Validation(_)));
        });
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let content = serde_json::json!({
                "model": "opus",
                "general": {"showTurnDuration": true, "prefersReducedMotion": false}
            });
            write(&content).unwrap();
            let r = read().unwrap();
            assert!(r.exists);
            assert_eq!(r.content.unwrap(), content);
        });
    }
}
```

- [ ] **Step 2: Export the module**

Open `crates/ohmyc-core/src/lib.rs`. Add `pub mod settings;` alongside the existing module declarations. The block should look like:

```rust
pub mod claude_home;
pub mod components;
pub mod error;
pub mod settings;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib settings 2>&1 | tail -15`
Expected: `test result: ok. 7 passed`.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/settings.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): settings::read + atomic write with object validation"
```

---

## Task 3: Implement `ohmyc-core::configs` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/configs.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the configs module**

Create `crates/ohmyc-core/src/configs.rs`:

```rust
//! Read MCP servers, hooks, and LSP servers from claude_home global
//! files. Minimal-port scope-cut (matching slice 3): plugin contributions
//! and project-local overrides land in slice 6.
//!
//! - MCP servers: `<claude_home>/.mcp.json` → `mcpServers` field.
//! - Hooks: `<claude_home>/settings.json` → `hooks` field, flattened
//!   from the nested `{ event: [{ matcher?, hooks: [...] }] }` shape
//!   into linear `[{ event, name, data: { matcher?, type, command } }]`
//!   entries. Each entry is tagged `source=local, scope=global`.
//! - LSP servers: `<claude_home>/settings.json` → `lspServers` field.

use serde::Serialize;
use serde_json::{Map, Value};

use crate::claude_home;
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct McpEntry {
    pub name: String,
    pub config: Value,
    pub source: &'static str, // always "local" this slice
    pub scope: &'static str,  // always "global" this slice
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct HookEntry {
    pub event: String,
    pub name: String,
    pub data: Value,
    pub source: &'static str,
    pub scope: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LspEntry {
    pub name: String,
    pub config: Value,
    pub source: &'static str,
    pub scope: &'static str,
}

/// Read `<claude_home>/.mcp.json` (if present), extract `mcpServers`
/// object, return as a list of entries. Missing or malformed file →
/// empty list (matches the TS server's `readJson(... ) ?? null` path).
pub fn mcp_servers() -> Result<Vec<McpEntry>, ApiError> {
    let path = claude_home::resolve()?.join(".mcp.json");
    let Some(json) = read_json_or_none(&path)? else {
        return Ok(Vec::new());
    };
    let Some(servers) = json.get("mcpServers").and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };
    Ok(servers
        .iter()
        .map(|(name, config)| McpEntry {
            name: name.clone(),
            config: config.clone(),
            source: "local",
            scope: "global",
        })
        .collect())
}

/// Read `<claude_home>/settings.json`, extract `hooks` field, flatten
/// the nested shape into linear entries. Same skip-when-missing rule.
pub fn hooks() -> Result<Vec<HookEntry>, ApiError> {
    let path = claude_home::resolve()?.join("settings.json");
    let Some(json) = read_json_or_none(&path)? else {
        return Ok(Vec::new());
    };
    let Some(hooks_obj) = json.get("hooks").and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };
    Ok(flatten_hooks(hooks_obj))
}

/// Read `<claude_home>/settings.json`, extract `lspServers` field.
pub fn lsp_servers() -> Result<Vec<LspEntry>, ApiError> {
    let path = claude_home::resolve()?.join("settings.json");
    let Some(json) = read_json_or_none(&path)? else {
        return Ok(Vec::new());
    };
    let Some(servers) = json.get("lspServers").and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };
    Ok(servers
        .iter()
        .map(|(name, config)| LspEntry {
            name: name.clone(),
            config: config.clone(),
            source: "local",
            scope: "global",
        })
        .collect())
}

fn read_json_or_none(path: &std::path::Path) -> Result<Option<Value>, ApiError> {
    match std::fs::read_to_string(path) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(v) => Ok(Some(v)),
            // Match TS behavior: malformed JSON treated as "no data" (returns []).
            // Distinguishes from "file missing"; logs to stderr so dev sees it.
            Err(e) => {
                eprintln!("configs: malformed JSON in {}: {e}", path.display());
                Ok(None)
            }
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    }
}

fn flatten_hooks(hooks_obj: &Map<String, Value>) -> Vec<HookEntry> {
    let mut entries: Vec<HookEntry> = Vec::new();
    for (event_name, groups) in hooks_obj {
        let Some(group_array) = groups.as_array() else {
            continue;
        };
        for group in group_array {
            let matcher = group.get("matcher").cloned();
            let Some(hooks_array) = group.get("hooks").and_then(|v| v.as_array()) else {
                continue;
            };
            for (index, hook) in hooks_array.iter().enumerate() {
                let mut data = Map::new();
                if let Some(m) = matcher.as_ref() {
                    data.insert("matcher".to_string(), m.clone());
                }
                if let Some(t) = hook.get("type") {
                    data.insert("type".to_string(), t.clone());
                }
                if let Some(c) = hook.get("command") {
                    data.insert("command".to_string(), c.clone());
                }
                entries.push(HookEntry {
                    event: event_name.clone(),
                    name: format!("{event_name} [{index}]"),
                    data: Value::Object(data),
                    source: "local",
                    scope: "global",
                });
            }
        }
    }
    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_claude_home<F: FnOnce()>(dir: &std::path::Path, f: F) {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", dir);
        f();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
    }

    #[test]
    fn mcp_servers_returns_empty_when_no_file() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            assert!(mcp_servers().unwrap().is_empty());
        });
    }

    #[test]
    fn mcp_servers_extracts_entries_with_local_scope() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(".mcp.json"),
            r#"{"mcpServers":{"github":{"command":"gh-mcp"},"filesystem":{"command":"fs-mcp","args":["/"]}}}"#,
        )
        .unwrap();
        with_claude_home(dir.path(), || {
            let entries = mcp_servers().unwrap();
            assert_eq!(entries.len(), 2);
            let github = entries.iter().find(|e| e.name == "github").unwrap();
            assert_eq!(github.config["command"], "gh-mcp");
            assert_eq!(github.source, "local");
            assert_eq!(github.scope, "global");
        });
    }

    #[test]
    fn hooks_flattens_nested_shape_with_event_indexes() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{
              "hooks": {
                "PreToolUse": [
                  { "matcher": "Edit", "hooks": [
                    { "type": "command", "command": "echo a" },
                    { "type": "command", "command": "echo b" }
                  ]}
                ],
                "Stop": [
                  { "hooks": [{ "type": "command", "command": "echo done" }] }
                ]
              }
            }"#,
        )
        .unwrap();
        with_claude_home(dir.path(), || {
            let entries = hooks().unwrap();
            assert_eq!(entries.len(), 3);
            let first = entries.iter().find(|h| h.name == "PreToolUse [0]").unwrap();
            assert_eq!(first.event, "PreToolUse");
            assert_eq!(first.data["matcher"], "Edit");
            assert_eq!(first.data["command"], "echo a");
            let stop = entries.iter().find(|h| h.event == "Stop").unwrap();
            // No matcher on Stop group
            assert!(stop.data.get("matcher").is_none());
        });
    }

    #[test]
    fn hooks_returns_empty_when_settings_missing_or_no_hooks_field() {
        let dir = tempfile::tempdir().unwrap();
        // No file
        with_claude_home(dir.path(), || {
            assert!(hooks().unwrap().is_empty());
        });
        // File without hooks field
        std::fs::write(dir.path().join("settings.json"), r#"{"model":"sonnet"}"#).unwrap();
        with_claude_home(dir.path(), || {
            assert!(hooks().unwrap().is_empty());
        });
    }

    #[test]
    fn lsp_servers_extracts_entries() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{"lspServers":{"rust-analyzer":{"command":"rust-analyzer"}}}"#,
        )
        .unwrap();
        with_claude_home(dir.path(), || {
            let entries = lsp_servers().unwrap();
            assert_eq!(entries.len(), 1);
            assert_eq!(entries[0].name, "rust-analyzer");
            assert_eq!(entries[0].source, "local");
        });
    }

    #[test]
    fn malformed_json_is_treated_as_empty_not_error() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".mcp.json"), "{ not valid").unwrap();
        with_claude_home(dir.path(), || {
            assert!(mcp_servers().unwrap().is_empty());
        });
    }
}
```

- [ ] **Step 2: Export the module**

Open `crates/ohmyc-core/src/lib.rs`. Add `pub mod configs;` to the list. Final state:

```rust
pub mod claude_home;
pub mod components;
pub mod configs;
pub mod error;
pub mod settings;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib configs 2>&1 | tail -15`
Expected: `test result: ok. 6 passed`.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/configs.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): configs::{mcp_servers,hooks,lsp_servers} (global-only)"
```

---

## Task 4: Tauri commands for settings

**Files:**
- Create: `packages/desktop/src-tauri/src/api/settings.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

- [ ] **Step 1: Create the settings commands**

Create `packages/desktop/src-tauri/src/api/settings.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::settings.
//!
//! `project` parameter is accepted for web-side compatibility but
//! IGNORED on desktop (slice 4 scope: global-only). Desktop has no
//! project context — adding it would require a working-dir abstraction
//! that's out of scope.

use ohmyc_core::error::ApiError;
use ohmyc_core::settings::{self, SettingsRead, SettingsWrite};
use serde_json::Value;

#[tauri::command]
pub fn settings_get(_project: Option<String>) -> Result<SettingsRead, ApiError> {
    settings::read()
}

#[tauri::command]
pub fn settings_set(
    content: Value,
    _project: Option<String>,
) -> Result<SettingsWrite, ApiError> {
    settings::write(&content)
}
```

- [ ] **Step 2: Re-export**

Open `packages/desktop/src-tauri/src/api/mod.rs`. Add `pub mod settings;` alongside the existing declarations:

```rust
pub mod agents;
pub mod commands;
pub mod settings;
pub mod skills;
pub mod timeline;
```

(Leave the `include_origin` helper + tests block untouched.)

- [ ] **Step 3: Verify the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished` cleanly.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/settings.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): settings Tauri commands (get+set)"
```

---

## Task 5: Tauri commands for configs

**Files:**
- Create: `packages/desktop/src-tauri/src/api/configs.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

- [ ] **Step 1: Create the configs commands**

Create `packages/desktop/src-tauri/src/api/configs.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::configs.

use ohmyc_core::configs::{self, HookEntry, LspEntry, McpEntry};
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct McpResponse {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<McpEntry>,
}

#[derive(Serialize)]
pub struct HooksResponse {
    pub hooks: Vec<HookEntry>,
}

#[derive(Serialize)]
pub struct LspResponse {
    #[serde(rename = "lspServers")]
    pub lsp_servers: Vec<LspEntry>,
}

#[tauri::command]
pub fn configs_mcp() -> Result<McpResponse, ApiError> {
    Ok(McpResponse { mcp_servers: configs::mcp_servers()? })
}

#[tauri::command]
pub fn configs_hooks() -> Result<HooksResponse, ApiError> {
    Ok(HooksResponse { hooks: configs::hooks()? })
}

#[tauri::command]
pub fn configs_lsp() -> Result<LspResponse, ApiError> {
    Ok(LspResponse { lsp_servers: configs::lsp_servers()? })
}
```

- [ ] **Step 2: Re-export**

Open `packages/desktop/src-tauri/src/api/mod.rs`. Add `pub mod configs;`:

```rust
pub mod agents;
pub mod commands;
pub mod configs;
pub mod settings;
pub mod skills;
pub mod timeline;
```

- [ ] **Step 3: Verify the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished` cleanly.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/configs.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): configs Tauri commands (mcp+hooks+lsp)"
```

---

## Task 6: Register the 5 new commands in main.rs

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add the new commands to `invoke_handler!`**

Open `packages/desktop/src-tauri/src/main.rs`. Find the `.invoke_handler(tauri::generate_handler![...])` block. After the last existing command (likely `commands_get`), add:

```rust
            ohmyc_desktop_lib::api::settings::settings_get,
            ohmyc_desktop_lib::api::settings::settings_set,
            ohmyc_desktop_lib::api::configs::configs_mcp,
            ohmyc_desktop_lib::api::configs::configs_hooks,
            ohmyc_desktop_lib::api::configs::configs_lsp,
```

- [ ] **Step 2: Build + run the full workspace tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --workspace 2>&1 | grep "test result" | head -10`
Expected: all results `ok`; total Rust tests should be ~99 (86 from slice 3 + 13 new: 1 error + 7 settings + 6 configs - 1 from duplicates if any).

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): register settings + configs Tauri commands"
```

---

## Task 7: Widen the transport `fetch.ts` route shape to support writes

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts`

Today every route entry returns a string (URL). Settings writes need to send a POST with a JSON body. Widen the route value type so an entry can return either a string (GET shorthand) or `{ url, method, body }`.

- [ ] **Step 1: Add the failing tests**

Open `packages/ui/src/lib/transport/transport.test.ts`. At the bottom of the existing `describe('transport seam', () => { ... })`, before the closing `})`, append:

```ts
  it('fetch transport sends POST with JSON body for settings.set', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ success: true, path: '/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('settings.set', { content: { model: 'sonnet' } })
      expect(seen).toHaveLength(1)
      expect(seen[0].url).toBe('/api/settings')
      expect(seen[0].init?.method).toBe('POST')
      const body = JSON.parse(String(seen[0].init?.body ?? ''))
      expect(body).toEqual({ content: { model: 'sonnet' } })
      expect((seen[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport sends GET for settings.get with optional project query', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ exists: false, content: null, path: '/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('settings.get', {})
      await fetchTransport('settings.get', { project: '/my/project' })
      expect(calls).toEqual([
        '/api/settings',
        '/api/settings?project=%2Fmy%2Fproject',
      ])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 2: Run to confirm the new tests fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: failures — the new wires (`settings.set`, `settings.get`) aren't in the routes table yet.

- [ ] **Step 3: Widen the route shape + add the 5 new entries**

Replace the entire contents of `packages/ui/src/lib/transport/fetch.ts` with:

```ts
import type { Transport } from '../transport'

/** A non-GET request specification returned by a route builder. */
interface RequestSpec {
  url: string
  method?: string
  body?: unknown
}

type RouteBuilder = (args: Record<string, unknown>) => string | RequestSpec

// Wire-name → URL/method/body builder. Each slice that migrates an endpoint
// adds the slice's wires here so the legacy fetch transport keeps working
// during the migration window (`pnpm dev` against the TS server).
//
// String return = GET URL shorthand.
// Object return = mutating request with explicit method and JSON body.
const routes: Record<string, RouteBuilder> = {
  // ---- Slice 2: timeline (all GET) ----
  'timeline.heatmap': a => `/api/timeline/heatmap?${qs(a)}`,
  'timeline.events': a => `/api/timeline/events?${qs(a)}`,
  'timeline.session': a => `/api/timeline/sessions/${encodeURIComponent(String(a.id ?? ''))}`,
  'timeline.projects': () => '/api/timeline/projects',
  'timeline.years': () => '/api/timeline/years',
  'timeline.status': () => '/api/timeline/status',

  // ---- Slice 3: agents/skills/commands (all GET) ----
  'agents.list': a => `/api/agents${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'agents.get': a => `/api/agents/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'skills.list': a => `/api/skills${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'skills.get': a => `/api/skills/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'commands.list': a => `/api/commands${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'commands.get': a => `/api/commands/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,

  // ---- Slice 4: settings + configs ----
  'settings.get': (a) => {
    const project = a.project as string | undefined
    return project ? `/api/settings?${qs({ project })}` : '/api/settings'
  },
  'settings.set': (a) => {
    const project = a.project as string | undefined
    return {
      url: project ? `/api/settings?${qs({ project })}` : '/api/settings',
      method: 'POST',
      body: { content: a.content },
    }
  },
  'configs.mcp': () => '/api/mcp',
  'configs.hooks': () => '/api/hooks',
  'configs.lsp': () => '/api/lsp',
}

function qs(args: Record<string, unknown>): string {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) {
      continue
    }
    out.set(k, String(v))
  }
  return out.toString()
}

function detailQs(args: Record<string, unknown>): string {
  const subset: Record<string, unknown> = {}
  for (const k of ['source', 'pluginId', 'scope']) {
    if (args[k] !== undefined && args[k] !== null) {
      subset[k] = args[k]
    }
  }
  const out = qs(subset)
  return out ? `?${out}` : ''
}

function buildInit(spec: RequestSpec): { url: string, init: RequestInit } {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined
  if (spec.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(spec.body)
  }
  return {
    url: spec.url,
    init: { method: spec.method ?? 'GET', headers, body },
  }
}

export const fetchTransport: Transport = async (wire, args) => {
  const a = (args ?? {}) as Record<string, unknown>
  const built = routes[wire]
    ? routes[wire](a)
    : `/api/${wire.replace(/\./g, '/')}${Object.keys(a).length > 0 ? `?${qs(a)}` : ''}`

  let url: string
  let init: RequestInit | undefined
  if (typeof built === 'string') {
    url = built
  }
  else {
    const prepared = buildInit(built)
    url = prepared.url
    init = prepared.init
  }

  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  // Some POST endpoints return empty body on success; tolerate it.
  const text = await res.text()
  if (!text) {
    return undefined
  }
  return JSON.parse(text)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: all transport tests pass (the 8 from earlier slices + 2 new = 10).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(ui): fetch transport supports { url, method, body } for writes"
```

---

## Task 8: Migrate `use-settings.ts` to the transport seam

**Files:**
- Modify: `packages/ui/src/hooks/use-settings.ts`

- [ ] **Step 1: Replace the file contents**

Open `packages/ui/src/hooks/use-settings.ts`. Replace the entire contents with:

```ts
// React Query hooks for reading and writing Claude Code settings.json.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useMutation, useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

import type { SettingsJson } from '@ohmyc/shared'

export interface SettingsResponse {
  path: string
  content: SettingsJson | null
  exists: boolean
  error?: string
}

export interface SaveSettingsResponse {
  success: boolean
  path: string
  error?: string
}

export function useSettings(project?: string) {
  const queryKey = ['settings', project] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (project) {
        args.project = project
      }
      return await request<SettingsResponse>('settings.get', args)
    },
  })

  const mutation = useMutation({
    mutationKey: [...queryKey, 'save'],
    mutationFn: async (content: SettingsJson) => {
      const args: Record<string, unknown> = { content }
      if (project) {
        args.project = project
      }
      return await request<SaveSettingsResponse>('settings.set', args)
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    mutate: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error,
    saveData: mutation.data,
  }
}
```

- [ ] **Step 2: Verify no `fetch(` calls remain**

Run: `grep -n 'fetch(' /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui/src/hooks/use-settings.ts`
Expected: no output (empty result).

- [ ] **Step 3: Run any existing settings hook tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-settings 2>&1 | tail -10`
Expected: either green or "No test files found". (If a test file exists, the next task fixes it.)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-settings.ts
git commit -m "feat(ui): use-settings routes through transport seam (settings.get/set)"
```

---

## Task 9: Add `use-settings.test.tsx`

**Files:**
- Create or replace: `packages/ui/src/hooks/use-settings.test.tsx`

- [ ] **Step 1: Locate any existing settings test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && find . -name "use-settings.test*" -not -path "*/node_modules/*" 2>/dev/null`
Note the result. If a file exists, the next step replaces it; otherwise creates fresh.

- [ ] **Step 2: Write the test**

Create or replace `packages/ui/src/hooks/use-settings.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useSettings } from './use-settings'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

describe('useSettings', () => {
  it('returns the settings response shape on read', async () => {
    setMockHandler('settings.get', async () => ({
      path: '/home/me/.claude/settings.json',
      content: { model: 'sonnet-4' },
      exists: true,
    }))
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.exists).toBe(true)
    expect(result.current.data?.content).toEqual({ model: 'sonnet-4' })
  })

  it('passes project arg when provided', async () => {
    let captured: unknown = null
    setMockHandler('settings.get', async (args) => {
      captured = args
      return { path: '/x', content: null, exists: false }
    })
    renderHook(() => useSettings('/path/to/project'), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { project?: string }).project).toBe('/path/to/project')
  })

  it('omits project arg when not provided', async () => {
    let captured: unknown = null
    setMockHandler('settings.get', async (args) => {
      captured = args
      return { path: '/x', content: null, exists: false }
    })
    renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { project?: string }).project).toBeUndefined()
  })

  it('sends content via the save mutation', async () => {
    setMockHandler('settings.get', async () => ({ path: '/x', content: null, exists: false }))
    let sent: unknown = null
    setMockHandler('settings.set', async (args) => {
      sent = args
      return { success: true, path: '/x' }
    })
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.mutate({ model: 'opus' } as never)
    })
    await waitFor(() => expect(result.current.saveData).toBeDefined())
    expect((sent as { content?: unknown }).content).toEqual({ model: 'opus' })
  })

  it('surfaces save errors via saveError', async () => {
    setMockHandler('settings.get', async () => ({ path: '/x', content: null, exists: false }))
    setMockHandler('settings.set', async () => {
      throw Object.assign(new Error('content must be a JSON object'), { code: 'Validation' })
    })
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.mutate('not-an-object' as never)
    })
    await waitFor(() => expect(result.current.saveError).toBeTruthy())
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-settings.test 2>&1 | tail -15`
Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-settings.test.tsx
git commit -m "test(ui): use-settings tests (read, write, project arg, validation error)"
```

---

## Task 10: Migrate `use-configs.ts` to the transport seam

**Files:**
- Modify: `packages/ui/src/hooks/use-configs.ts`

- [ ] **Step 1: Replace the file contents**

Open `packages/ui/src/hooks/use-configs.ts`. Replace the entire contents with:

```ts
// React Query hooks for MCP servers, hooks, and LSP server configuration queries.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

/** A single MCP or LSP server entry after merging all sources. */
export interface ConfigEntry {
  name: string
  config: any
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

/** A single flattened hook entry. */
export interface HookEntry {
  event: string
  name: string
  data: Record<string, unknown>
  source: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp'],
    queryFn: () => request<{ mcpServers: ConfigEntry[] }>('configs.mcp', {}),
    select: data => data.mcpServers,
  })
}

export function useHooks() {
  return useQuery({
    queryKey: ['hooks'],
    queryFn: () => request<{ hooks: HookEntry[] }>('configs.hooks', {}),
    select: data => data.hooks,
  })
}

export function useLspServers() {
  return useQuery({
    queryKey: ['lsp'],
    queryFn: () => request<{ lspServers: ConfigEntry[] }>('configs.lsp', {}),
    select: data => data.lspServers,
  })
}
```

- [ ] **Step 2: Verify no fetch calls remain**

Run: `grep -n 'fetch(' /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui/src/hooks/use-configs.ts`
Expected: no output.

- [ ] **Step 3: Run the full UI test suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass. The existing `explorer.inventory.test.tsx` mocks the hooks directly (per the slice-3 review's grep result) — should still pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-configs.ts
git commit -m "feat(ui): use-configs routes through transport seam (configs.{mcp,hooks,lsp})"
```

---

## Task 11: Add `use-configs.test.tsx`

**Files:**
- Create: `packages/ui/src/hooks/use-configs.test.tsx`

- [ ] **Step 1: Write the test**

Create `packages/ui/src/hooks/use-configs.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useHooks, useLspServers, useMcpServers } from './use-configs'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
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

describe('useMcpServers', () => {
  it('returns the mcpServers array selected from the envelope', async () => {
    setMockHandler('configs.mcp', async () => ({
      mcpServers: [
        { name: 'github', config: { command: 'gh' }, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useMcpServers(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('github')
  })
})

describe('useHooks', () => {
  it('returns the hooks array selected from the envelope', async () => {
    setMockHandler('configs.hooks', async () => ({
      hooks: [
        { event: 'PreToolUse', name: 'PreToolUse [0]', data: {}, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useHooks(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].event).toBe('PreToolUse')
  })
})

describe('useLspServers', () => {
  it('returns the lspServers array selected from the envelope', async () => {
    setMockHandler('configs.lsp', async () => ({
      lspServers: [
        { name: 'rust-analyzer', config: { command: 'ra' }, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useLspServers(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].name).toBe('rust-analyzer')
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-configs.test 2>&1 | tail -10`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-configs.test.tsx
git commit -m "test(ui): use-configs tests for the three config hooks"
```

---

## Task 12: Extend `useFsChanged` invalidations for settings + configs

**Files:**
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

Settings + configs all live under `<claude_home>`. When the watcher fires `claude_home`, invalidate the matching React Query keys.

- [ ] **Step 1: Read the current file**

Open `packages/ui/src/hooks/use-fs-changed.ts`. Find the `claude_home` branch — it currently invalidates `['agents']`, `['skills']`, `['commands']` based on path segment.

- [ ] **Step 2: Add settings + configs invalidations**

In the `claude_home` branch, after the `commands` invalidation, add:

```ts
        if (path.endsWith('/settings.json')) {
          void qc.invalidateQueries({ queryKey: ['settings'] })
          // settings.json is also the source for hooks + lsp.
          void qc.invalidateQueries({ queryKey: ['hooks'] })
          void qc.invalidateQueries({ queryKey: ['lsp'] })
        }
        if (path.endsWith('/.mcp.json')) {
          void qc.invalidateQueries({ queryKey: ['mcp'] })
        }
```

The complete `claude_home` branch should now look like:

```ts
      if (payload.kind === 'claude_home') {
        const path = payload.path
        if (path.includes('/agents/')) {
          void qc.invalidateQueries({ queryKey: ['agents'] })
        }
        if (path.includes('/skills/')) {
          void qc.invalidateQueries({ queryKey: ['skills'] })
        }
        if (path.includes('/commands/')) {
          void qc.invalidateQueries({ queryKey: ['commands'] })
        }
        if (path.endsWith('/settings.json')) {
          void qc.invalidateQueries({ queryKey: ['settings'] })
          void qc.invalidateQueries({ queryKey: ['hooks'] })
          void qc.invalidateQueries({ queryKey: ['lsp'] })
        }
        if (path.endsWith('/.mcp.json')) {
          void qc.invalidateQueries({ queryKey: ['mcp'] })
        }
      }
```

- [ ] **Step 3: Run the UI suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(ui): useFsChanged invalidates settings/mcp/hooks/lsp on relevant writes"
```

---

## Task 13: Manual smoke test

**Files:** none

- [ ] **Step 1: Start the desktop app**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/desktop tauri dev`

- [ ] **Step 2: Verify Settings page reads from Rust**

Click the tray icon → `Open OhMyC →`. Navigate to `/settings` (or wherever the Settings panel lives — Explorer sidebar or top-nav).

Expected:
- The Settings page renders the form populated from `~/.claude/settings.json` (if it exists).
- No console errors about failed `/api/settings` calls.
- If `~/.claude/settings.json` does not exist yet, the form shows defaults; that's the `exists: false, content: null` state.

- [ ] **Step 3: Edit + save a setting; verify the file changes**

Change a toggle (e.g., `prefersReducedMotion`) and click Save. Then in a terminal:

```bash
cat ~/.claude/settings.json | python3 -m json.tool 2>/dev/null || cat ~/.claude/settings.json
```

Expected:
- File now contains the updated value.
- The atomic-write pattern means even if you crash mid-write, the previous file is intact.

- [ ] **Step 4: Verify Explorer MCP / Hooks / LSP tabs load**

Navigate to `/explore/mcp`, `/explore/hooks`, `/explore/lsp` (or whatever the route paths are — check sidebar entries). Each should render its list.

Expected:
- MCP shows entries from `~/.claude/.mcp.json` (if present).
- Hooks shows entries from `~/.claude/settings.json` `hooks` field (if present).
- LSP shows entries from `~/.claude/settings.json` `lspServers` field (if present).
- Empty list (no error) when source files don't exist.
- Plugin and project entries are MISSING (slice 6 scope) — expected, not a bug.

- [ ] **Step 5: Verify live invalidation from external write**

With the Settings page open, edit `~/.claude/settings.json` from a terminal:

```bash
# Make any harmless change, e.g. add a comment-like field:
python3 -c "import json,os; p=os.path.expanduser('~/.claude/settings.json'); d=json.load(open(p)) if os.path.exists(p) else {}; d['_smoke']='hi'; json.dump(d, open(p, 'w'), indent=2)"
```

Within ~1 second the Settings page should re-fetch and the form's "current saved value" updates.

Clean up:

```bash
python3 -c "import json,os; p=os.path.expanduser('~/.claude/settings.json'); d=json.load(open(p)); d.pop('_smoke',None); json.dump(d, open(p, 'w'), indent=2)"
```

Expected: React Query refetched because the watcher fired `claude_home` with the `/settings.json` suffix and `useFsChanged` invalidated `['settings']` (+ `['hooks']` + `['lsp']`).

- [ ] **Step 6: Verify web dev still works**

In a separate terminal: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli && pnpm dev`. Then: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm dev`.

Open `http://localhost:5173/settings`. The Settings page should still load, save, and re-read via the legacy `/api/settings` HTTP route. Same for `/explore/mcp`, `/hooks`, `/lsp`.

Expected: web dev unchanged — settings.get/set route through `fetchTransport` to the TS server.

- [ ] **Step 7: Report**

If any step failed, note which one. Do not mark this task complete until steps 1-5 pass.

---

## Done criteria for Slice 4

- `cargo test --workspace` green (target: ~99 tests total; +13 from slice 3's 86).
- `pnpm -r test` green (target: ~143 UI tests; +5 settings + 3 configs = +8 from slice 3's 138).
- `pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin` produces a binary.
- Manual smoke (Task 13) steps 1-5 pass.
- The TS server's `/api/{settings,mcp,hooks,lsp}` routes are still alive (web dev loop).
- `packages/ui/src/hooks/use-settings.ts` and `use-configs.ts` contain zero `fetch(` calls.
- `transport/fetch.ts` route map supports `{ url, method, body }` returns; existing string-shorthand entries (timeline + agents/skills/commands) continue to work unchanged.

---

## What this slice does NOT do (intentional)

- Does not migrate the store (`use-store.ts`, 21 CRUD hooks across 4 entity types). That's Slice 5.
- Does not port the `/api/settings/schema` endpoint. The desktop UI doesn't consume it; the schema lives client-side via `@ohmyc/shared`.
- Does not honor the `project` parameter on the desktop side — it's accepted by Tauri commands for hook compat but reads/writes always target `<claude_home>/settings.json`. Project-scoped settings on desktop would require a working-dir abstraction that's out of scope.
- Does not port plugin or project-local merge for MCP / hooks / LSP — same minimal-port scope-cut as slice 3. Plugin contributions land in Slice 6.
- Does not delete the TS server routes for settings or configs. Slice 8 (Cleanup) does that.
