//! Test-only helpers — build a SQLite database in-memory and pre-seed
//! it with the schema and rows the timeline tests need.

use rusqlite::{params, Connection};

pub const SCHEMA_SQL: &str = "
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
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);
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

/// Open an in-memory DB with the schema applied. Tests fill rows themselves.
pub fn empty_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    conn.execute_batch(SCHEMA_SQL).expect("apply schema");
    conn
}

/// Insert one session row. Pass `0` for any field you don't care about.
#[allow(clippy::too_many_arguments)]
pub fn insert_session(
    conn: &Connection,
    session_id: &str,
    project: &str,
    started_at_ms: i64,
    turns: i64,
    tokens_input: i64,
    tokens_output: i64,
    tokens_cached: i64,
) {
    conn.execute(
        "INSERT INTO sessions (
            session_id, project, agent_name, started_at, ended_at, duration_ms,
            turns, tokens_input, tokens_output, tokens_cached,
            summary, summary_source, transcript_path, last_offset, ingested_at, model
        ) VALUES (?1, ?2, NULL, ?3, ?3, 0, ?4, ?5, ?6, ?7, NULL, 'auto', '/tmp/t.jsonl', 0, ?3, NULL)",
        params![session_id, project, started_at_ms, turns, tokens_input, tokens_output, tokens_cached],
    )
    .expect("insert session");
}

/// Insert a (session, tool, count) row.
pub fn insert_tool(conn: &Connection, session_id: &str, tool_name: &str, call_count: i64) {
    conn.execute(
        "INSERT INTO session_tools (session_id, tool_name, call_count) VALUES (?1, ?2, ?3)",
        params![session_id, tool_name, call_count],
    )
    .expect("insert tool");
}

/// Insert a (session, skill) row.
pub fn insert_skill(conn: &Connection, session_id: &str, skill_name: &str) {
    conn.execute(
        "INSERT INTO session_skills (session_id, skill_name) VALUES (?1, ?2)",
        params![session_id, skill_name],
    )
    .expect("insert skill");
}

/// Set a meta key/value pair (used for last_sync_at).
pub fn set_meta(conn: &Connection, key: &str, value: &str) {
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .expect("set meta");
}

/// Convert a `YYYY-MM-DD` date string to UTC midnight milliseconds.
/// Mirrors the JS `Date.UTC(...)` calls in `use-timeline.ts`.
pub fn date_ms(date: &str) -> i64 {
    let y: i32 = date[0..4].parse().expect("year");
    let m: u32 = date[5..7].parse().expect("month");
    let d: u32 = date[8..10].parse().expect("day");
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
    let nd = NaiveDate::from_ymd_opt(y, m, d).expect("valid date");
    let ndt = NaiveDateTime::new(nd, NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    Utc.from_utc_datetime(&ndt).timestamp_millis()
}
