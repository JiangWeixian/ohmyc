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
    pub source: &'static str,
    pub scope: &'static str,
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
            assert!(stop.data.get("matcher").is_none());
        });
    }

    #[test]
    fn hooks_returns_empty_when_settings_missing_or_no_hooks_field() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            assert!(hooks().unwrap().is_empty());
        });
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
