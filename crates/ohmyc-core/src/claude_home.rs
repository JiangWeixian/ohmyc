//! Resolves the on-disk root that the OhMyC backend reads from.
//! Default: `$HOME/.claude`. Overridable via `OHMYC_CLAUDE_HOME` for
//! tests and for users with a non-standard layout.

use std::path::{Path, PathBuf};

use crate::error::ApiError;

const ENV_OVERRIDE: &str = "OHMYC_CLAUDE_HOME";

/// Resolve the active claude-home directory.
///
/// Lookup order:
/// 1. `OHMYC_CLAUDE_HOME` env var (if set and non-empty)
/// 2. `$HOME/.claude`
///
/// Returns `ApiError::Internal` if no home dir can be determined.
pub fn resolve() -> Result<PathBuf, ApiError> {
    if let Ok(override_path) = std::env::var(ENV_OVERRIDE) {
        if !override_path.is_empty() {
            return Ok(PathBuf::from(override_path));
        }
    }
    let home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(home.join(".claude"))
}

/// Resolve a path relative to claude-home.
pub fn join<P: AsRef<Path>>(rel: P) -> Result<PathBuf, ApiError> {
    Ok(resolve()?.join(rel))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env<F: FnOnce()>(key: &str, value: Option<&str>, f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(key).ok();
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
        f();
        match prev {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }

    #[test]
    fn resolve_uses_env_override_when_set() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = resolve().unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude"));
        });
    }

    #[test]
    fn resolve_falls_back_to_home_dot_claude_when_env_unset() {
        with_env(ENV_OVERRIDE, None, || {
            let path = resolve().unwrap();
            assert!(path.ends_with(".claude"));
        });
    }

    #[test]
    fn resolve_ignores_empty_env_var() {
        with_env(ENV_OVERRIDE, Some(""), || {
            let path = resolve().unwrap();
            assert!(path.ends_with(".claude"));
        });
    }

    #[test]
    fn join_concatenates_relative_path() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = join("profiles/default.yaml").unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude/profiles/default.yaml"));
        });
    }
}
