pub mod agents;
pub mod commands;
pub mod frontmatter;
pub mod skills;

use serde::Serialize;

pub fn is_safe_name(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentSource {
    Local,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Agents,
    Claude,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Global,
}

use std::path::PathBuf;

use crate::claude_home;
use crate::error::ApiError;

pub fn agents_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("agents"))
}

pub fn skills_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("skills"))
}

pub fn agents_shared_skills_dir() -> Result<PathBuf, ApiError> {
    let home = dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(home.join(".agents").join("skills"))
}

pub fn commands_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("commands"))
}

/// Read a Markdown file, treating "file vanished between listing and read"
/// (NotFound) as a benign skip (Ok(None)) and surfacing every other I/O
/// failure (permission denied, transient FS error, etc.) as ApiError::Io.
/// Centralizes the policy so the three reader modules agree.
pub fn read_md_or_skip(path: &std::path::Path) -> Result<Option<String>, ApiError> {
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_safe_name_accepts_alphanumeric_with_dash_and_underscore() {
        assert!(is_safe_name("agent-1"));
        assert!(is_safe_name("my_skill"));
        assert!(is_safe_name("X9"));
    }

    #[test]
    fn is_safe_name_rejects_dots_slashes_and_empty() {
        assert!(!is_safe_name(""));
        assert!(!is_safe_name("foo.md"));
        assert!(!is_safe_name("../etc/passwd"));
        assert!(!is_safe_name("a/b"));
        assert!(!is_safe_name("with space"));
    }

    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn component_dirs_compose_under_claude_home() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", "/tmp/fake-home");
        assert_eq!(agents_dir().unwrap(), PathBuf::from("/tmp/fake-home/agents"));
        assert_eq!(skills_dir().unwrap(), PathBuf::from("/tmp/fake-home/skills"));
        assert_eq!(commands_dir().unwrap(), PathBuf::from("/tmp/fake-home/commands"));
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
    }

    #[test]
    fn enums_serialize_lowercase_to_match_ts_origin_enum() {
        assert_eq!(serde_json::to_value(Origin::Agents).unwrap(), "agents");
        assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(Scope::Global).unwrap(), "global");
        assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
    }
}
