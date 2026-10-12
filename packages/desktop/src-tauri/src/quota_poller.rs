//! Background quota polling. A plain thread (no async runtime in this app)
//! loops `QuotaRegistry::fetch_all()` → shared cache → `quota:changed` event.
//! The cache lives in Tauri state so the `quota.list` command never blocks on
//! the network once the first poll has landed.
//!
//! Every cycle is appended to `~/Library/Logs/OhMyC/quota-poller.log` — in
//! release builds that log is the only way to tell whether the poller kept
//! running through sleep/App Nap or stalled. The cycle body is wrapped in
//! `catch_unwind` on top of fetch_all's per-provider isolation, so nothing
//! (cache poisoning, emit failure) can kill the thread silently.

use std::sync::RwLock;
use std::thread;
use std::time::{Duration, Instant};

use ohmyc_core::quota::{QuotaRegistry, SnapshotStatus, UsageSnapshot};
use tauri::{AppHandle, Emitter, Manager};

pub const QUOTA_CHANGED_EVENT: &str = "quota:changed";
pub const DEFAULT_POLL_SECS: u64 = 300;

/// Shared snapshot cache. Registered via `app.manage(...)` at setup.
#[derive(Default)]
pub struct QuotaCache {
    snapshots: RwLock<Vec<UsageSnapshot>>,
}

impl QuotaCache {
    pub fn get(&self) -> Vec<UsageSnapshot> {
        self.snapshots.read().unwrap().clone()
    }

    pub fn set(&self, snapshots: Vec<UsageSnapshot>) {
        *self.snapshots.write().unwrap() = snapshots;
    }

    pub fn is_empty(&self) -> bool {
        self.snapshots.read().unwrap().is_empty()
    }
}

/// Poll interval: `OHMYC_QUOTA_POLL_SECS` (seconds, > 0) or 5 minutes.
pub fn poll_interval() -> Duration {
    std::env::var("OHMYC_QUOTA_POLL_SECS")
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
        .filter(|secs| *secs > 0)
        .map(Duration::from_secs)
        .unwrap_or(Duration::from_secs(DEFAULT_POLL_SECS))
}

/// Blocking refresh shared by the poller loop and the `quota_refresh`
/// command: fetch all providers, swap the cache, broadcast the event.
pub fn refresh_now(app: &AppHandle, cache: &QuotaCache) -> Vec<UsageSnapshot> {
    let snapshots = QuotaRegistry::new().fetch_all();
    cache.set(snapshots.clone());
    let _ = app.emit(QUOTA_CHANGED_EVENT, &snapshots);
    snapshots
}

fn status_label(snapshot: &UsageSnapshot) -> &'static str {
    match &snapshot.status {
        SnapshotStatus::Ok => "ok",
        SnapshotStatus::NotLoggedIn => "not-logged-in",
        SnapshotStatus::TokenExpired => "token-expired",
        SnapshotStatus::RateLimited { .. } => "rate-limited",
        SnapshotStatus::Unsupported { .. } => "unsupported",
        SnapshotStatus::Error { .. } => "error",
    }
}

/// Append one line per poll cycle to ~/Library/Logs/OhMyC/quota-poller.log,
/// rotating at 512 KiB. Diagnostic only — never fails, never panics.
fn log_cycle(line: &str) {
    use std::io::Write as _;
    let Some(home) = std::env::var_os("HOME") else {
        return;
    };
    let dir = std::path::PathBuf::from(home).join("Library/Logs/OhMyC");
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("quota-poller.log");
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > 512 * 1024 {
            let _ = std::fs::rename(&path, dir.join("quota-poller.old.log"));
        }
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{line}");
    }
}

/// Hold an NSActivity assertion for the process lifetime so macOS App Nap
/// can never suspend the poller mid-sleep. Without it a hidden menubar
/// accessory is a prime App Nap target and the 5-minute interval silently
/// becomes "whenever the process next gets scheduled". Still allows system
/// sleep — we only opt out of per-app napping.
#[cfg(target_os = "macos")]
pub fn prevent_app_nap() {
    use objc2_foundation::{NSActivityOptions, NSProcessInfo, NSString};
    let activity = NSProcessInfo::processInfo().beginActivityWithOptions_reason(
        NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
        &NSString::from_str("quota polling"),
    );
    // The assertion lives as long as the retained token; keep it forever.
    std::mem::forget(activity);
}

/// Spawn the polling thread. The first fetch runs immediately so the cache is
/// warm before the UI asks; failures inside a provider never surface here —
/// `fetch_all` already collapses them into per-provider snapshot statuses.
pub fn spawn_poller(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    prevent_app_nap();
    let app = app.clone();
    let interval = poll_interval();
    thread::spawn(move || loop {
        let cycle = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let started = Instant::now();
            let snapshots = {
                let cache = app.state::<QuotaCache>();
                let snapshots = QuotaRegistry::new().fetch_all();
                cache.set(snapshots.clone());
                snapshots
            };
            let emitted = app.emit(QUOTA_CHANGED_EVENT, &snapshots).is_ok();
            log_cycle(&format!(
                "{} cycle {}ms emit={} [{}]",
                chrono::Local::now().to_rfc3339(),
                started.elapsed().as_millis(),
                emitted,
                snapshots
                    .iter()
                    .map(|s| format!("{:?}:{}", s.provider, status_label(s)))
                    .collect::<Vec<_>>()
                    .join(" ")
            ));
        }));
        if cycle.is_err() {
            log_cycle(&format!(
                "{} cycle PANIC — poller survived via catch_unwind",
                chrono::Local::now().to_rfc3339()
            ));
        }
        thread::sleep(interval);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn poll_interval_defaults_to_five_minutes() {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_QUOTA_POLL_SECS").ok();
        std::env::remove_var("OHMYC_QUOTA_POLL_SECS");
        assert_eq!(poll_interval(), Duration::from_secs(300));
        if let Some(v) = prev {
            std::env::set_var("OHMYC_QUOTA_POLL_SECS", v);
        }
    }

    #[test]
    fn poll_interval_accepts_valid_override_and_rejects_garbage() {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_QUOTA_POLL_SECS").ok();
        std::env::set_var("OHMYC_QUOTA_POLL_SECS", "60");
        assert_eq!(poll_interval(), Duration::from_secs(60));
        for bad in ["0", "-5", "abc", ""] {
            std::env::set_var("OHMYC_QUOTA_POLL_SECS", bad);
            assert_eq!(poll_interval(), Duration::from_secs(300), "input {bad:?}");
        }
        match prev {
            Some(v) => std::env::set_var("OHMYC_QUOTA_POLL_SECS", v),
            None => std::env::remove_var("OHMYC_QUOTA_POLL_SECS"),
        }
    }

    #[test]
    fn cache_round_trips_snapshots() {
        let cache = QuotaCache::default();
        assert!(cache.is_empty());
        let snapshots = vec![UsageSnapshot::with_status(
            ohmyc_core::quota::QuotaProvider::Claude,
            ohmyc_core::quota::SnapshotStatus::NotLoggedIn,
        )];
        cache.set(snapshots);
        assert!(!cache.is_empty());
        let got = cache.get();
        assert_eq!(got.len(), 1);
        assert!(matches!(got[0].status, ohmyc_core::quota::SnapshotStatus::NotLoggedIn));
    }
}
