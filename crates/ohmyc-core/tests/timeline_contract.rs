//! Slice-2 contract test: assert ohmyc-core::timeline produces JSON
//! identical (after the comparable-projection step) to the fixtures
//! under tests/fixtures/timeline-contract/expected/.

use std::path::PathBuf;

use ohmyc_core::timeline::{
    self, EventsQuery, HeatmapQuery, Metric,
};
use rusqlite::Connection;
use serde_json::{json, Value};

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn load_seed_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    let sql = std::fs::read_to_string(
        workspace_root().join("tests/fixtures/timeline-contract/seed.sql"),
    )
    .unwrap();
    conn.execute_batch(&sql).unwrap();
    conn
}

fn expected(name: &str) -> Value {
    let path = workspace_root().join(format!("tests/fixtures/timeline-contract/expected/{name}"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn heatmap_tokens_matches_fixture() {
    let conn = load_seed_db();
    let data = timeline::heatmap(
        &conn,
        HeatmapQuery {
            from: "2026-01-01".into(),
            to: "2026-01-03".into(),
            metric: Metric::Tokens,
            project: None,
        },
    )
    .unwrap();
    let actual = json!({ "data": data });
    assert_eq!(actual, expected("heatmap-tokens.json"));
}

#[test]
fn years_matches_fixture() {
    let conn = load_seed_db();
    let years = timeline::years(&conn).unwrap();
    assert_eq!(json!({ "years": years }), expected("years.json"));
}

#[test]
fn projects_matches_fixture() {
    let conn = load_seed_db();
    let projects = timeline::projects(&conn).unwrap();
    assert_eq!(json!({ "projects": projects }), expected("projects.json"));
}

#[test]
fn status_matches_fixture() {
    let conn = load_seed_db();
    let s = timeline::status(&conn).unwrap();
    let actual = json!({
        "sessionCount": s.session_count,
        "lastSyncAt": s.last_sync_at,
    });
    assert_eq!(actual, expected("status.json"));
}

#[test]
fn events_aggregates_match_fixture() {
    let conn = load_seed_db();
    let result = timeline::events(
        &conn,
        EventsQuery { from: None, to: None, project: None, limit: None, cursor: None },
    )
    .unwrap();

    let days: Vec<Value> = result
        .days
        .into_iter()
        .map(|d| {
            let groups: Vec<Value> = d
                .project_groups
                .into_iter()
                .map(|g| {
                    json!({
                        "project": g.project,
                        "sessionCount": g.session_count,
                        "turnCount": g.turn_count,
                        "tokenCount": g.token_count,
                        "toolCount": g.tool_count,
                        "skillCount": g.skill_count,
                        "agents": g.agents,
                    })
                })
                .collect();
            json!({
                "day": d.day,
                "projectGroups": groups,
                "sessionCount": d.session_count,
                "turnCount": d.turn_count,
                "tokenCount": d.token_count,
            })
        })
        .collect();

    let actual = json!({ "days": days });
    assert_eq!(actual, expected("events-page1.json"));
}
