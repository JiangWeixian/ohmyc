use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, read_md_or_skip, ComponentSource, Origin, Scope};
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
}

pub fn list(dir: &Path) -> Result<Vec<Skill>, ApiError> {
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
        if let Some(skill) = parse_skill(&dir_name, &raw)? {
            out.push(skill);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Skill>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let skill_path: PathBuf = dir.join(name).join(SKILL_FILE);
    let Some(raw) = read_md_or_skip(&skill_path)? else {
        return Ok(None);
    };
    parse_skill(name, &raw)
}

fn parse_skill(dir_name: &str, raw: &str) -> Result<Option<Skill>, ApiError> {
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
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
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
}
