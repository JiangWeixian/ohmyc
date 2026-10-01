//! Data model for subscription quota snapshots. Everything serializes to
//! camelCase JSON — this is the contract a TypeScript frontend consumes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuotaProvider {
    Claude,
    Codex,
    Cursor,
    Grok,
    Gemini,
    Kimi,
    /// Explicit rename keeps the camelCase frontend contract readable.
    #[serde(rename = "opencodeGo")]
    OpenCodeGo,
}

impl QuotaProvider {
    /// Fixed registry order: the order `fetch_all` returns snapshots in.
    pub const ALL: [QuotaProvider; 7] = [
        QuotaProvider::Claude,
        QuotaProvider::Codex,
        QuotaProvider::Cursor,
        QuotaProvider::Grok,
        QuotaProvider::Gemini,
        QuotaProvider::Kimi,
        QuotaProvider::OpenCodeGo,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowKind {
    Session,
    Daily,
    Weekly,
    Monthly,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub kind: WindowKind,
    /// Short display hint: "5h" / "Weekly" / "Monthly" / "Code review" etc.
    pub label: String,
    /// 0–100; `None` means unknown — the UI must render "—", never a fake 0%.
    pub used_percent: Option<f64>,
    pub resets_at: Option<DateTime<Utc>>,
    /// 18000 = 5h, 604800 = 7d. The UI derives labels from this instead of
    /// guessing from free text.
    pub window_seconds: Option<u64>,
    /// Model-specific window (Claude sonnet/opus weekly caps, Gemini buckets).
    pub model: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MeterKind {
    Dollars,
    Count,
    Percent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageMeter {
    pub label: String,
    pub value: f64,
    pub kind: MeterKind,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum SnapshotStatus {
    Ok,
    /// No credential found on this machine.
    NotLoggedIn,
    /// Credential exists but is expired; opening the official CLI once
    /// refreshes it (we never refresh tokens ourselves).
    TokenExpired,
    RateLimited {
        retry_after_seconds: Option<u64>,
    },
    Unsupported,
    /// Network / parse / other failure. Never contains credential material.
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Provenance {
    OfficialEndpoint,
    Experimental,
    LocalEstimate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub email: Option<String>,
    pub plan: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub provider: QuotaProvider,
    #[serde(flatten)]
    pub status: SnapshotStatus,
    /// Sorted ascending by `window_seconds` (`None` sorts last).
    pub windows: Vec<UsageWindow>,
    pub meters: Vec<UsageMeter>,
    pub identity: Option<Identity>,
    pub provenance: Provenance,
    pub fetched_at: DateTime<Utc>,
}

impl UsageSnapshot {
    /// Successful snapshot. `windows` are sorted by `window_seconds` ascending.
    pub fn ok(
        provider: QuotaProvider,
        mut windows: Vec<UsageWindow>,
        meters: Vec<UsageMeter>,
        identity: Option<Identity>,
    ) -> Self {
        windows.sort_by_key(|w| w.window_seconds.unwrap_or(u64::MAX));
        Self {
            provider,
            status: SnapshotStatus::Ok,
            windows,
            meters,
            identity,
            // Every provider here talks to an undocumented endpoint; the enum
            // variants exist so a future official API (or a local-estimate
            // fallback) can be marked honestly.
            provenance: Provenance::Experimental,
            fetched_at: Utc::now(),
        }
    }

    /// Non-Ok snapshot (NotLoggedIn / TokenExpired / RateLimited / Error…)
    /// with empty windows and meters.
    pub fn with_status(provider: QuotaProvider, status: SnapshotStatus) -> Self {
        Self {
            provider,
            status,
            windows: Vec::new(),
            meters: Vec::new(),
            identity: None,
            provenance: Provenance::Experimental,
            fetched_at: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_serializes_to_camel_case_contract() {
        let snapshot = UsageSnapshot {
            provider: QuotaProvider::Claude,
            status: SnapshotStatus::Ok,
            windows: vec![UsageWindow {
                kind: WindowKind::Session,
                label: "5h".to_string(),
                used_percent: Some(42.5),
                resets_at: DateTime::from_timestamp(1_780_000_000, 0),
                window_seconds: Some(18000),
                model: None,
            }],
            meters: vec![UsageMeter {
                label: "Extra usage".to_string(),
                value: 7.25,
                kind: MeterKind::Dollars,
                currency: Some("USD".to_string()),
            }],
            identity: Some(Identity {
                email: Some("dev@example.com".to_string()),
                plan: Some("max".to_string()),
            }),
            provenance: Provenance::Experimental,
            fetched_at: DateTime::from_timestamp(1_779_999_000, 0).unwrap(),
        };
        let json = serde_json::to_value(&snapshot).unwrap();
        assert_eq!(json["provider"], "claude");
        assert_eq!(json["status"], "ok");
        assert_eq!(json["provenance"], "experimental");
        assert_eq!(json["identity"]["email"], "dev@example.com");
        assert_eq!(json["identity"]["plan"], "max");
        let window = &json["windows"][0];
        assert_eq!(window["kind"], "session");
        assert_eq!(window["usedPercent"], 42.5);
        assert_eq!(window["windowSeconds"], 18000);
        assert!(window["resetsAt"].is_string());
        assert!(window.get("model").is_some());
        let meter = &json["meters"][0];
        assert_eq!(meter["kind"], "dollars");
        assert_eq!(meter["currency"], "USD");
        assert!(json["fetchedAt"].is_string());
    }

    #[test]
    fn status_variants_serialize_with_tag() {
        let snap = UsageSnapshot::with_status(QuotaProvider::Grok, SnapshotStatus::NotLoggedIn);
        assert_eq!(serde_json::to_value(&snap).unwrap()["status"], "notLoggedIn");

        let snap = UsageSnapshot::with_status(QuotaProvider::Grok, SnapshotStatus::TokenExpired);
        assert_eq!(serde_json::to_value(&snap).unwrap()["status"], "tokenExpired");

        let snap = UsageSnapshot::with_status(
            QuotaProvider::Grok,
            SnapshotStatus::RateLimited {
                retry_after_seconds: Some(30),
            },
        );
        let json = serde_json::to_value(&snap).unwrap();
        assert_eq!(json["status"], "rateLimited");
        assert_eq!(json["retryAfterSeconds"], 30);

        let snap = UsageSnapshot::with_status(
            QuotaProvider::Grok,
            SnapshotStatus::Error {
                message: "boom".to_string(),
            },
        );
        let json = serde_json::to_value(&snap).unwrap();
        assert_eq!(json["status"], "error");
        assert_eq!(json["message"], "boom");
    }

    #[test]
    fn provider_serializes_to_frontend_contract_names() {
        assert_eq!(serde_json::to_value(QuotaProvider::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(QuotaProvider::OpenCodeGo).unwrap(), "opencodeGo");
        assert_eq!(
            serde_json::from_value::<QuotaProvider>(serde_json::json!("opencodeGo")).unwrap(),
            QuotaProvider::OpenCodeGo
        );
    }

    #[test]
    fn ok_snapshot_sorts_windows_by_window_seconds() {
        let window = |seconds: Option<u64>| UsageWindow {
            kind: WindowKind::Other,
            label: "x".to_string(),
            used_percent: None,
            resets_at: None,
            window_seconds: seconds,
            model: None,
        };
        let snapshot = UsageSnapshot::ok(
            QuotaProvider::Codex,
            vec![window(None), window(Some(604800)), window(Some(18000))],
            vec![],
            None,
        );
        let order: Vec<Option<u64>> = snapshot.windows.iter().map(|w| w.window_seconds).collect();
        assert_eq!(order, vec![Some(18000), Some(604800), None]);
    }
}
