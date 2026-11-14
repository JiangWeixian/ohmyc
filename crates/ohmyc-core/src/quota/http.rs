//! Minimal synchronous HTTP wrapper around ureq for the quota providers.
//!
//! - Every request gets a hard global timeout (default 10s) and the response
//!   body is capped at 1 MiB — quota endpoints return small JSON documents.
//! - Non-2xx responses are NOT errors here: providers map status codes to
//!   `SnapshotStatus` themselves (`HttpOutcome::Ok` carries any status).
//! - Error messages are sanitized: ureq errors never include request headers,
//!   so no credential material can leak into `SnapshotStatus::Error`.

use std::time::Duration;

/// Default per-request timeout (connect + send + receive, whole call).
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(10);

/// Maximum response body size (1 MiB).
pub const MAX_BODY_BYTES: u64 = 1024 * 1024;

#[derive(Debug)]
pub enum HttpOutcome {
    /// The server responded; `status` may be non-2xx. `retry_after` is parsed
    /// from a `Retry-After` delta-seconds header (HTTP-date form is ignored).
    Ok {
        status: u16,
        retry_after: Option<u64>,
        body: String,
    },
    /// Timeout / DNS / connect / TLS / body-read failure — no usable response.
    Transport { message: String },
}

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        // Let providers see raw status codes instead of ureq::Error::StatusCode.
        .http_status_as_error(false)
        .build()
        .into()
}

pub fn get_json(url: &str, headers: &[(&str, &str)], timeout: Duration) -> HttpOutcome {
    let agent = agent(timeout);
    let mut request = agent.get(url);
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    finish(request.call())
}

pub fn post_json(url: &str, headers: &[(&str, &str)], body: &str, timeout: Duration) -> HttpOutcome {
    let agent = agent(timeout);
    let mut request = agent.post(url).header("content-type", "application/json");
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    finish(request.send(body))
}

fn finish(result: Result<ureq::http::Response<ureq::Body>, ureq::Error>) -> HttpOutcome {
    let mut response = match result {
        Ok(response) => response,
        Err(e) => {
            return HttpOutcome::Transport {
                message: sanitize_transport_error(&e),
            }
        }
    };
    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<u64>().ok());
    let body = match response.body_mut().with_config().limit(MAX_BODY_BYTES).read_to_string() {
        Ok(body) => body,
        Err(e) => {
            return HttpOutcome::Transport {
                message: format!("failed to read response body: {e}"),
            }
        }
    };
    HttpOutcome::Ok {
        status,
        retry_after,
        body,
    }
}

fn sanitize_transport_error(e: &ureq::Error) -> String {
    match e {
        ureq::Error::Timeout(t) => format!("request timed out ({t:?})"),
        other => other.to_string(),
    }
}
