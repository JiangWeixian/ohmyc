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
