//! Read + atomic-write of `<claude_home>/settings.json`. Mirrors the
//! TS `/api/settings` GET/POST behavior:
//! - Read: `{ path, content: Option<Value>, exists }` — content is
//!   None when the file does not exist; `exists` is false in that case.
//! - Write: rejects non-object bodies with `ApiError::Validation`,
//!   creates the parent dir if missing, writes via temp-file + rename
//!   so a partial write never leaves a corrupt file.

use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value;

use crate::claude_home;
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SettingsRead {
    pub path: String,
    pub content: Option<Value>,
    pub exists: bool,
}

pub fn settings_path() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("settings.json"))
}

/// Read settings from the global `<claude_home>/settings.json`. Returns
/// `exists: false, content: None` when the file is missing — this is
/// not an error, it's the "no settings yet" state the UI surfaces as
/// defaults.
///
/// Other I/O failures (permission denied, etc.) surface as `ApiError::Io`.
/// Malformed JSON surfaces as `ApiError::Parse`.
pub fn read() -> Result<SettingsRead, ApiError> {
    let path = settings_path()?;
    let path_str = path.to_string_lossy().to_string();
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let content: Value = serde_json::from_str(&raw)
                .map_err(|e| ApiError::Parse(format!("settings.json: {e}")))?;
            Ok(SettingsRead { path: path_str, content: Some(content), exists: true })
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(SettingsRead { path: path_str, content: None, exists: false })
        }
        Err(e) => Err(ApiError::Io(format!("read {path_str}: {e}"))),
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SettingsWrite {
    pub path: String,
    pub success: bool,
}

/// Write `content` to `<claude_home>/settings.json` atomically. Rejects
/// non-object bodies with `ApiError::Validation` (matches the TS server's
/// "Content must be an object" check). Creates the parent directory if
/// missing. Writes via temp-file in the same directory + atomic rename.
pub fn write(content: &Value) -> Result<SettingsWrite, ApiError> {
    if !content.is_object() {
        return Err(ApiError::Validation(
            "content must be a JSON object".to_string(),
        ));
    }
    let path = settings_path()?;
    let path_str = path.to_string_lossy().to_string();

    let dir = path.parent().ok_or_else(|| {
        ApiError::Internal(format!("settings path has no parent: {path_str}"))
    })?;
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;

    let serialized = serde_json::to_string_pretty(content)
        .map_err(|e| ApiError::Internal(format!("serialize settings: {e}")))?;

    // Atomic replace: write to a sibling temp file, then rename.
    let mut tmp = tempfile::NamedTempFile::new_in(dir)
        .map_err(|e| ApiError::Io(format!("create temp in {}: {e}", dir.display())))?;
    use std::io::Write;
    tmp.write_all(serialized.as_bytes())
        .map_err(|e| ApiError::Io(format!("write temp: {e}")))?;
    tmp.persist(&path)
        .map_err(|e| ApiError::Io(format!("persist {path_str}: {e}")))?;

    Ok(SettingsWrite { path: path_str, success: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_claude_home<F: FnOnce()>(dir: &std::path::Path, f: F) {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", dir);
        f();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
    }

    #[test]
    fn read_returns_exists_false_when_file_missing() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let r = read().unwrap();
            assert!(!r.exists);
            assert!(r.content.is_none());
            assert!(r.path.ends_with("settings.json"));
        });
    }

    #[test]
    fn read_returns_parsed_content_when_file_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), r#"{"model":"sonnet-4","general":{"alwaysThinkingEnabled":true}}"#)
            .unwrap();
        with_claude_home(dir.path(), || {
            let r = read().unwrap();
            assert!(r.exists);
            let c = r.content.unwrap();
            assert_eq!(c["model"], "sonnet-4");
            assert_eq!(c["general"]["alwaysThinkingEnabled"], true);
        });
    }

    #[test]
    fn read_errors_on_malformed_json() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), "{not valid").unwrap();
        with_claude_home(dir.path(), || {
            let err = read().unwrap_err();
            match err {
                ApiError::Parse(msg) => assert!(msg.contains("settings.json")),
                other => panic!("expected Parse, got {other:?}"),
            }
        });
    }

    #[test]
    fn write_persists_object_atomically() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let content = serde_json::json!({"model": "sonnet-4"});
            let r = write(&content).unwrap();
            assert!(r.success);
            assert!(r.path.ends_with("settings.json"));

            // Read back
            let raw = std::fs::read_to_string(dir.path().join("settings.json")).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(parsed, content);
        });
    }

    #[test]
    fn write_creates_parent_directory_when_missing() {
        // Use a tempdir that doesn't have the claude_home dir yet.
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("does-not-exist");
        with_claude_home(&nested, || {
            let content = serde_json::json!({"k": "v"});
            let r = write(&content).unwrap();
            assert!(r.success);
            assert!(nested.join("settings.json").exists());
        });
    }

    #[test]
    fn write_rejects_non_object_with_validation_error() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let err = write(&serde_json::json!([1, 2, 3])).unwrap_err();
            match err {
                ApiError::Validation(msg) => assert!(msg.contains("object")),
                other => panic!("expected Validation, got {other:?}"),
            }
            let err2 = write(&serde_json::json!("a string")).unwrap_err();
            assert!(matches!(err2, ApiError::Validation(_)));
            let err3 = write(&serde_json::json!(null)).unwrap_err();
            assert!(matches!(err3, ApiError::Validation(_)));
        });
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        with_claude_home(dir.path(), || {
            let content = serde_json::json!({
                "model": "opus",
                "general": {"showTurnDuration": true, "prefersReducedMotion": false}
            });
            write(&content).unwrap();
            let r = read().unwrap();
            assert!(r.exists);
            assert_eq!(r.content.unwrap(), content);
        });
    }
}
