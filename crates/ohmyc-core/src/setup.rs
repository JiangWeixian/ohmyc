//! Setup readiness probe. Resolves the local monitor store and checks whether
//! the timeline schema can be read. Exposes a stable `SetupStatus` only —
//! the DB path never leaves this module.

use serde::Serialize;
use std::path::Path;

use crate::timeline;

/// Stable setup readiness state serialized to the frontend as a tagged union:
/// `{ state: "ready" }`, `{ state: "missing_store" }`, etc.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "state")]
pub enum SetupStatus {
    Ready,
    MissingStore,
    UnreadableStore {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    InternalError {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

/// Public entry point: resolve the store path via the timeline module and probe it.
/// A failure to even resolve the path is an `InternalError` (never panics).
pub fn probe() -> SetupStatus {
    match timeline::default_db_path() {
        Ok(path) => probe_path(&path),
        Err(_) => SetupStatus::InternalError {
            reason: Some("could not resolve monitor store path".to_string()),
        },
    }
}

/// Path-injected probe — the testable core. No env var mutation required.
pub fn probe_path(path: &Path) -> SetupStatus {
    if !path.exists() {
        return SetupStatus::MissingStore;
    }
    // open_db returns an Io error only when the file is absent (already handled
    // above); any other open failure means unreadable. We deliberately discard
    // the raw error string so the DB path can never leak.
    let conn = match timeline::open_db(path) {
        Ok(conn) => conn,
        Err(_) => {
            return SetupStatus::UnreadableStore {
                reason: Some("monitor store could not be opened".to_string()),
            };
        }
    };
    match timeline::status(&conn) {
        Ok(_) => SetupStatus::Ready,
        Err(_) => SetupStatus::UnreadableStore {
            reason: Some("monitor store schema could not be read".to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::fs;
    use tempfile::TempDir;

    // Timeline schema inlined here (mirrors crates/ohmyc-core/src/timeline/test_db.rs)
    // because `test_db` is a private `#[cfg(test)]` submodule of `timeline` and is
    // not visible from this module. Keep in sync if the schema changes.
    const SCHEMA_SQL: &str = "
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  agent_name        TEXT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  turns             INTEGER NOT NULL,
  tokens_input      INTEGER NOT NULL DEFAULT 0,
  tokens_output     INTEGER NOT NULL DEFAULT 0,
  tokens_cached     INTEGER NOT NULL DEFAULT 0,
  summary           TEXT,
  summary_source    TEXT NOT NULL,
  transcript_path   TEXT NOT NULL,
  last_offset       INTEGER NOT NULL,
  ingested_at       INTEGER NOT NULL,
  model             TEXT
);
CREATE TABLE session_tools (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  call_count  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tool_name)
);
CREATE TABLE session_skills (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,
  PRIMARY KEY (session_id, skill_name)
);
CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
";

    /// Build a valid timeline DB (schema applied, zero sessions) at a temp path.
    fn valid_store() -> (TempDir, std::path::PathBuf) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        let conn = Connection::open(&path).expect("open db");
        conn.execute_batch(SCHEMA_SQL).expect("apply schema");
        // Zero sessions is a valid Ready state, not an onboarding condition.
        drop(conn);
        (dir, path)
    }

    #[test]
    fn missing_store_returns_missing() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        // Path does not exist.
        assert_eq!(probe_path(&path), SetupStatus::MissingStore);
    }

    #[test]
    fn ready_when_store_has_schema_and_zero_sessions() {
        let (_dir, path) = valid_store();
        assert_eq!(probe_path(&path), SetupStatus::Ready);
    }

    #[test]
    fn unreadable_when_store_is_garbage_bytes() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        fs::write(&path, b"not a sqlite database").expect("write garbage");
        match probe_path(&path) {
            SetupStatus::UnreadableStore { .. } => {}
            other => panic!("expected UnreadableStore, got {other:?}"),
        }
    }

    #[test]
    fn unreadable_when_schema_is_missing_sessions_table() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        // A valid SQLite file but not the timeline schema.
        let conn = Connection::open(&path).expect("open db");
        conn.execute_batch("CREATE TABLE unrelated (x INTEGER);")
            .expect("apply wrong schema");
        drop(conn);
        assert!(
            matches!(probe_path(&path), SetupStatus::UnreadableStore { .. }),
            "a SQLite file without the sessions table is unreadable"
        );
    }

    #[test]
    fn serialized_status_never_contains_the_db_path() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        fs::write(&path, b"garbage").expect("write garbage");
        let status = probe_path(&path);
        let json = serde_json::to_string(&status).expect("serialize");
        // The temp path must not appear anywhere in the wire payload.
        assert!(
            !json.contains(&path.display().to_string()),
            "DB path leaked into setup status: {json}"
        );
    }

    #[test]
    fn ready_serializes_to_state_ready_tag() {
        let json = serde_json::to_value(&SetupStatus::Ready).expect("serialize");
        assert_eq!(json["state"], "ready");
    }

    #[test]
    fn missing_serializes_to_state_missing_store_tag() {
        let json = serde_json::to_value(&SetupStatus::MissingStore).expect("serialize");
        assert_eq!(json["state"], "missing_store");
    }
}
