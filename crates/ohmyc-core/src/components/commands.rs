use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, read_md_or_skip, ComponentSource, Origin, Scope};
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
}

pub fn list(dir: &Path) -> Result<Vec<Command>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Command> = Vec::new();
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
        if let Some(cmd) = parse_command(&filename, &raw)? {
            out.push(cmd);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
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
    parse_command(&filename, &raw)
}

fn parse_command(filename: &str, raw: &str) -> Result<Option<Command>, ApiError> {
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
}
