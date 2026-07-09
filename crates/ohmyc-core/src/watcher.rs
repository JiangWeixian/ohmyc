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
    /// Provider config changed (Codex, Claude, OpenCode, or shared .agents).
    ProviderConfig { path: String },
    /// A claude-home file changed (agents/skills/commands/settings/plugins).
    ClaudeHome { path: String },
}

pub fn provider_config_roots_for(home: &std::path::Path, project_root: &std::path::Path) -> Vec<std::path::PathBuf> {
    vec![
        home.join(".claude"),
        home.join(".codex"),
        home.join(".agents"),
        home.join(".config").join("opencode"),
        project_root.join(".claude"),
        project_root.join(".codex"),
        project_root.join(".agents"),
        project_root.join(".opencode"),
        project_root.join("opencode.json"),
        project_root.join("opencode.jsonc"),
    ]
}

fn is_provider_config_path(path: &std::path::Path) -> bool {
    let s = path.to_string_lossy();
    s.contains("/.claude/")
        || s.ends_with("/.claude")
        || s.contains("/.codex/")
        || s.ends_with("/.codex")
        || s.contains("/.agents/")
        || s.ends_with("/.agents")
        || s.contains("/.opencode/")
        || s.ends_with("/.opencode")
        || s.contains("/.config/opencode/")
        || s.ends_with("/.config/opencode")
        || s.ends_with("/opencode.json")
        || s.ends_with("/opencode.jsonc")
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
                } else if is_provider_config_path(p) {
                    FsEvent::ProviderConfig { path }
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
    let home = dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    let current_dir = std::env::current_dir().map_err(|e| ApiError::Internal(format!("current dir: {e}")))?;
    let project_root = crate::providers::paths::find_project_root(&current_dir);
    let mut paths = vec![db_dir, claude_home, ohmyc_base];
    for path in provider_config_roots_for(&home, &project_root) {
        if !paths.contains(&path) {
            paths.push(path);
        }
    }
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::{channel, Receiver};
    use std::sync::Mutex;
    use std::time::Instant;

    static ENV_LOCK: Mutex<()> = Mutex::new(());
    // Real filesystem watcher tests race on macOS when several debouncers
    // start at once; the production watcher still supports recursive paths.
    static WATCHER_LOCK: Mutex<()> = Mutex::new(());

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
    fn provider_config_event_serializes_with_tag_and_path() {
        let ev = FsEvent::ProviderConfig {
            path: "/repo/.codex/agents/reviewer.toml".into(),
        };
        let json = serde_json::to_value(&ev).unwrap();
        assert_eq!(json["kind"], "provider_config");
        assert_eq!(json["path"], "/repo/.codex/agents/reviewer.toml");
    }

    #[test]
    fn classifier_marks_provider_paths() {
        assert!(is_provider_config_path(std::path::Path::new(
            "/repo/.codex/agents/reviewer.toml"
        )));
        assert!(is_provider_config_path(std::path::Path::new("/repo/opencode.json")));
        assert!(is_provider_config_path(std::path::Path::new(
            "/home/alice/.config/opencode/opencode.json"
        )));
    }

    #[test]
    fn debouncer_emits_event_after_write() {
        let _lock = WATCHER_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();
        let target = dir.path().join("anything.txt");

        wait_for_matching_event(
            &rx,
            || std::fs::write(&target, "hi").unwrap(),
            |event| match event {
                FsEvent::ClaudeHome { path } if path.contains("anything.txt") => true,
                FsEvent::ClaudeHome { .. } => false,
                other => panic!("unexpected event: {other:?}"),
            },
        );
    }

    fn wait_for_matching_event(
        rx: &Receiver<FsEvent>,
        mut trigger: impl FnMut(),
        mut matches_event: impl FnMut(FsEvent) -> bool,
    ) {
        let deadline = Instant::now() + Duration::from_secs(4);
        while Instant::now() < deadline {
            trigger();
            let poll_until = (Instant::now() + Duration::from_millis(400)).min(deadline);
            while Instant::now() < poll_until {
                let remaining = poll_until.saturating_duration_since(Instant::now());
                match rx.recv_timeout(remaining) {
                    Ok(event) => {
                        if matches_event(event) {
                            return;
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        panic!("watcher channel disconnected")
                    }
                }
            }
        }
        panic!("matching watcher event received");
    }

    #[test]
    fn debouncer_classifies_timeline_db_writes() {
        let _lock = WATCHER_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();
        let target = dir.path().join("timeline.db");

        wait_for_matching_event(
            &rx,
            || std::fs::write(&target, b"sqlite").unwrap(),
            |event| matches!(event, FsEvent::TimelineDb { .. }),
        );
    }

    #[test]
    fn debouncer_emits_event_for_nested_writes() {
        let _lock = WATCHER_LOCK.lock().unwrap();
        // Slices 3+ rely on this: claude-home writes land under nested dirs
        // such as agents/<name>.md. Lock in that the recursive watcher catches
        // them even if notify emits a parent directory event first.
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("agents");
        std::fs::create_dir_all(&nested).unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();
        let target = nested.join("reviewer.md");

        wait_for_matching_event(
            &rx,
            || std::fs::write(&target, "name: reviewer\n").unwrap(),
            |event| matches!(event, FsEvent::ClaudeHome { path } if path.contains("agents") && path.ends_with("reviewer.md")),
        );
    }

    #[test]
    fn debouncer_classifies_provider_config_writes() {
        let _lock = WATCHER_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join(".codex").join("agents");
        std::fs::create_dir_all(&nested).unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();
        let target = nested.join("reviewer.toml");

        wait_for_matching_event(
            &rx,
            || std::fs::write(&target, "name = \"reviewer\"\n").unwrap(),
            |event| matches!(event, FsEvent::ProviderConfig { path } if path.contains(".codex") && path.ends_with("reviewer.toml")),
        );
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

    #[test]
    fn default_watch_paths_include_provider_config_dirs() {
        let roots = provider_config_roots_for(std::path::Path::new("/home/alice"), std::path::Path::new("/repo"));
        assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.claude")));
        assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.codex")));
        assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.agents")));
        assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.config/opencode")));
        assert!(roots.contains(&std::path::PathBuf::from("/repo/.codex")));
        assert!(roots.contains(&std::path::PathBuf::from("/repo/.agents")));
        assert!(roots.contains(&std::path::PathBuf::from("/repo/.opencode")));
        assert!(roots.contains(&std::path::PathBuf::from("/repo/opencode.json")));
        assert!(roots.contains(&std::path::PathBuf::from("/repo/opencode.jsonc")));
    }
}
