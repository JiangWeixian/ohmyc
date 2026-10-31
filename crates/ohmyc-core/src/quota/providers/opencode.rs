//! OpenCode Go (opencode's subscription product: Go $10/mo, Go Plus $40/mo).
//!
//! - Endpoint: `GET {base}/zen/go/v1/usage`, default base
//!   `https://opencode.ai` (override `OHMYC_QUOTA_OPENCODE_BASE_URL`).
//!   Headers: `authorization: Bearer`, `accept: application/json`.
//!   The endpoint is **first-party but undocumented**: shipped 2026-08 for
//!   opencode's own product, adopted by CodexBar as the preferred Go data
//!   source — hence `Provenance::OfficialEndpoint`, unlike the reverse-
//!   engineered providers. (A pre-2026-08 cookie/dashboard scraping fallback
//!   exists in other tools; the API superseded it and is not implemented
//!   here.)
//! - Credentials: env `OPENCODE_API_KEY` → `<xdg-data>/opencode/auth.json`
//!   (`opencode-go` entry, `opencode` fallback). No expiry field exists, so
//!   401/403 → TokenExpired is the only staleness signal.
//! - Three windows: rolling 5h (20% of the monthly cap), weekly (50%),
//!   monthly (100%, anchored to the billing cycle).
//! - **Trap: `percent` is a 0–100 percentage, NOT a 0–1 fraction** (CodexBar
//!   explicitly warns about this). Do not multiply. A non-"ok" `status`
//!   means the number is unreliable → `used_percent: None` (honest empty).
//!   Monthly `resetsAt` may be absent → `resets_at: None`.

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http;
use crate::quota::types::{Provenance, QuotaProvider, SnapshotStatus, UsageSnapshot, UsageWindow, WindowKind};

const DEFAULT_BASE_URL: &str = "https://opencode.ai";
const SESSION_WINDOW_SECONDS: u64 = 18000;
const WEEKLY_WINDOW_SECONDS: u64 = 604800;

#[derive(Debug, Default)]
pub struct OpenCodeGoQuota;

impl OpenCodeGoQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::opencode_go() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => return with_status(SnapshotStatus::NotLoggedIn),
            CredentialOutcome::Expired => return with_status(SnapshotStatus::TokenExpired),
        };
        let url = format!(
            "{}/zen/go/v1/usage",
            super::base_url("OHMYC_QUOTA_OPENCODE_BASE_URL", DEFAULT_BASE_URL)
        );
        let auth = format!("Bearer {token}");
        let headers = [("authorization", auth.as_str()), ("accept", "application/json")];
        let mut snapshot = super::finish(
            QuotaProvider::OpenCodeGo,
            http::get_json(&url, &headers, http::DEFAULT_TIMEOUT),
            parse_response,
        );
        snapshot.provenance = Provenance::OfficialEndpoint;
        snapshot
    }
}

/// First-party (but undocumented) endpoint — every snapshot from this
/// provider, including failure states, reports `OfficialEndpoint` rather
/// than the `Experimental` default used by the reverse-engineered providers.
fn with_status(status: SnapshotStatus) -> UsageSnapshot {
    let mut snapshot = UsageSnapshot::with_status(QuotaProvider::OpenCodeGo, status);
    snapshot.provenance = Provenance::OfficialEndpoint;
    snapshot
}

#[derive(Debug, Deserialize)]
struct OpenCodeUsageResponse {
    usage: Option<OpenCodeUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenCodeUsage {
    rolling: Option<Window>,
    weekly: Option<Window>,
    monthly: Option<Window>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Window {
    status: Option<String>,
    /// 0–100 percentage (NOT a 0–1 fraction).
    percent: Option<f64>,
    resets_at: Option<String>,
}

fn map_window(
    source: &Option<Window>,
    kind: WindowKind,
    label: &str,
    window_seconds: Option<u64>,
) -> Option<UsageWindow> {
    let window = source.as_ref()?;
    Some(UsageWindow {
        kind,
        label: label.to_string(),
        // Non-"ok" status → the reported percent is unreliable; stay honest.
        used_percent: match window.status.as_deref() {
            Some("ok") => window.percent.map(|p| p.clamp(0.0, 100.0)),
            _ => None,
        },
        resets_at: super::parse_rfc3339(window.resets_at.as_ref()),
        window_seconds,
        model: None,
    })
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: OpenCodeUsageResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse usage response: {e}"))?;
    let mut windows = Vec::new();
    if let Some(usage) = &response.usage {
        windows.extend(map_window(
            &usage.rolling,
            WindowKind::Session,
            "5h",
            Some(SESSION_WINDOW_SECONDS),
        ));
        windows.extend(map_window(
            &usage.weekly,
            WindowKind::Weekly,
            "Weekly",
            Some(WEEKLY_WINDOW_SECONDS),
        ));
        // Month length varies (billing-cycle anchored) → no fixed seconds.
        windows.extend(map_window(&usage.monthly, WindowKind::Monthly, "Monthly", None));
    }
    // The endpoint exposes no plan information; identity stays None.
    Ok(UsageSnapshot::ok(QuotaProvider::OpenCodeGo, windows, Vec::new(), None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/opencode_go_usage.json");

    fn opencode_env(home: &tempfile::TempDir) -> (EnvGuard, EnvGuard) {
        std::fs::write(
            home.path().join("auth.json"),
            r#"{"opencode-go":{"type":"api","key":"oc-test-key"}}"#,
        )
        .unwrap();
        (
            EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap()),
            EnvGuard::unset("OPENCODE_API_KEY"),
        )
    }

    #[test]
    fn fixture_maps_three_windows_with_plain_percentages() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert_eq!(snapshot.provider, QuotaProvider::OpenCodeGo);
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 3);

        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.label, "5h");
        assert_eq!(session.window_seconds, Some(18000));
        // `percent` is already 0–100: 4 stays 4.0, no fraction conversion.
        assert_eq!(session.used_percent, Some(4.0));
        assert_eq!(
            session.resets_at.map(|t| t.to_rfc3339()).as_deref(),
            Some("2026-08-13T16:27:38.287+00:00")
        );

        let weekly = &snapshot.windows[1];
        assert_eq!(weekly.kind, WindowKind::Weekly);
        assert_eq!(weekly.window_seconds, Some(604800));
        assert_eq!(weekly.used_percent, Some(3.0));

        let monthly = &snapshot.windows[2];
        assert_eq!(monthly.kind, WindowKind::Monthly);
        assert_eq!(monthly.window_seconds, None);
        assert_eq!(monthly.used_percent, Some(1.0));
        assert!(monthly.resets_at.is_some());

        assert!(snapshot.meters.is_empty());
        assert!(snapshot.identity.is_none());
    }

    #[test]
    fn non_ok_status_yields_unknown_percent() {
        let snapshot =
            parse_response(r#"{"usage":{"rolling":{"status":"stale","percent":87,"resetsAt":null}}}"#).unwrap();
        assert_eq!(snapshot.windows.len(), 1);
        assert_eq!(snapshot.windows[0].used_percent, None);
    }

    #[test]
    fn monthly_without_resets_at_is_allowed() {
        let snapshot = parse_response(r#"{"usage":{"monthly":{"status":"ok","percent":42}}}"#).unwrap();
        let monthly = &snapshot.windows[0];
        assert_eq!(monthly.kind, WindowKind::Monthly);
        assert_eq!(monthly.used_percent, Some(42.0));
        assert_eq!(monthly.resets_at, None);
    }

    #[test]
    fn fetch_marks_provenance_official_endpoint() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = opencode_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_OPENCODE_BASE_URL", &server.url);
        let snapshot = OpenCodeGoQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.provenance, Provenance::OfficialEndpoint);
        assert_eq!(snapshot.windows.len(), 3);
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = opencode_env(&home);
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_OPENCODE_BASE_URL", &server.url);
        let snapshot = OpenCodeGoQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }
}
