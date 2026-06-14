//! Reference-check across profiles — which profiles list a given
//! component as a dependency? Used both for the "Used by N profiles"
//! display column and to gate `delete` unless `force=true`.

use std::path::Path;

use serde_json::Value;

use crate::error::ApiError;
use crate::store::provenance::ComponentKind;

/// Scan every `<profiles_dir>/<name>/profile.json` for references to
/// `(kind, name)`. Returns the matching profile names (alphabetically
/// sorted).
///
/// Profile shape (minimal contract): a JSON object with
/// `name: string`, plus the kind-specific reference field:
/// - agents/skills/commands → array of strings under the matching key
/// - model-configs → string under `modelConfig`
pub fn referencing_profiles(
    profiles_dir: &Path,
    kind: ComponentKind,
    component_name: &str,
) -> Result<Vec<String>, ApiError> {
    if !profiles_dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(profiles_dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let dir_name = match p.file_name().and_then(|s| s.to_str()) {
            Some(s) if !s.starts_with('.') => s.to_string(),
            _ => continue,
        };
        let profile_path = p.join("profile.json");
        let raw = match std::fs::read_to_string(&profile_path) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => continue,
        };
        let profile: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let name = profile
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&dir_name)
            .to_string();
        if matches(&profile, kind, component_name) {
            out.push(name);
        }
    }
    out.sort();
    Ok(out)
}

fn matches(profile: &Value, kind: ComponentKind, name: &str) -> bool {
    match kind {
        ComponentKind::ModelConfigs => profile
            .get("modelConfig")
            .and_then(|v| v.as_str())
            .map(|s| s == name)
            .unwrap_or(false),
        other => {
            let key = match other {
                ComponentKind::Agents => "agents",
                ComponentKind::Skills => "skills",
                ComponentKind::Commands => "commands",
                _ => unreachable!(),
            };
            profile
                .get(key)
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().any(|x| x.as_str() == Some(name)))
                .unwrap_or(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_profile(dir: &Path, name: &str, body: &str) {
        let p = dir.join(name);
        std::fs::create_dir_all(&p).unwrap();
        std::fs::write(p.join("profile.json"), body).unwrap();
    }

    #[test]
    fn returns_empty_when_profiles_dir_missing() {
        let r = referencing_profiles(Path::new("/nonexistent"), ComponentKind::Agents, "alpha").unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn finds_profiles_listing_the_agent() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(
            dir.path(),
            "dev",
            r#"{"name":"dev","agents":["alpha","beta"],"skills":[],"commands":[]}"#,
        );
        make_profile(
            dir.path(),
            "prod",
            r#"{"name":"prod","agents":["beta"],"skills":[],"commands":[]}"#,
        );
        make_profile(
            dir.path(),
            "empty",
            r#"{"name":"empty","agents":[],"skills":[],"commands":[]}"#,
        );
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "alpha").unwrap();
        assert_eq!(r, vec!["dev"]);
    }

    #[test]
    fn finds_profiles_referencing_model_config_by_string_field() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "p1", r#"{"name":"p1","modelConfig":"anthropic/sonnet-4"}"#);
        make_profile(dir.path(), "p2", r#"{"name":"p2","modelConfig":"openai/gpt-4o"}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::ModelConfigs, "anthropic/sonnet-4").unwrap();
        assert_eq!(r, vec!["p1"]);
    }

    #[test]
    fn returns_sorted_alphabetically() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "zeta", r#"{"name":"zeta","agents":["x"]}"#);
        make_profile(dir.path(), "alpha", r#"{"name":"alpha","agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["alpha", "zeta"]);
    }

    #[test]
    fn skips_dot_prefixed_dirs_and_malformed_profiles() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), ".hidden", r#"{"name":".hidden","agents":["x"]}"#);
        let bad = dir.path().join("broken");
        std::fs::create_dir_all(&bad).unwrap();
        std::fs::write(bad.join("profile.json"), "{ not json").unwrap();
        make_profile(dir.path(), "ok", r#"{"name":"ok","agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["ok"]);
    }

    #[test]
    fn falls_back_to_dir_name_when_profile_name_missing() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "no-name-field", r#"{"agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["no-name-field"]);
    }
}
