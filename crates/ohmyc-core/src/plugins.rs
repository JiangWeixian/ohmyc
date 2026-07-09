//! Read installed plugins and known marketplaces from
//! `<claude_home>/plugins/`. Read-only; mirrors the TS
//! `PluginService` in `packages/cli/src/server/services/plugin-service.ts`.
//!
//! Slice-6 scope cut: enabled-state merge uses a single settings path
//! (`<claude_home>/settings.json`). Multi-path merge (user + project +
//! project-local) can be added when project-scoped settings context lands.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::components::{locator_id, ComponentKind, ComponentSource, Origin, Scope, SourceKind, SourceProvider};
use crate::error::ApiError;

const ENV_CODEX_PLUGINS_CACHE: &str = "OHMYC_CODEX_PLUGINS_CACHE";

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
    #[serde(rename = "locatorId", default)]
    pub locator_id: String,
    #[serde(rename = "sourceProvider", default = "default_plugin_source_provider")]
    pub source_provider: SourceProvider,
    #[serde(rename = "sourceKind", default = "default_plugin_source_kind")]
    pub source_kind: SourceKind,
    #[serde(default)]
    pub origins: Vec<Origin>,
}

fn default_plugin_source_provider() -> SourceProvider {
    SourceProvider::Claude
}

fn default_plugin_source_kind() -> SourceKind {
    SourceKind::Plugin
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

/// Read `enabledPlugins: { [id]: bool }` from one settings file. Missing
/// file, missing field, or malformed JSON → empty map.
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

pub fn load_manifest(install_path: &Path) -> Result<Option<PluginManifest>, ApiError> {
    let primary = install_path.join("plugin.json");
    if let Some(m) = read_manifest_or_none(&primary)? {
        return Ok(Some(m));
    }
    let codex = install_path.join(".codex-plugin").join("plugin.json");
    if let Some(m) = read_manifest_or_none(&codex)? {
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

fn read_json_or_none(path: &Path) -> Result<Option<Value>, ApiError> {
    let raw = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    };
    Ok(serde_json::from_str::<Value>(&raw).ok())
}

pub fn list_plugins(plugins_dir: &Path, settings_path: &Path) -> Result<Vec<InstalledPlugin>, ApiError> {
    let registry_path = plugins_dir.join("installed_plugins.json");
    let raw = match std::fs::read_to_string(&registry_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", registry_path.display()))),
    };
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
        let installs: Vec<PluginInstall> = serde_json::from_value(installs_value.clone()).unwrap_or_default();
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
            locator_id: locator_id(
                ComponentKind::Plugins,
                SourceProvider::Claude,
                ComponentSource::Plugin,
                Scope::Global,
                Some(id),
                id,
                installs.first().map(|install| Path::new(&install.install_path)),
            ),
            installs,
            manifest,
            components,
            source_provider: SourceProvider::Claude,
            source_kind: SourceKind::Plugin,
            origins: vec![Origin::Claude],
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn codex_plugins_cache_dir() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var(ENV_CODEX_PLUGINS_CACHE) {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    let home = dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(home.join(".codex").join("plugins").join("cache"))
}

pub fn list_codex_plugins(cache_dir: &Path) -> Result<Vec<InstalledPlugin>, ApiError> {
    if !cache_dir.exists() {
        return Ok(Vec::new());
    }
    let mut install_dirs = Vec::new();
    collect_codex_install_dirs(cache_dir, &mut install_dirs)?;

    let mut out = Vec::with_capacity(install_dirs.len());
    for install_path in install_dirs {
        let manifest = load_manifest(&install_path)?;
        let components = scan_components(&install_path)?;
        let (marketplace, fallback_name, version) = codex_cache_identity(cache_dir, &install_path);
        let name = manifest
            .as_ref()
            .and_then(|m| m.name.as_deref())
            .filter(|s| !s.is_empty())
            .unwrap_or(&fallback_name)
            .to_string();
        let id = format!("{name}@{marketplace}");
        let installs = vec![PluginInstall {
            version,
            installed_at: String::new(),
            last_updated: String::new(),
            install_path: install_path.to_string_lossy().to_string(),
            git_commit_sha: None,
            is_local: Some(false),
            scope: "user".to_string(),
            project_path: None,
            source: Some("codex".to_string()),
            installed_by_presets: None,
            extra: Map::new(),
        }];
        out.push(InstalledPlugin {
            locator_id: locator_id(
                ComponentKind::Plugins,
                SourceProvider::Codex,
                ComponentSource::Plugin,
                Scope::Global,
                Some(&id),
                &id,
                installs.first().map(|install| Path::new(&install.install_path)),
            ),
            id,
            name,
            marketplace,
            enabled: true,
            installs,
            manifest,
            components,
            source_provider: SourceProvider::Codex,
            source_kind: SourceKind::Plugin,
            origins: vec![Origin::Codex],
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.marketplace.cmp(&b.marketplace)));
    Ok(out)
}

fn collect_codex_install_dirs(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), ApiError> {
    if dir.join(".codex-plugin").join("plugin.json").is_file() {
        out.push(dir.to_path_buf());
        return Ok(());
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(it) => it,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(ApiError::Io(format!("read_dir {}: {e}", dir.display()))),
    };
    for entry in entries {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if path.is_dir() {
            collect_codex_install_dirs(&path, out)?;
        }
    }
    Ok(())
}

fn codex_cache_identity(cache_dir: &Path, install_path: &Path) -> (String, String, String) {
    let parts: Vec<String> = install_path
        .strip_prefix(cache_dir)
        .ok()
        .map(|p| {
            p.components()
                .filter_map(|c| c.as_os_str().to_str().map(ToString::to_string))
                .collect()
        })
        .unwrap_or_default();
    let marketplace = parts.first().cloned().unwrap_or_else(|| "codex".to_string());
    let fallback_name = parts
        .get(parts.len().saturating_sub(2))
        .cloned()
        .or_else(|| {
            install_path
                .file_name()
                .and_then(|s| s.to_str())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| "plugin".to_string());
    let version = install_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    (marketplace, fallback_name, version)
}

pub fn get_plugin(plugins_dir: &Path, settings_path: &Path, id: &str) -> Result<Option<InstalledPlugin>, ApiError> {
    let all = list_plugins(plugins_dir, settings_path)?;
    Ok(all.into_iter().find(|p| p.id == id))
}

fn split_id(id: &str) -> (&str, &str) {
    match id.find('@') {
        Some(i) => (&id[..i], &id[i + 1..]),
        None => (id, ""),
    }
}

#[derive(Debug, Clone, Default)]
pub struct PluginResources {
    pub agents: Vec<crate::components::agents::Agent>,
    pub skills: Vec<crate::components::skills::Skill>,
    pub commands: Vec<crate::components::commands::Command>,
}

pub fn parse_claude_plugin_resources(install_path: &Path, plugin_id: &str) -> Result<PluginResources, ApiError> {
    // Used by focused tests and future full-inventory callers. Production
    // list APIs should prefer resource-specific plugin parsers so a skills
    // request does not parse plugin agents and commands unnecessarily.
    Ok(PluginResources {
        agents: parse_claude_plugin_agents(install_path, plugin_id)?,
        skills: parse_claude_plugin_skills(install_path, plugin_id)?,
        commands: parse_claude_plugin_commands(install_path, plugin_id)?,
    })
}

pub fn parse_claude_plugin_agents(
    install_path: &Path,
    plugin_id: &str,
) -> Result<Vec<crate::components::agents::Agent>, ApiError> {
    crate::components::agents::list_with_meta(
        &install_path.join("agents"),
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}

pub fn parse_claude_plugin_skills(
    install_path: &Path,
    plugin_id: &str,
) -> Result<Vec<crate::components::skills::Skill>, ApiError> {
    crate::components::skills::list_with_origins_and_meta(
        &install_path.join("skills"),
        vec![Origin::Claude, Origin::Opencode],
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}

pub fn parse_claude_plugin_commands(
    install_path: &Path,
    plugin_id: &str,
) -> Result<Vec<crate::components::commands::Command>, ApiError> {
    crate::components::commands::list_with_meta(
        &install_path.join("commands"),
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}

pub fn parse_codex_plugin_resources(install_path: &Path, plugin_id: &str) -> Result<PluginResources, ApiError> {
    // Codex plugins currently expose skills only. Keep this parser explicit
    // so future agent/command support does not silently change skills-list
    // performance or behavior.
    Ok(PluginResources {
        agents: Vec::new(),
        skills: parse_codex_plugin_skills(install_path, plugin_id)?,
        commands: Vec::new(),
    })
}

pub fn parse_codex_plugin_skills(
    install_path: &Path,
    plugin_id: &str,
) -> Result<Vec<crate::components::skills::Skill>, ApiError> {
    crate::components::skills::list_with_origins_and_meta(
        &install_path.join("skills"),
        vec![Origin::Codex],
        SourceProvider::Codex,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
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
        std::fs::write(&settings, r#"{"enabledPlugins":{"gitlab@m":true,"other@m":false}}"#).unwrap();
        let map = read_enabled_plugins_from(&settings).unwrap();
        assert_eq!(map.get("gitlab@m"), Some(&true));
        assert_eq!(map.get("other@m"), Some(&false));
    }

    #[test]
    fn read_enabled_plugins_from_tolerates_corrupt_json() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        std::fs::write(&settings, "not json {").unwrap();
        assert!(read_enabled_plugins_from(&settings).unwrap().is_empty());
    }

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
        let bogus = dir.path().join("does-not-exist");
        let c = scan_components(&bogus).unwrap();
        assert!(c.agents.is_empty());
        assert!(c.hooks.is_none());
    }

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
}
