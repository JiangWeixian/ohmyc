//! The eight quota providers. Each is a concrete struct with `new()` +
//! `fetch() -> UsageSnapshot`; the registry aggregates them (no trait —
//! provider quirks dominate and there is no shared abstraction worth
//! enforcing). All endpoints are undocumented and can drift at any time;
//! each provider's response schema is pinned by a fixture test.

pub mod claude;
pub mod codex;
pub mod cursor;
pub mod gemini;
pub mod glm;
pub mod grok;
pub mod kimi;
pub mod opencode;

use crate::quota::http::HttpOutcome;
use crate::quota::types::{QuotaProvider, SnapshotStatus, UsageSnapshot};

/// Display hint derived from a window length; the UI primarily renders from
/// `window_seconds`, this is only a fallback label.
pub(crate) fn window_label(window_seconds: Option<u64>) -> String {
    match window_seconds {
        Some(18000) => "5h".to_string(),
        Some(86400) => "Daily".to_string(),
        Some(604800) => "Weekly".to_string(),
        _ => "Window".to_string(),
    }
}

/// Uniform non-2xx mapping. 401 and 403 both mean "this credential no longer
/// works" from the user's perspective — the recovery (open the official CLI)
/// is identical, so both surface as `TokenExpired`. Everything else is an
/// honest `Error` carrying only the status code, never the response body
/// (a 5xx page could in principle echo request material).
pub(crate) fn map_http_status(status: u16, retry_after: Option<u64>) -> Option<SnapshotStatus> {
    match status {
        200..=299 => None,
        401 | 403 => Some(SnapshotStatus::TokenExpired),
        429 => Some(SnapshotStatus::RateLimited {
            retry_after_seconds: retry_after,
        }),
        other => Some(SnapshotStatus::Error {
            message: format!("unexpected HTTP status {other}"),
        }),
    }
}

/// Shared fetch tail: transport errors and non-2xx statuses become snapshot
/// statuses; a 2xx body goes to the provider's parser. `parse` returns
/// `Err(message)` with a sanitized, credential-free message.
pub(crate) fn finish(
    provider: QuotaProvider,
    outcome: HttpOutcome,
    parse: impl FnOnce(&str) -> Result<UsageSnapshot, String>,
) -> UsageSnapshot {
    match outcome {
        HttpOutcome::Transport { message } => UsageSnapshot::with_status(provider, SnapshotStatus::Error { message }),
        HttpOutcome::Ok {
            status,
            retry_after,
            body,
        } => {
            if let Some(status) = map_http_status(status, retry_after) {
                return UsageSnapshot::with_status(provider, status);
            }
            match parse(&body) {
                Ok(snapshot) => snapshot,
                Err(message) => UsageSnapshot::with_status(provider, SnapshotStatus::Error { message }),
            }
        }
    }
}

/// Read an env override for a provider base URL.
/// Base URL override for tests and local debugging. In release builds only
/// `https://` overrides are honored — a plain-http override would send
/// bearer tokens unencrypted.
pub(crate) fn base_url(env: &str, default: &str) -> String {
    std::env::var(env)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .filter(|v| cfg!(any(test, debug_assertions)) || v.starts_with("https://"))
        .unwrap_or_else(|| default.to_string())
}

/// Parse an ISO-8601/RFC3339 timestamp from an endpoint response.
pub(crate) fn parse_rfc3339(value: Option<&String>) -> Option<chrono::DateTime<chrono::Utc>> {
    let value = value?;
    chrono::DateTime::parse_from_rfc3339(value.trim())
        .ok()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}
