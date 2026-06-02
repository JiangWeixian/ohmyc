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
}
