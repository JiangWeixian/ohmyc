//! Tauri command wrappers for ohmyc-core::timeline. All commands open and
//! close the SQLite connection per call — keeps state simple and avoids
//! locking the WAL across calls.

use std::path::PathBuf;

use ohmyc_core::error::ApiError;
use ohmyc_core::timeline::{
    self, EventsQuery, EventsResult, HeatmapPoint, HeatmapQuery, Metric, ProjectGroup,
    SessionDetail, TimelineStatus,
};
use serde::Serialize;

fn db_path() -> Result<PathBuf, ApiError> {
    timeline::default_db_path()
}

#[derive(Serialize)]
pub struct HeatmapResponse {
    pub data: Vec<HeatmapPoint>,
}

#[tauri::command]
pub fn timeline_heatmap(
    from: i64,
    to: i64,
    metric: String,
    project: Option<String>,
) -> Result<HeatmapResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    let data = timeline::heatmap(
        &conn,
        HeatmapQuery {
            from: ms_to_date(from),
            to: ms_to_date(to),
            metric: Metric::parse(&metric)?,
            project,
        },
    )?;
    Ok(HeatmapResponse { data })
}

#[tauri::command]
pub fn timeline_events(
    from: Option<i64>,
    to: Option<i64>,
    project: Option<String>,
    limit: Option<i64>,
    cursor: Option<String>,
) -> Result<EventsResult, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::events(
        &conn,
        EventsQuery {
            from: from.map(ms_to_date),
            to: to.map(ms_to_date),
            project,
            limit,
            cursor,
        },
    )
}

#[tauri::command]
pub fn timeline_session(id: String) -> Result<Option<SessionDetail>, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::session(&conn, &id)
}

#[derive(Serialize)]
pub struct ProjectsResponse {
    pub projects: Vec<String>,
}

#[tauri::command]
pub fn timeline_projects() -> Result<ProjectsResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    Ok(ProjectsResponse { projects: timeline::projects(&conn)? })
}

#[derive(Serialize)]
pub struct YearsResponse {
    pub years: Vec<i64>,
}

#[tauri::command]
pub fn timeline_years() -> Result<YearsResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    Ok(YearsResponse { years: timeline::years(&conn)? })
}

#[tauri::command]
pub fn timeline_status() -> Result<TimelineStatus, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::status(&conn)
}

#[allow(dead_code)]
fn _project_group_used(_: ProjectGroup) {}

fn ms_to_date(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let dt = Utc.timestamp_millis_opt(ms).single().expect("valid ms");
    dt.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ms_to_date_converts_utc_midnight() {
        assert_eq!(ms_to_date(1_767_225_600_000), "2026-01-01");
    }
}
