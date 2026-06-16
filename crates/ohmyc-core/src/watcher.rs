//! Filesystem watcher — debounced 250ms; emits a typed `FsEvent` for
//! every change in the watched paths. Used by the Tauri layer to forward
//! to the frontend as `fs:changed`.

use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind, Debouncer};
use serde::Serialize;

use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FsEvent {
    /// A timeline DB write (sessions.db / -wal / -shm changed).
    TimelineDb { path: String },
    /// A claude-home file changed (agents/skills/commands/settings/plugins).
    ClaudeHome { path: String },
}

/// Builds a debouncer (250ms) that watches the given paths recursively and
/// forwards events to `tx`. The returned `Debouncer` must be kept alive —
/// dropping it stops the watcher.
pub fn spawn(paths: Vec<PathBuf>, tx: Sender<FsEvent>) -> Result<Debouncer<notify::RecommendedWatcher>, ApiError> {
    let mut debouncer = new_debouncer(
        Duration::from_millis(250),
        move |res: notify_debouncer_mini::DebounceEventResult| {
            let Ok(events) = res else { return };
            for ev in events {
                let p = &ev.path;
                let path = p.to_string_lossy().into_owned();
                if !matches!(ev.kind, DebouncedEventKind::Any) {
                    continue;
                }
                let lower = path.to_lowercase();
                let event = if lower.ends_with("timeline.db")
                    || lower.ends_with("timeline.db-wal")
                    || lower.ends_with("timeline.db-shm")
                {
                    FsEvent::TimelineDb { path }
                } else {
                    FsEvent::ClaudeHome { path }
                };
                let _ = tx.send(event);
            }
        },
    )
    .map_err(|e| ApiError::Internal(format!("debouncer init: {e}")))?;

    for path in &paths {
        if !path.exists() {
            continue;
        }
        // Recursive: slices 3+ depend on detecting writes nested under
        // ~/.claude (e.g. agents/<name>.md). The debouncer collapses bursts
        // so cost stays low.
        debouncer
            .watcher()
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| ApiError::Internal(format!("watch {}: {e}", path.display())))?;
    }
    Ok(debouncer)
}

/// Returns the default set of paths to watch:
/// - `$OHMYC_HOME` (parent dir of `timeline.db`)
/// - `~/.claude` (claude home root)
pub fn default_watch_paths() -> Result<Vec<PathBuf>, ApiError> {
    let db = crate::timeline::default_db_path()?;
    let db_dir = db
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| ApiError::Internal("db path has no parent".to_string()))?;
    let claude_home = crate::claude_home::resolve()?;
    let ohmyc_base = crate::store::base_dir()?;
    Ok(vec![db_dir, claude_home, ohmyc_base])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::{channel, Receiver};
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn fs_event_serializes_with_tag_and_path() {
        let ev = FsEvent::TimelineDb {
            path: "/tmp/timeline.db".into(),
        };
        let json = serde_json::to_value(&ev).unwrap();
        assert_eq!(json["kind"], "timeline_db");
        assert_eq!(json["path"], "/tmp/timeline.db");
    }

    #[test]
    fn debouncer_emits_event_after_write() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();

        std::thread::sleep(Duration::from_millis(50));
        std::fs::write(dir.path().join("anything.txt"), "hi").unwrap();

        let event = rx.recv_timeout(Duration::from_secs(2)).expect("event received");
        match event {
            FsEvent::ClaudeHome { path } => assert!(path.contains("anything.txt")),
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn debouncer_classifies_timeline_db_writes() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();

        std::thread::sleep(Duration::from_millis(50));
        std::fs::write(dir.path().join("timeline.db"), b"sqlite").unwrap();

        let event = rx.recv_timeout(Duration::from_secs(2)).expect("event received");
        assert!(matches!(event, FsEvent::TimelineDb { .. }));
    }

    #[test]
    fn debouncer_emits_event_for_nested_writes() {
        // Slices 3+ rely on this: claude-home writes land under nested dirs
        // such as agents/<name>.md. Lock in that the recursive watcher catches
        // them even if notify emits a parent directory event first.
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("agents");
        std::fs::create_dir_all(&nested).unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();

        std::thread::sleep(Duration::from_millis(50));
        std::fs::write(nested.join("reviewer.md"), "name: reviewer\n").unwrap();

        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        loop {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let event = rx.recv_timeout(remaining).expect("target file event received");
            match event {
                FsEvent::ClaudeHome { path } if path.contains("agents") && path.ends_with("reviewer.md") => break,
                FsEvent::ClaudeHome { .. } => continue,
                other => panic!("expected ClaudeHome for nested write, got {other:?}"),
            }
        }
    }

    #[test]
    fn default_watch_paths_includes_ohmyc_home_base() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev_db = std::env::var("OHMYC_TIMELINE_DB").ok();
        let prev_home = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_TIMELINE_DB", "/tmp/test-db/timeline.db");
        std::env::set_var("OHMYC_HOME", "/tmp/test-ohmyc-home");
        let paths = default_watch_paths().unwrap();
        match prev_db {
            Some(v) => std::env::set_var("OHMYC_TIMELINE_DB", v),
            None => std::env::remove_var("OHMYC_TIMELINE_DB"),
        }
        match prev_home {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        let path_strings: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
        assert!(path_strings.iter().any(|p| p.contains("test-ohmyc-home")));
    }
}
