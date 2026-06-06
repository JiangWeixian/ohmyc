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

/// Read `<plugins_dir>/known_marketplaces.json`. Missing or malformed file
/// → empty list.
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
}
