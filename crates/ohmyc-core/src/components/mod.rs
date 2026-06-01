pub mod agents;
pub mod commands;
pub mod frontmatter;
pub mod skills;

use serde::Serialize;

pub fn is_safe_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentSource {
    Local,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Claude,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Global,
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

    #[test]
    fn enums_serialize_lowercase_to_match_ts_origin_enum() {
        assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(Scope::Global).unwrap(), "global");
        assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
    }
}
