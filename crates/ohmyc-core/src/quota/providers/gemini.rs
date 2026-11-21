//! Gemini (Gemini CLI OAuth / Code Assist) quota.
//!
//! - Endpoint: `POST {base}/v1internal:retrieveUserQuota` with body `{}`,
//!   default base `https://cloudcode-pa.googleapis.com` (override
//!   `OHMYC_QUOTA_GEMINI_BASE_URL`).
//! - Credentials: `~/.gemini/oauth_creds.json` → `access_token`, `expiry_date`
//!   precheck (see `crate::quota::credentials::gemini`). We never use the
//!   refresh token. 401 → TokenExpired.
//! - Response shape (verified against CodexBar's GeminiStatusProbe.swift and
//!   the agy-quota project): `{ "buckets": [{ modelId, tokenType,
//!   remainingFraction, resetTime }] }`. A `models` alias is accepted
//!   defensively. Multiple buckets per model exist; the lowest
//!   `remainingFraction` wins.
//! - Caveat: buckets for third-party models reflect a **shared pool level**,
//!   not a precise per-model budget (empirically verified by agy-quota).
//! - Note: since June 2026 Google serves this endpoint only for Standard /
//!   Enterprise tiers; consumer accounts get 403 SUBSCRIPTION_REQUIRED, which
//!   surfaces here as Unsupported (a plan limitation, not a dead token).

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::quota::credentials::{self, CredentialOutcome};
use crate::quota::http;
use crate::quota::types::{QuotaProvider, SnapshotStatus, UsageSnapshot, UsageWindow, WindowKind};

const DEFAULT_BASE_URL: &str = "https://cloudcode-pa.googleapis.com";

#[derive(Debug, Default)]
pub struct GeminiQuota;

impl GeminiQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let token = match credentials::gemini() {
            CredentialOutcome::Token(token) => token,
            CredentialOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Gemini, SnapshotStatus::NotLoggedIn);
            }
            CredentialOutcome::Expired => {
                return UsageSnapshot::with_status(QuotaProvider::Gemini, SnapshotStatus::TokenExpired);
            }
        };
        let url = format!(
            "{}/v1internal:retrieveUserQuota",
            super::base_url("OHMYC_QUOTA_GEMINI_BASE_URL", DEFAULT_BASE_URL)
        );
        let auth = format!("Bearer {token}");
        let headers = [("authorization", auth.as_str())];
        let outcome = http::post_json(&url, &headers, "{}", http::DEFAULT_TIMEOUT);
        // Consumer accounts get 403 SUBSCRIPTION_REQUIRED from this internal
        // endpoint — that's a plan limitation, not a dead token, so don't
        // tell the user to re-login.
        if let http::HttpOutcome::Ok {
            status: 403, ref body, ..
        } = outcome
        {
            if body.contains("SUBSCRIPTION_REQUIRED") {
                return UsageSnapshot::with_status(
                    QuotaProvider::Gemini,
                    SnapshotStatus::Unsupported {
                        message: Some(
                            "This Google account has no Gemini Code Assist subscription — quota is only available on paid tiers."
                                .to_string(),
                        ),
                    },
                );
            }
        }
        super::finish(QuotaProvider::Gemini, outcome, parse_response)
    }
}

#[derive(Debug, Deserialize)]
struct GeminiQuotaResponse {
    buckets: Option<Vec<QuotaBucket>>,
    /// Defensive alias seen in third-party docs.
    models: Option<Vec<QuotaBucket>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuotaBucket {
    model_id: Option<String>,
    /// Remaining quota as a fraction 0–1.
    remaining_fraction: Option<f64>,
    reset_time: Option<String>,
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let response: GeminiQuotaResponse =
        serde_json::from_str(body).map_err(|e| format!("failed to parse quota response: {e}"))?;
    let buckets = response.buckets.or(response.models).unwrap_or_default();

    // One model can appear in several buckets (e.g. different token types);
    // the lowest remaining fraction is the binding constraint. BTreeMap keeps
    // the output ordered by model id for deterministic snapshots.
    let mut per_model: BTreeMap<String, (f64, Option<String>)> = BTreeMap::new();
    for bucket in &buckets {
        let (Some(model_id), Some(fraction)) = (&bucket.model_id, bucket.remaining_fraction) else {
            continue;
        };
        per_model
            .entry(model_id.clone())
            .and_modify(|(lowest, reset)| {
                if fraction < *lowest {
                    *lowest = fraction;
                    *reset = bucket.reset_time.clone();
                }
            })
            .or_insert((fraction, bucket.reset_time.clone()));
    }

    let windows = per_model
        .into_iter()
        .map(|(model_id, (fraction, reset_time))| UsageWindow {
            kind: WindowKind::Daily,
            label: "Daily".to_string(),
            used_percent: Some(((1.0 - fraction) * 100.0).clamp(0.0, 100.0)),
            resets_at: super::parse_rfc3339(reset_time.as_ref()),
            // Day-quota semantics; the exact length varies by tier, so we
            // report no fixed window length.
            window_seconds: None,
            model: Some(model_id),
        })
        .collect();

    Ok(UsageSnapshot::ok(QuotaProvider::Gemini, windows, Vec::new(), None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE: &str = include_str!("../fixtures/gemini_quota.json");

    fn gemini_env(home: &tempfile::TempDir) -> EnvGuard {
        let expiry = chrono::Utc::now().timestamp_millis() + 3_600_000;
        std::fs::write(
            home.path().join("oauth_creds.json"),
            format!(r#"{{"access_token":"ya29.test","expiry_date":{expiry}}}"#),
        )
        .unwrap();
        EnvGuard::set("OHMYC_QUOTA_GEMINI_HOME", home.path().to_str().unwrap())
    }

    #[test]
    fn fixture_maps_buckets_to_daily_model_windows() {
        let snapshot = parse_response(FIXTURE).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        // gemini-2.5-pro appears twice; the lowest fraction (0.42) wins.
        assert_eq!(snapshot.windows.len(), 2);
        let flash = &snapshot.windows[0];
        assert_eq!(flash.model.as_deref(), Some("gemini-2.5-flash"));
        assert_eq!(flash.kind, WindowKind::Daily);
        assert_eq!(flash.window_seconds, None);
        assert!((flash.used_percent.unwrap() - 12.0).abs() < 1e-9);
        let pro = &snapshot.windows[1];
        assert_eq!(pro.model.as_deref(), Some("gemini-2.5-pro"));
        assert!((pro.used_percent.unwrap() - 58.0).abs() < 1e-9);
        assert_eq!(
            pro.resets_at.map(|t| t.to_rfc3339()).as_deref(),
            Some("2026-10-01T13:59:03+00:00")
        );
    }

    #[test]
    fn models_alias_is_accepted() {
        let snapshot =
            parse_response(r#"{"models":[{"modelId":"gemini-3-pro","remainingFraction":1.0,"resetTime":null}]}"#)
                .unwrap();
        assert_eq!(snapshot.windows.len(), 1);
        assert_eq!(snapshot.windows[0].model.as_deref(), Some("gemini-3-pro"));
        assert_eq!(snapshot.windows[0].used_percent, Some(0.0));
    }

    #[test]
    fn empty_bucket_list_is_ok_with_no_windows() {
        let snapshot = parse_response(r#"{"buckets":[]}"#).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert!(snapshot.windows.is_empty());
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = gemini_env(&home);
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_GEMINI_BASE_URL", &server.url);
        let snapshot = GeminiQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = gemini_env(&home);
        let server = MiniServer::respond(200, &[], FIXTURE);
        let _base = EnvGuard::set("OHMYC_QUOTA_GEMINI_BASE_URL", &server.url);
        let snapshot = GeminiQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 2);
    }
}
