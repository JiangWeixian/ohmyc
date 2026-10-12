//! Kimi For Coding usage (Moonshot's coding subscription; distinct from the
//! Kimi Open Platform).
//!
//! - Endpoint: `GET {base}/coding/v1/usages`, default base
//!   `https://api.kimi.com` (China region; override
//!   `OHMYC_QUOTA_KIMI_BASE_URL`). On a 401 the international host
//!   `https://api.kimi.ai` is tried once (override
//!   `OHMYC_QUOTA_KIMI_BASE_URL_INTL`).
//! - Credentials: `~/.kimi-code/credentials/kimi-code.json` (read-only — Kimi
//!   rotates refresh tokens, so the official CLI owns renewal). 401 from both
//!   regions → TokenExpired.
//! - Response (reversed from the CLI binary): ratio pools under `usages`
//!   (`limit_5h` / `limit_7d` / `limit_month_total` / `limit_month_code`,
//!   snake_case, each `{used_ratio 0–1, reset_time}`; newer plans omit
//!   `limit_7d`) plus a camelCase `boosterWallet`. `limit_month_code` is the
//!   code-only sub-pool of the monthly quota — surfaced with `model: "code"`
//!   so it renders distinct from the total and stays out of the popover.
//! - `boosterWallet.balance.amountLeft` is a **fixed-point** value:
//!   divide by 10^6 to get cents, by 10^8 to get currency units. Currency
//!   comes from `monthlyChargeLimit.currency` (default CNY).

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http::{self, HttpOutcome};
use crate::quota::types::{
    MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const DEFAULT_BASE_URL: &str = "https://api.kimi.com";
const DEFAULT_BASE_URL_INTL: &str = "https://api.kimi.ai";
const SESSION_WINDOW_SECONDS: u64 = 18000;
const WEEKLY_WINDOW_SECONDS: u64 = 604800;

#[derive(Debug, Default)]
pub struct KimiQuota;

impl KimiQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::kimi() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::NotLoggedIn);
            }
            CredentialOutcome::Expired => {
                return UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::TokenExpired);
            }
        };
        let auth = format!("Bearer {token}");
        let headers = [("authorization", auth.as_str())];
        let url = |base: &str| format!("{base}/coding/v1/usages");
        let china = super::base_url("OHMYC_QUOTA_KIMI_BASE_URL", DEFAULT_BASE_URL);
        let intl = super::base_url("OHMYC_QUOTA_KIMI_BASE_URL_INTL", DEFAULT_BASE_URL_INTL);

        let outcome = http::get_json(&url(&china), &headers, http::DEFAULT_TIMEOUT);
        // A China-region 401 can mean the account lives on the international
        // host: retry once before concluding the token is dead.
        let outcome = match outcome {
            HttpOutcome::Ok { status: 401, .. } => http::get_json(&url(&intl), &headers, http::DEFAULT_TIMEOUT),
            other => other,
        };
        super::finish(QuotaProvider::Kimi, outcome, parse_response)
    }
}

#[derive(Debug, Deserialize)]
struct KimiUsagesResponse {
    usages: Option<UsagePools>,
    #[serde(rename = "boosterWallet")]
    booster_wallet: Option<BoosterWallet>,
}

#[derive(Debug, Deserialize)]
struct UsagePools {
    limit_5h: Option<RatioPool>,
    limit_7d: Option<RatioPool>,
    limit_month_total: Option<RatioPool>,
    limit_month_code: Option<RatioPool>,
}

#[derive(Debug, Deserialize)]
struct RatioPool {
    /// Fraction used, 0–1.
    used_ratio: Option<f64>,
    reset_time: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoosterWallet {
    balance: Option<WalletBalance>,
    monthly_charge_limit: Option<MonthlyChargeLimit>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WalletBalance {
    /// Fixed-point: ÷10^6 → cents. May arrive as a JSON string (proto3).
    amount_left: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct MonthlyChargeLimit {
    currency: Option<String>,
}

fn map_pool(
    source: &Option<RatioPool>,
    kind: WindowKind,
    label: &str,
    window_seconds: Option<u64>,
    model: Option<&str>,
) -> Option<UsageWindow> {
    source.as_ref().map(|pool| UsageWindow {
        kind,
        label: label.to_string(),
        used_percent: pool.used_ratio.map(|r| (r * 100.0).clamp(0.0, 100.0)),
        resets_at: super::parse_rfc3339(pool.reset_time.as_ref()),
        window_seconds,
        model: model.map(ToOwned::to_owned),
    })
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: KimiUsagesResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse usages response: {e}"))?;

    let mut windows = Vec::new();
    if let Some(usages) = &response.usages {
        windows.extend(map_pool(
            &usages.limit_5h,
            WindowKind::Session,
            "5h",
            Some(SESSION_WINDOW_SECONDS),
            None,
        ));
        windows.extend(map_pool(
            &usages.limit_7d,
            WindowKind::Weekly,
            "Weekly",
            Some(WEEKLY_WINDOW_SECONDS),
            None,
        ));
        windows.extend(map_pool(
            &usages.limit_month_total,
            WindowKind::Monthly,
            "Monthly",
            None,
            None,
        ));
        // The code-only monthly pool mirrors the total on plans where code is
        // the only usage; tagging it as model-specific keeps the UI distinct
        // ("MO code") and out of the menubar popover (account windows only).
        windows.extend(map_pool(
            &usages.limit_month_code,
            WindowKind::Monthly,
            "Monthly",
            None,
            Some("code"),
        ));
    }

    let mut meters = Vec::new();
    if let Some(wallet) = &response.booster_wallet {
        if let Some(amount_left) = wallet
            .balance
            .as_ref()
            .and_then(|b| b.amount_left.as_ref())
            .and_then(|v| match v {
                serde_json::Value::Number(n) => n.as_f64(),
                serde_json::Value::String(s) => s.trim().parse().ok(),
                _ => None,
            })
        {
            let currency = wallet
                .monthly_charge_limit
                .as_ref()
                .and_then(|l| l.currency.clone())
                .unwrap_or_else(|| "CNY".to_string());
            meters.push(UsageMeter {
                label: "Booster wallet".to_string(),
                value: amount_left / 1e8,
                kind: MeterKind::Dollars,
                currency: Some(currency),
            });
        }
    }

    Ok(UsageSnapshot::ok(QuotaProvider::Kimi, windows, meters, None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/kimi_usages.json");

    fn kimi_env(home: &tempfile::TempDir) -> EnvGuard {
        let credentials_dir = home.path().join("credentials");
        std::fs::create_dir_all(&credentials_dir).unwrap();
        let expires = chrono::Utc::now().timestamp() + 900;
        std::fs::write(
            credentials_dir.join("kimi-code.json"),
            format!(r#"{{"access_token":"kimi-at","refresh_token":"rt","expires_at":{expires}}}"#),
        )
        .unwrap();
        EnvGuard::set("OHMYC_QUOTA_KIMI_HOME", home.path().to_str().unwrap())
    }

    #[test]
    fn fixture_maps_ratio_pools_and_booster_wallet() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        // New plan shape: no limit_7d in the fixture → no weekly window.
        assert_eq!(snapshot.windows.len(), 3);
        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.window_seconds, Some(18000));
        assert!((session.used_percent.unwrap() - 69.5).abs() < 1e-9);
        assert!(session.resets_at.is_some());
        let monthly = &snapshot.windows[1];
        assert_eq!(monthly.kind, WindowKind::Monthly);
        assert_eq!(monthly.label, "Monthly");
        assert_eq!(monthly.window_seconds, None);
        assert!((monthly.used_percent.unwrap() - 12.0).abs() < 1e-9);
        let monthly_code = &snapshot.windows[2];
        assert_eq!(monthly_code.label, "Monthly");
        assert_eq!(monthly_code.model.as_deref(), Some("code"));

        // amountLeft 2_500_000_000 / 10^8 = 25.00 CNY.
        assert_eq!(snapshot.meters.len(), 1);
        assert_eq!(snapshot.meters[0].label, "Booster wallet");
        assert!((snapshot.meters[0].value - 25.0).abs() < 1e-9);
        assert_eq!(snapshot.meters[0].currency.as_deref(), Some("CNY"));
    }

    #[test]
    fn weekly_pool_is_mapped_when_present() {
        let snapshot =
            parse_response(r#"{"usages":{"limit_7d":{"used_ratio":0.5,"reset_time":"2026-10-04T00:00:00Z"}}}"#)
                .unwrap();
        assert_eq!(snapshot.windows.len(), 1);
        assert_eq!(snapshot.windows[0].kind, WindowKind::Weekly);
        assert_eq!(snapshot.windows[0].window_seconds, Some(604800));
        assert_eq!(snapshot.windows[0].used_percent, Some(50.0));
    }

    #[test]
    fn fetch_retries_international_host_after_china_401() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = kimi_env(&home);
        let china = MiniServer::respond(401, &[], "{}");
        let intl = MiniServer::respond(200, &[], FIXTURE);
        let _china = EnvGuard::set("OHMYC_QUOTA_KIMI_BASE_URL", &china.url);
        let _intl = EnvGuard::set("OHMYC_QUOTA_KIMI_BASE_URL_INTL", &intl.url);
        let snapshot = KimiQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 3);
    }

    #[test]
    fn fetch_maps_double_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = kimi_env(&home);
        let china = MiniServer::respond(401, &[], "{}");
        let intl = MiniServer::respond(401, &[], "{}");
        let _china = EnvGuard::set("OHMYC_QUOTA_KIMI_BASE_URL", &china.url);
        let _intl = EnvGuard::set("OHMYC_QUOTA_KIMI_BASE_URL_INTL", &intl.url);
        let snapshot = KimiQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }
}
