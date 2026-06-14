//! Pure file I/O for profile JSON. Each profile is
//! `$OHMYC_HOME/profiles/<name>/profile.json`. No symlinks, no settings
//! mutation — those live in the deferred activation slice.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::ApiError;

use super::{is_reserved_profile_name, is_safe_profile_name};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub agents: Vec<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_config: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hooks: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lsp_servers: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProfileList {
    pub profiles: Vec<Profile>,
    pub active: Option<String>,
}

pub fn read_active_profile_name(profiles_dir: &Path) -> Result<Option<String>, ApiError> {
    let active_path = profiles_dir.join(".active");
    let raw = match std::fs::read_to_string(&active_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", active_path.display()))),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if std::path::Path::new(trimmed).is_absolute() {
        Ok(Path::new(trimmed)
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string()))
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

pub fn list(profiles_dir: &Path) -> Result<ProfileList, ApiError> {
    let active = read_active_profile_name(profiles_dir)?;

    if !profiles_dir.exists() {
        return Ok(ProfileList {
            profiles: Vec::new(),
            active,
        });
    }

    let mut profiles: Vec<Profile> = Vec::new();
    for entry in std::fs::read_dir(profiles_dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if name.starts_with('.') {
            continue;
        }
        let json_path = path.join("profile.json");
        let raw = match std::fs::read_to_string(&json_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Ok(p) = serde_json::from_str::<Profile>(&raw) {
            profiles.push(p);
        }
    }
    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(ProfileList { profiles, active })
}

pub fn get(profiles_dir: &Path, name: &str) -> Result<Option<Profile>, ApiError> {
    if !is_safe_profile_name(name) || is_reserved_profile_name(name) {
        return Ok(None);
    }
    let json_path = profiles_dir.join(name).join("profile.json");
    match std::fs::read_to_string(&json_path) {
        Ok(raw) => match serde_json::from_str::<Profile>(&raw) {
            Ok(p) => Ok(Some(p)),
            Err(e) => Err(ApiError::Parse(format!("{}: {e}", json_path.display()))),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", json_path.display()))),
    }
}

pub fn create(profiles_dir: &Path, body: &Value) -> Result<Profile, ApiError> {
    let name = body
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("body.name is required".to_string()))?;
    if !is_safe_profile_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "profile name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    if is_reserved_profile_name(name) {
        return Err(ApiError::InvalidInput(format!("profile name '{name}' is reserved")));
    }
    let dir = profiles_dir.join(name);
    if dir.exists() {
        return Err(ApiError::Conflict(format!("profile '{name}' already exists")));
    }
    let profile: Profile =
        serde_json::from_value(body.clone()).map_err(|e| ApiError::Validation(format!("invalid profile body: {e}")))?;
    std::fs::create_dir_all(&dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let json_path = dir.join("profile.json");
    let raw =
        serde_json::to_string_pretty(&profile).map_err(|e| ApiError::Internal(format!("serialize profile: {e}")))?;
    std::fs::write(&json_path, raw).map_err(|e| ApiError::Io(format!("write {}: {e}", json_path.display())))?;
    Ok(profile)
}

pub fn update(profiles_dir: &Path, name: &str, changes: &Value) -> Result<Option<Profile>, ApiError> {
    let Some(existing) = get(profiles_dir, name)? else {
        return Ok(None);
    };
    let mut merged = serde_json::to_value(&existing).map_err(|e| ApiError::Internal(format!("to_value: {e}")))?;
    if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
        for (k, v) in changes_obj {
            if k == "name" {
                continue;
            }
            merged_obj.insert(k.clone(), v.clone());
        }
    }
    let next: Profile =
        serde_json::from_value(merged).map_err(|e| ApiError::Validation(format!("merged profile invalid: {e}")))?;
    let json_path = profiles_dir.join(name).join("profile.json");
    let raw = serde_json::to_string_pretty(&next).map_err(|e| ApiError::Internal(format!("serialize: {e}")))?;
    std::fs::write(&json_path, raw).map_err(|e| ApiError::Io(format!("write {}: {e}", json_path.display())))?;
    Ok(Some(next))
}

pub fn delete(profiles_dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_profile_name(name) || is_reserved_profile_name(name) {
        return Ok(false);
    }
    let dir = profiles_dir.join(name);
    if !dir.exists() {
        return Ok(false);
    }
    std::fs::remove_dir_all(&dir).map_err(|e| ApiError::Io(format!("rm {}: {e}", dir.display())))?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_profile(profiles_dir: &Path, name: &str, body: Value) {
        let dir = profiles_dir.join(name);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("profile.json"), body.to_string()).unwrap();
    }

    #[test]
    fn list_returns_empty_when_profiles_dir_missing() {
        let dir = tempfile::tempdir().unwrap();
        let result = list(&dir.path().join("does-not-exist")).unwrap();
        assert!(result.profiles.is_empty());
        assert!(result.active.is_none());
    }

    #[test]
    fn list_returns_profiles_sorted_by_name() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "zebra", serde_json::json!({"name": "zebra"}));
        write_profile(dir.path(), "alpha", serde_json::json!({"name": "alpha"}));
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 2);
        assert_eq!(result.profiles[0].name, "alpha");
        assert_eq!(result.profiles[1].name, "zebra");
    }

    #[test]
    fn list_skips_dot_prefixed_entries() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "ok", serde_json::json!({"name": "ok"}));
        std::fs::create_dir_all(dir.path().join(".metadata")).unwrap();
        std::fs::write(
            dir.path().join(".metadata").join("profile.json"),
            r#"{"name":"hidden"}"#,
        )
        .unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 1);
        assert_eq!(result.profiles[0].name, "ok");
    }

    #[test]
    fn list_skips_dirs_without_profile_json() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "good", serde_json::json!({"name": "good"}));
        std::fs::create_dir_all(dir.path().join("bare")).unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 1);
        assert_eq!(result.profiles[0].name, "good");
    }

    #[test]
    fn list_reads_active_from_bare_name_marker() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path()).unwrap();
        std::fs::write(dir.path().join(".active"), "dev\n").unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.active.as_deref(), Some("dev"));
    }

    #[test]
    fn list_reads_active_from_absolute_path_marker() {
        let dir = tempfile::tempdir().unwrap();
        let abs = dir.path().join("dev");
        std::fs::create_dir_all(&abs).unwrap();
        std::fs::write(dir.path().join(".active"), abs.to_string_lossy().to_string()).unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.active.as_deref(), Some("dev"));
    }

    #[test]
    fn get_returns_profile_by_name() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(
            dir.path(),
            "my-profile",
            serde_json::json!({"name": "my-profile", "description": "x", "agents": ["a1"]}),
        );
        let p = get(dir.path(), "my-profile").unwrap().unwrap();
        assert_eq!(p.name, "my-profile");
        assert_eq!(p.description.as_deref(), Some("x"));
        assert_eq!(p.agents, vec!["a1".to_string()]);
    }

    #[test]
    fn get_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(get(dir.path(), "missing").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(get(dir.path(), "../escape").unwrap().is_none());
        assert!(get(dir.path(), "store").unwrap().is_none());
        assert!(get(dir.path(), ".active").unwrap().is_none());
    }

    // --- create tests ---

    #[test]
    fn create_writes_profile_json_and_returns_profile() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "new", "description": "first"});
        let p = create(dir.path(), &body).unwrap();
        assert_eq!(p.name, "new");
        assert_eq!(p.description.as_deref(), Some("first"));
        assert!(dir.path().join("new").join("profile.json").exists());
        let back = get(dir.path(), "new").unwrap().unwrap();
        assert_eq!(back.description.as_deref(), Some("first"));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "a/b", "description": "x"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_reserved_name() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "store"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_missing_name_field() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"description": "x"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_errors_with_conflict_when_profile_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("dup")).unwrap();
        let body = serde_json::json!({"name": "dup"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_persists_defaults_for_array_fields() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "minimal"});
        let p = create(dir.path(), &body).unwrap();
        assert!(p.agents.is_empty());
        assert!(p.skills.is_empty());
        assert!(p.commands.is_empty());
        assert!(p.plugins.is_empty());
    }

    // --- update tests ---

    #[test]
    fn update_merges_partial_changes() {
        let dir = tempfile::tempdir().unwrap();
        create(
            dir.path(),
            &serde_json::json!({
                "name": "test",
                "description": "old",
                "agents": ["a1"],
                "settings": {"k1": "v1"}
            }),
        )
        .unwrap();

        let changes = serde_json::json!({
            "description": "new",
            "settings": {"k2": "v2"}
        });
        let updated = update(dir.path(), "test", &changes).unwrap().expect("updated");
        assert_eq!(updated.description.as_deref(), Some("new"));
        assert_eq!(updated.agents, vec!["a1".to_string()]);
        let settings = updated.settings.as_ref().unwrap();
        assert_eq!(settings.get("k2").and_then(|v| v.as_str()), Some("v2"));
        assert!(settings.get("k1").is_none());
    }

    #[test]
    fn update_ignores_name_field_in_body() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &serde_json::json!({"name": "test"})).unwrap();
        let changes = serde_json::json!({"name": "renamed", "description": "x"});
        let updated = update(dir.path(), "test", &changes).unwrap().expect("updated");
        assert_eq!(updated.name, "test");
        assert_eq!(updated.description.as_deref(), Some("x"));
    }

    #[test]
    fn update_returns_none_when_profile_missing() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "missing", &serde_json::json!({})).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn update_returns_none_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "../bad", &serde_json::json!({})).unwrap().is_none());
        assert!(update(dir.path(), "store", &serde_json::json!({})).unwrap().is_none());
    }

    // --- delete tests ---

    #[test]
    fn delete_removes_profile_dir_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &serde_json::json!({"name": "doomed"})).unwrap();
        assert!(delete(dir.path(), "doomed").unwrap());
        assert!(!dir.path().join("doomed").exists());
    }

    #[test]
    fn delete_returns_false_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "ghost").unwrap());
    }

    #[test]
    fn delete_returns_false_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "../bad").unwrap());
        assert!(!delete(dir.path(), "store").unwrap());
    }
}
