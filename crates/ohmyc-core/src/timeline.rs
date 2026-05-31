//! Timeline read layer — mirrors packages/timeline/src/query.ts behavior
//! exactly. Reads SQLite at `$OHMYC_HOME/timeline.db` (default
//! `~/.config/ohmyc/timeline.db`) via rusqlite. All date math is UTC.

use std::path::PathBuf;

use serde::Serialize;

use crate::error::ApiError;

const ENV_HOME: &str = "OHMYC_HOME";
const DB_FILENAME: &str = "timeline.db";

/// Returns the SQLite path used by the dashboard plugin and read by this crate.
///
/// Lookup order, matching `packages/timeline/src/db.ts::getDefaultDbPath`:
/// 1. `$OHMYC_HOME/timeline.db` if `OHMYC_HOME` is set and non-empty
/// 2. `$HOME/.config/ohmyc/timeline.db`
pub fn default_db_path() -> Result<PathBuf, ApiError> {
    if let Ok(home) = std::env::var(ENV_HOME) {
        if !home.is_empty() {
            return Ok(PathBuf::from(home).join(DB_FILENAME));
        }
    }
    let user_home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(user_home.join(".config").join("ohmyc").join(DB_FILENAME))
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct HeatmapPoint {
    pub date: String,
    pub value: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Metric {
    Sessions,
    Turns,
    Tokens,
}

impl Metric {
    pub fn parse(s: &str) -> Result<Self, ApiError> {
        match s {
            "sessions" => Ok(Self::Sessions),
            "turns" => Ok(Self::Turns),
            "tokens" => Ok(Self::Tokens),
            other => Err(ApiError::InvalidInput(format!(
                "metric must be one of sessions|turns|tokens, got '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionRow {
    pub session_id: String,
    pub project: String,
    pub agent_name: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_ms: i64,
    pub turns: i64,
    pub tokens_input: i64,
    pub tokens_output: i64,
    pub tokens_cached: i64,
    pub summary: Option<String>,
    pub summary_source: String,
    pub transcript_path: String,
    pub last_offset: i64,
    pub ingested_at: i64,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionTool {
    pub session_id: String,
    pub tool_name: String,
    pub call_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionSkill {
    pub session_id: String,
    pub skill_name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionDetail {
    #[serde(flatten)]
    pub session: SessionRow,
    pub tools: Vec<SessionTool>,
    pub skills: Vec<SessionSkill>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ProjectGroup {
    pub project: String,
    pub sessions: Vec<SessionRow>,
    pub session_count: i64,
    pub turn_count: i64,
    pub token_count: i64,
    pub tool_count: i64,
    pub skill_count: i64,
    pub agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DayEvents {
    pub day: String,
    pub project_groups: Vec<ProjectGroup>,
    pub session_count: i64,
    pub turn_count: i64,
    pub token_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct EventsResult {
    pub days: Vec<DayEvents>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TimelineStatus {
    pub session_count: i64,
    pub last_sync_at: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metric_parses_known_values() {
        assert_eq!(Metric::parse("sessions").unwrap(), Metric::Sessions);
        assert_eq!(Metric::parse("turns").unwrap(), Metric::Turns);
        assert_eq!(Metric::parse("tokens").unwrap(), Metric::Tokens);
    }

    #[test]
    fn metric_rejects_unknown_value() {
        let err = Metric::parse("bogus").unwrap_err();
        match err {
            ApiError::InvalidInput(msg) => assert!(msg.contains("bogus")),
            other => panic!("expected InvalidInput, got {other:?}"),
        }
    }

    #[test]
    fn default_db_path_honors_ohmyc_home_env() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        let path = default_db_path().unwrap();
        assert_eq!(path, PathBuf::from("/tmp/fake-ohmyc/timeline.db"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    #[test]
    fn default_db_path_falls_back_to_config_dir() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::remove_var(ENV_HOME);
        let path = default_db_path().unwrap();
        assert!(path.ends_with(".config/ohmyc/timeline.db"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    use std::sync::Mutex;
    static ENV_LOCK: Mutex<()> = Mutex::new(());
}
