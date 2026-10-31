//! Claude (Claude Code subscription) usage.
//!
//! **Opt-in by default.** `GET /api/oauth/usage` is an undocumented endpoint
//! reached with the user's subscription OAuth token — a ToS gray area. The
//! on/off gate lives in the settings resolution layer (env >
//! `~/.config/ohmyc/settings.json` > default-off) and is applied by
//! `QuotaRegistry::fetch_all`: a disabled Claude is never fetched, so no
//! credential resolution and no HTTP happen while disabled.
//!
//! - Endpoint: `GET {base}/api/oauth/usage`, default base
//!   `https://api.anthropic.com` (override `OHMYC_QUOTA_CLAUDE_BASE_URL`).
//! - Headers: `authorization: Bearer`, `anthropic-beta: oauth-2025-04-20`,
//!   `user-agent: claude-code/2.1.80` — the UA is load-bearing: without it the
//!   endpoint buckets you into aggressive rate limiting —
//!   `content-type: application/json`.
//! - Credentials: `CLAUDE_CODE_OAUTH_TOKEN` env → macOS Keychain
//!   (`Claude Code-credentials`) → `~/.claude/.credentials.json`
//!   (see `crate::quota::credentials::claude`). 401/403 → TokenExpired,
//!   429 → RateLimited.
//! - Known server bug: `utilization` can exceed 101. Values >101 are treated
//!   as unknown (`used_percent: None`); 100–101 clamp to 100.

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http;
use crate::quota::types::{
    MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const SESSION_WINDOW_SECONDS: u64 = 18000;
const WEEKLY_WINDOW_SECONDS: u64 = 604800;

#[derive(Debug, Default)]
pub struct ClaudeQuota;

impl ClaudeQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::claude() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Claude, SnapshotStatus::NotLoggedIn);
            }
            CredentialOutcome::Expired => {
                return UsageSnapshot::with_status(QuotaProvider::Claude, SnapshotStatus::TokenExpired);
            }
        };
        let url = format!(
            "{}/api/oauth/usage",
            super::base_url("OHMYC_QUOTA_CLAUDE_BASE_URL", DEFAULT_BASE_URL)
        );
        let headers = [
            ("authorization", format!("Bearer {token}")),
            ("anthropic-beta", "oauth-2025-04-20".to_string()),
            ("user-agent", "claude-code/2.1.80".to_string()),
            ("content-type", "application/json".to_string()),
        ];
        let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
        super::finish(
            QuotaProvider::Claude,
            http::get_json(&url, &header_refs, http::DEFAULT_TIMEOUT),
            parse_response,
        )
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeUsageResponse {
    five_hour: Option<UtilizationWindow>,
    seven_day: Option<UtilizationWindow>,
    seven_day_opus: Option<UtilizationWindow>,
    seven_day_sonnet: Option<UtilizationWindow>,
    extra_usage: Option<ExtraUsage>,
}

#[derive(Debug, Deserialize)]
struct UtilizationWindow {
    utilization: Option<f64>,
    resets_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ExtraUsage {
    is_enabled: Option<bool>,
    monthly_limit: Option<f64>,
    used_credits: Option<f64>,
}

/// Defend against the known `utilization > 100` server bug: >101 means the
/// number is garbage (report honestly as unknown); 100–101 clamps to 100.
fn sanitize_utilization(utilization: Option<f64>) -> Option<f64> {
    let value = utilization?;
    if value > 101.0 {
        None
    } else {
        Some(value.clamp(0.0, 100.0))
    }
}

fn map_window(
    source: &Option<UtilizationWindow>,
    kind: WindowKind,
    label: &str,
    window_seconds: u64,
    model: Option<&str>,
) -> Option<UsageWindow> {
    source.as_ref().map(|w| UsageWindow {
        kind,
        label: label.to_string(),
        used_percent: sanitize_utilization(w.utilization),
        resets_at: super::parse_rfc3339(w.resets_at.as_ref()),
        window_seconds: Some(window_seconds),
        model: model.map(ToOwned::to_owned),
    })
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: ClaudeUsageResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse usage response: {e}"))?;
    let mut windows = Vec::new();
    windows.extend(map_window(
        &response.five_hour,
        WindowKind::Session,
        "5h",
        SESSION_WINDOW_SECONDS,
        None,
    ));
    windows.extend(map_window(
        &response.seven_day,
        WindowKind::Weekly,
        "Weekly",
        WEEKLY_WINDOW_SECONDS,
        None,
    ));
    windows.extend(map_window(
        &response.seven_day_opus,
        WindowKind::Weekly,
        "Weekly",
        WEEKLY_WINDOW_SECONDS,
        Some("opus"),
    ));
    windows.extend(map_window(
        &response.seven_day_sonnet,
        WindowKind::Weekly,
        "Weekly",
        WEEKLY_WINDOW_SECONDS,
        Some("sonnet"),
    ));

    let mut meters = Vec::new();
    if let Some(extra) = &response.extra_usage {
        if extra.is_enabled.unwrap_or(false) {
            if let Some(used) = extra.used_credits {
                meters.push(UsageMeter {
                    label: "Extra usage".to_string(),
                    value: used,
                    kind: MeterKind::Dollars,
                    currency: Some("USD".to_string()),
                });
            }
            if let Some(limit) = extra.monthly_limit {
                meters.push(UsageMeter {
                    label: "Extra usage limit".to_string(),
                    value: limit,
                    kind: MeterKind::Dollars,
                    currency: Some("USD".to_string()),
                });
            }
        }
    }

    Ok(UsageSnapshot::ok(QuotaProvider::Claude, windows, meters, None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/claude_usage.json");

    /// Point every *other* provider's credential lookup at an empty home so a
    /// stray developer env cannot influence provider tests. Also opts Claude
    /// polling in — the network tests below exercise the enabled path.
    fn claude_env(home: &tempfile::TempDir) -> (EnvGuard, EnvGuard, EnvGuard) {
        (
            EnvGuard::set("OHMYC_QUOTA_CLAUDE_HOME", home.path().to_str().unwrap()),
            EnvGuard::unset("CLAUDE_CODE_OAUTH_TOKEN"),
            EnvGuard::set("OHMYC_QUOTA_CLAUDE_ENABLED", "1"),
        )
    }

    fn write_claude_credentials(home: &tempfile::TempDir) {
        let expires_at = chrono::Utc::now().timestamp_millis() + 3_600_000;
        std::fs::write(
            home.path().join(".credentials.json"),
            format!(r#"{{"claudeAiOauth":{{"accessToken":"sk-ant-test","expiresAt":{expires_at}}}}}"#),
        )
        .unwrap();
    }

    #[test]
    fn fixture_maps_windows_and_meters() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert_eq!(snapshot.provider, QuotaProvider::Claude);
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        // Sorted: 5h session first, then the weekly windows.
        assert_eq!(snapshot.windows.len(), 3);
        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.label, "5h");
        assert_eq!(session.window_seconds, Some(18000));
        assert_eq!(session.used_percent, Some(42.0));
        assert!(session.resets_at.is_some());
        let weekly = &snapshot.windows[1];
        assert_eq!(weekly.kind, WindowKind::Weekly);
        assert_eq!(weekly.window_seconds, Some(604800));
        assert_eq!(weekly.model, None);
        // seven_day_opus is null in the fixture → skipped; sonnet kept.
        let sonnet = &snapshot.windows[2];
        assert_eq!(sonnet.model.as_deref(), Some("sonnet"));
        assert_eq!(sonnet.used_percent, Some(5.0));
        // extra_usage meters (USD).
        assert_eq!(snapshot.meters.len(), 2);
        assert_eq!(snapshot.meters[0].label, "Extra usage");
        assert_eq!(snapshot.meters[0].value, 7.25);
        assert_eq!(snapshot.meters[0].kind, MeterKind::Dollars);
        assert_eq!(snapshot.meters[0].currency.as_deref(), Some("USD"));
        assert_eq!(snapshot.meters[1].value, 50.0);
    }

    #[test]
    fn utilization_above_101_is_unknown_and_100_to_101_clamps() {
        let snapshot = parse_response(
            r#"{"five_hour":{"utilization":137.0,"resets_at":null},
                "seven_day":{"utilization":100.7,"resets_at":null}}"#,
        )
        .unwrap();
        assert_eq!(snapshot.windows[0].used_percent, None);
        assert_eq!(snapshot.windows[1].used_percent, Some(100.0));
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_claude_credentials(&home);
        let _env = claude_env(&home);
        let server = MiniServer::respond(401, &[], r#"{"error":"unauthorized"}"#);
        let _base = EnvGuard::set("OHMYC_QUOTA_CLAUDE_BASE_URL", &server.url);
        let snapshot = ClaudeQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
        assert!(snapshot.windows.is_empty());
    }

    #[test]
    fn fetch_maps_429_to_rate_limited_with_retry_after() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_claude_credentials(&home);
        let _env = claude_env(&home);
        let server = MiniServer::respond(429, &[("retry-after", "120")], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_CLAUDE_BASE_URL", &server.url);
        let snapshot = ClaudeQuota::new().fetch();
        match snapshot.status {
            SnapshotStatus::RateLimited { retry_after_seconds } => {
                assert_eq!(retry_after_seconds, Some(120))
            }
            other => panic!("expected RateLimited, got {other:?}"),
        }
    }

    #[test]
    fn fetch_maps_malformed_200_to_error() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_claude_credentials(&home);
        let _env = claude_env(&home);
        let server = MiniServer::respond(200, &[], "this is not json");
        let _base = EnvGuard::set("OHMYC_QUOTA_CLAUDE_BASE_URL", &server.url);
        let snapshot = ClaudeQuota::new().fetch();
        match snapshot.status {
            SnapshotStatus::Error { message } => assert!(message.contains("failed to parse")),
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_claude_credentials(&home);
        let _env = claude_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_CLAUDE_BASE_URL", &server.url);
        let snapshot = ClaudeQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 3);
    }
}
