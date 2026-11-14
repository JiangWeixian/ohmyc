//! Codex (ChatGPT subscription) usage.
//!
//! - Endpoint: `GET {base}/backend-api/wham/usage`, default base
//!   `https://chatgpt.com` (override `OHMYC_QUOTA_CODEX_BASE_URL`).
//! - Headers: `authorization: Bearer`, `chatgpt-account-id`.
//! - Credentials: `~/.codex/auth.json` → `tokens.access_token` +
//!   `tokens.account_id` (see `crate::quota::credentials::codex`).
//!   401 → TokenExpired.
//! - **Critical trap: windows are classified by `limit_window_seconds`
//!   (18000 = session, 604800 = weekly, anything else = Other), never by the
//!   primary/secondary slot.** On Team plans the *primary* slot holds the
//!   weekly window, so slot-based labeling mislabels it as a 5h window.

use serde::Deserialize;

use crate::quota::credentials::{self, CodexOutcome};
use crate::quota::http;
use crate::quota::types::{
    Identity, MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const DEFAULT_BASE_URL: &str = "https://chatgpt.com";

#[derive(Debug, Default)]
pub struct CodexQuota;

impl CodexQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let tokens = match credentials::codex() {
            CodexOutcome::Tokens(tokens) => tokens,
            CodexOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Codex, SnapshotStatus::NotLoggedIn);
            }
        };
        let url = format!(
            "{}/backend-api/wham/usage",
            super::base_url("OHMYC_QUOTA_CODEX_BASE_URL", DEFAULT_BASE_URL)
        );
        let mut headers = vec![
            ("authorization", format!("Bearer {}", tokens.access_token)),
            ("content-type", "application/json".to_string()),
        ];
        if let Some(account_id) = &tokens.account_id {
            headers.push(("chatgpt-account-id", account_id.clone()));
        }
        let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
        super::finish(
            QuotaProvider::Codex,
            http::get_json(&url, &header_refs, http::DEFAULT_TIMEOUT),
            parse_response,
        )
    }
}

#[derive(Debug, Deserialize)]
struct CodexUsageResponse {
    plan_type: Option<String>,
    rate_limit: Option<RateLimit>,
    credits: Option<Credits>,
    code_review_rate_limit: Option<RateLimit>,
    /// Plans without extra policies send an explicit `null` here — `Option`
    /// absorbs both missing and null (serde's `default` only covers missing).
    additional_rate_limits: Option<Vec<RateLimit>>,
    /// Banked full-reset credits ("使用限额重置" in the Codex app). Omitted on
    /// plans without the feature.
    rate_limit_reset_credits: Option<RateLimitResetCredits>,
}

#[derive(Debug, Deserialize)]
struct RateLimitResetCredits {
    /// Banked resets, used or not. Matches the app's 可用 count.
    available_count: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct RateLimit {
    primary_window: Option<RateWindow>,
    secondary_window: Option<RateWindow>,
}

#[derive(Debug, Deserialize)]
struct RateWindow {
    used_percent: Option<f64>,
    limit_window_seconds: Option<u64>,
    /// Epoch seconds.
    reset_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct Credits {
    has_credits: Option<bool>,
    unlimited: Option<bool>,
    /// A decimal number encoded as a string, e.g. "12.34" (USD).
    balance: Option<String>,
}

fn map_window(source: &Option<RateWindow>, label_override: Option<&str>) -> Option<UsageWindow> {
    let window = source.as_ref()?;
    let seconds = window.limit_window_seconds;
    let kind = match seconds {
        Some(18000) => WindowKind::Session,
        Some(604800) => WindowKind::Weekly,
        _ => WindowKind::Other,
    };
    Some(UsageWindow {
        kind,
        label: label_override
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| super::window_label(seconds)),
        used_percent: window.used_percent.map(|v| v.clamp(0.0, 100.0)),
        resets_at: window.reset_at.and_then(chrono::DateTime::from_timestamp_secs),
        window_seconds: seconds,
        model: None,
    })
}

fn push_rate_limit(windows: &mut Vec<UsageWindow>, limit: &RateLimit, label: Option<&str>) {
    windows.extend(map_window(&limit.primary_window, label));
    windows.extend(map_window(&limit.secondary_window, label));
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: CodexUsageResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse usage response: {e}"))?;

    let mut windows = Vec::new();
    if let Some(limit) = &response.rate_limit {
        push_rate_limit(&mut windows, limit, None);
    }
    if let Some(limit) = &response.code_review_rate_limit {
        push_rate_limit(&mut windows, limit, Some("Code review"));
    }
    for extra in response.additional_rate_limits.as_deref().unwrap_or_default() {
        push_rate_limit(&mut windows, extra, Some("Additional"));
    }

    let mut meters = Vec::new();
    if let Some(credits) = &response.credits {
        let billed = credits.has_credits.unwrap_or(false) && !credits.unlimited.unwrap_or(false);
        if billed {
            if let Some(balance) = credits.balance.as_deref().and_then(|b| b.trim().parse::<f64>().ok()) {
                meters.push(UsageMeter {
                    label: "Credits".to_string(),
                    value: balance,
                    kind: MeterKind::Dollars,
                    currency: Some("USD".to_string()),
                });
            }
        }
    }
    if let Some(resets) = &response.rate_limit_reset_credits {
        if let Some(count) = resets.available_count.filter(|c| *c > 0) {
            meters.push(UsageMeter {
                label: "Resets banked".to_string(),
                value: count as f64,
                kind: MeterKind::Count,
                currency: None,
            });
        }
    }

    let identity = response.plan_type.map(|plan| Identity {
        email: None,
        plan: Some(plan),
    });
    Ok(UsageSnapshot::ok(QuotaProvider::Codex, windows, meters, identity))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/codex_usage.json");

    fn codex_env(home: &tempfile::TempDir) -> EnvGuard {
        std::fs::write(
            home.path().join("auth.json"),
            r#"{"tokens":{"access_token":"codex-at","account_id":"acc-123"}}"#,
        )
        .unwrap();
        EnvGuard::set("OHMYC_QUOTA_CODEX_HOME", home.path().to_str().unwrap())
    }

    #[test]
    fn fixture_maps_windows_credits_and_plan() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.identity.and_then(|i| i.plan).as_deref(), Some("plus"));

        // 5h session window first (18000s), code-review weekly second.
        assert_eq!(snapshot.windows.len(), 2);
        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.label, "5h");
        assert_eq!(session.used_percent, Some(37.0));
        assert_eq!(session.window_seconds, Some(18000));
        assert_eq!(session.resets_at, chrono::DateTime::from_timestamp_secs(1780300000));
        let review = &snapshot.windows[1];
        assert_eq!(review.kind, WindowKind::Weekly);
        assert_eq!(review.label, "Code review");

        assert_eq!(snapshot.meters.len(), 2);
        assert_eq!(snapshot.meters[0].value, 12.34);
        assert_eq!(snapshot.meters[0].kind, MeterKind::Dollars);
        assert_eq!(snapshot.meters[1].label, "Resets banked");
        assert_eq!(snapshot.meters[1].value, 2.0);
        assert_eq!(snapshot.meters[1].kind, MeterKind::Count);
    }

    #[test]
    fn team_plan_weekly_in_primary_slot_is_classified_by_length_not_slot() {
        let snapshot = parse_response(
            r#"{"rate_limit":{"primary_window":{"used_percent":55.0,"limit_window_seconds":604800,"reset_at":1780800000},
                              "secondary_window":null}}"#,
        )
        .unwrap();
        assert_eq!(snapshot.windows[0].kind, WindowKind::Weekly);
        assert_eq!(snapshot.windows[0].label, "Weekly");
    }

    #[test]
    fn explicit_null_additional_rate_limits_is_tolerated() {
        // Plans without extra policies return "additional_rate_limits": null.
        let snapshot = parse_response(
            r#"{"plan_type":"plus","rate_limit":{"primary_window":{"used_percent":10.0,"limit_window_seconds":18000,"reset_at":1780300000},"secondary_window":null},"additional_rate_limits":null}"#,
        )
        .unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 1);
    }

    #[test]
    fn unlimited_credits_produce_no_meter() {
        let snapshot =
            parse_response(r#"{"credits":{"has_credits":true,"unlimited":true,"balance":"999.99"}}"#).unwrap();
        assert!(snapshot.meters.is_empty());
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = codex_env(&home);
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_CODEX_BASE_URL", &server.url);
        let snapshot = CodexQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = codex_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_CODEX_BASE_URL", &server.url);
        let snapshot = CodexQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 2);
    }
}
