pub mod agents;
pub mod commands;
pub mod frontmatter;
pub mod skills;

use serde::{Deserialize, Serialize};

pub fn is_safe_name(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentKind {
    Agents,
    Commands,
    Skills,
    Plugins,
}

impl ComponentKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Agents => "agents",
            Self::Commands => "commands",
            Self::Skills => "skills",
            Self::Plugins => "plugins",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentSource {
    Local,
    Plugin,
    Project,
}

impl ComponentSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Plugin => "plugin",
            Self::Project => "project",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Codex,
    Claude,
    Opencode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceProvider {
    Codex,
    Claude,
    Opencode,
    Shared,
}

impl SourceProvider {
    fn as_str(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Opencode => "opencode",
            Self::Shared => "shared",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Global,
    Project,
    Plugin,
    Shared,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Global,
    Project,
}

impl Scope {
    fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Project => "project",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ComponentMeta<'a> {
    pub provider: SourceProvider,
    pub source: ComponentSource,
    pub scope: Scope,
    pub kind: SourceKind,
    pub plugin_id: Option<&'a str>,
}

impl<'a> ComponentMeta<'a> {
    pub fn new(
        provider: SourceProvider,
        source: ComponentSource,
        scope: Scope,
        kind: SourceKind,
        plugin_id: Option<&'a str>,
    ) -> Self {
        Self {
            provider,
            source,
            scope,
            kind,
            plugin_id,
        }
    }
}

impl ComponentMeta<'static> {
    pub fn claude_global() -> Self {
        Self::new(
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )
    }
}

pub fn locator_id(
    kind: ComponentKind,
    provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    plugin_id: Option<&str>,
    id: &str,
    source_path: Option<&std::path::Path>,
) -> String {
    use sha2::{Digest, Sha256};
    let normalized_path = source_path
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let hash = Sha256::digest(normalized_path.as_bytes());
    let path_hash = format!("{hash:x}");
    format!(
        "{}:{}:{}:{}:{}:{}:{}",
        kind.as_str(),
        provider.as_str(),
        source.as_str(),
        scope.as_str(),
        plugin_id.unwrap_or("none"),
        id,
        &path_hash[..16],
    )
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
        assert_eq!(serde_json::to_value(Origin::Codex).unwrap(), "codex");
        assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(Scope::Global).unwrap(), "global");
        assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
    }

    #[test]
    fn source_and_origin_enums_match_frontend_contract() {
        assert_eq!(serde_json::to_value(Origin::Codex).unwrap(), "codex");
        assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(Origin::Opencode).unwrap(), "opencode");
        assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
        assert_eq!(serde_json::to_value(ComponentSource::Plugin).unwrap(), "plugin");
        assert_eq!(serde_json::to_value(ComponentSource::Project).unwrap(), "project");
        assert_eq!(serde_json::to_value(SourceProvider::Shared).unwrap(), "shared");
        assert_eq!(serde_json::to_value(SourceKind::Shared).unwrap(), "shared");
    }

    #[test]
    fn locator_id_is_stable_and_distinguishes_sources() {
        let left = locator_id(
            ComponentKind::Skills,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            None,
            "review",
            Some(std::path::Path::new("/tmp/.claude/skills/review/SKILL.md")),
        );
        let right = locator_id(
            ComponentKind::Skills,
            SourceProvider::Shared,
            ComponentSource::Local,
            Scope::Global,
            None,
            "review",
            Some(std::path::Path::new("/tmp/.agents/skills/review/SKILL.md")),
        );
        assert_ne!(left, right);
        assert_eq!(left, "skills:claude:local:global:none:review:451173795d55287c");
        assert_eq!(right, "skills:shared:local:global:none:review:8322be38db255add");
    }
}
