//! Read/write JSON-based model configs. Each config is one
//! `<dir>/<name>.json` file. Name regex `[a-zA-Z0-9_./-]+` allows
//! provider-prefixed names like `anthropic/sonnet-4`, but `..` is
//! rejected to prevent directory traversal.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub name: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub provider: String,
}

pub fn is_safe_model_config_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    // Reject anything that PathBuf::join would treat as absolute (leading `/`)
    // or that has a dangling/doubled separator. Without these checks, a name
    // like "/etc/passwd" lets PathBuf::join discard the store base, allowing
    // a write/delete outside the managed directory.
    if name.starts_with('/') || name.ends_with('/') || name.contains("//") {
        return false;
    }
    // Reject any path segment exactly equal to ".." (the substring check
    // alone would let "a..b" through, which IS safe; this segment check is
    // the precise constraint).
    if name.split('/').any(|seg| seg == "..") {
        return false;
    }
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'))
}

pub fn list(dir: &Path) -> Result<Vec<ModelConfig>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<ModelConfig> = Vec::new();
    walk_collect(dir, &mut out)?;
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

fn walk_collect(dir: &Path, out: &mut Vec<ModelConfig>) -> Result<(), ApiError> {
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let p = entry.path();
        if p.is_dir() {
            walk_collect(&p, out)?;
            continue;
        }
        if p.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let raw = match std::fs::read_to_string(&p) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(ApiError::Io(format!("read {}: {e}", p.display()))),
        };
        if let Ok(c) = serde_json::from_str::<ModelConfig>(&raw) {
            out.push(c);
        }
    }
    Ok(())
}

pub fn get(dir: &Path, name: &str) -> Result<Option<ModelConfig>, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(None);
    }
    let path = dir.join(format!("{name}.json"));
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let c: ModelConfig = serde_json::from_str(&raw)
                .map_err(|e| ApiError::Parse(format!("{}: {e}", path.display())))?;
            Ok(Some(c))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    }
}

pub fn create(dir: &Path, config: &ModelConfig) -> Result<ModelConfig, ApiError> {
    if !is_safe_model_config_name(&config.name) {
        return Err(ApiError::InvalidInput(format!(
            "model-config name '{}' must match [a-zA-Z0-9_./-] and not contain '..'",
            config.name
        )));
    }
    let path: PathBuf = dir.join(format!("{}.json", config.name));
    if path.exists() {
        return Err(ApiError::Conflict(format!(
            "model-config '{}' already exists",
            config.name
        )));
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| ApiError::Internal(format!("serialize model config: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(config.clone())
}

pub fn update(
    dir: &Path,
    name: &str,
    changes: &serde_json::Value,
) -> Result<Option<ModelConfig>, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = serde_json::to_value(&existing)
        .map_err(|e| ApiError::Internal(format!("to_value: {e}")))?;
    if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
        for (k, v) in changes_obj {
            merged_obj.insert(k.clone(), v.clone());
        }
    }
    let next: ModelConfig = serde_json::from_value(merged)
        .map_err(|e| ApiError::Validation(format!("merged model-config invalid: {e}")))?;
    let path = dir.join(format!("{name}.json"));
    let raw = serde_json::to_string_pretty(&next)
        .map_err(|e| ApiError::Internal(format!("serialize: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Some(next))
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(false);
    }
    let path = dir.join(format!("{name}.json"));
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", path.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> ModelConfig {
        ModelConfig {
            name: "anthropic/sonnet-4".to_string(),
            api_key: "sk-test".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            model_name: "claude-sonnet-4".to_string(),
            provider: "anthropic".to_string(),
        }
    }

    #[test]
    fn is_safe_accepts_provider_prefixed_names() {
        assert!(is_safe_model_config_name("anthropic/sonnet-4"));
        assert!(is_safe_model_config_name("openai/gpt-4o"));
        assert!(is_safe_model_config_name("local"));
        assert!(is_safe_model_config_name("v1.0.0"));
    }

    #[test]
    fn is_safe_rejects_traversal_and_empty() {
        assert!(!is_safe_model_config_name(""));
        assert!(!is_safe_model_config_name(".."));
        assert!(!is_safe_model_config_name("../etc"));
        assert!(!is_safe_model_config_name("a/../b"));
        assert!(!is_safe_model_config_name("with space"));
    }

    #[test]
    fn is_safe_rejects_leading_slash_or_doubled_slash() {
        // Without these checks, PathBuf::join would treat the name as
        // absolute and escape the store dir.
        assert!(!is_safe_model_config_name("/etc/passwd"));
        assert!(!is_safe_model_config_name("//absolute"));
        assert!(!is_safe_model_config_name("/leading"));
        assert!(!is_safe_model_config_name("trailing/"));
        assert!(!is_safe_model_config_name("a//b"));
    }

    #[test]
    fn create_with_absolute_name_is_rejected_not_traversed() {
        let dir = tempfile::tempdir().unwrap();
        let mut bad = fixture();
        bad.name = "/tmp/escape".to_string();
        let err = create(dir.path(), &bad).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
        // Critically: nothing got written outside the store dir.
        assert!(!std::path::Path::new("/tmp/escape.json").exists());
    }

    #[test]
    fn safe_name_still_accepts_dot_dot_inside_segment() {
        // "a..b" is NOT a traversal — only the segment ".." itself is.
        // Document this to prevent over-zealous future tightening from
        // breaking valid names like "claude.v1.2" → "claude.v1..2"? No;
        // the dot rule allows literal dots, so this is just a sanity test.
        assert!(is_safe_model_config_name("a..b"));
        assert!(is_safe_model_config_name("v1.0.0"));
    }

    #[test]
    fn create_then_list_returns_config() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let all = list(dir.path()).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "anthropic/sonnet-4");
    }

    #[test]
    fn list_walks_nested_provider_dirs() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let mut c2 = fixture();
        c2.name = "openai/gpt-4o".to_string();
        create(dir.path(), &c2).unwrap();
        let all = list(dir.path()).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].name, "anthropic/sonnet-4");
        assert_eq!(all[1].name, "openai/gpt-4o");
    }

    #[test]
    fn get_returns_config_or_none() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let c = get(dir.path(), "anthropic/sonnet-4").unwrap().unwrap();
        assert_eq!(c.provider, "anthropic");
        assert!(get(dir.path(), "missing").unwrap().is_none());
        assert!(get(dir.path(), "../bad").unwrap().is_none());
    }

    #[test]
    fn create_errors_with_conflict_when_exists() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let err = create(dir.path(), &fixture()).unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let mut bad = fixture();
        bad.name = "../bad".to_string();
        let err = create(dir.path(), &bad).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_merges_partial_changes() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let changes = serde_json::json!({"apiKey": "sk-new", "provider": "anthropic"});
        let updated = update(dir.path(), "anthropic/sonnet-4", &changes)
            .unwrap()
            .expect("updated");
        assert_eq!(updated.api_key, "sk-new");
        assert_eq!(updated.base_url, "https://api.anthropic.com");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", &serde_json::json!({}))
            .unwrap()
            .is_none());
    }

    #[test]
    fn delete_removes_file_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        assert!(delete(dir.path(), "anthropic/sonnet-4").unwrap());
        assert!(get(dir.path(), "anthropic/sonnet-4").unwrap().is_none());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
}
