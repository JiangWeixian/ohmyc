//! Cursor subscription usage.
//!
//! - Endpoint: `POST {base}/aiserver.v1.DashboardService/GetCurrentPeriodUsage`
//!   with body `{}`, default base `https://api2.cursor.sh` (override
//!   `OHMYC_QUOTA_CURSOR_BASE_URL`). It's a Connect-RPC endpoint, so
//!   `connect-protocol-version: 1` is required.
//! - Credentials: two-level chain — `agent status --format json` from the
//!   Cursor CLI, then the IDE's `state.vscdb` read-only
//!   (see `crate::quota::credentials::cursor`). No expiry info is stored
//!   locally; a dead token surfaces as 401 → TokenExpired.
//! - Money fields (`totalSpend`, `includedSpend`, `remaining`, `limit`) are
//!   in **cents**; `billingCycleStart/End` are epoch **milliseconds** as
//!   strings.

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http;
use crate::quota::types::{
    MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const DEFAULT_BASE_URL: &str = "https://api2.cursor.sh";

#[derive(Debug, Default)]
pub struct CursorQuota;

impl CursorQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::cursor() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Cursor, SnapshotStatus::NotLoggedIn);
            }
            CredentialOutcome::Expired => {
                return UsageSnapshot::with_status(QuotaProvider::Cursor, SnapshotStatus::TokenExpired);
            }
        };
        let url = format!(
            "{}/aiserver.v1.DashboardService/GetCurrentPeriodUsage",
            super::base_url("OHMYC_QUOTA_CURSOR_BASE_URL", DEFAULT_BASE_URL)
        );
        let headers = [
            ("authorization", format!("Bearer {token}")),
            ("connect-protocol-version", "1".to_string()),
        ];
        let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
        super::finish(
            QuotaProvider::Cursor,
            http::post_json(&url, &header_refs, "{}", http::DEFAULT_TIMEOUT),
            parse_response,
        )
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CursorUsageResponse {
    /// Epoch milliseconds, as a string.
    billing_cycle_start: Option<String>,
    billing_cycle_end: Option<String>,
    plan_usage: Option<PlanUsage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanUsage {
    /// Remaining included spend, in cents.
    remaining: Option<f64>,
    total_percent_used: Option<f64>,
}

fn parse_epoch_millis(value: Option<&String>) -> Option<chrono::DateTime<chrono::Utc>> {
    value?
        .trim()
        .parse::<i64>()
        .ok()
        .and_then(chrono::DateTime::from_timestamp_millis)
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: CursorUsageResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse usage response: {e}"))?;

    let mut windows = Vec::new();
    let mut meters = Vec::new();

    let start = parse_epoch_millis(response.billing_cycle_start.as_ref());
    let end = parse_epoch_millis(response.billing_cycle_end.as_ref());
    let window_seconds = match (start, end) {
        (Some(start), Some(end)) => u64::try_from((end - start).num_seconds()).ok(),
        _ => None,
    };

    if let Some(plan) = &response.plan_usage {
        if plan.total_percent_used.is_some() || end.is_some() {
            windows.push(UsageWindow {
                kind: WindowKind::Monthly,
                label: "Monthly".to_string(),
                used_percent: plan.total_percent_used.map(|v| v.clamp(0.0, 100.0)),
                resets_at: end,
                window_seconds,
                model: None,
            });
        }
        if let Some(remaining_cents) = plan.remaining {
            meters.push(UsageMeter {
                label: "Remaining this cycle".to_string(),
                value: remaining_cents / 100.0,
                kind: MeterKind::Dollars,
                currency: Some("USD".to_string()),
            });
        }
    }

    Ok(UsageSnapshot::ok(QuotaProvider::Cursor, windows, meters, None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/cursor_usage.json");

    fn cursor_env(home: &tempfile::TempDir) -> (EnvGuard, EnvGuard) {
        // No agent binary, and a state.vscdb carrying a fake token.
        let db_path = home.path().join("state.vscdb");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)", [])
            .unwrap();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('cursorAuth/accessToken', 'cursor-at')",
            [],
        )
        .unwrap();
        drop(conn);
        (
            EnvGuard::set("OHMYC_QUOTA_CURSOR_AGENT", "/nonexistent/agent"),
            EnvGuard::set("OHMYC_QUOTA_CURSOR_STATE_DB", db_path.to_str().unwrap()),
        )
    }

    #[test]
    fn fixture_maps_monthly_window_and_remaining_meter() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 1);
        let window = &snapshot.windows[0];
        assert_eq!(window.kind, WindowKind::Monthly);
        assert_eq!(window.label, "Monthly");
        assert_eq!(window.used_percent, Some(76.15));
        assert_eq!(window.resets_at, chrono::DateTime::from_timestamp_millis(1780272000000));
        // billingCycleEnd - billingCycleStart in seconds.
        assert_eq!(window.window_seconds, Some(20_995_200));
        assert_eq!(snapshot.meters.len(), 1);
        assert_eq!(snapshot.meters[0].label, "Remaining this cycle");
        assert!((snapshot.meters[0].value - 4.77).abs() < 1e-9);
        assert_eq!(snapshot.meters[0].currency.as_deref(), Some("USD"));
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = cursor_env(&home);
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_CURSOR_BASE_URL", &server.url);
        let snapshot = CursorQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = cursor_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_CURSOR_BASE_URL", &server.url);
        let snapshot = CursorQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 1);
        assert_eq!(snapshot.meters.len(), 1);
    }
}
