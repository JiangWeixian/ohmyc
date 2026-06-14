use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, read_md_or_skip, ComponentSource, Origin, Scope};
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize)]
pub struct Agent {
    pub id: String,
    pub frontmatter: Value,
    pub content: String,
    pub raw: String,
    pub filename: String,
    pub source: ComponentSource,
    pub scope: Scope,
    pub origins: Vec<Origin>,
    pub badges: Vec<Value>,
}

pub fn list(dir: &Path) -> Result<Vec<Agent>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Agent> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let filename = match path.file_name().and_then(|s| s.to_str()) {
            Some(f) => f.to_string(),
            None => continue,
        };
        let raw = match read_md_or_skip(&path)? {
            Some(s) => s,
            None => continue,
        };
        if let Some(agent) = parse_agent(&filename, &raw)? {
            out.push(agent);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Agent>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    let Some(raw) = read_md_or_skip(&path)? else {
        return Ok(None);
    };
    parse_agent(&filename, &raw)
}

fn parse_agent(filename: &str, raw: &str) -> Result<Option<Agent>, ApiError> {
    let (frontmatter, content) = frontmatter::parse(raw)?;
    let has_required = frontmatter.get("name").and_then(|v| v.as_str()).is_some()
        && frontmatter.get("description").and_then(|v| v.as_str()).is_some();
    if !has_required {
        return Ok(None);
    }
    let id = filename.trim_end_matches(".md").to_string();
    Ok(Some(Agent {
        id,
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Agent, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "agent name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    std::fs::create_dir_all(dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    if path.exists() {
        return Err(ApiError::Conflict(format!("agent '{name}' already exists")));
    }
    let raw = frontmatter::stringify(frontmatter, content)?;
    std::fs::write(&path, &raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Agent {
        id: name.to_string(),
        frontmatter: frontmatter.clone(),
        content: content.trim().to_string(),
        raw,
        filename,
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    })
}

pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Agent>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = existing.frontmatter.clone();
    if let Some(changes) = frontmatter_changes {
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object())
        {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let path = dir.join(format!("{name}.md"));
    std::fs::write(&path, &raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Some(Agent {
        id: name.to_string(),
        frontmatter: merged,
        content: body.trim().to_string(),
        raw,
        filename: format!("{name}.md"),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_name(name) {
        return Ok(false);
    }
    let path = dir.join(format!("{name}.md"));
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", path.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("alpha.md"),
            "---\nname: alpha\ndescription: first\n---\nalpha body",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("zulu.md"),
            "---\nname: zulu\ndescription: last\nmodel: claude-sonnet-4\n---\nzulu body",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("orphan.md"),
            "---\nname: orphan\n---\nno description here",
        )
        .unwrap();
        std::fs::write(dir.path().join("README.txt"), "not an agent").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_valid_agents_and_skips_invalid() {
        let dir = seeded_dir();
        let agents = list(dir.path()).unwrap();
        let ids: Vec<&str> = agents.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, vec!["alpha", "zulu"]);
    }

    #[test]
    fn list_returns_empty_when_dir_missing() {
        let agents = list(Path::new("/nonexistent/path/agents")).unwrap();
        assert!(agents.is_empty());
    }

    #[test]
    fn list_populates_default_origin_scope_source_badges() {
        let dir = seeded_dir();
        let agents = list(dir.path()).unwrap();
        let alpha = agents.iter().find(|a| a.id == "alpha").unwrap();
        assert_eq!(alpha.origins, vec![Origin::Claude]);
        assert_eq!(alpha.scope, Scope::Global);
        assert_eq!(alpha.source, ComponentSource::Local);
        assert!(alpha.badges.is_empty());
        assert_eq!(alpha.filename, "alpha.md");
    }

    #[test]
    fn get_returns_agent_by_name() {
        let dir = seeded_dir();
        let agent = get(dir.path(), "zulu").unwrap().unwrap();
        assert_eq!(agent.id, "zulu");
        assert_eq!(agent.frontmatter["model"], "claude-sonnet-4");
    }

    #[test]
    fn get_returns_none_when_invalid_name() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../etc/passwd").unwrap().is_none());
        assert!(get(dir.path(), "with space").unwrap().is_none());
        assert!(get(dir.path(), "").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_when_file_missing() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_when_required_fields_missing() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "orphan").unwrap().is_none());
    }

    #[test]
    fn create_writes_new_file_and_returns_agent() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "alpha", "description": "first"});
        let agent = create(dir.path(), &front, "body").unwrap();
        assert_eq!(agent.id, "alpha");
        assert_eq!(agent.filename, "alpha.md");
        assert!(dir.path().join("alpha.md").exists());
        let r = get(dir.path(), "alpha").unwrap().unwrap();
        assert_eq!(r.frontmatter["description"], "first");
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_errors_with_conflict_when_exists() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "dup", "description": "d"});
        create(dir.path(), &front, "x").unwrap();
        let err = create(dir.path(), &front, "y").unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_creates_parent_directory_if_missing() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("does-not-exist-yet");
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(&nested, &front, "body").unwrap();
        assert!(nested.join("x.md").exists());
    }

    #[test]
    fn update_merges_frontmatter_and_replaces_content() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old", "model": "sonnet"});
        create(dir.path(), &front, "old body").unwrap();

        let partial = Some(serde_json::json!({"description": "new"}));
        let new_content = Some("new body".to_string());
        let updated = update(dir.path(), "a", partial.as_ref(), new_content.as_deref())
            .unwrap()
            .expect("agent updated");
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.frontmatter["model"], "sonnet");
        assert_eq!(updated.content, "new body");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "missing", None, None).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn update_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "../bad", None, None).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn delete_removes_file_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(dir.path(), &front, "body").unwrap();
        assert!(delete(dir.path(), "x").unwrap());
        assert!(!dir.path().join("x.md").exists());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
}
