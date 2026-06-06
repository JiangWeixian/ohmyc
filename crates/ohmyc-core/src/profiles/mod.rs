//! Profile CRUD and preflight. Each profile is one
//! `$OHMYC_HOME/profiles/<name>/profile.json` file. Activation symlinks,
//! settings backup, and plugin-marketplace registration live in the
//! deferred "Profiles Activation" follow-up slice — slice 7 only covers
//! read + light writes + the dry-run preflight that the UI uses to
//! preview activation side-effects.

pub mod crud;
pub mod lock;
pub mod preflight;

use std::path::PathBuf;

use crate::error::ApiError;
use crate::store;

/// Names reserved by the profiles dir layout. Mirrors TS
/// `RESERVED_PROFILE_NAMES`. `.active` is a marker file; the rest are
/// sibling directories under the store.
pub const RESERVED_PROFILE_NAMES: &[&str] =
    &["store", ".active", "plugins", "agents", "skills", "commands"];

/// `$OHMYC_HOME/profiles/<name>/`.
pub fn profile_dir(name: &str) -> Result<PathBuf, ApiError> {
    Ok(store::store_profiles_dir()?.join(name))
}

/// `$OHMYC_HOME/profiles/<name>/profile.json`.
pub fn profile_json_path(name: &str) -> Result<PathBuf, ApiError> {
    Ok(profile_dir(name)?.join("profile.json"))
}

/// `$OHMYC_HOME/profiles/.active` — bare-name or absolute-path marker
/// pointing at the currently active profile.
pub fn active_marker_path() -> Result<PathBuf, ApiError> {
    Ok(store::store_profiles_dir()?.join(".active"))
}

/// Mirrors TS `SAFE_NAME_PATTERN = /^[\w-]+$/`: ASCII alphanumeric +
/// underscore + hyphen, non-empty. No dots, slashes, or whitespace.
pub fn is_safe_profile_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

/// True when `name` is a layout-reserved sibling. Case-sensitive match,
/// matching TS Array.includes behavior.
pub fn is_reserved_profile_name(name: &str) -> bool {
    RESERVED_PROFILE_NAMES.contains(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_name_accepts_word_chars_and_hyphen() {
        assert!(is_safe_profile_name("dev"));
        assert!(is_safe_profile_name("my_profile"));
        assert!(is_safe_profile_name("ci-prod"));
        assert!(is_safe_profile_name("v1_2"));
    }

    #[test]
    fn safe_name_rejects_dots_slashes_whitespace_empty() {
        assert!(!is_safe_profile_name(""));
        assert!(!is_safe_profile_name("a.b"));
        assert!(!is_safe_profile_name("a/b"));
        assert!(!is_safe_profile_name("a b"));
        assert!(!is_safe_profile_name("../escape"));
    }

    #[test]
    fn reserved_names_include_layout_siblings() {
        assert!(is_reserved_profile_name("store"));
        assert!(is_reserved_profile_name(".active"));
        assert!(is_reserved_profile_name("plugins"));
        assert!(is_reserved_profile_name("agents"));
        assert!(is_reserved_profile_name("skills"));
        assert!(is_reserved_profile_name("commands"));
        assert!(!is_reserved_profile_name("dev"));
        assert!(!is_reserved_profile_name("Store"));
    }
}
