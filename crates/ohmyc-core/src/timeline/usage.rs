//! Event-time tokens plus uncovered legacy session totals, independent of session counts.
use super::{HeatmapPoint, HeatmapQuery, TimelineSummary};
use crate::error::ApiError;
use chrono::{Local, NaiveDate, TimeZone};
use rusqlite::{params, Connection, OptionalExtension};

fn error(e: impl std::fmt::Display) -> ApiError {
    ApiError::Internal(format!("usage ledger: {e}"))
}

pub fn has_table(conn: &Connection, table: &str) -> Result<bool, ApiError> {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
        [table],
        |_| Ok(()),
    )
    .optional()
    .map(|row| row.is_some())
    .map_err(error)
}
pub fn incomplete(conn: &Connection) -> Result<i64, ApiError> {
    if !has_table(conn, "usage_event_coverage")? {
        return conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0))
            .map_err(error);
    }
    conn.query_row(&format!("SELECT COUNT(*) FROM sessions s WHERE NOT EXISTS (SELECT 1 FROM usage_event_coverage c WHERE c.session_id=s.session_id AND c.source=COALESCE(s.agent_name,'unknown') AND c.status='complete' AND c.reconciled_total=({}))", super::TOKEN_TOTAL_SQL), [], |r| r.get(0)).map_err(error)
}
const LEGACY_ONLY: &str = "NOT EXISTS (SELECT 1 FROM token_usage_events e WHERE e.session_id=s.session_id AND e.source=COALESCE(s.agent_name,'unknown'))";

fn tokens_in_ranges(conn: &Connection, from: i64, to: i64, legacy_from: i64, legacy_to: i64) -> Result<i64, ApiError> {
    let has_events = has_table(conn, "token_usage_events")?;
    let legacy_only = if has_events { LEGACY_ONLY } else { "1" };
    let legacy_sql = format!("SELECT COALESCE(SUM({}),0) AS value FROM sessions s WHERE s.started_at>=?3 AND s.started_at<?4 AND {legacy_only}", super::TOKEN_TOTAL_SQL);
    let sql = if has_events {
        format!("SELECT SUM(value) FROM (SELECT COALESCE(SUM(e.tokens_input+e.tokens_output+e.tokens_cached),0) AS value FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source WHERE e.occurred_at>=?1 AND e.occurred_at<?2 UNION ALL {legacy_sql})")
    } else {
        legacy_sql
    };
    conn.query_row(&sql, params![from, to, legacy_from, legacy_to], |r| r.get(0))
        .map_err(error)
}

pub fn tokens(conn: &Connection, from: i64, to: i64) -> Result<i64, ApiError> {
    tokens_in_ranges(conn, from, to, from, to)
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
    if first >= last {
        return Err(ApiError::InvalidInput("summary requires from <= to".into()));
    }
    Ok(TimelineSummary {
        sessions: super::session_count(conn, super::date_to_utc_ms(first), super::date_to_utc_ms(last))?,
        tokens: tokens_in_ranges(
            conn,
            local_midnight(first)?,
            local_midnight(last)?,
            super::date_to_utc_ms(first),
            super::date_to_utc_ms(last),
        )?,
    })
}

pub fn event_sessions(conn: &Connection, q: &HeatmapQuery) -> Result<Vec<HeatmapPoint>, ApiError> {
    let dates = super::generate_date_range(&q.from, &q.to)?;
    if dates.is_empty() || !has_table(conn, "token_usage_events")? {
        return Ok(dates.into_iter().map(|date| HeatmapPoint { date, value: 0 }).collect());
    }
    let from = local_midnight(super::parse_ymd(&q.from)?)?;
    let to = local_midnight(
        super::parse_ymd(&q.to)?
            .succ_opt()
            .ok_or_else(|| error("date overflow"))?,
    )?;
    let mut stmt = conn.prepare("SELECT date(e.occurred_at/1000,'unixepoch','localtime') AS day,COUNT(DISTINCT e.session_id) FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source WHERE e.occurred_at>=?1 AND e.occurred_at<?2 AND (?3 IS NULL OR s.project=?3) GROUP BY day").map_err(error)?;
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
    let legacy_from = super::date_to_utc_ms(super::parse_ymd(&q.from)?);
    let legacy_to = super::date_to_utc_ms(super::parse_ymd(&q.to)?) + 86400000;
    let has_events = has_table(conn, "token_usage_events")?;
    let legacy_only = if has_events { LEGACY_ONLY } else { "1" };
    let legacy_sql = format!("SELECT date(s.started_at/1000,'unixepoch') AS day,SUM({}) AS value FROM sessions s WHERE s.started_at>=?3 AND s.started_at<?4 AND (?5 IS NULL OR s.project=?5) AND {legacy_only} GROUP BY day", super::TOKEN_TOTAL_SQL);
    let sql = if has_events {
        format!("SELECT day,SUM(value) FROM (SELECT date(e.occurred_at/1000,'unixepoch','localtime') AS day,SUM(e.tokens_input+e.tokens_output+e.tokens_cached) AS value FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source WHERE e.occurred_at>=?1 AND e.occurred_at<?2 AND (?5 IS NULL OR s.project=?5) GROUP BY day UNION ALL {legacy_sql}) GROUP BY day")
    } else {
        legacy_sql
    };
    let mut stmt = conn.prepare(&sql).map_err(error)?;
    let values = stmt
        .query_map(params![from, to, legacy_from, legacy_to, q.project], |r| {
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
    use crate::timeline::{summary, test_db, Metric};

    #[test]
    fn event_sessions_follow_event_days_without_changing_created_session_counts() {
        let conn = test_db::empty_db();
        let monday = local_midnight(NaiveDate::from_ymd_opt(2026, 9, 21).unwrap()).unwrap();
        test_db::insert_session(&conn, "old", "p", monday - 86400000, 1, 900, 0, 0);
        for id in ["zero", "missing", "partial"] {
            test_db::insert_session(&conn, id, "p", monday + 43200000, 0, 0, 0, 0);
        }
        test_db::insert_session(&conn, "other", "other", monday - 86400000, 1, 100, 0, 0);
        conn.execute_batch("CREATE TABLE token_usage_events(source TEXT,session_id TEXT,event_key TEXT,occurred_at INTEGER,tokens_input INTEGER,tokens_output INTEGER,tokens_cached INTEGER);").unwrap();
        conn.execute("INSERT INTO token_usage_events VALUES('unknown','old','a',?1,10,0,0),('unknown','old','b',?1,20,0,0),('unknown','zero','c',?1,0,0,0),('unknown','other','d',?1,100,0,0),('wrong-source','missing','e',?1,999,0,0),('unknown','orphan','f',?1,999,0,0)", [monday]).unwrap();
        conn.execute("INSERT INTO token_usage_events VALUES('unknown','old','before',?1,5,0,0),('unknown','old','after',?2,5,0,0)", params![monday - 1, monday + 86400000]).unwrap();
        for mode in [None, Some("session"), Some("events")] {
            conn.execute("DELETE FROM meta WHERE key='usage_mode'", []).unwrap();
            if let Some(mode) = mode {
                test_db::set_meta(&conn, "usage_mode", mode);
            }
            let points = crate::timeline::heatmap(
                &conn,
                HeatmapQuery {
                    from: "2026-09-20".into(),
                    to: "2026-09-23".into(),
                    metric: Metric::parse("event_sessions").unwrap(),
                    project: Some("p".into()),
                },
            )
            .unwrap();
            assert_eq!(
                points.iter().map(|p| p.value).collect::<Vec<_>>(),
                vec![1, 2, 1, 0],
                "mode {mode:?}"
            );
            assert_eq!(range(&conn, "2026-09-21", "2026-09-21").unwrap().sessions, 3);
        }
        conn.execute_batch("DROP TABLE token_usage_events").unwrap();
        let points = crate::timeline::heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-09-21".into(),
                to: "2026-09-21".into(),
                metric: Metric::parse("event_sessions").unwrap(),
                project: None,
            },
        )
        .unwrap();
        assert_eq!(points[0].value, 0);
        assert_eq!(range(&conn, "2026-09-21", "2026-09-21").unwrap().sessions, 3);
    }

    #[test]
    fn legacy_history_is_included_once_until_source_events_exist() {
        let conn = test_db::empty_db();
        let first = test_db::date_ms("2026-09-20") + 43200000;
        let second = first + 86400000;
        test_db::insert_session(&conn, "legacy", "p", first, 1, 100, 20, 30);
        test_db::insert_session(&conn, "codex", "p", first, 1, 100, 20, 80);
        conn.execute("UPDATE sessions SET agent_name='codex' WHERE session_id='codex'", [])
            .unwrap();
        test_db::insert_session(&conn, "resumed", "p", first, 1, 900, 0, 0);
        test_db::insert_session(&conn, "other", "other", first, 1, 1000, 0, 0);
        conn.execute_batch("CREATE TABLE token_usage_events(source TEXT,session_id TEXT,event_key TEXT,occurred_at INTEGER,tokens_input INTEGER,tokens_output INTEGER,tokens_cached INTEGER);").unwrap();
        conn.execute("INSERT INTO token_usage_events VALUES('unknown','resumed','a',?1,10,0,0),('unknown','resumed','b',?1,20,0,0),('wrong-source','legacy','ignored',?1,999,0,0)", [second]).unwrap();
        for mode in [None, Some("session"), Some("events")] {
            if let Some(mode) = mode {
                test_db::set_meta(&conn, "usage_mode", mode);
            }
            let q = HeatmapQuery {
                from: "2026-09-20".into(),
                to: "2026-09-21".into(),
                metric: Metric::Tokens,
                project: Some("p".into()),
            };
            assert_eq!(
                heatmap(&conn, &q).unwrap().iter().map(|p| p.value).collect::<Vec<_>>(),
                vec![270, 30]
            );
            assert_eq!(range(&conn, "2026-09-20", "2026-09-20").unwrap().tokens, 1270);
            assert_eq!(range(&conn, "2026-09-21", "2026-09-21").unwrap().tokens, 30);
        }
        conn.execute(
            "INSERT INTO token_usage_events VALUES('unknown','legacy','backfill',?1,100,20,30)",
            [second],
        )
        .unwrap();
        assert_eq!(range(&conn, "2026-09-20", "2026-09-21").unwrap().tokens, 1300);
        assert_eq!(range(&conn, "2026-09-20", "2026-09-20").unwrap().tokens, 1120);
    }

    #[test]
    fn date_summary_matches_session_calendar_boundaries() {
        let conn = test_db::empty_db();
        let start = test_db::date_ms("2026-09-21");
        let end = start + 86400000;
        for (id, at) in [("before", start - 1), ("start", start), ("last", end - 1), ("end", end)] {
            test_db::insert_session(&conn, id, "p", at, 0, 0, 0, 0);
        }
        let total = range(&conn, "2026-09-21", "2026-09-21").unwrap();
        let points = crate::timeline::heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-09-21".into(),
                to: "2026-09-21".into(),
                metric: Metric::Sessions,
                project: None,
            },
        )
        .unwrap();
        assert_eq!(total.sessions, 2);
        assert_eq!(points[0].value, total.sessions);
    }

    #[test]
    fn missing_event_tables_preserve_legacy_session_and_token_totals() {
        let conn = test_db::empty_db();
        test_db::insert_session(&conn, "s", "p", test_db::date_ms("2026-09-21"), 1, 999, 0, 0);
        for mode in [None, Some("session"), Some("events")] {
            if let Some(mode) = mode {
                test_db::set_meta(&conn, "usage_mode", mode);
            }
            assert_eq!(
                range(&conn, "2026-09-21", "2026-09-21").unwrap(),
                TimelineSummary {
                    sessions: 1,
                    tokens: 999
                }
            );
            let q = HeatmapQuery {
                from: "2026-09-21".into(),
                to: "2026-09-21".into(),
                metric: Metric::Sessions,
                project: None,
            };
            assert_eq!(crate::timeline::heatmap(&conn, q).unwrap()[0].value, 1);
            let q = HeatmapQuery {
                from: "2026-09-21".into(),
                to: "2026-09-21".into(),
                metric: Metric::Tokens,
                project: None,
            };
            assert_eq!(crate::timeline::heatmap(&conn, q).unwrap()[0].value, 999);
            assert_eq!(crate::timeline::status(&conn).unwrap().usage_incomplete, 1);
            assert_eq!(crate::timeline::status(&conn).unwrap().usage_mode, "events");
            assert_eq!(crate::timeline::years(&conn).unwrap(), vec![2026]);
        }
    }

    #[test]
    fn sessions_are_independent_of_events_and_legacy_mode() {
        let conn = test_db::empty_db();
        conn.execute_batch("CREATE TABLE token_usage_events(source TEXT,session_id TEXT,event_key TEXT,occurred_at INTEGER,tokens_input INTEGER,tokens_output INTEGER,tokens_cached INTEGER);").unwrap();
        let monday = local_midnight(NaiveDate::from_ymd_opt(2026, 9, 21).unwrap()).unwrap();
        test_db::insert_session(&conn, "old", "p", monday - 86400000, 1, 900, 0, 0);
        for id in ["zero", "missing", "partial"] {
            test_db::insert_session(&conn, id, "p", monday + 43200000, 0, 0, 0, 0);
        }
        conn.execute("INSERT INTO token_usage_events VALUES('unknown','old','a',?1,10,0,0),('unknown','old','b',?1,20,0,0),('unknown','partial','c',?1,5,0,0)", [monday + 43200000]).unwrap();
        for mode in [None, Some("session"), Some("events")] {
            conn.execute("DELETE FROM meta WHERE key='usage_mode'", []).unwrap();
            if let Some(mode) = mode {
                test_db::set_meta(&conn, "usage_mode", mode);
            }
            let total = crate::timeline::summary(&conn, monday, monday + 86400000).unwrap();
            assert_eq!(total.sessions, 3, "mode {mode:?}");
            assert_eq!(total.tokens, 35, "mode {mode:?}");
            let points = crate::timeline::heatmap(
                &conn,
                HeatmapQuery {
                    from: "2026-09-21".into(),
                    to: "2026-09-21".into(),
                    metric: Metric::Sessions,
                    project: Some("p".into()),
                },
            )
            .unwrap();
            assert_eq!(points[0].value, 3, "mode {mode:?}");
            assert_eq!(range(&conn, "2026-09-21", "2026-09-21").unwrap().sessions, 3);
            assert_eq!(crate::timeline::status(&conn).unwrap().usage_mode, "events");
        }
    }

    #[test]
    fn source_time_counts_cross_week_usage_once_and_ignores_legacy_mode() {
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
        test_db::set_meta(&conn, "usage_mode", "events");
        assert_eq!(summary(&conn, sunday, monday).unwrap().tokens, 90);
        assert_eq!(summary(&conn, sunday, monday + 86400000).unwrap().sessions, 1);
        assert_eq!(
            summary(&conn, monday, monday + 86400000).unwrap(),
            TimelineSummary {
                sessions: 0,
                tokens: 90
            }
        );
        assert_eq!(
            summary(&conn, monday + 86400000, monday + 172800000).unwrap(),
            TimelineSummary { sessions: 0, tokens: 0 }
        );
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
        test_db::set_meta(&conn, "usage_mode", "session");
        assert_eq!(crate::timeline::summary(&conn, sunday, monday).unwrap().tokens, 90);
        conn.execute_batch("UPDATE sessions SET tokens_output=30").unwrap();
        test_db::set_meta(&conn, "usage_mode", "events");
        assert_eq!(incomplete(&conn).unwrap(), 1);
        assert_eq!(summary(&conn, sunday, monday + 86400000).unwrap().tokens, 180);
    }
}
