//! GLM Coding Plan (Zhipu Z.ai international / bigmodel.cn China).
//!
//! - Endpoint: `GET {base}/api/monitor/usage/quota/limit`, default base by
//!   credential region — international `https://api.z.ai`, China
//!   `https://open.bigmodel.cn` (same path, separate accounts/keys; override
//!   `OHMYC_QUOTA_GLM_BASE_URL`). Headers: `authorization: Bearer <key>`,
//!   `accept: application/json`. Undocumented (Z.ai's own subscription UI
//!   calls it); three independent open-source implementations agree on the
//!   shape.
//! - The response is an envelope: **HTTP 200 does not mean success** —
//!   `success: false` + `code: 1001` means the auth parameter was not
//!   accepted (→ TokenExpired), and a `msg` mentioning "coding plan" means
//!   the key is valid but no Coding Plan is purchased (→ Unsupported).
//! - Windows: `data.limits[]` classified by `unit × number` (3=hour, 4=day,
//!   5=month(30d), 6=week) — never by array index. `CREDIT_LIMIT` is the
//!   current type name (legacy payloads use `TOKENS_LIMIT`, accepted too).
//!   `TIME_LIMIT` is the monthly MCP-call counter (label "mcp"). An active
//!   5h window may omit `nextResetTime` → `resets_at: None`. A known window
//!   missing `percentage` is treated as schema drift (parse error) instead
//!   of a fabricated 0%.
//! - Credentials (Z.ai has no first-party CLI): env `ZAI_API_KEY` →
//!   `GLM_API_KEY` → `ZHIPU_API_KEY` → opencode `auth.json` keys
//!   `zai-coding-plan` / `zhipuai-coding-plan` (China) / `zai` →
//!   `~/.config/zai/key.json` → `~/.pi/agent/models.json`. Read-only, no
//!   expiry fields → 401/403 → TokenExpired is the only staleness signal.

use serde::Deserialize;

use crate::quota::credentials::{self, GlmOutcome, GlmRegion};
use crate::quota::http;
use crate::quota::types::{
    Identity, MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

const INTERNATIONAL_BASE_URL: &str = "https://api.z.ai";
const CHINA_BASE_URL: &str = "https://open.bigmodel.cn";
/// Monthly windows are billed as 30-day periods.
const MONTH_SECONDS: u64 = 2_592_000;

#[derive(Debug, Default)]
pub struct GlmQuota;

impl GlmQuota {
    pub fn new() -> Self {
        Self
    }

    pub fn fetch(&self) -> UsageSnapshot {
        let credential = match credentials::glm() {
            GlmOutcome::Credential(credential) => credential,
            GlmOutcome::NotLoggedIn => {
                return UsageSnapshot::with_status(QuotaProvider::Glm, SnapshotStatus::NotLoggedIn);
            }
        };
        let default_base = match credential.region {
            GlmRegion::International => INTERNATIONAL_BASE_URL,
            GlmRegion::China => CHINA_BASE_URL,
        };
        let url = format!(
            "{}/api/monitor/usage/quota/limit",
            super::base_url("OHMYC_QUOTA_GLM_BASE_URL", default_base)
        );
        let auth = format!("Bearer {}", credential.key);
        let headers = [("authorization", auth.as_str()), ("accept", "application/json")];
        super::finish(
            QuotaProvider::Glm,
            http::get_json(&url, &headers, http::DEFAULT_TIMEOUT),
            parse_response,
        )
    }
}

#[derive(Debug, Deserialize)]
struct GlmEnvelope {
    #[serde(default)]
    code: Option<i64>,
    #[serde(default)]
    msg: Option<String>,
    #[serde(default)]
    success: Option<bool>,
    data: Option<GlmData>,
    /// Legacy payloads carried the window array at the root level instead of
    /// under `data`.
    #[serde(default)]
    limits: Vec<GlmLimit>,
}

#[derive(Debug, Deserialize)]
struct GlmData {
    #[serde(default)]
    level: Option<String>,
    #[serde(default)]
    limits: Vec<GlmLimit>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GlmLimit {
    /// `type` is a Rust keyword; serde keeps the JSON name "type".
    #[serde(alias = "name")]
    r#type: Option<String>,
    unit: Option<u64>,
    number: Option<u64>,
    percentage: Option<f64>,
    next_reset_time: Option<f64>,
    #[serde(default)]
    usage_details: Option<Vec<GlmUsageDetail>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GlmUsageDetail {
    #[serde(default)]
    model_code: Option<String>,
    #[serde(default)]
    usage: Option<f64>,
}

/// `unit` → (kind, seconds). Returns `None` for unknown units — skip the
/// entry rather than guess. Unit codes observed in live payloads: 3=hour,
/// 4=day, 5=month (billed as 30 days), 6=week.
fn classify(unit: u64, number: u64) -> Option<(WindowKind, &'static str, u64)> {
    let (kind, label, seconds) = match unit {
        3 => (WindowKind::Session, "5h", 3600),
        4 => (WindowKind::Daily, "Daily", 86400),
        5 => (WindowKind::Monthly, "Monthly", MONTH_SECONDS),
        6 => (WindowKind::Weekly, "Weekly", 604_800),
        _ => return None,
    };
    let seconds = number.checked_mul(seconds)?;
    Some((kind, label, seconds))
}

fn capitalize(value: &str) -> Option<String> {
    let mut chars = value.chars();
    Some(chars.next()?.to_uppercase().collect::<String>() + chars.as_str())
}

pub(crate) fn parse_response(body: &str) -> Result<UsageSnapshot, String> {
    let envelope: GlmEnvelope =
        serde_json::from_str(body).map_err(|e| format!("failed to parse quota response: {e}"))?;

    // HTTP 200 does not mean success — the envelope carries the verdict.
    if envelope.success == Some(false) {
        let message = envelope.msg.clone().unwrap_or_default();
        if envelope.code == Some(1001) {
            return Ok(UsageSnapshot::with_status(
                QuotaProvider::Glm,
                SnapshotStatus::TokenExpired,
            ));
        }
        if message.to_lowercase().contains("coding plan") {
            return Ok(UsageSnapshot::with_status(
                QuotaProvider::Glm,
                SnapshotStatus::Unsupported { message: Some(message) },
            ));
        }
        return Err(format!("glm quota request rejected: {message}"));
    }

    let limits = match envelope.data.as_ref().map(|data| data.limits.as_slice()) {
        Some(limits) if !limits.is_empty() => limits,
        // Legacy payloads carried the array at the root; an empty array is a
        // legitimate "no data yet" and stays an honest empty Ok snapshot.
        _ => envelope.limits.as_slice(),
    };

    let mut windows = Vec::new();
    let mut meters = Vec::new();
    for limit in limits {
        let kind_name = limit
            .r#type
            .as_deref()
            .or(limit.usage_details.as_ref().map(|_| "TIME_LIMIT"));
        match kind_name {
            Some("CREDIT_LIMIT") | Some("TOKENS_LIMIT") => {
                let (unit, number) = match (limit.unit, limit.number) {
                    (Some(unit), Some(number)) => (unit, number),
                    _ => continue,
                };
                let Some((kind, label, seconds)) = classify(unit, number) else {
                    continue;
                };
                // A known window without a percentage is schema drift: fail
                // loudly instead of rendering a fabricated 0%.
                let Some(used_percent) = limit.percentage else {
                    return Err("glm: known credit window is missing `percentage`".to_string());
                };
                windows.push(UsageWindow {
                    kind,
                    label: label.to_string(),
                    used_percent: Some(used_percent.clamp(0.0, 100.0)),
                    resets_at: reset_at(limit.next_reset_time),
                    window_seconds: Some(seconds),
                    model: None,
                });
            }
            Some("TIME_LIMIT") => {
                let Some(used_percent) = limit.percentage else {
                    return Err("glm: TIME_LIMIT window is missing `percentage`".to_string());
                };
                let seconds = limit.number.and_then(|number| number.checked_mul(MONTH_SECONDS));
                windows.push(UsageWindow {
                    kind: WindowKind::Monthly,
                    label: "mcp".to_string(),
                    used_percent: Some(used_percent.clamp(0.0, 100.0)),
                    resets_at: reset_at(limit.next_reset_time),
                    window_seconds: seconds,
                    model: None,
                });
                for detail in limit.usage_details.iter().flatten() {
                    let Some(label) = detail.model_code.clone() else {
                        continue;
                    };
                    meters.push(UsageMeter {
                        label,
                        value: detail.usage.unwrap_or(0.0),
                        kind: MeterKind::Count,
                        currency: None,
                    });
                }
            }
            _ => {}
        }
    }

    let plan = envelope
        .data
        .as_ref()
        .and_then(|data| data.level.as_deref())
        .and_then(capitalize);
    let identity = plan.map(|plan| Identity {
        email: None,
        plan: Some(plan),
    });
    Ok(UsageSnapshot::ok(QuotaProvider::Glm, windows, meters, identity))
}

fn reset_at(epoch_millis: Option<f64>) -> Option<chrono::DateTime<chrono::Utc>> {
    let millis = epoch_millis?;
    chrono::DateTime::from_timestamp_millis(millis as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, MiniServer, ENV_LOCK};

    const FIXTURE_PRO: &str = include_str!("../fixtures/glm_pro_limits.json");
    const FIXTURE_LITE: &str = include_str!("../fixtures/glm_lite_limits.json");

    #[test]
    fn fixture_maps_windows_by_unit_times_number() {
        let snapshot = parse_response(FIXTURE_PRO).unwrap();
        assert_eq!(snapshot.provider, QuotaProvider::Glm);
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 3);

        // unit 3 × 5 = 5h session window.
        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.window_seconds, Some(18000));
        assert_eq!(session.used_percent, Some(34.0));
        assert!(session.resets_at.is_some());

        // unit 6 × 1 = weekly window; classification must come from the
        // unit codes, not the array position.
        let weekly = &snapshot.windows[1];
        assert_eq!(weekly.kind, WindowKind::Weekly);
        assert_eq!(weekly.window_seconds, Some(604_800));
        assert_eq!(weekly.used_percent, Some(98.0));

        // TIME_LIMIT → monthly "mcp" window plus per-model count meters.
        let mcp = &snapshot.windows[2];
        assert_eq!(mcp.kind, WindowKind::Monthly);
        assert_eq!(mcp.label, "mcp");
        assert_eq!(mcp.window_seconds, Some(MONTH_SECONDS));
        assert_eq!(snapshot.meters.len(), 3);
        assert_eq!(snapshot.meters[0].label, "search-prime");
        assert_eq!(snapshot.meters[0].kind, MeterKind::Count);

        assert_eq!(snapshot.identity.as_ref().unwrap().plan.as_deref(), Some("Pro"));
    }

    #[test]
    fn lite_fixture_tolerates_missing_reset_and_legacy_type_name() {
        let snapshot = parse_response(FIXTURE_LITE).unwrap();
        let session = &snapshot.windows[0];
        assert_eq!(session.kind, WindowKind::Session);
        assert_eq!(session.used_percent, Some(4.0));
        // Active 5h windows may omit nextResetTime.
        assert_eq!(session.resets_at, None);
        // Legacy TOKENS_LIMIT type name maps the same as CREDIT_LIMIT.
        assert_eq!(session.label, "5h");
        assert_eq!(snapshot.identity.as_ref().unwrap().plan.as_deref(), Some("Lite"));
    }

    #[test]
    fn unknown_units_are_skipped() {
        let body = r#"{"success":true,"data":{"level":"pro","limits":[
            {"type":"CREDIT_LIMIT","unit":9,"number":5,"percentage":50},
            {"type":"CREDIT_LIMIT","unit":6,"number":1,"percentage":12,"nextResetTime":1786685679998}
        ]}}"#;
        let snapshot = parse_response(body).unwrap();
        assert_eq!(snapshot.windows.len(), 1);
        assert_eq!(snapshot.windows[0].used_percent, Some(12.0));
    }

    #[test]
    fn known_window_missing_percentage_is_a_parse_error_not_zero() {
        let body = r#"{"success":true,"data":{"level":"pro","limits":[
            {"type":"CREDIT_LIMIT","unit":3,"number":5,"nextResetTime":1786685679998}
        ]}}"#;
        let message = parse_response(body).unwrap_err();
        assert!(message.contains("percentage"));
    }

    #[test]
    fn http_200_with_code_1001_maps_to_token_expired() {
        let snapshot =
            parse_response(r#"{"code":1001,"msg":"Authentication parameter not received","success":false}"#).unwrap();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn http_200_without_coding_plan_maps_to_unsupported() {
        let snapshot =
            parse_response(r#"{"code":500,"msg":"no available coding plan for this account","success":false}"#)
                .unwrap();
        match snapshot.status {
            SnapshotStatus::Unsupported { message } => {
                assert!(message.unwrap_or_default().to_lowercase().contains("coding plan"));
            }
            other => panic!("expected Unsupported, got {other:?}"),
        }
    }

    #[test]
    fn fetch_maps_401_to_token_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        std::fs::write(
            home.path().join("auth.json"),
            r#"{"zai-coding-plan":{"type":"api","key":"glm-test-key"}}"#,
        )
        .unwrap();
        let _env = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _envs = [
            EnvGuard::unset("ZAI_API_KEY"),
            EnvGuard::unset("GLM_API_KEY"),
            EnvGuard::unset("ZHIPU_API_KEY"),
        ];
        let server = MiniServer::respond(401, &[], "{}");
        let _base = EnvGuard::set("OHMYC_QUOTA_GLM_BASE_URL", &server.url);
        let snapshot = GlmQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::TokenExpired));
    }

    #[test]
    fn fetch_maps_200_fixture_to_ok() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        std::fs::write(
            home.path().join("auth.json"),
            r#"{"zai-coding-plan":{"type":"api","key":"glm-test-key"}}"#,
        )
        .unwrap();
        let _env = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _envs = [
            EnvGuard::unset("ZAI_API_KEY"),
            EnvGuard::unset("GLM_API_KEY"),
            EnvGuard::unset("ZHIPU_API_KEY"),
        ];
        let server = MiniServer::respond(200, &[], FIXTURE_PRO);
        let _base = EnvGuard::set("OHMYC_QUOTA_GLM_BASE_URL", &server.url);
        let snapshot = GlmQuota::new().fetch();
        assert!(matches!(snapshot.status, SnapshotStatus::Ok));
        assert_eq!(snapshot.windows.len(), 3);
    }
}
