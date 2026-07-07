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
    let user_home = dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
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

pub struct EventsQuery {
    pub from: Option<String>, // YYYY-MM-DD
    pub to: Option<String>,
    pub project: Option<String>,
    pub limit: Option<i64>,
    pub cursor: Option<String>,
}

pub fn events(conn: &Connection, q: EventsQuery) -> Result<EventsResult, ApiError> {
    let limit = q.limit.unwrap_or(30);
    if limit <= 0 {
        return Err(ApiError::InvalidInput("limit must be > 0".into()));
    }

    let mut conditions: Vec<String> = Vec::new();
    let mut args: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(from) = q.from.as_ref() {
        conditions.push("started_at >= ?".into());
        args.push(date_to_utc_ms(parse_ymd(from)?).into());
    }
    if let Some(to) = q.to.as_ref() {
        conditions.push("started_at <= ?".into());
        args.push((date_to_utc_ms(parse_ymd(to)?) + MS_PER_DAY - 1).into());
    }
    if let Some(p) = q.project.as_ref() {
        conditions.push("project = ?".into());
        args.push(p.clone().into());
    }
    if let Some(c) = q.cursor.as_ref() {
        conditions.push("date(started_at / 1000, 'unixepoch') < ?".into());
        args.push(c.clone().into());
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let day_sql = format!(
        "SELECT DISTINCT date(started_at / 1000, 'unixepoch') AS day \
         FROM sessions {where_clause} ORDER BY day DESC LIMIT ?"
    );
    let mut day_args = args.clone();
    day_args.push((limit + 1).into());

    let mut day_stmt = conn
        .prepare(&day_sql)
        .map_err(|e| ApiError::Internal(format!("prepare events day sql: {e}")))?;
    let day_rows: Vec<String> = day_stmt
        .query_map(params_from_iter(day_args), |row| row.get::<_, String>(0))
        .map_err(|e| ApiError::Internal(format!("query events days: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect events days: {e}")))?;

    let has_more = day_rows.len() as i64 > limit;
    let day_batch: Vec<String> = if has_more {
        day_rows.into_iter().take(limit as usize).collect()
    } else {
        day_rows
    };

    if day_batch.is_empty() {
        return Ok(EventsResult {
            days: Vec::new(),
            next_cursor: None,
        });
    }

    let placeholders = day_batch.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let project_filter = if q.project.is_some() { "AND project = ?" } else { "" };
    let session_sql = format!(
        "SELECT session_id, project, agent_name, started_at, ended_at, duration_ms, \
                turns, tokens_input, tokens_output, tokens_cached, summary, summary_source, \
                transcript_path, last_offset, ingested_at, model \
         FROM sessions \
         WHERE date(started_at / 1000, 'unixepoch') IN ({placeholders}) {project_filter} \
         ORDER BY started_at DESC"
    );
    let mut session_args: Vec<rusqlite::types::Value> = day_batch.iter().map(|d| d.clone().into()).collect();
    if let Some(p) = q.project.as_ref() {
        session_args.push(p.clone().into());
    }
    let mut session_stmt = conn
        .prepare(&session_sql)
        .map_err(|e| ApiError::Internal(format!("prepare events session sql: {e}")))?;
    let sessions: Vec<SessionRow> = session_stmt
        .query_map(params_from_iter(session_args), row_to_session)
        .map_err(|e| ApiError::Internal(format!("query events sessions: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect events sessions: {e}")))?;

    let mut day_project_map: std::collections::HashMap<String, Vec<ProjectGroup>> =
        day_batch.iter().map(|d| (d.clone(), Vec::new())).collect();

    for session in &sessions {
        let day = ms_to_date_string(session.started_at);
        let groups = day_project_map.entry(day.clone()).or_default();
        let pos = groups.iter().position(|g| g.project == session.project);
        let idx = match pos {
            Some(i) => i,
            None => {
                groups.push(ProjectGroup {
                    project: session.project.clone(),
                    sessions: Vec::new(),
                    session_count: 0,
                    turn_count: 0,
                    token_count: 0,
                    tool_count: 0,
                    skill_count: 0,
                    agents: Vec::new(),
                });
                groups.len() - 1
            }
        };
        let group = &mut groups[idx];
        group.sessions.push(session.clone());
        group.session_count += 1;
        group.turn_count += session.turns;
        group.token_count += session.tokens_input + session.tokens_output + session.tokens_cached;
        if let Some(agent) = session.agent_name.as_ref() {
            if !group.agents.contains(agent) {
                group.agents.push(agent.clone());
            }
        }
    }

    for (_day, groups) in day_project_map.iter_mut() {
        let session_ids: Vec<String> = groups
            .iter()
            .flat_map(|g| g.sessions.iter().map(|s| s.session_id.clone()))
            .collect();
        if session_ids.is_empty() {
            continue;
        }
        let id_placeholders = session_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        let tool_sql = format!(
            "SELECT session_id, SUM(call_count) AS cnt FROM session_tools \
             WHERE session_id IN ({id_placeholders}) GROUP BY session_id"
        );
        let mut tool_stmt = conn
            .prepare(&tool_sql)
            .map_err(|e| ApiError::Internal(format!("prepare tool sql: {e}")))?;
        let tool_map: std::collections::HashMap<String, i64> = tool_stmt
            .query_map(
                params_from_iter(session_ids.iter().cloned().map(rusqlite::types::Value::from)),
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .map_err(|e| ApiError::Internal(format!("query tools: {e}")))?
            .collect::<Result<_, _>>()
            .map_err(|e| ApiError::Internal(format!("collect tools: {e}")))?;

        let skill_sql = format!(
            "SELECT session_id, COUNT(*) AS cnt FROM session_skills \
             WHERE session_id IN ({id_placeholders}) GROUP BY session_id"
        );
        let mut skill_stmt = conn
            .prepare(&skill_sql)
            .map_err(|e| ApiError::Internal(format!("prepare skill sql: {e}")))?;
        let skill_map: std::collections::HashMap<String, i64> = skill_stmt
            .query_map(
                params_from_iter(session_ids.iter().cloned().map(rusqlite::types::Value::from)),
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .map_err(|e| ApiError::Internal(format!("query skills: {e}")))?
            .collect::<Result<_, _>>()
            .map_err(|e| ApiError::Internal(format!("collect skills: {e}")))?;

        for group in groups.iter_mut() {
            group.tool_count = group
                .sessions
                .iter()
                .map(|s| tool_map.get(&s.session_id).copied().unwrap_or(0))
                .sum();
            group.skill_count = group
                .sessions
                .iter()
                .map(|s| skill_map.get(&s.session_id).copied().unwrap_or(0))
                .sum();
        }
    }

    let mut day_events: Vec<DayEvents> = Vec::new();
    for day in &day_batch {
        let mut groups = day_project_map.remove(day).unwrap_or_default();
        groups.sort_by(|a, b| {
            let a_first = a.sessions.first().map(|s| s.started_at).unwrap_or(0);
            let b_first = b.sessions.first().map(|s| s.started_at).unwrap_or(0);
            b_first.cmp(&a_first)
        });
        let session_count = groups.iter().map(|g| g.session_count).sum();
        let turn_count = groups.iter().map(|g| g.turn_count).sum();
        let token_count = groups.iter().map(|g| g.token_count).sum();
        day_events.push(DayEvents {
            day: day.clone(),
            project_groups: groups,
            session_count,
            turn_count,
            token_count,
        });
    }

    Ok(EventsResult {
        days: day_events,
        next_cursor: if has_more { day_batch.last().cloned() } else { None },
    })
}

fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<SessionRow> {
    Ok(SessionRow {
        session_id: row.get(0)?,
        project: row.get(1)?,
        agent_name: row.get(2)?,
        started_at: row.get(3)?,
        ended_at: row.get(4)?,
        duration_ms: row.get(5)?,
        turns: row.get(6)?,
        tokens_input: row.get(7)?,
        tokens_output: row.get(8)?,
        tokens_cached: row.get(9)?,
        summary: row.get(10)?,
        summary_source: row.get(11)?,
        transcript_path: row.get(12)?,
        last_offset: row.get(13)?,
        ingested_at: row.get(14)?,
        model: row.get(15)?,
    })
}

pub fn session(conn: &Connection, session_id: &str) -> Result<Option<SessionDetail>, ApiError> {
    let row = conn
        .query_row(
            "SELECT session_id, project, agent_name, started_at, ended_at, duration_ms, \
                    turns, tokens_input, tokens_output, tokens_cached, summary, summary_source, \
                    transcript_path, last_offset, ingested_at, model \
             FROM sessions WHERE session_id = ?",
            [session_id],
            row_to_session,
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => ApiError::NotFound {
                kind: "session",
                name: session_id.to_string(),
            },
            other => ApiError::Internal(format!("session query: {other}")),
        });

    let session = match row {
        Ok(s) => s,
        Err(ApiError::NotFound { .. }) => return Ok(None),
        Err(e) => return Err(e),
    };

    let mut tool_stmt = conn
        .prepare("SELECT session_id, tool_name, call_count FROM session_tools WHERE session_id = ?")
        .map_err(|e| ApiError::Internal(format!("prepare tools: {e}")))?;
    let tools: Vec<SessionTool> = tool_stmt
        .query_map([session_id], |row| {
            Ok(SessionTool {
                session_id: row.get(0)?,
                tool_name: row.get(1)?,
                call_count: row.get(2)?,
            })
        })
        .map_err(|e| ApiError::Internal(format!("query tools: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect tools: {e}")))?;

    let mut skill_stmt = conn
        .prepare("SELECT session_id, skill_name FROM session_skills WHERE session_id = ?")
        .map_err(|e| ApiError::Internal(format!("prepare skills: {e}")))?;
    let skills: Vec<SessionSkill> = skill_stmt
        .query_map([session_id], |row| {
            Ok(SessionSkill {
                session_id: row.get(0)?,
                skill_name: row.get(1)?,
            })
        })
        .map_err(|e| ApiError::Internal(format!("query skills: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect skills: {e}")))?;

    Ok(Some(SessionDetail { session, tools, skills }))
}

pub fn projects(conn: &Connection) -> Result<Vec<String>, ApiError> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT project FROM sessions WHERE TRIM(project) <> '' ORDER BY project")
        .map_err(|e| ApiError::Internal(format!("prepare projects: {e}")))?;
    let rows: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| ApiError::Internal(format!("query projects: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect projects: {e}")))?;
    Ok(rows)
}

pub fn years(conn: &Connection) -> Result<Vec<i64>, ApiError> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT CAST(strftime('%Y', started_at / 1000, 'unixepoch') AS INTEGER) AS year \
             FROM sessions ORDER BY year",
        )
        .map_err(|e| ApiError::Internal(format!("prepare years: {e}")))?;
    let rows: Vec<i64> = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| ApiError::Internal(format!("query years: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect years: {e}")))?;
    Ok(rows)
}

pub fn status(conn: &Connection) -> Result<TimelineStatus, ApiError> {
    let session_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
        .map_err(|e| ApiError::Internal(format!("status count: {e}")))?;

    let last_sync_at: Option<i64> = conn
        .query_row("SELECT value FROM meta WHERE key = 'last_sync_at'", [], |row| {
            let v: String = row.get(0)?;
            Ok(v.parse::<i64>().ok())
        })
        .optional()
        .map_err(|e| ApiError::Internal(format!("status meta: {e}")))?
        .flatten();

    Ok(TimelineStatus {
        session_count,
        last_sync_at,
    })
}

use rusqlite::OptionalExtension;

/// Open the timeline database at the given path. Returns an `Io` error if the
/// file does not exist (we never create it — the dashboard plugin owns
/// schema + writes; this crate is read-only).
pub fn open_db(path: &std::path::Path) -> Result<Connection, ApiError> {
    if !path.exists() {
        return Err(ApiError::Io(format!("timeline db not found at {}", path.display())));
    }
    let conn = Connection::open(path).map_err(|e| ApiError::Internal(format!("open db: {e}")))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| ApiError::Internal(format!("set wal: {e}")))?;
    Ok(conn)
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
        assert_eq!(
            result[0],
            HeatmapPoint {
                date: "2026-01-01".into(),
                value: 2
            }
        );
        assert_eq!(
            result[1],
            HeatmapPoint {
                date: "2026-01-02".into(),
                value: 0
            }
        );
        assert_eq!(
            result[2],
            HeatmapPoint {
                date: "2026-01-03".into(),
                value: 1
            }
        );
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

    use super::test_db::{insert_skill, insert_tool};

    fn seeded_events_db() -> Connection {
        let conn = empty_db();
        // Day 2026-01-03: proj-a (2 sessions), proj-b (1 session)
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-03") + 1000, 5, 100, 0, 0);
        insert_session(&conn, "s2", "proj-a", date_ms("2026-01-03") + 2000, 3, 50, 0, 0);
        insert_session(&conn, "s3", "proj-b", date_ms("2026-01-03") + 3000, 7, 200, 0, 0);
        insert_tool(&conn, "s1", "Read", 4);
        insert_tool(&conn, "s2", "Bash", 2);
        insert_skill(&conn, "s1", "investigate");
        insert_skill(&conn, "s3", "qa");
        // Day 2026-01-04: one session in proj-a
        insert_session(&conn, "s4", "proj-a", date_ms("2026-01-04") + 1000, 1, 10, 0, 0);
        conn
    }

    #[test]
    fn events_groups_sessions_by_day_then_project() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: None,
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(res.days.len(), 2);
        // Days newest first
        assert_eq!(res.days[0].day, "2026-01-04");
        assert_eq!(res.days[1].day, "2026-01-03");
        // 01-03 has two project groups
        let day3 = &res.days[1];
        assert_eq!(day3.project_groups.len(), 2);
        // proj-b's first session started at +3000ms, proj-a's first started at +2000ms
        // (sessions ordered DESC); proj-b sorts first.
        assert_eq!(day3.project_groups[0].project, "proj-b");
        assert_eq!(day3.project_groups[1].project, "proj-a");
        // proj-a aggregates
        let proj_a = &day3.project_groups[1];
        assert_eq!(proj_a.session_count, 2);
        assert_eq!(proj_a.turn_count, 8); // 5 + 3
        assert_eq!(proj_a.token_count, 150);
        assert_eq!(proj_a.tool_count, 6); // 4 (s1 Read) + 2 (s2 Bash)
        assert_eq!(proj_a.skill_count, 1); // s1 investigate
    }

    #[test]
    fn events_project_filter_excludes_other_projects() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: Some("proj-b".into()),
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        // Only proj-b sessions exist on 2026-01-03; nothing on 01-04.
        assert_eq!(res.days.len(), 1);
        assert_eq!(res.days[0].day, "2026-01-03");
        assert_eq!(res.days[0].project_groups.len(), 1);
        assert_eq!(res.days[0].project_groups[0].project, "proj-b");
    }

    #[test]
    fn events_pagination_emits_next_cursor_when_more_days_exist() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: None,
                limit: Some(1),
                cursor: None,
            },
        )
        .unwrap();
        assert_eq!(res.days.len(), 1);
        assert_eq!(res.days[0].day, "2026-01-04");
        assert_eq!(res.next_cursor.as_deref(), Some("2026-01-04"));

        let page2 = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: None,
                limit: Some(1),
                cursor: Some("2026-01-04".into()),
            },
        )
        .unwrap();
        assert_eq!(page2.days.len(), 1);
        assert_eq!(page2.days[0].day, "2026-01-03");
        assert_eq!(page2.next_cursor, None);
    }

    #[test]
    fn events_returns_empty_when_no_sessions_match() {
        let conn = empty_db();
        let res = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: None,
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        assert!(res.days.is_empty());
        assert!(res.next_cursor.is_none());
    }

    use super::test_db::set_meta;

    #[test]
    fn session_returns_row_with_tools_and_skills() {
        let conn = empty_db();
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-01"), 5, 100, 50, 25);
        insert_tool(&conn, "s1", "Read", 3);
        insert_tool(&conn, "s1", "Bash", 1);
        insert_skill(&conn, "s1", "investigate");

        let detail = session(&conn, "s1").unwrap().expect("session present");
        assert_eq!(detail.session.session_id, "s1");
        assert_eq!(detail.tools.len(), 2);
        assert!(detail.tools.iter().any(|t| t.tool_name == "Read" && t.call_count == 3));
        assert_eq!(detail.skills.len(), 1);
        assert_eq!(detail.skills[0].skill_name, "investigate");
    }

    #[test]
    fn session_returns_none_when_id_absent() {
        let conn = empty_db();
        assert!(session(&conn, "nope").unwrap().is_none());
    }

    #[test]
    fn projects_returns_distinct_sorted() {
        let conn = empty_db();
        insert_session(&conn, "s0", "", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s4", "   ", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s1", "z-proj", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "a-proj", date_ms("2026-01-02"), 1, 0, 0, 0);
        insert_session(&conn, "s3", "a-proj", date_ms("2026-01-03"), 1, 0, 0, 0);
        let ps = projects(&conn).unwrap();
        assert_eq!(ps, vec!["a-proj", "z-proj"]);
    }

    #[test]
    fn years_returns_distinct_ascending() {
        let conn = empty_db();
        insert_session(&conn, "s1", "p", date_ms("2024-06-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "p", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s3", "p", date_ms("2025-12-31"), 1, 0, 0, 0);
        let ys = years(&conn).unwrap();
        assert_eq!(ys, vec![2024, 2025, 2026]);
    }

    #[test]
    fn status_reports_count_and_meta_last_sync() {
        let conn = empty_db();
        insert_session(&conn, "s1", "p", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "p", date_ms("2026-01-02"), 1, 0, 0, 0);
        set_meta(&conn, "last_sync_at", "1700000000000");
        let s = status(&conn).unwrap();
        assert_eq!(s.session_count, 2);
        assert_eq!(s.last_sync_at, Some(1_700_000_000_000));
    }

    #[test]
    fn status_returns_none_when_meta_missing() {
        let conn = empty_db();
        let s = status(&conn).unwrap();
        assert_eq!(s.session_count, 0);
        assert_eq!(s.last_sync_at, None);
    }

    #[test]
    fn open_db_creates_a_readable_connection() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("timeline.db");
        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute_batch(test_db::SCHEMA_SQL).unwrap();
        }
        let conn = open_db(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn open_db_errors_when_path_does_not_exist() {
        let err = open_db(std::path::Path::new("/nonexistent/path/timeline.db")).unwrap_err();
        match err {
            ApiError::Io(_) => {}
            other => panic!("expected Io error, got {other:?}"),
        }
    }
}
