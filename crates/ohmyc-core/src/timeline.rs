//! Timeline read layer — mirrors packages/timeline/src/query.ts behavior
//! exactly. Reads SQLite at `$OHMYC_HOME/timeline.db` (default
//! `~/.config/ohmyc/timeline.db`) via rusqlite. All date math is UTC.

use std::path::PathBuf;

use serde::Serialize;

use crate::error::ApiError;

#[cfg(test)]
mod test_db;

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

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

use rusqlite::{params_from_iter, Connection};

const MS_PER_DAY: i64 = 86_400_000;

pub struct HeatmapQuery {
    pub from: String, // YYYY-MM-DD
    pub to: String,
    pub metric: Metric,
    pub project: Option<String>,
}

fn parse_ymd(date: &str) -> Result<chrono::NaiveDate, ApiError> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|e| ApiError::InvalidInput(format!("date '{date}' is not YYYY-MM-DD: {e}")))
}

fn date_to_utc_ms(date: chrono::NaiveDate) -> i64 {
    use chrono::{NaiveDateTime, NaiveTime, TimeZone, Utc};
    let ndt = NaiveDateTime::new(date, NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    Utc.from_utc_datetime(&ndt).timestamp_millis()
}

fn ms_to_date_string(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let dt = Utc.timestamp_millis_opt(ms).single().expect("valid ms");
    dt.format("%Y-%m-%d").to_string()
}

fn generate_date_range(from: &str, to: &str) -> Result<Vec<String>, ApiError> {
    let start = parse_ymd(from)?;
    let end = parse_ymd(to)?;
    if start > end {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut cur = start;
    while cur <= end {
        out.push(cur.format("%Y-%m-%d").to_string());
        cur = cur.succ_opt().expect("date increment");
    }
    Ok(out)
}

pub fn heatmap(conn: &Connection, q: HeatmapQuery) -> Result<Vec<HeatmapPoint>, ApiError> {
    let dates = generate_date_range(&q.from, &q.to)?;
    if dates.is_empty() {
        return Ok(Vec::new());
    }

    let start_ms = date_to_utc_ms(parse_ymd(&q.from)?);
    let end_ms = date_to_utc_ms(parse_ymd(&q.to)?) + MS_PER_DAY - 1;

    let select_metric = match q.metric {
        Metric::Sessions => "COUNT(*)",
        Metric::Turns => "SUM(turns)",
        Metric::Tokens => "SUM(tokens_input + tokens_output + tokens_cached)",
    };

    let mut sql = format!(
        "SELECT date(started_at / 1000, 'unixepoch') AS day, {select_metric} AS value \
         FROM sessions WHERE started_at >= ? AND started_at <= ?"
    );
    let mut args: Vec<rusqlite::types::Value> = vec![start_ms.into(), end_ms.into()];
    if let Some(p) = q.project.as_ref() {
        sql.push_str(" AND project = ?");
        args.push(p.clone().into());
    }
    sql.push_str(" GROUP BY day");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| ApiError::Internal(format!("prepare heatmap sql: {e}")))?;
    let rows: Vec<(String, i64)> = stmt
        .query_map(params_from_iter(args), |row| {
            let day: String = row.get(0)?;
            let value: Option<i64> = row.get(1)?;
            Ok((day, value.unwrap_or(0)))
        })
        .map_err(|e| ApiError::Internal(format!("query heatmap: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect heatmap: {e}")))?;

    let value_map: std::collections::HashMap<String, i64> = rows.into_iter().collect();
    Ok(dates
        .into_iter()
        .map(|date| HeatmapPoint {
            value: value_map.get(&date).copied().unwrap_or(0),
            date,
        })
        .collect())
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

    use super::test_db::{date_ms, empty_db, insert_session};
    use rusqlite::Connection;

    fn seeded_three_days() -> Connection {
        let conn = empty_db();
        // 2026-01-01 — 2 sessions, 10 + 20 turns
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-01"), 10, 100, 50, 25);
        insert_session(&conn, "s2", "proj-b", date_ms("2026-01-01"), 20, 200, 100, 50);
        // 2026-01-02 — nothing
        // 2026-01-03 — 1 session, 5 turns
        insert_session(&conn, "s3", "proj-a", date_ms("2026-01-03"), 5, 30, 15, 5);
        conn
    }

    #[test]
    fn heatmap_sessions_metric_counts_sessions_per_day() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Sessions,
                project: None,
            },
        )
        .unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], HeatmapPoint { date: "2026-01-01".into(), value: 2 });
        assert_eq!(result[1], HeatmapPoint { date: "2026-01-02".into(), value: 0 });
        assert_eq!(result[2], HeatmapPoint { date: "2026-01-03".into(), value: 1 });
    }

    #[test]
    fn heatmap_turns_metric_sums_turns_per_day() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Turns,
                project: None,
            },
        )
        .unwrap();
        assert_eq!(result[0].value, 30); // 10 + 20
        assert_eq!(result[2].value, 5);
    }

    #[test]
    fn heatmap_tokens_metric_sums_input_output_cached() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Tokens,
                project: None,
            },
        )
        .unwrap();
        // Day 1: (100+50+25) + (200+100+50) = 525
        assert_eq!(result[0].value, 525);
        // Day 3: 30+15+5 = 50
        assert_eq!(result[2].value, 50);
    }

    #[test]
    fn heatmap_project_filter_limits_to_one_project() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Sessions,
                project: Some("proj-a".into()),
            },
        )
        .unwrap();
        assert_eq!(result[0].value, 1); // only s1 on day 1
        assert_eq!(result[2].value, 1); // s3 on day 3
    }

    #[test]
    fn heatmap_returns_empty_when_from_after_to() {
        let conn = empty_db();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-05".into(),
                to: "2026-01-01".into(),
                metric: Metric::Sessions,
                project: None,
            },
        )
        .unwrap();
        assert!(result.is_empty());
    }
}
