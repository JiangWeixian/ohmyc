//! Background quota polling. A plain thread (no async runtime in this app)
//! loops `QuotaRegistry::fetch_all()` → shared cache → `quota:changed` event.
//! The cache lives in Tauri state so the `quota.list` command never blocks on
//! the network once the first poll has landed.

use std::sync::RwLock;
use std::thread;
use std::time::Duration;

use ohmyc_core::quota::{QuotaRegistry, UsageSnapshot};
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

/// Spawn the polling thread. The first fetch runs immediately so the cache is
/// warm before the UI asks; failures inside a provider never surface here —
/// `fetch_all` already collapses them into per-provider snapshot statuses.
pub fn spawn_poller(app: &AppHandle) {
    let app = app.clone();
    let interval = poll_interval();
    thread::spawn(move || loop {
        let snapshots = {
            let cache = app.state::<QuotaCache>();
            let snapshots = QuotaRegistry::new().fetch_all();
            cache.set(snapshots.clone());
            snapshots
        };
        let _ = app.emit(QUOTA_CHANGED_EVENT, &snapshots);
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
