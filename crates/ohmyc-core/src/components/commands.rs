use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{
    is_safe_name, locator_id, read_md_or_skip, ComponentKind, ComponentSource, Origin, Scope, SourceKind,
    SourceProvider,
};
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize)]
pub struct Command {
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

pub fn list(dir: &Path) -> Result<Vec<Command>, ApiError> {
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
) -> Result<Vec<Command>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Command> = Vec::new();
    list_command_files(
        dir,
        &mut out,
        origin,
        source_provider,
        source,
        scope,
        source_kind,
        plugin_id.as_deref(),
    )?;
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn list_command_files(
    dir: &Path,
    out: &mut Vec<Command>,
    origin: Origin,
    source_provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    source_kind: SourceKind,
    plugin_id: Option<&str>,
) -> Result<(), ApiError> {
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
            list_command_files(
                &path,
                out,
                origin,
                source_provider,
                source,
                scope,
                source_kind,
                plugin_id,
            )?;
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
        if let Some(cmd) = parse_command_with_meta(
            &filename,
            &raw,
            Some(&path),
            origin,
            source_provider,
            source,
            scope,
            source_kind,
            plugin_id,
        )? {
            out.push(cmd);
        }
    }
    Ok(())
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Command>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    let Some(raw) = read_md_or_skip(&path)? else {
        return Ok(None);
    };
    parse_command(&filename, &raw, Some(&path))
}

fn parse_command(filename: &str, raw: &str, source_path: Option<&Path>) -> Result<Option<Command>, ApiError> {
    parse_command_with_meta(
        filename,
        raw,
        source_path,
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Local,
        Scope::Global,
        SourceKind::Global,
        None,
    )
}

fn parse_command_with_meta(
    filename: &str,
    raw: &str,
    source_path: Option<&Path>,
    origin: Origin,
    source_provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    source_kind: SourceKind,
    plugin_id: Option<&str>,
) -> Result<Option<Command>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    let id = filename.trim_end_matches(".md").to_string();
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(&id)
        .to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.insert("name".to_string(), Value::String(name));
    }
    Ok(Some(Command {
        id: id.clone(),
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source,
        scope,
        origins: vec![origin],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Commands,
            source_provider,
            source,
            scope,
            plugin_id,
            &id,
            source_path,
        ),
        source_path: source_path.map(|path| path.to_string_lossy().to_string()),
        source_provider,
        source_kind,
        plugin_id: plugin_id.map(str::to_string),
    }))
}

pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Command, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "command name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    if path.exists() {
        return Err(ApiError::Conflict(format!("command '{name}' already exists")));
    }
    let raw = frontmatter::stringify(frontmatter, content)?;
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    parse_command(&filename, &raw, Some(&path))?
        .ok_or_else(|| ApiError::Internal("parse_command returned None after create".to_string()))
}

pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Command>, ApiError> {
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
    parse_command(&format!("{name}.md"), &raw, Some(&path))
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

pub fn parse_codex_prompt(
    filename: &str,
    raw: &str,
    source_path: &Path,
    scope: Scope,
) -> Result<Option<Command>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    let id = filename.trim_end_matches(".md").to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.entry("name".to_string())
            .or_insert_with(|| Value::String(id.clone()));
        obj.entry("description".to_string())
            .or_insert_with(|| Value::String("Codex legacy prompt".into()));
    }
    let source = match scope {
        Scope::Global => ComponentSource::Local,
        Scope::Project => ComponentSource::Project,
    };
    Ok(Some(Command {
        id: id.clone(),
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source,
        scope,
        origins: vec![Origin::Codex],
        badges: vec![serde_json::json!({"kind": "pill", "label": "prompt", "tone": "neutral"})],
        locator_id: locator_id(
            ComponentKind::Commands,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("ship.md"),
            "---\nname: ship\ndescription: ship it\n---\nbody",
        )
        .unwrap();
        std::fs::write(dir.path().join("no-front.md"), "just body").unwrap();
        std::fs::write(dir.path().join("README.txt"), "noise").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_commands_including_those_without_frontmatter() {
        let dir = seeded_dir();
        let cmds = list(dir.path()).unwrap();
        let ids: Vec<&str> = cmds.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, vec!["no-front", "ship"]);
    }

    #[test]
    fn list_falls_back_to_id_when_frontmatter_name_missing() {
        let dir = seeded_dir();
        let cmds = list(dir.path()).unwrap();
        let nf = cmds.iter().find(|c| c.id == "no-front").unwrap();
        assert_eq!(nf.frontmatter["name"], "no-front");
    }

    #[test]
    fn get_returns_command_by_name() {
        let dir = seeded_dir();
        let cmd = get(dir.path(), "ship").unwrap().unwrap();
        assert_eq!(cmd.id, "ship");
        assert_eq!(cmd.frontmatter["description"], "ship it");
    }

    #[test]
    fn get_returns_none_for_invalid_or_missing() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../bad").unwrap().is_none());
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
    }

    #[test]
    fn create_writes_new_file_and_returns_command() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "ship", "description": "ship it"});
        let cmd = create(dir.path(), &front, "body").unwrap();
        assert_eq!(cmd.id, "ship");
        assert!(dir.path().join("ship.md").exists());
        let r = get(dir.path(), "ship").unwrap().unwrap();
        assert_eq!(r.frontmatter["description"], "ship it");
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
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_merges_and_writes() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old"});
        create(dir.path(), &front, "old body").unwrap();
        let partial = serde_json::json!({"description": "new"});
        let updated = update(dir.path(), "a", Some(&partial), Some("new body"))
            .unwrap()
            .expect("command updated");
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.content, "new body");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", None, None).unwrap().is_none());
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
