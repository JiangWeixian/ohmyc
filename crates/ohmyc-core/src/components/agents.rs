use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{
    is_safe_name, locator_id, read_md_or_skip, ComponentKind, ComponentMeta, ComponentSource, Origin, Scope,
    SourceKind, SourceProvider,
};
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

pub fn list(dir: &Path) -> Result<Vec<Agent>, ApiError> {
    list_with_meta(
        dir,
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Local,
        Scope::Global,
        SourceKind::Global,
        None,
    )
}

pub fn list_with_meta(
    dir: &Path,
    origin: Origin,
    source_provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    source_kind: SourceKind,
    plugin_id: Option<String>,
) -> Result<Vec<Agent>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Agent> = Vec::new();
    let meta = ComponentMeta::new(source_provider, source, scope, source_kind, plugin_id.as_deref());
    list_agent_files(dir, &mut out, origin, meta)?;
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn list_agent_files(dir: &Path, out: &mut Vec<Agent>, origin: Origin, meta: ComponentMeta<'_>) -> Result<(), ApiError> {
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let file_type = entry.file_type().map_err(ApiError::from)?;
        let path = entry.path();
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            let name = match path.file_name().and_then(|s| s.to_str()) {
                Some(name) => name,
                None => continue,
            };
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            list_agent_files(&path, out, origin, meta)?;
            continue;
        }
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
        if let Some(agent) = parse_agent_with_meta(&filename, &raw, Some(&path), origin, meta)? {
            out.push(agent);
        }
    }
    Ok(())
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
    parse_agent(&filename, &raw, Some(&path))
}

fn parse_agent(filename: &str, raw: &str, source_path: Option<&Path>) -> Result<Option<Agent>, ApiError> {
    parse_agent_with_meta(
        filename,
        raw,
        source_path,
        Origin::Claude,
        ComponentMeta::claude_global(),
    )
}

fn parse_agent_with_meta(
    filename: &str,
    raw: &str,
    source_path: Option<&Path>,
    origin: Origin,
    meta: ComponentMeta<'_>,
) -> Result<Option<Agent>, ApiError> {
    let (frontmatter, content) = frontmatter::parse(raw)?;
    let has_description = frontmatter.get("description").and_then(|v| v.as_str()).is_some();
    if !has_description {
        return Ok(None);
    }
    let id = filename.trim_end_matches(".md").to_string();
    let mut frontmatter = frontmatter;
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.entry("name".to_string())
            .or_insert_with(|| Value::String(id.clone()));
    }
    Ok(Some(Agent {
        id: id.clone(),
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: meta.source,
        scope: meta.scope,
        origins: vec![origin],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Agents,
            meta.provider,
            meta.source,
            meta.scope,
            meta.plugin_id,
            &id,
            source_path,
        ),
        source_path: source_path.map(|path| path.to_string_lossy().to_string()),
        source_provider: meta.provider,
        source_kind: meta.kind,
        plugin_id: meta.plugin_id.map(str::to_string),
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
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    if path.exists() {
        return Err(ApiError::Conflict(format!("agent '{name}' already exists")));
    }
    let raw = frontmatter::stringify(frontmatter, content)?;
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    parse_agent(&filename, &raw, Some(&path))?
        .ok_or_else(|| ApiError::Internal("parse_agent returned None after create".to_string()))
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
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let path = dir.join(format!("{name}.md"));
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    parse_agent(&format!("{name}.md"), &raw, Some(&path))
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

pub fn parse_codex_toml_agent(
    filename: &str,
    raw: &str,
    source_path: &Path,
    scope: Scope,
) -> Result<Option<Agent>, ApiError> {
    let value: toml::Value = toml::from_str(raw).map_err(|e| ApiError::Parse(format!("codex agent toml: {e}")))?;
    let Some(name) = value.get("name").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let Some(description) = value
        .get("description")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    else {
        return Ok(None);
    };
    let Some(instructions) = value
        .get("developer_instructions")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    else {
        return Ok(None);
    };
    let mut frontmatter = serde_json::Map::new();
    frontmatter.insert("name".into(), Value::String(name.to_string()));
    frontmatter.insert("description".into(), Value::String(description.to_string()));
    if let Some(model) = value.get("model").and_then(|v| v.as_str()) {
        frontmatter.insert("model".into(), Value::String(model.to_string()));
    }
    let id = name.to_string();
    let source = match scope {
        Scope::Global => ComponentSource::Local,
        Scope::Project => ComponentSource::Project,
    };
    Ok(Some(Agent {
        id: id.clone(),
        frontmatter: Value::Object(frontmatter),
        content: instructions.trim().to_string(),
        raw: raw.to_string(),
        filename: filename.to_string(),
        source,
        scope,
        origins: vec![Origin::Codex],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Agents,
            SourceProvider::Codex,
            source,
            scope,
            None,
            &id,
            Some(source_path),
        ),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Codex,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    }))
}

pub fn agent_from_opencode_config(id: &str, value: &Value, source_path: &Path, scope: Scope) -> Option<Agent> {
    let description = value.get("description")?.as_str()?.to_string();
    let content = value
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let mut frontmatter = value.as_object().cloned().unwrap_or_default();
    frontmatter.insert("name".into(), Value::String(id.to_string()));
    frontmatter.insert("description".into(), Value::String(description));
    let source = match scope {
        Scope::Global => ComponentSource::Local,
        Scope::Project => ComponentSource::Project,
    };
    Some(Agent {
        id: id.to_string(),
        frontmatter: Value::Object(frontmatter),
        content,
        raw: value.to_string(),
        filename: source_path.file_name()?.to_string_lossy().to_string(),
        source,
        scope,
        origins: vec![Origin::Opencode],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Agents,
            SourceProvider::Opencode,
            source,
            scope,
            None,
            id,
            Some(source_path),
        ),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Opencode,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    })
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
