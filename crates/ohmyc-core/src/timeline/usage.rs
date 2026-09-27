//! Additive usage ledger reader. Legacy session queries remain available.
use super::{HeatmapPoint, HeatmapQuery, Metric, TimelineSummary};
use crate::error::ApiError;
use chrono::{Local, NaiveDate, TimeZone};
use rusqlite::{params, Connection, OptionalExtension};

fn error(e: impl std::fmt::Display) -> ApiError {
    ApiError::Internal(format!("usage ledger: {e}"))
}

pub fn event_mode(conn: &Connection) -> bool {
    conn.query_row("SELECT value FROM meta WHERE key='usage_mode'", [], |r| {
        r.get::<_, String>(0)
    })
    .optional()
    .ok()
    .flatten()
    .as_deref()
        == Some("events")
}
pub fn set_mode(conn: &Connection, events: bool) -> Result<(), ApiError> {
    if events {
        conn.prepare("SELECT 1 FROM token_usage_events LIMIT 1")
            .map_err(error)?;
    }
    conn.execute(
        "INSERT INTO meta(key,value) VALUES('usage_mode',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [if events { "events" } else { "session" }],
    )
    .map_err(error)?;
    Ok(())
}
pub fn incomplete(conn: &Connection) -> Result<i64, ApiError> {
    if !event_mode(conn) {
        return Ok(0);
    }
    conn.query_row(&format!("SELECT COUNT(*) FROM sessions s WHERE NOT EXISTS (SELECT 1 FROM usage_event_coverage c WHERE c.session_id=s.session_id AND c.source=COALESCE(s.agent_name,'unknown') AND c.status='complete' AND c.reconciled_total=({}))", super::TOKEN_TOTAL_SQL), [], |r| r.get(0)).map_err(error)
}
pub fn summary(conn: &Connection, from: i64, to: i64) -> Result<TimelineSummary, ApiError> {
    conn.query_row("SELECT COUNT(DISTINCT e.session_id), COALESCE(SUM(e.tokens_input+e.tokens_output+e.tokens_cached),0) FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source WHERE e.occurred_at>=?1 AND e.occurred_at<?2", params![from,to], |r| Ok(TimelineSummary { sessions:r.get(0)?, tokens:r.get(1)? })).map_err(error)
}
pub fn local_midnight(date: NaiveDate) -> Result<i64, ApiError> {
    (0..1440)
        .find_map(|minute| {
            Local
                .from_local_datetime(&date.and_hms_opt(minute / 60, minute % 60, 0)?)
                .earliest()
        })
        .map(|dt| dt.timestamp_millis())
        .ok_or_else(|| error("local date has no valid time"))
}
pub fn range(conn: &Connection, from: &str, to: &str) -> Result<TimelineSummary, ApiError> {
    let first = super::parse_ymd(from)?;
    let last = super::parse_ymd(to)?.succ_opt().ok_or_else(|| error("date overflow"))?;
    if event_mode(conn) {
        super::summary(conn, local_midnight(first)?, local_midnight(last)?)
    } else {
        super::summary(conn, super::date_to_utc_ms(first), super::date_to_utc_ms(last))
    }
}
pub fn heatmap(conn: &Connection, q: &HeatmapQuery) -> Result<Vec<HeatmapPoint>, ApiError> {
    let dates = super::generate_date_range(&q.from, &q.to)?;
    if dates.is_empty() {
        return Ok(vec![]);
    }
    let from = local_midnight(super::parse_ymd(&q.from)?)?;
    let to = local_midnight(
        super::parse_ymd(&q.to)?
            .succ_opt()
            .ok_or_else(|| error("date overflow"))?,
    )?;
    let metric = match q.metric {
        Metric::Sessions => "COUNT(DISTINCT e.session_id)",
        _ => "SUM(e.tokens_input+e.tokens_output+e.tokens_cached)",
    };
    let mut stmt = conn.prepare(&format!("SELECT date(e.occurred_at/1000,'unixepoch','localtime') AS day,{metric} FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source WHERE e.occurred_at>=?1 AND e.occurred_at<?2 AND (?3 IS NULL OR s.project=?3) GROUP BY day")).map_err(error)?;
    let values = stmt
        .query_map(params![from, to, q.project], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        })
        .map_err(error)?
        .collect::<Result<std::collections::HashMap<_, _>, _>>()
        .map_err(error)?;
    Ok(dates
        .into_iter()
        .map(|date| HeatmapPoint {
            value: values.get(&date).copied().unwrap_or(0),
            date,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timeline::test_db;

    #[test]
    fn source_time_counts_cross_week_usage_once_and_legacy_mode_survives() {
        let conn = test_db::empty_db();
        conn.execute_batch("CREATE TABLE token_usage_events(source TEXT,session_id TEXT,event_key TEXT,occurred_at INTEGER,tokens_input INTEGER,tokens_output INTEGER,tokens_cached INTEGER);
        CREATE TABLE usage_event_coverage(source TEXT,session_id TEXT,status TEXT,reconciled_total INTEGER);").unwrap();
        let sunday = local_midnight(NaiveDate::from_ymd_opt(2026, 9, 20).unwrap()).unwrap();
        let monday = local_midnight(NaiveDate::from_ymd_opt(2026, 9, 21).unwrap()).unwrap();
        test_db::insert_session(&conn, "s", "p", sunday, 1, 100, 20, 60);
        conn.execute(
            "INSERT INTO token_usage_events VALUES('unknown','s','a',?1,50,10,30),('unknown','s','b',?2,50,10,30)",
            params![sunday, monday],
        )
        .unwrap();
        conn.execute_batch("INSERT INTO usage_event_coverage VALUES('unknown','s','complete',180)")
            .unwrap();
        set_mode(&conn, true).unwrap();
        assert_eq!(summary(&conn, sunday, monday).unwrap().tokens, 90);
        assert_eq!(summary(&conn, sunday, monday + 86400000).unwrap().sessions, 1);
        let q = HeatmapQuery {
            from: "2026-09-20".into(),
            to: "2026-09-21".into(),
            metric: Metric::Tokens,
            project: Some("p".into()),
        };
        assert_eq!(
            heatmap(&conn, &q).unwrap().iter().map(|p| p.value).collect::<Vec<_>>(),
            vec![90, 90]
        );
        assert_eq!(incomplete(&conn).unwrap(), 0);
        set_mode(&conn, false).unwrap();
        assert_eq!(crate::timeline::summary(&conn, sunday, monday).unwrap().tokens, 180);
        conn.execute_batch("UPDATE sessions SET tokens_output=30").unwrap();
        set_mode(&conn, true).unwrap();
        assert_eq!(incomplete(&conn).unwrap(), 1);
        assert_eq!(summary(&conn, sunday, monday + 86400000).unwrap().tokens, 180);
    }
}
