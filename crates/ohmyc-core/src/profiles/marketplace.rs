//! Synthetic `ohmyc-profiles` marketplace — exposes each profile as a
//! pseudo-plugin so Claude Code's plugin registry can enable/disable it
//! via `enabledPlugins`. Mirrors the TS `writeMarketplace`,
//! `registerProfilePlugin`, `registerKnownMarketplace` trio.

use std::path::Path;

use serde_json::{json, Value};

use crate::error::ApiError;

/// Marketplace ID used in `installed_plugins.json` keys and
/// `known_marketplaces.json`. Mirrors TS
/// `ProfileService.MARKETPLACE_ID`.
pub const MARKETPLACE_ID: &str = "ohmyc-profiles";

/// Synthetic plugin ID for a profile: `profile-<name>@ohmyc-profiles`.
pub fn plugin_id(profile_name: &str) -> String {
    format!("profile-{profile_name}@{MARKETPLACE_ID}")
}

/// Read `<plugins_dir>/installed_plugins.json`. Missing/malformed →
/// `{ "version": 2, "plugins": {} }`.
pub fn read_installed_plugins(plugins_dir: &Path) -> Value {
    let path = plugins_dir.join("installed_plugins.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(v) => normalize_installed(v),
            Err(_) => default_installed(),
        },
        Err(_) => default_installed(),
    }
}

fn normalize_installed(mut v: Value) -> Value {
    let obj = v.as_object_mut().expect("expected object");
    if !obj.contains_key("version") {
        obj.insert("version".to_string(), json!(2));
    }
    if !obj.contains_key("plugins") {
        obj.insert("plugins".to_string(), json!({}));
    }
    v
}

fn default_installed() -> Value {
    json!({ "version": 2, "plugins": {} })
}

/// Write `<plugins_dir>/installed_plugins.json` (creates parent dir).
pub fn write_installed_plugins(plugins_dir: &Path, data: &Value) -> Result<(), ApiError> {
    std::fs::create_dir_all(plugins_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugins_dir.display())))?;
    let path = plugins_dir.join("installed_plugins.json");
    let raw = serde_json::to_string_pretty(data)
        .map_err(|e| ApiError::Internal(format!("serialize installed_plugins: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

/// Read `<plugins_dir>/known_marketplaces.json`. Missing/malformed → `{}`.
pub fn read_known_marketplaces(plugins_dir: &Path) -> Value {
    let path = plugins_dir.join("known_marketplaces.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!({})),
        Err(_) => json!({}),
    }
}

/// Write `<plugins_dir>/known_marketplaces.json` (creates parent dir).
pub fn write_known_marketplaces(plugins_dir: &Path, data: &Value) -> Result<(), ApiError> {
    std::fs::create_dir_all(plugins_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugins_dir.display())))?;
    let path = plugins_dir.join("known_marketplaces.json");
    let raw = serde_json::to_string_pretty(data)
        .map_err(|e| ApiError::Internal(format!("serialize known_marketplaces: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

/// Add/overwrite the `profile-<name>@ohmyc-profiles` entry in
/// installed_plugins. Mirrors TS `registerProfilePlugin`.
pub fn register_profile_plugin(
    plugins_dir: &Path,
    name: &str,
    install_path: &Path,
    now_iso8601: &str,
) -> Result<(), ApiError> {
    let mut installed = read_installed_plugins(plugins_dir);
    let id = plugin_id(name);
    if let Some(plugins) = installed
        .as_object_mut()
        .and_then(|o| o.get_mut("plugins"))
        .and_then(|v| v.as_object_mut())
    {
        plugins.insert(
            id,
            json!([{
                "scope": "user",
                "installPath": install_path.to_string_lossy().to_string(),
                "version": "1.0.0",
                "installedAt": now_iso8601,
                "lastUpdated": now_iso8601,
            }]),
        );
    }
    write_installed_plugins(plugins_dir, &installed)
}

/// Remove the `profile-<name>@ohmyc-profiles` entry. No-op if absent.
pub fn unregister_profile_plugin(plugins_dir: &Path, name: &str) -> Result<(), ApiError> {
    let mut installed = read_installed_plugins(plugins_dir);
    let id = plugin_id(name);
    let mut changed = false;
    if let Some(plugins) = installed
        .as_object_mut()
        .and_then(|o| o.get_mut("plugins"))
        .and_then(|v| v.as_object_mut())
    {
        if plugins.remove(&id).is_some() {
            changed = true;
        }
    }
    if changed {
        write_installed_plugins(plugins_dir, &installed)?;
    }
    Ok(())
}

/// Snapshot of the known_marketplaces.json before activation registers
/// the synthetic marketplace — used by the undo stack to restore.
pub struct KnownMarketplacesSnapshot(pub Value);

/// Adds the `ohmyc-profiles` marketplace entry pointing at `base_dir`.
/// Returns the pre-write snapshot for the undo stack.
pub fn register_known_marketplace(
    plugins_dir: &Path,
    base_dir: &Path,
    now_iso8601: &str,
) -> Result<KnownMarketplacesSnapshot, ApiError> {
    let known = read_known_marketplaces(plugins_dir);
    let snapshot = KnownMarketplacesSnapshot(known.clone());
    let mut next = known;
    if let Some(obj) = next.as_object_mut() {
        obj.insert(
            MARKETPLACE_ID.to_string(),
            json!({
                "source": { "source": "directory", "path": base_dir.to_string_lossy() },
                "installLocation": base_dir.to_string_lossy(),
                "lastUpdated": now_iso8601,
            }),
        );
    }
    write_known_marketplaces(plugins_dir, &next)?;
    Ok(snapshot)
}

/// Write `<base_dir>/.claude-plugin/marketplace.json` listing every
/// profile (name, source path, description, fixed version "1.0.0").
/// `profile_summaries` is `(name, description_or_name)` pairs sorted by
/// name — caller-supplied so this stays pure I/O.
pub fn write_marketplace_json(
    base_dir: &Path,
    profile_summaries: &[(String, String)],
) -> Result<(), ApiError> {
    let dir = base_dir.join(".claude-plugin");
    std::fs::create_dir_all(&dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let plugins: Vec<Value> = profile_summaries
        .iter()
        .map(|(name, desc)| {
            json!({
                "name": format!("profile-{name}"),
                "source": format!("./profiles/{name}"),
                "description": format!("OhMyC profile: {desc}"),
                "version": "1.0.0",
            })
        })
        .collect();
    let body = json!({
        "name": MARKETPLACE_ID,
        "description": "OhMyC profile-as-plugin marketplace",
        "owner": { "name": "ohmyc" },
        "plugins": plugins,
    });
    let path = dir.join("marketplace.json");
    let raw = serde_json::to_string_pretty(&body)
        .map_err(|e| ApiError::Internal(format!("serialize marketplace.json: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plugin_id_uses_marketplace_constant() {
        assert_eq!(plugin_id("dev"), "profile-dev@ohmyc-profiles");
    }

    #[test]
    fn read_installed_returns_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let v = read_installed_plugins(dir.path());
        assert_eq!(v["version"], 2);
        assert!(v["plugins"].is_object());
        assert_eq!(v["plugins"].as_object().unwrap().len(), 0);
    }

    #[test]
    fn register_profile_plugin_adds_entry_with_qualified_id() {
        let dir = tempfile::tempdir().unwrap();
        let install_path = dir.path().join("install");
        register_profile_plugin(dir.path(), "dev", &install_path, "2026-06-06T00:00:00Z").unwrap();
        let v = read_installed_plugins(dir.path());
        let id = "profile-dev@ohmyc-profiles";
        assert!(v["plugins"][id].is_array());
        assert_eq!(v["plugins"][id][0]["installPath"], install_path.to_string_lossy().as_ref());
        assert_eq!(v["plugins"][id][0]["scope"], "user");
        assert_eq!(v["plugins"][id][0]["version"], "1.0.0");
    }

    #[test]
    fn unregister_profile_plugin_removes_entry() {
        let dir = tempfile::tempdir().unwrap();
        register_profile_plugin(dir.path(), "dev", &dir.path().join("install"), "ts").unwrap();
        unregister_profile_plugin(dir.path(), "dev").unwrap();
        let v = read_installed_plugins(dir.path());
        assert!(v["plugins"]["profile-dev@ohmyc-profiles"].is_null());
    }

    #[test]
    fn unregister_profile_plugin_is_noop_when_absent() {
        let dir = tempfile::tempdir().unwrap();
        unregister_profile_plugin(dir.path(), "ghost").unwrap();
        assert!(!dir.path().join("installed_plugins.json").exists());
    }

    #[test]
    fn register_known_marketplace_writes_entry_and_returns_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let base = tempfile::tempdir().unwrap();
        let snapshot = register_known_marketplace(dir.path(), base.path(), "2026-06-06T00:00:00Z").unwrap();
        let v = read_known_marketplaces(dir.path());
        assert_eq!(v[MARKETPLACE_ID]["source"]["source"], "directory");
        assert_eq!(v[MARKETPLACE_ID]["source"]["path"], base.path().to_string_lossy().as_ref());
        assert_eq!(v[MARKETPLACE_ID]["installLocation"], base.path().to_string_lossy().as_ref());
        assert_eq!(snapshot.0, json!({}));
    }

    #[test]
    fn write_marketplace_json_lists_profiles_sorted_by_name() {
        let dir = tempfile::tempdir().unwrap();
        let summaries = vec![
            ("alpha".to_string(), "First".to_string()),
            ("beta".to_string(), "Second".to_string()),
        ];
        write_marketplace_json(dir.path(), &summaries).unwrap();
        let raw = std::fs::read_to_string(dir.path().join(".claude-plugin").join("marketplace.json")).unwrap();
        let v: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(v["name"], MARKETPLACE_ID);
        let plugins = v["plugins"].as_array().unwrap();
        assert_eq!(plugins.len(), 2);
        assert_eq!(plugins[0]["name"], "profile-alpha");
        assert_eq!(plugins[0]["source"], "./profiles/alpha");
        assert_eq!(plugins[0]["description"], "OhMyC profile: First");
        assert_eq!(plugins[1]["name"], "profile-beta");
    }
}
