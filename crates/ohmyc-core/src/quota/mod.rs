//! Unified, read-only subscription-quota queries for seven AI coding CLIs:
//! Claude, Codex, Cursor, Grok, Gemini, Kimi, OpenCode Go.
//!
//! # Design positions
//!
//! 1. **Credentials are read-only.** This module never refreshes or writes
//!    back a token. Grok's and Kimi's refresh tokens rotate on use — writing
//!    one back could race the official CLI and log the user out of their own
//!    tool. An expired token is reported as `SnapshotStatus::TokenExpired`;
//!    opening the official CLI once restores it.
//! 2. **Snapshots never fail.** Any per-provider problem (not logged in,
//!    expired, rate limited, parse failure, network error) collapses into
//!    `UsageSnapshot.status`. Nothing propagates an `Err` that could take
//!    down the other providers, and the registry wraps each fetch in
//!    `std::panic::catch_unwind` as a last-resort isolation layer.
//! 3. **Honest empty states.** When a number is unknown, `used_percent` is
//!    `None` and the UI renders "—". We never invent a 0%.
//! 4. **All endpoints are undocumented and drift without notice.** Each
//!    provider's response schema is pinned by a fixture JSON test, and each
//!    provider file documents its endpoint, credential source, and known
//!    traps in its header comment. `Provenance::Experimental` marks this
//!    (OpenCode Go is the exception: first-party but undocumented, marked
//!    `OfficialEndpoint`); the enum leaves room for official APIs or local
//!    estimates later.
//!
//! Security: tokens are read → used in-memory → discarded. They never hit
//! disk, logs, or error messages.

pub mod providers;
pub mod types;

mod credentials;
mod http;

#[cfg(test)]
pub(crate) mod testutil;

pub use types::{
    Identity, MeterKind, Provenance, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
};

/// Aggregates the seven providers. Stateless and cheap to construct; every
/// `fetch*` call re-resolves credentials and hits the network fresh.
#[derive(Debug, Default)]
pub struct QuotaRegistry {
    claude: providers::claude::ClaudeQuota,
    codex: providers::codex::CodexQuota,
    cursor: providers::cursor::CursorQuota,
    grok: providers::grok::GrokQuota,
    gemini: providers::gemini::GeminiQuota,
    kimi: providers::kimi::KimiQuota,
    opencode_go: providers::opencode::OpenCodeGoQuota,
}

impl QuotaRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Fetch every provider, in the fixed `QuotaProvider::ALL` order.
    /// Individual failures (including panics) never affect other providers.
    pub fn fetch_all(&self) -> Vec<UsageSnapshot> {
        QuotaProvider::ALL.iter().map(|p| self.fetch(*p)).collect()
    }

    /// Fetch one provider. A panicking provider is converted into an
    /// `Error`-status snapshot instead of unwinding into the caller.
    pub fn fetch(&self, provider: QuotaProvider) -> UsageSnapshot {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match provider {
            QuotaProvider::Claude => self.claude.fetch(),
            QuotaProvider::Codex => self.codex.fetch(),
            QuotaProvider::Cursor => self.cursor.fetch(),
            QuotaProvider::Grok => self.grok.fetch(),
            QuotaProvider::Gemini => self.gemini.fetch(),
            QuotaProvider::Kimi => self.kimi.fetch(),
            QuotaProvider::OpenCodeGo => self.opencode_go.fetch(),
        }));
        result.unwrap_or_else(|_| {
            UsageSnapshot::with_status(
                provider,
                SnapshotStatus::Error {
                    message: "internal panic while fetching quota".to_string(),
                },
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, ENV_LOCK};

    /// Point every credential lookup at empty tempdirs (and a nonexistent
    /// Cursor agent binary) so the fetch short-circuits to NotLoggedIn before
    /// any network or keychain access, regardless of the host machine.
    struct EmptyHomes {
        _dirs: Vec<tempfile::TempDir>,
        _guards: Vec<EnvGuard>,
    }

    fn empty_homes() -> EmptyHomes {
        let mut dirs = Vec::new();
        let mut guards = Vec::new();
        let mut home = |env: &'static str| {
            let dir = tempfile::tempdir().unwrap();
            guards.push(EnvGuard::set(env, dir.path().to_str().unwrap()));
            dirs.push(dir);
        };
        home("OHMYC_QUOTA_CLAUDE_HOME");
        home("OHMYC_QUOTA_CODEX_HOME");
        home("OHMYC_QUOTA_GROK_HOME");
        home("OHMYC_QUOTA_GEMINI_HOME");
        home("OHMYC_QUOTA_KIMI_HOME");
        home("OHMYC_QUOTA_OPENCODE_HOME");
        guards.push(EnvGuard::unset("CLAUDE_CODE_OAUTH_TOKEN"));
        guards.push(EnvGuard::unset("OPENCODE_API_KEY"));
        guards.push(EnvGuard::set("OHMYC_QUOTA_CURSOR_AGENT", "/nonexistent/agent"));
        let cursor_dir = tempfile::tempdir().unwrap();
        guards.push(EnvGuard::set(
            "OHMYC_QUOTA_CURSOR_STATE_DB",
            cursor_dir.path().join("state.vscdb").to_str().unwrap(),
        ));
        dirs.push(cursor_dir);
        EmptyHomes {
            _dirs: dirs,
            _guards: guards,
        }
    }

    #[test]
    fn fetch_all_returns_seven_not_logged_in_snapshots_in_fixed_order() {
        let _lock = ENV_LOCK.lock().unwrap();
        let _homes = empty_homes();
        let snapshots = QuotaRegistry::new().fetch_all();
        assert_eq!(snapshots.len(), 7);
        let order: Vec<QuotaProvider> = snapshots.iter().map(|s| s.provider).collect();
        assert_eq!(
            order,
            vec![
                QuotaProvider::Claude,
                QuotaProvider::Codex,
                QuotaProvider::Cursor,
                QuotaProvider::Grok,
                QuotaProvider::Gemini,
                QuotaProvider::Kimi,
                QuotaProvider::OpenCodeGo,
            ]
        );
        for snapshot in &snapshots {
            assert!(
                matches!(snapshot.status, SnapshotStatus::NotLoggedIn),
                "expected NotLoggedIn for {:?}, got {:?}",
                snapshot.provider,
                snapshot.status
            );
            assert!(snapshot.windows.is_empty());
            assert!(snapshot.meters.is_empty());
        }
    }

    #[test]
    fn fetch_single_provider_matches_fetch_all_entry() {
        let _lock = ENV_LOCK.lock().unwrap();
        let _homes = empty_homes();
        let registry = QuotaRegistry::new();
        let snapshot = registry.fetch(QuotaProvider::Grok);
        assert_eq!(snapshot.provider, QuotaProvider::Grok);
        assert!(matches!(snapshot.status, SnapshotStatus::NotLoggedIn));
    }
}
