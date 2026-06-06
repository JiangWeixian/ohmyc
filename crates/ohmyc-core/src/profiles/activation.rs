//! Profile activation — the transactional state machine. Built up
//! across Tasks 5-9: helpers first (deep merge, env injection), then
//! forward path, then undo stack, then auto-restore-previous.

use std::path::Path;

use serde_json::{json, Map, Value};

use crate::error::ApiError;

use super::marketplace;

/// Recursive merge: object → object recurses, arrays/primitives in
/// `source` overwrite `target`. Mirrors TS `deepMerge` exactly.
pub(crate) fn deep_merge(target: &Value, source: &Value) -> Value {
    match (target, source) {
        (Value::Object(t), Value::Object(s)) => {
            let mut out = t.clone();
            for (k, v) in s {
                let merged = match out.get(k) {
                    Some(existing) => deep_merge(existing, v),
                    None => v.clone(),
                };
                out.insert(k.clone(), merged);
            }
            Value::Object(out)
        }
        _ => source.clone(),
    }
}

/// Build the 4-or-5 env var map for a model config. Mirrors the TS
/// `environmentVariables` literal in `activate` Step 10.
pub(crate) fn build_env_vars(
    api_key: &str,
    base_url: &str,
    model_name: Option<&str>,
) -> Map<String, Value> {
    let mut env = Map::new();
    env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key.to_string()));
    env.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url.to_string()));
    env.insert("API_TIMEOUT_MS".to_string(), Value::String("3000000".to_string()));
    env.insert(
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC".to_string(),
        Value::String("1".to_string()),
    );
    if let Some(m) = model_name {
        if !m.is_empty() {
            env.insert("ANTHROPIC_MODEL".to_string(), Value::String(m.to_string()));
        }
    }
    env
}

/// Internal cleanup — restores backup, removes generated artifacts.
/// No lock acquisition (callers hold the activation lock when needed).
/// All steps are best-effort; missing files/dirs are not errors.
pub fn deactivate_internal(
    base_dir: &Path,
    profiles_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    active_name: &str,
) -> Result<(), ApiError> {
    let per_profile = base_dir.join(format!("settings.backup.{active_name}.json"));
    let generic = base_dir.join("settings.backup.json");
    let restored = if let Ok(raw) = std::fs::read_to_string(&per_profile) {
        if let Some(parent) = claude_settings_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(claude_settings_path, raw)
            .map_err(|e| ApiError::Io(format!("write {}: {e}", claude_settings_path.display())))?;
        let _ = std::fs::remove_file(&per_profile);
        true
    } else {
        false
    };
    if !restored {
        if let Ok(raw) = std::fs::read_to_string(&generic) {
            if let Some(parent) = claude_settings_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(claude_settings_path, raw)
                .map_err(|e| ApiError::Io(format!("write {}: {e}", claude_settings_path.display())))?;
            let _ = std::fs::remove_file(&generic);
        }
    }

    let profile_dir = profiles_dir.join(active_name);

    for sub in ["agents", "skills", "commands"] {
        let sub_dir = profile_dir.join(sub);
        let Ok(entries) = std::fs::read_dir(&sub_dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_symlink = path
                .symlink_metadata()
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false);
            if is_symlink || path.is_file() {
                let _ = std::fs::remove_file(&path);
            } else if path.is_dir() {
                let _ = std::fs::remove_dir_all(&path);
            }
        }
    }

    let _ = std::fs::remove_dir_all(profile_dir.join(".claude-plugin"));
    let _ = std::fs::remove_dir_all(profile_dir.join("hooks"));
    let _ = std::fs::remove_file(profile_dir.join(".mcp.json"));
    let _ = std::fs::remove_file(profile_dir.join(".lsp.json"));

    marketplace::unregister_profile_plugin(plugins_dir, active_name)?;

    let _ = std::fs::remove_file(profiles_dir.join(".active"));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::path::PathBuf;

    #[test]
    fn deep_merge_recurses_into_objects() {
        let t = json!({ "a": { "b": 1, "c": 2 }, "d": 3 });
        let s = json!({ "a": { "c": 99, "e": 4 } });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": { "b": 1, "c": 99, "e": 4 }, "d": 3 }));
    }

    #[test]
    fn deep_merge_array_in_source_overwrites_target_array() {
        let t = json!({ "list": [1, 2, 3] });
        let s = json!({ "list": [4] });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "list": [4] }));
    }

    #[test]
    fn deep_merge_source_primitive_replaces_target_object() {
        let t = json!({ "a": { "b": 1 } });
        let s = json!({ "a": "scalar" });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": "scalar" }));
    }

    #[test]
    fn build_env_vars_includes_anthropic_model_when_set() {
        let env = build_env_vars("sk-x", "https://api", Some("claude-sonnet-4"));
        assert_eq!(env.get("ANTHROPIC_MODEL").unwrap(), "claude-sonnet-4");
        assert_eq!(env.get("API_TIMEOUT_MS").unwrap(), "3000000");
    }

    #[test]
    fn build_env_vars_omits_anthropic_model_when_empty_or_none() {
        let env = build_env_vars("sk-x", "https://api", None);
        assert!(env.get("ANTHROPIC_MODEL").is_none());
        let env_empty = build_env_vars("sk-x", "https://api", Some(""));
        assert!(env_empty.get("ANTHROPIC_MODEL").is_none());
    }

    fn write(p: &std::path::Path, contents: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, contents).unwrap();
    }

    struct ActivatedFixture {
        _root: tempfile::TempDir,
        base: PathBuf,
        profiles_dir: PathBuf,
        plugins_dir: PathBuf,
        claude_settings: PathBuf,
        profile_dir: PathBuf,
    }

    fn setup_activated(name: &str) -> ActivatedFixture {
        let root = tempfile::tempdir().unwrap();
        let base = root.path().to_path_buf();
        let profiles_dir = base.join("profiles");
        let plugins_dir = base.join("claude-plugins");
        let claude_settings = base.join("claude-settings.json");
        let profile_dir = profiles_dir.join(name);
        write(&claude_settings, r#"{"model":"sonnet","effort":"high"}"#);
        write(
            &base.join(format!("settings.backup.{name}.json")),
            r#"{"model":"sonnet"}"#,
        );
        std::fs::create_dir_all(&profile_dir).unwrap();
        write(&profile_dir.join("agents/reviewer.md"), "x");
        write(&profile_dir.join("commands/push.md"), "x");
        std::fs::create_dir_all(profile_dir.join("skills/deploy")).unwrap();
        write(&profile_dir.join(".claude-plugin/plugin.json"), "{}");
        write(&profile_dir.join("hooks/hooks.json"), "{}");
        write(&profile_dir.join(".mcp.json"), "{}");
        write(&profile_dir.join(".lsp.json"), "{}");
        write(&profiles_dir.join(".active"), name);
        crate::profiles::marketplace::register_profile_plugin(
            &plugins_dir,
            name,
            &profile_dir,
            "2026-06-06T00:00:00Z",
        )
        .unwrap();
        ActivatedFixture { _root: root, base, profiles_dir, plugins_dir, claude_settings, profile_dir }
    }

    #[test]
    fn deactivate_internal_restores_settings_backup() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let settings: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(settings, json!({"model": "sonnet"}));
        assert!(!f.base.join("settings.backup.dev.json").exists());
    }

    #[test]
    fn deactivate_internal_removes_symlinks_and_generated_files() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        assert!(!f.profile_dir.join("agents/reviewer.md").exists());
        assert!(!f.profile_dir.join("commands/push.md").exists());
        assert!(!f.profile_dir.join("skills/deploy").exists());
        assert!(!f.profile_dir.join(".claude-plugin").exists());
        assert!(!f.profile_dir.join("hooks").exists());
        assert!(!f.profile_dir.join(".mcp.json").exists());
        assert!(!f.profile_dir.join(".lsp.json").exists());
    }

    #[test]
    fn deactivate_internal_unregisters_plugin_and_clears_active() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let installed = crate::profiles::marketplace::read_installed_plugins(&f.plugins_dir);
        assert!(installed["plugins"]["profile-dev@ohmyc-profiles"].is_null());
        assert!(!f.profiles_dir.join(".active").exists());
    }

    #[test]
    fn deactivate_internal_falls_back_to_generic_backup_when_per_profile_missing() {
        let f = setup_activated("dev");
        std::fs::remove_file(f.base.join("settings.backup.dev.json")).unwrap();
        write(&f.base.join("settings.backup.json"), r#"{"model":"generic"}"#);
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let settings: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(settings["model"], "generic");
        assert!(!f.base.join("settings.backup.json").exists());
    }
}
