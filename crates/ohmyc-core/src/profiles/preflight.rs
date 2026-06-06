//! Profile activation dry-run. Lists missing store components, predicts
//! settings overwrite warnings, surfaces the current-active context,
//! and computes the model-config env diff.
//!
//! Read-only — no writes, no symlinks. Reuse-safe by the deferred
//! activation slice as its internal safety gate.

use std::path::Path;

use serde::Serialize;
use serde_json::Map;

use crate::error::ApiError;
use crate::store::{self, provenance::ComponentKind};

use super::crud::{self, Profile};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResult {
    pub can_activate: bool,
    pub missing: Vec<String>,
    pub settings_warnings: Vec<String>,
    pub current_active: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_config_changes: Option<ModelConfigChanges>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigChanges {
    pub config_name: String,
    pub changes: Vec<ModelConfigEnvChange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deactivation_changes: Option<Vec<ModelConfigEnvChange>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deactivation_config_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ModelConfigEnvChange {
    pub action: EnvAction,
    pub key: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum EnvAction {
    Set,
    Change,
    Remove,
}

fn read_settings(settings_path: &Path) -> Map<String, serde_json::Value> {
    match std::fs::read_to_string(settings_path) {
        Ok(raw) => match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(serde_json::Value::Object(m)) => m,
            _ => Map::new(),
        },
        Err(_) => Map::new(),
    }
}

fn compute_settings_warnings(
    current: &Map<String, serde_json::Value>,
    profile_settings: Option<&Map<String, serde_json::Value>>,
) -> Vec<String> {
    let Some(ps) = profile_settings else {
        return Vec::new();
    };
    let mut warnings = Vec::new();
    for key in ps.keys() {
        if current.contains_key(key) {
            warnings.push(format!("Settings key '{key}' would be overwritten"));
        }
    }
    warnings.sort();
    warnings
}

fn compute_missing(store_dir: &Path, profile: &Profile) -> Vec<String> {
    let mut missing = Vec::new();
    for name in &profile.agents {
        if !store::component_exists(store_dir, ComponentKind::Agents, name) {
            missing.push(format!("agent:{name}"));
        }
    }
    for name in &profile.skills {
        if !store::component_exists(store_dir, ComponentKind::Skills, name) {
            missing.push(format!("skill:{name}"));
        }
    }
    for name in &profile.commands {
        if !store::component_exists(store_dir, ComponentKind::Commands, name) {
            missing.push(format!("command:{name}"));
        }
    }
    missing
}

pub fn preflight(
    profiles_dir: &Path,
    store_dir: &Path,
    settings_path: &Path,
    name: &str,
) -> Result<PreflightResult, ApiError> {
    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };
    let missing = compute_missing(store_dir, &profile);
    let current = read_settings(settings_path);
    let settings_warnings = compute_settings_warnings(
        &current,
        profile.settings.as_ref(),
    );
    let current_active = crud::read_active_profile_name(profiles_dir)?;

    let model_config_changes = compute_model_config_changes_branch(
        profiles_dir,
        store_dir,
        &current,
        current_active.as_deref(),
        &profile,
    )?;

    Ok(PreflightResult {
        can_activate: missing.is_empty(),
        missing,
        settings_warnings,
        current_active,
        model_config_changes,
    })
}

fn compute_model_config_changes_branch(
    profiles_dir: &Path,
    store_dir: &Path,
    current_settings: &Map<String, serde_json::Value>,
    current_active: Option<&str>,
    profile: &Profile,
) -> Result<Option<ModelConfigChanges>, ApiError> {
    let Some(mc_name) = profile.model_config.as_deref() else {
        return Ok(None);
    };
    let model_configs_dir = store_dir.join("model-configs");
    let Some(mc) = store::model_configs::get(&model_configs_dir, mc_name)? else {
        return Ok(None);
    };

    let current_env = current_settings
        .get("env")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let changes = build_env_changes(
        &mc.api_key,
        &mc.base_url,
        if mc.model_name.is_empty() { None } else { Some(mc.model_name.as_str()) },
        &current_env,
    );

    let mut deactivation_changes = None;
    let mut deactivation_config_name = None;
    if let Some(active) = current_active {
        if let Some(active_profile) = crud::get(profiles_dir, active)? {
            if let Some(active_mc_name) = active_profile.model_config.as_deref() {
                if let Some(active_mc) = store::model_configs::get(&model_configs_dir, active_mc_name)? {
                    let mut removes = vec![
                        "ANTHROPIC_AUTH_TOKEN",
                        "ANTHROPIC_BASE_URL",
                        "API_TIMEOUT_MS",
                        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
                    ];
                    if !active_mc.model_name.is_empty() {
                        removes.push("ANTHROPIC_MODEL");
                    }
                    deactivation_changes = Some(
                        removes
                            .iter()
                            .map(|key| ModelConfigEnvChange {
                                action: EnvAction::Remove,
                                key: (*key).to_string(),
                                value: current_env
                                    .get(*key)
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                previous_value: None,
                            })
                            .collect(),
                    );
                    deactivation_config_name = Some(active_mc_name.to_string());
                }
            }
        }
    }

    Ok(Some(ModelConfigChanges {
        config_name: mc_name.to_string(),
        changes,
        deactivation_changes,
        deactivation_config_name,
    }))
}

fn build_env_changes(
    api_key: &str,
    base_url: &str,
    model_name: Option<&str>,
    current_env: &Map<String, serde_json::Value>,
) -> Vec<ModelConfigEnvChange> {
    let mut vars: Vec<(&'static str, String)> = vec![
        ("ANTHROPIC_AUTH_TOKEN", api_key.to_string()),
        ("ANTHROPIC_BASE_URL", base_url.to_string()),
        ("API_TIMEOUT_MS", "3000000".to_string()),
        ("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1".to_string()),
    ];
    if let Some(m) = model_name {
        vars.push(("ANTHROPIC_MODEL", m.to_string()));
    }

    vars.into_iter()
        .map(|(key, raw_value)| {
            let value = if key == "ANTHROPIC_AUTH_TOKEN" {
                mask_api_key(&raw_value)
            } else {
                raw_value
            };
            match current_env.get(key).and_then(|v| v.as_str()) {
                Some(prev) => ModelConfigEnvChange {
                    action: EnvAction::Change,
                    key: key.to_string(),
                    value,
                    previous_value: Some(prev.to_string()),
                },
                None => ModelConfigEnvChange {
                    action: EnvAction::Set,
                    key: key.to_string(),
                    value,
                    previous_value: None,
                },
            }
        })
        .collect()
}

fn mask_api_key(key: &str) -> String {
    if key.len() >= 4 {
        format!("****{}", &key[key.len() - 4..])
    } else {
        "****".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(p: &Path, body: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, body).unwrap();
    }

    struct Fixture {
        _root: tempfile::TempDir,
        profiles: std::path::PathBuf,
        store: std::path::PathBuf,
        settings: std::path::PathBuf,
    }

    fn fixture() -> Fixture {
        let root = tempfile::tempdir().unwrap();
        let profiles = root.path().join("profiles");
        let store = root.path().join("store");
        let settings = root.path().join("settings.json");
        std::fs::create_dir_all(&profiles).unwrap();
        std::fs::create_dir_all(store.join("agents")).unwrap();
        std::fs::create_dir_all(store.join("commands")).unwrap();
        std::fs::create_dir_all(store.join("skills")).unwrap();
        write(&settings, "{}");
        Fixture { _root: root, profiles, store, settings }
    }

    fn write_mc(store_dir: &Path, name: &str, api_key: &str, base_url: &str, model_name: &str) {
        let mc = serde_json::json!({
            "name": name,
            "apiKey": api_key,
            "baseUrl": base_url,
            "modelName": model_name,
            "provider": ""
        });
        let path = store_dir.join("model-configs").join(format!("{name}.json"));
        write(&path, &mc.to_string());
    }

    #[test]
    fn preflight_can_activate_when_all_components_present() {
        let f = fixture();
        write(&f.store.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "agents": ["reviewer"]}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.can_activate);
        assert!(r.missing.is_empty());
        assert!(r.current_active.is_none());
    }

    #[test]
    fn preflight_lists_missing_agent_skill_command() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({
                "name": "test",
                "agents": ["miss-agent"],
                "skills": ["miss-skill"],
                "commands": ["miss-cmd"]
            }),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(!r.can_activate);
        assert!(r.missing.contains(&"agent:miss-agent".to_string()));
        assert!(r.missing.contains(&"skill:miss-skill".to_string()));
        assert!(r.missing.contains(&"command:miss-cmd".to_string()));
    }

    #[test]
    fn preflight_returns_settings_warnings_for_overlap() {
        let f = fixture();
        write(&f.settings, r#"{"model":"sonnet","effort":"low"}"#);
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "settings": {"effort": "high"}}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert_eq!(r.settings_warnings, vec!["Settings key 'effort' would be overwritten".to_string()]);
    }

    #[test]
    fn preflight_returns_no_warnings_for_disjoint_settings() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "settings": {"brandNewKey": "v"}}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.settings_warnings.is_empty());
    }

    #[test]
    fn preflight_returns_current_active_from_marker() {
        let f = fixture();
        crud::create(&f.profiles, &serde_json::json!({"name": "test"})).unwrap();
        write(&f.profiles.join(".active"), "dev");
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert_eq!(r.current_active.as_deref(), Some("dev"));
    }

    #[test]
    fn preflight_returns_not_found_when_profile_missing() {
        let f = fixture();
        let err = preflight(&f.profiles, &f.store, &f.settings, "ghost").unwrap_err();
        assert!(matches!(err, ApiError::NotFound { .. }));
    }

    // --- model-config tests (Task 8) ---

    #[test]
    fn preflight_returns_set_actions_when_env_keys_absent() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-test1234567890", "https://api.anthropic.com", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        assert_eq!(mc.config_name, "anthropic");
        let actions: Vec<_> = mc.changes.iter().map(|c| &c.action).collect();
        assert!(actions.iter().all(|a| matches!(a, EnvAction::Set)));
        let keys: Vec<_> = mc.changes.iter().map(|c| c.key.as_str()).collect();
        assert!(keys.contains(&"ANTHROPIC_AUTH_TOKEN"));
        assert!(keys.contains(&"ANTHROPIC_BASE_URL"));
        assert!(keys.contains(&"API_TIMEOUT_MS"));
        assert!(keys.contains(&"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"));
        assert!(!keys.contains(&"ANTHROPIC_MODEL"));
    }

    #[test]
    fn preflight_emits_anthropic_model_when_model_name_set() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-x", "https://api.x", "claude-sonnet-4");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let keys: Vec<_> = mc.changes.iter().map(|c| c.key.as_str()).collect();
        assert!(keys.contains(&"ANTHROPIC_MODEL"));
    }

    #[test]
    fn preflight_masks_api_key_in_change_value() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-secret-1234", "https://x", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let token = mc.changes.iter().find(|c| c.key == "ANTHROPIC_AUTH_TOKEN").unwrap();
        assert_eq!(token.value, "****1234");
    }

    #[test]
    fn preflight_emits_change_action_for_existing_env_keys() {
        let f = fixture();
        write(
            &f.settings,
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://old"}}"#,
        );
        write_mc(&f.store, "anthropic", "sk-x", "https://new", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let base = mc.changes.iter().find(|c| c.key == "ANTHROPIC_BASE_URL").unwrap();
        assert!(matches!(base.action, EnvAction::Change));
        assert_eq!(base.previous_value.as_deref(), Some("https://old"));
        assert_eq!(base.value, "https://new");
    }

    #[test]
    fn preflight_emits_deactivation_changes_when_switching_profiles() {
        let f = fixture();
        write_mc(&f.store, "prev-mc", "sk-prev", "https://prev", "");
        write_mc(&f.store, "new-mc", "sk-new", "https://new", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "prev", "modelConfig": "prev-mc"}),
        )
        .unwrap();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "next", "modelConfig": "new-mc"}),
        )
        .unwrap();
        write(&f.profiles.join(".active"), "prev");
        let r = preflight(&f.profiles, &f.store, &f.settings, "next").unwrap();
        let mc = r.model_config_changes.unwrap();
        let deact = mc.deactivation_changes.expect("deactivation_changes set");
        assert!(deact.iter().all(|c| matches!(c.action, EnvAction::Remove)));
        assert_eq!(mc.deactivation_config_name.as_deref(), Some("prev-mc"));
    }

    #[test]
    fn preflight_omits_model_config_changes_when_profile_has_no_model_config() {
        let f = fixture();
        crud::create(&f.profiles, &serde_json::json!({"name": "test"})).unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.model_config_changes.is_none());
    }

    #[test]
    fn preflight_omits_model_config_changes_when_config_missing_on_disk() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "ghost"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.model_config_changes.is_none());
    }
}
