//! Grok (xAI subscription) usage.
//!
//! - Endpoint: `GET {base}/v1/billing?format=credits`, default base
//!   `https://cli-chat-proxy.grok.com` (override `OHMYC_QUOTA_GROK_BASE_URL`).
//! - Credentials: `~/.grok/auth.json` (see `crate::quota::credentials::grok`).
//!   401 → TokenExpired.
//! - **Critical trap: the window kind comes from `currentPeriod.type`, never
//!   from assumptions.** Older response shapes wrap the same data in a
//!   MONTHLY envelope; mislabeling it Weekly would show a wrong reset
//!   countdown.
//! - proto3 habit: `creditUsagePercent` is omitted when zero → absence means
//!   0%, not "unknown".
//! - `prepaidBalance.val` is interpreted as cents; the semantics are not
//!   officially documented — treat the meter as approximate.

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http;
use crate::quota::types::{
    MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const DEFAULT_BASE_URL: &str = "https://cli-chat-proxy.grok.com";
const DAILY_WINDOW_SECONDS: u64 = 86400;
const WEEKLY_WINDOW_SECONDS: u64 = 604800;

#[derive(Debug, Default)]
pub struct GrokQuota;

impl GrokQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::grok() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Grok, SnapshotStatus::NotLoggedIn);
            }
            CredentialOutcome::Expired => {
                return UsageSnapshot::with_status(QuotaProvider::Grok, SnapshotStatus::TokenExpired);
            }
        };
        let url = format!(
            "{}/v1/billing?format=credits",
            super::base_url("OHMYC_QUOTA_GROK_BASE_URL", DEFAULT_BASE_URL)
        );
        let auth = format!("Bearer {token}");
        let headers = [("authorization", auth.as_str())];
        super::finish(
            QuotaProvider::Grok,
            http::get_json(&url, &headers, http::DEFAULT_TIMEOUT),
            parse_response,
        )
    }
}

#[derive(Debug, Deserialize)]
struct GrokBillingResponse {
    config: Option<GrokConfig>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrokConfig {
    current_period: Option<CurrentPeriod>,
    /// proto3: omitted when zero — `None` here means 0%, not unknown.
    credit_usage_percent: Option<f64>,
    #[serde(default)]
    product_usage: Vec<ProductUsage>,
    prepaid_balance: Option<PrepaidBalance>,
}

#[derive(Debug, Deserialize)]
struct CurrentPeriod {
    #[serde(rename = "type")]
    period_type: Option<String>,
    start: Option<String>,
    end: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductUsage {
    product: Option<String>,
    usage_percent: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct PrepaidBalance {
    /// Numeric value; proto3 int64 fields may arrive as JSON strings.
    val: Option<serde_json::Value>,
}

fn number_or_string(value: Option<&serde_json::Value>) -> Option<f64> {
    match value? {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: GrokBillingResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse billing response: {e}"))?;

    let mut windows = Vec::new();
    let mut meters = Vec::new();

    if let Some(config) = &response.config {
        if let Some(period) = &config.current_period {
            let start = super::parse_rfc3339(period.start.as_ref());
            let end = super::parse_rfc3339(period.end.as_ref());
            let period_seconds = match (start, end) {
                (Some(start), Some(end)) => u64::try_from((end - start).num_seconds()).ok(),
                _ => None,
            };
            let (kind, label, window_seconds) = match period.period_type.as_deref() {
                Some("USAGE_PERIOD_TYPE_WEEKLY") => (WindowKind::Weekly, "Weekly", Some(WEEKLY_WINDOW_SECONDS)),
                Some("USAGE_PERIOD_TYPE_DAILY") => (WindowKind::Daily, "Daily", Some(DAILY_WINDOW_SECONDS)),
                Some("USAGE_PERIOD_TYPE_MONTHLY") => (WindowKind::Monthly, "Monthly", period_seconds),
                _ => (WindowKind::Other, "Window", period_seconds),
            };
            windows.push(UsageWindow {
                kind,
                label: label.to_string(),
                // proto3: a missing creditUsagePercent is a literal 0%.
                used_percent: Some(config.credit_usage_percent.unwrap_or(0.0).clamp(0.0, 100.0)),
                resets_at: end,
                window_seconds,
                model: None,
            });
        }

        for product in &config.product_usage {
            if let (Some(name), Some(percent)) = (&product.product, product.usage_percent) {
                meters.push(UsageMeter {
                    label: name.clone(),
                    value: percent.clamp(0.0, 100.0),
                    kind: MeterKind::Percent,
                    currency: None,
                });
            }
        }

        // Semantics of `val` are not officially documented; empirically it
        // behaves like cents. Surfaced as an approximate USD meter.
        if let Some(val) = number_or_string(config.prepaid_balance.as_ref().and_then(|b| b.val.as_ref())) {
            meters.push(UsageMeter {
                label: "Prepaid balance".to_string(),
                value: val / 100.0,
                kind: MeterKind::Dollars,
                currency: Some("USD".to_string()),
            });
        }
    }

    Ok(UsageSnapshot::ok(QuotaProvider::Grok, windows, meters, None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/grok_billing.json");

    fn grok_env(home: &tempfile::TempDir) -> EnvGuard {
        let expires = (chrono::Utc::now().timestamp() + 3600).to_string();
        std::fs::write(
            home.path().join("auth.json"),
            format!(r#"{{"https://auth.x.ai::u2":{{"key":"grok-at","expires_at":"{expires}"}}}}"#),
        )
        .unwrap();
        EnvGuard::set("OHMYC_QUOTA_GROK_HOME", home.path().to_str().unwrap())
    }

    #[test]
    fn fixture_maps_weekly_period_default_percent_and_meters() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 1);
        let window = &snapshot.windows[0];
        assert_eq!(window.kind, WindowKind::Weekly);
        assert_eq!(window.window_seconds, Some(604800));
        // creditUsagePercent is absent in the fixture → proto3 default 0%.
        assert_eq!(window.used_percent, Some(0.0));
        assert_eq!(
            window.resets_at.map(|t| t.to_rfc3339()).as_deref(),
            Some("2026-10-05T00:00:00+00:00")
        );
        assert_eq!(snapshot.meters.len(), 2);
        assert_eq!(snapshot.meters[0].kind, MeterKind::Percent);
        assert_eq!(snapshot.meters[0].label, "grok-code-fast-1");
        assert_eq!(snapshot.meters[0].value, 20.0);
        // prepaidBalance.val "1500" cents → 15.00 USD.
        assert_eq!(snapshot.meters[1].label, "Prepaid balance");
        assert_eq!(snapshot.meters[1].value, 15.0);
        assert_eq!(snapshot.meters[1].currency.as_deref(), Some("USD"));
    }

    #[test]
    fn monthly_envelope_is_labeled_monthly_not_weekly() {
        let snapshot = parse_response(
            r#"{"config":{"currentPeriod":{"type":"USAGE_PERIOD_TYPE_MONTHLY",
                "start":"2026-09-01T00:00:00Z","end":"2026-10-01T00:00:00Z"},
                "creditUsagePercent":55.5}}"#,
        )
        .unwrap();
        let window = &snapshot.windows[0];
        assert_eq!(window.kind, WindowKind::Monthly);
        assert_eq!(window.label, "Monthly");
        assert_eq!(window.used_percent, Some(55.5));
        // 30 days in seconds, derived from start/end.
        assert_eq!(window.window_seconds, Some(30 * 86400));
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = grok_env(&home);
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_GROK_BASE_URL", &server.url);
        let snapshot = GrokQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = grok_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_GROK_BASE_URL", &server.url);
        let snapshot = GrokQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 1);
    }
}
