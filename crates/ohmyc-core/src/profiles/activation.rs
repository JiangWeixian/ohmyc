//! Profile activation — the transactional state machine. Built up
//! across Tasks 5-9: helpers first (deep merge, env injection), then
//! forward path, then undo stack, then auto-restore-previous.

use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};

use crate::error::ApiError;

use super::{crud, marketplace, preflight};
use super::symlink as sym;

#[derive(Debug)]
enum UndoAction {
    RemoveFile(PathBuf),
    RemoveDir(PathBuf),
    RestoreInstalled(Value),
    RestoreKnown(Value),
    /// `Some(bytes)` → restore the pre-write file contents.
    /// `None` → settings.json didn't exist pre-activation; remove the
    /// file so rollback doesn't leave an orphan empty-object behind.
    RestoreSettings(Option<Vec<u8>>),
}

impl UndoAction {
    fn run(&self, plugins_dir: &Path, claude_settings_path: &Path) {
        match self {
            UndoAction::RemoveFile(p) => {
                let _ = std::fs::remove_file(p);
            }
            UndoAction::RemoveDir(p) => {
                let _ = std::fs::remove_dir_all(p);
            }
            UndoAction::RestoreInstalled(v) => {
                let _ = marketplace::write_installed_plugins(plugins_dir, v);
            }
            UndoAction::RestoreKnown(v) => {
                let _ = marketplace::write_known_marketplaces(plugins_dir, v);
            }
            UndoAction::RestoreSettings(Some(bytes)) => {
                let _ = std::fs::write(claude_settings_path, bytes);
            }
            UndoAction::RestoreSettings(None) => {
                let _ = std::fs::remove_file(claude_settings_path);
            }
        }
    }
}

fn rollback(actions: &[UndoAction], plugins_dir: &Path, claude_settings_path: &Path) {
    for action in actions.iter().rev() {
        action.run(plugins_dir, claude_settings_path);
    }
}

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

    // Match TS `rm(path, { force: true })`: remove each entry as a file
    // (works for both files and symlinks on Unix — including symlinks
    // pointing at directories). We intentionally do NOT recurse into
    // real subdirectories: activation only ever creates symlinks here,
    // so a real dir would be a user artifact we should leave alone.
    for sub in ["agents", "skills", "commands"] {
        let sub_dir = profile_dir.join(sub);
        let Ok(entries) = std::fs::read_dir(&sub_dir) else { continue };
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
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

pub(crate) fn activate_forward(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
) -> Result<Vec<String>, ApiError> {
    let mut undo: Vec<UndoAction> = Vec::new();

    let result = activate_inner(
        base_dir,
        profiles_dir,
        store_dir,
        plugins_dir,
        claude_settings_path,
        name,
        &mut undo,
    );

    if result.is_err() {
        rollback(&undo, plugins_dir, claude_settings_path);
    }
    result
}

fn activate_inner(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
    undo: &mut Vec<UndoAction>,
) -> Result<Vec<String>, ApiError> {
    let pre = preflight::preflight(profiles_dir, store_dir, claude_settings_path, name)?;
    if !pre.can_activate {
        return Err(ApiError::ActivationBlocked { missing: pre.missing });
    }

    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };

    let previous_active = crud::read_active_profile_name(profiles_dir)?;

    if let Some(prev) = previous_active.as_deref() {
        deactivate_internal(base_dir, profiles_dir, plugins_dir, claude_settings_path, prev)?;
    }

    // Capture pre-write state so rollback can restore-or-remove. None
    // signals "file did not exist pre-activation" so RestoreSettings
    // unlinks rather than materializing an orphan `{}`.
    let pre_settings: Option<Vec<u8>> = std::fs::read(claude_settings_path).ok();
    let current_settings: Value = pre_settings
        .as_deref()
        .and_then(|b| serde_json::from_slice(b).ok())
        .unwrap_or_else(|| json!({}));
    let backup_path = base_dir.join(format!("settings.backup.{name}.json"));
    std::fs::write(&backup_path, serde_json::to_string_pretty(&current_settings).unwrap())
        .map_err(|e| ApiError::Io(format!("write backup {}: {e}", backup_path.display())))?;
    undo.push(UndoAction::RemoveFile(backup_path.clone()));

    let profile_dir = profiles_dir.join(name);
    std::fs::create_dir_all(&profile_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", profile_dir.display())))?;

    let absolute = profile_dir.canonicalize().unwrap_or(profile_dir.clone());
    let active_path = profiles_dir.join(".active");
    std::fs::write(&active_path, absolute.to_string_lossy().to_string())
        .map_err(|e| ApiError::Io(format!("write .active: {e}")))?;
    undo.push(UndoAction::RemoveFile(active_path));

    for agent in &profile.agents {
        let source = store_dir.join("agents").join(format!("{agent}.md"));
        let dest = profile_dir.join("agents").join(format!("{agent}.md"));
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }
    for skill in &profile.skills {
        let source = store_dir.join("skills").join(skill);
        let dest = profile_dir.join("skills").join(skill);
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }
    for cmd in &profile.commands {
        let source = store_dir.join("commands").join(format!("{cmd}.md"));
        let dest = profile_dir.join("commands").join(format!("{cmd}.md"));
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }

    let plugin_dir = profile_dir.join(".claude-plugin");
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugin_dir.display())))?;
    let description = profile.description.clone().unwrap_or_else(|| name.to_string());
    let plugin_json = json!({
        "name": format!("profile-{name}"),
        "version": "1.0.0",
        "description": format!("OhMyC profile: {description}"),
    });
    std::fs::write(
        plugin_dir.join("plugin.json"),
        serde_json::to_string_pretty(&plugin_json).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write plugin.json: {e}")))?;
    undo.push(UndoAction::RemoveDir(plugin_dir));

    if let Some(hooks) = profile.hooks.as_ref() {
        let hooks_dir = profile_dir.join("hooks");
        std::fs::create_dir_all(&hooks_dir)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", hooks_dir.display())))?;
        let body = json!({ "hooks": hooks });
        std::fs::write(
            hooks_dir.join("hooks.json"),
            serde_json::to_string_pretty(&body).unwrap(),
        )
        .map_err(|e| ApiError::Io(format!("write hooks.json: {e}")))?;
        undo.push(UndoAction::RemoveDir(hooks_dir));
    }

    if let Some(mcp) = profile.mcp_servers.as_ref() {
        let body = json!({ "mcpServers": mcp });
        let path = profile_dir.join(".mcp.json");
        std::fs::write(&path, serde_json::to_string_pretty(&body).unwrap())
            .map_err(|e| ApiError::Io(format!("write .mcp.json: {e}")))?;
        undo.push(UndoAction::RemoveFile(path));
    }

    if let Some(lsp) = profile.lsp_servers.as_ref() {
        let path = profile_dir.join(".lsp.json");
        std::fs::write(&path, serde_json::to_string_pretty(lsp).unwrap())
            .map_err(|e| ApiError::Io(format!("write .lsp.json: {e}")))?;
        undo.push(UndoAction::RemoveFile(path));
    }

    let mut merged = current_settings.clone();
    if let Some(ps) = profile.settings.as_ref() {
        merged = deep_merge(&merged, &Value::Object(ps.clone()));
    }
    if let Some(mc_name) = profile.model_config.as_deref() {
        if let Some(mc) = crate::store::model_configs::get(&store_dir.join("model-configs"), mc_name)? {
            let model = if mc.model_name.is_empty() { None } else { Some(mc.model_name.as_str()) };
            let env = build_env_vars(&mc.api_key, &mc.base_url, model);
            let existing_env = merged
                .get("env")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();
            let mut combined = existing_env;
            for (k, v) in env {
                combined.insert(k, v);
            }
            merged.as_object_mut().unwrap().insert("env".to_string(), Value::Object(combined));
        }
    }
    let mut enabled = merged
        .get("enabledPlugins")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    for plugin_id in &profile.plugins {
        enabled.insert(plugin_id.clone(), Value::Bool(true));
    }
    enabled.insert(marketplace::plugin_id(name), Value::Bool(true));
    merged.as_object_mut().unwrap().insert("enabledPlugins".to_string(), Value::Object(enabled));

    if let Some(parent) = claude_settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }
    std::fs::write(
        claude_settings_path,
        serde_json::to_string_pretty(&merged).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write settings: {e}")))?;
    undo.push(UndoAction::RestoreSettings(pre_settings));

    let listing = crud::list(profiles_dir)?;
    let summaries: Vec<(String, String)> = listing
        .profiles
        .iter()
        .map(|p| (p.name.clone(), p.description.clone().unwrap_or_else(|| p.name.clone())))
        .collect();
    marketplace::write_marketplace_json(base_dir, &summaries)?;
    undo.push(UndoAction::RemoveDir(base_dir.join(".claude-plugin")));

    let now = current_iso8601();
    let known_snapshot = marketplace::register_known_marketplace(plugins_dir, base_dir, &now)?;
    undo.push(UndoAction::RestoreKnown(known_snapshot.0));

    let installed_snapshot = marketplace::read_installed_plugins(plugins_dir);
    marketplace::register_profile_plugin(plugins_dir, name, &profile_dir, &now)?;
    undo.push(UndoAction::RestoreInstalled(installed_snapshot));

    Ok(pre.settings_warnings)
}

pub fn activate(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
) -> Result<Vec<String>, ApiError> {
    let previous = crud::read_active_profile_name(profiles_dir)?;
    let outcome = activate_forward(
        base_dir,
        profiles_dir,
        store_dir,
        plugins_dir,
        claude_settings_path,
        name,
    );
    match outcome {
        Ok(warnings) => Ok(warnings),
        Err(err) => {
            if !matches!(err, ApiError::ActivationBlocked { .. }) {
                if let Some(prev) = previous {
                    if prev != name {
                        let _ = activate_forward(
                            base_dir,
                            profiles_dir,
                            store_dir,
                            plugins_dir,
                            claude_settings_path,
                            &prev,
                        );
                    }
                }
            }
            Err(err)
        }
    }
}

pub fn deactivate(
    base_dir: &Path,
    profiles_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
) -> Result<(), ApiError> {
    let Some(active) = crud::read_active_profile_name(profiles_dir)? else {
        return Ok(());
    };
    deactivate_internal(base_dir, profiles_dir, plugins_dir, claude_settings_path, &active)
}

fn current_iso8601() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
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
        // Production activation creates symlinks here, not real files/dirs.
        // Mirror that so deactivate_internal's `remove_file` path (matching
        // TS `rm({force:true})`) cleans them up correctly. The symlink
        // targets don't need to exist for the test — symlinks are typed by
        // the inode itself, not the target.
        std::fs::create_dir_all(profile_dir.join("agents")).unwrap();
        std::fs::create_dir_all(profile_dir.join("commands")).unwrap();
        std::fs::create_dir_all(profile_dir.join("skills")).unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("/dangling/store/agents/reviewer.md", profile_dir.join("agents/reviewer.md")).unwrap();
            std::os::unix::fs::symlink("/dangling/store/commands/push.md", profile_dir.join("commands/push.md")).unwrap();
            std::os::unix::fs::symlink("/dangling/store/skills/deploy", profile_dir.join("skills/deploy")).unwrap();
        }
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

    struct ActivateFixture {
        _root: tempfile::TempDir,
        base: PathBuf,
        profiles_dir: PathBuf,
        store_dir: PathBuf,
        plugins_dir: PathBuf,
        claude_settings: PathBuf,
    }

    fn fresh() -> ActivateFixture {
        let root = tempfile::tempdir().unwrap();
        let base = root.path().to_path_buf();
        let profiles_dir = base.join("profiles");
        let store_dir = base.join("store");
        let plugins_dir = base.join("claude-plugins");
        let claude_settings = base.join("claude-settings.json");
        std::fs::create_dir_all(store_dir.join("agents")).unwrap();
        std::fs::create_dir_all(store_dir.join("skills")).unwrap();
        std::fs::create_dir_all(store_dir.join("commands")).unwrap();
        std::fs::create_dir_all(store_dir.join("model-configs")).unwrap();
        std::fs::create_dir_all(&profiles_dir).unwrap();
        write(&claude_settings, r#"{"model":"sonnet"}"#);
        ActivateFixture { _root: root, base, profiles_dir, store_dir, plugins_dir, claude_settings }
    }

    #[test]
    fn activate_writes_active_marker_with_absolute_path() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "agents": ["reviewer"]}),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let marker = std::fs::read_to_string(f.profiles_dir.join(".active")).unwrap();
        let marker = marker.trim();
        assert!(std::path::Path::new(marker).is_absolute());
        assert!(marker.ends_with("/profiles/dev") || marker.ends_with(r"\profiles\dev"));
    }

    #[test]
    fn activate_creates_symlinks_for_referenced_components() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        write(&f.store_dir.join("commands/push.md"), "x");
        std::fs::create_dir_all(f.store_dir.join("skills/deploy")).unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "agents": ["reviewer"],
                "skills": ["deploy"],
                "commands": ["push"],
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let pd = f.profiles_dir.join("dev");
        assert!(pd.join("agents/reviewer.md").symlink_metadata().unwrap().file_type().is_symlink());
        assert!(pd.join("skills/deploy").symlink_metadata().unwrap().file_type().is_symlink());
        assert!(pd.join("commands/push.md").symlink_metadata().unwrap().file_type().is_symlink());
    }

    #[test]
    fn activate_writes_plugin_files_when_profile_has_them() {
        let f = fresh();
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "hooks": { "PreToolUse": [] },
                "mcpServers": { "db": { "command": "node" } },
                "lspServers": { "ts": { "command": "tsc" } },
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let pd = f.profiles_dir.join("dev");
        assert!(pd.join(".claude-plugin/plugin.json").exists());
        assert!(pd.join("hooks/hooks.json").exists());
        assert!(pd.join(".mcp.json").exists());
        assert!(pd.join(".lsp.json").exists());
    }

    #[test]
    fn activate_deep_merges_settings_and_sets_enabled_plugins() {
        let f = fresh();
        write(&f.claude_settings, r#"{"model":"sonnet","env":{"X":"keep"}}"#);
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "settings": {"effort": "high", "env": {"Y": "new"}},
                "plugins": ["gitlab@market"],
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let v: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(v["model"], "sonnet");
        assert_eq!(v["effort"], "high");
        assert_eq!(v["env"]["X"], "keep");
        assert_eq!(v["env"]["Y"], "new");
        assert_eq!(v["enabledPlugins"]["gitlab@market"], true);
        assert_eq!(v["enabledPlugins"]["profile-dev@ohmyc-profiles"], true);
    }

    #[test]
    fn activate_injects_model_config_env_vars_when_present() {
        let f = fresh();
        write(
            &f.store_dir.join("model-configs/anthropic.json"),
            r#"{"name":"anthropic","apiKey":"sk-x","baseUrl":"https://api","modelName":"claude-sonnet-4","provider":""}"#,
        );
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "modelConfig": "anthropic"}),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let v: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-x");
        assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://api");
        assert_eq!(v["env"]["ANTHROPIC_MODEL"], "claude-sonnet-4");
    }

    #[test]
    fn activate_writes_marketplace_and_registers_plugin() {
        let f = fresh();
        crud::create(&f.profiles_dir, &json!({"name": "dev", "description": "Dev"})).unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        assert!(f.base.join(".claude-plugin/marketplace.json").exists());
        let installed = marketplace::read_installed_plugins(&f.plugins_dir);
        assert!(installed["plugins"]["profile-dev@ohmyc-profiles"].is_array());
        let known = marketplace::read_known_marketplaces(&f.plugins_dir);
        assert_eq!(known["ohmyc-profiles"]["source"]["source"], "directory");
    }

    #[test]
    fn activate_returns_activation_blocked_when_components_missing() {
        let f = fresh();
        crud::create(&f.profiles_dir, &json!({"name": "dev", "agents": ["ghost"]})).unwrap();
        let err = activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap_err();
        match err {
            ApiError::ActivationBlocked { missing } => {
                assert_eq!(missing, vec!["agent:ghost".to_string()]);
            }
            other => panic!("expected ActivationBlocked, got {other:?}"),
        }
    }

    #[test]
    fn activate_deactivates_previous_profile_before_activating_new() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(&f.profiles_dir, &json!({"name": "first", "agents": ["reviewer"]})).unwrap();
        crud::create(&f.profiles_dir, &json!({"name": "second"})).unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "first")
            .unwrap();
        assert!(f.profiles_dir.join("first/agents/reviewer.md").exists());
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "second")
            .unwrap();
        assert!(!f.profiles_dir.join("first/agents/reviewer.md").exists());
        let marker = std::fs::read_to_string(f.profiles_dir.join(".active")).unwrap();
        assert!(marker.trim().ends_with("/profiles/second") || marker.trim().ends_with(r"\profiles\second"));
    }

    #[test]
    fn rollback_when_lsp_write_fails_clears_active_marker() {
        let f = fresh();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "lspServers": {"ts": {}}}),
        )
        .unwrap();
        std::fs::create_dir_all(f.profiles_dir.join("dev/.lsp.json")).unwrap();
        let result = activate_forward(
            &f.base,
            &f.profiles_dir,
            &f.store_dir,
            &f.plugins_dir,
            &f.claude_settings,
            "dev",
        );
        assert!(result.is_err());
        assert!(!f.profiles_dir.join(".active").exists());
        assert!(!f.base.join("settings.backup.dev.json").exists());
        let raw = std::fs::read_to_string(&f.claude_settings).unwrap();
        assert!(raw.contains("\"model\""));
        assert!(!raw.contains("profile-dev@ohmyc-profiles"));
    }

    #[test]
    fn auto_restore_previous_when_switching_fails_non_blocked() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-a", "agents": ["reviewer"]}),
        )
        .unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-b", "lspServers": {"ts": {}}}),
        )
        .unwrap();
        activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-a")
            .unwrap();
        std::fs::create_dir_all(f.profiles_dir.join("profile-b/.lsp.json")).unwrap();
        let result = activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-b");
        assert!(result.is_err());
        let active = crud::read_active_profile_name(&f.profiles_dir).unwrap();
        assert_eq!(active.as_deref(), Some("profile-a"));
        assert!(f.profiles_dir.join("profile-a/agents/reviewer.md").exists());
    }

    #[test]
    fn auto_restore_does_not_fire_when_failure_is_activation_blocked() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-a", "agents": ["reviewer"]}),
        )
        .unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-b", "agents": ["ghost"]}),
        )
        .unwrap();
        activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-a")
            .unwrap();
        let err = activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-b")
            .unwrap_err();
        assert!(matches!(err, ApiError::ActivationBlocked { .. }));
        let active = crud::read_active_profile_name(&f.profiles_dir).unwrap();
        assert_eq!(active.as_deref(), Some("profile-a"));
    }
}
