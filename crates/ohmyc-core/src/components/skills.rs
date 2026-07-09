use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{
    is_safe_name, locator_id, read_md_or_skip, ComponentKind, ComponentSource, Origin, Scope, SourceKind,
    SourceProvider,
};
use crate::error::ApiError;

const SKILL_FILE: &str = "SKILL.md";

#[derive(Debug, Clone, Serialize)]
pub struct Skill {
    pub id: String,
    pub frontmatter: Value,
    pub content: String,
    pub raw: String,
    #[serde(rename = "dirName")]
    pub dir_name: String,
    pub source: ComponentSource,
    pub scope: Scope,
    pub origins: Vec<Origin>,
    pub badges: Vec<Value>,
    #[serde(rename = "locatorId")]
    pub locator_id: String,
    #[serde(rename = "sourcePath", skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    #[serde(rename = "sourceProvider")]
    pub source_provider: SourceProvider,
    #[serde(rename = "sourceKind")]
    pub source_kind: SourceKind,
    #[serde(rename = "pluginId", skip_serializing_if = "Option::is_none")]
    pub plugin_id: Option<String>,
}

pub fn list(dir: &Path) -> Result<Vec<Skill>, ApiError> {
    list_with_origin(dir, Origin::Claude)
}

pub fn list_with_origin(dir: &Path, origin: Origin) -> Result<Vec<Skill>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Skill> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let skill_path = path.join(SKILL_FILE);
        let raw = match read_md_or_skip(&skill_path)? {
            Some(s) => s,
            None => continue,
        };
        if let Some(skill) = parse_skill_with_origin(&dir_name, &raw, origin, Some(&skill_path))? {
            out.push(skill);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Skill>, ApiError> {
    get_with_origin(dir, name, Origin::Claude)
}

pub fn get_with_origin(dir: &Path, name: &str, origin: Origin) -> Result<Option<Skill>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let skill_path: PathBuf = dir.join(name).join(SKILL_FILE);
    let Some(raw) = read_md_or_skip(&skill_path)? else {
        return Ok(None);
    };
    parse_skill_with_origin(name, &raw, origin, Some(&skill_path))
}

fn parse_skill_with_origin(
    dir_name: &str,
    raw: &str,
    origin: Origin,
    source_path: Option<&Path>,
) -> Result<Option<Skill>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(dir_name)
        .to_string();
    let description = frontmatter
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.insert("name".to_string(), Value::String(name));
        obj.insert("description".to_string(), Value::String(description));
    }
    Ok(Some(Skill {
        id: dir_name.to_string(),
        frontmatter,
        content,
        raw: raw.to_string(),
        dir_name: dir_name.to_string(),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![origin],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Skills,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            None,
            dir_name,
            source_path,
        ),
        source_path: source_path.map(|path| path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Claude,
        source_kind: SourceKind::Global,
        plugin_id: None,
    }))
}

pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Skill, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "skill name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    let skill_dir = dir.join(name);
    if skill_dir.exists() {
        return Err(ApiError::Conflict(format!("skill '{name}' already exists")));
    }
    std::fs::create_dir_all(&skill_dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", skill_dir.display())))?;
    let raw = frontmatter::stringify(frontmatter, content)?;
    let file_path = skill_dir.join(SKILL_FILE);
    std::fs::write(&file_path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", file_path.display())))?;
    parse_skill_with_origin(name, &raw, Origin::Claude, Some(&file_path))?
        .ok_or_else(|| ApiError::Internal("parse_skill returned None after create".to_string()))
}

pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Skill>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = existing.frontmatter.clone();
    if let Some(changes) = frontmatter_changes {
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let file_path = dir.join(name).join(SKILL_FILE);
    std::fs::write(&file_path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", file_path.display())))?;
    parse_skill_with_origin(name, &raw, Origin::Claude, Some(&file_path))
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_name(name) {
        return Ok(false);
    }
    let skill_dir = dir.join(name);
    match std::fs::remove_dir_all(&skill_dir) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", skill_dir.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let alpha = dir.path().join("alpha");
        std::fs::create_dir(&alpha).unwrap();
        std::fs::write(
            alpha.join("SKILL.md"),
            "---\nname: alpha\ndescription: first skill\n---\nbody",
        )
        .unwrap();
        let bravo = dir.path().join("bravo");
        std::fs::create_dir(&bravo).unwrap();
        std::fs::write(bravo.join("SKILL.md"), "no frontmatter, just body").unwrap();
        std::fs::create_dir(dir.path().join("empty-dir")).unwrap();
        std::fs::write(dir.path().join("loose.md"), "noise").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_skills_skipping_dirs_without_skill_md() {
        let dir = seeded_dir();
        let skills = list(dir.path()).unwrap();
        let ids: Vec<&str> = skills.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, vec!["alpha", "bravo"]);
    }

    #[test]
    fn list_falls_back_to_dir_name_when_frontmatter_missing() {
        let dir = seeded_dir();
        let skills = list(dir.path()).unwrap();
        let bravo = skills.iter().find(|s| s.id == "bravo").unwrap();
        assert_eq!(bravo.frontmatter["name"], "bravo");
        assert_eq!(bravo.frontmatter["description"], "");
    }

    #[test]
    fn list_returns_empty_when_dir_missing() {
        assert!(list(Path::new("/nonexistent/skills")).unwrap().is_empty());
    }

    #[test]
    fn get_returns_skill_by_name() {
        let dir = seeded_dir();
        let s = get(dir.path(), "alpha").unwrap().unwrap();
        assert_eq!(s.id, "alpha");
        assert_eq!(s.dir_name, "alpha");
        assert_eq!(s.content, "body");
    }

    #[test]
    fn get_returns_none_when_invalid_name_or_missing_dir() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../bad").unwrap().is_none());
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
        assert!(get(dir.path(), "empty-dir").unwrap().is_none());
    }

    #[test]
    fn create_creates_skill_dir_with_skill_md() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "alpha", "description": "first"});
        let skill = create(dir.path(), &front, "body").unwrap();
        assert_eq!(skill.id, "alpha");
        assert_eq!(skill.dir_name, "alpha");
        assert!(dir.path().join("alpha").join("SKILL.md").exists());
    }

    #[test]
    fn create_errors_with_conflict_when_dir_exists() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "dup", "description": "d"});
        create(dir.path(), &front, "x").unwrap();
        let err = create(dir.path(), &front, "y").unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_writes_new_skill_md_preserving_dir() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old"});
        create(dir.path(), &front, "old body").unwrap();
        let partial = serde_json::json!({"description": "new"});
        let updated = update(dir.path(), "a", Some(&partial), Some("new body"))
            .unwrap()
            .expect("skill updated");
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.content, "new body");
        assert!(dir.path().join("a").join("SKILL.md").exists());
    }

    #[test]
    fn update_returns_none_when_dir_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", None, None).unwrap().is_none());
    }

    #[test]
    fn delete_removes_entire_skill_dir() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(dir.path(), &front, "body").unwrap();
        std::fs::write(dir.path().join("x").join("extra.txt"), "noise").unwrap();
        assert!(delete(dir.path(), "x").unwrap());
        assert!(!dir.path().join("x").exists());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
}
