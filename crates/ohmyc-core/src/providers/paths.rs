use std::path::{Path, PathBuf};

use crate::error::ApiError;

pub fn home_dir() -> Result<PathBuf, ApiError> {
    dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))
}

pub fn codex_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_CODEX_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".codex"))
}

pub fn opencode_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_OPENCODE_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".config").join("opencode"))
}

pub fn shared_agents_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_AGENTS_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".agents"))
}

pub fn find_project_root(start: &Path) -> PathBuf {
    let mut cur = start.to_path_buf();
    loop {
        if cur.join(".git").exists() {
            return cur;
        }
        if !cur.pop() {
            return start.to_path_buf();
        }
    }
}
