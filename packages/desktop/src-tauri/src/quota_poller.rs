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

use std::sync::{Mutex, RwLock};
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
    /// Serializes refresh_now: the poller and a manual refresh must not
    /// overlap, or the slower fetch could overwrite fresher results.
    refresh_lock: Mutex<()>,
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

/// Statuses where a previously-good snapshot stays meaningful when the
/// current fetch fails transiently: the card shows the last-known bars
/// (dimmed, marked stale) instead of an empty state, while the failed status
/// and its badge stay honest. NotLoggedIn/Unsupported never merge — missing
/// credentials make old data misleading.
fn keeps_stale_data(status: &SnapshotStatus) -> bool {
    matches!(
        status,
        SnapshotStatus::TokenExpired | SnapshotStatus::RateLimited { .. } | SnapshotStatus::Error { .. }
    )
}

/// For transient failures with no fresh data, carry over the previous
/// snapshot's windows/meters/identity and `fetched_at` (so "updated N min
/// ago" reflects data age, not the failed attempt). The merge key is
/// *carried data*, not the previous status: a stale snapshot from the last
/// failure still holds the good numbers, so consecutive failures keep them
/// (only NotLoggedIn/Unsupported — which never merge in — or a never-ok
/// history lose them).
pub fn merge_stale(previous: &[UsageSnapshot], next: Vec<UsageSnapshot>) -> Vec<UsageSnapshot> {
    next.into_iter()
        .map(|mut snap| {
            if !keeps_stale_data(&snap.status) || !snap.windows.is_empty() {
                return snap;
            }
            let Some(prev) = previous.iter().find(|p| p.provider == snap.provider) else {
                return snap;
            };
            if prev.windows.is_empty() {
                return snap;
            }
            snap.windows = prev.windows.clone();
            snap.meters = prev.meters.clone();
            snap.identity = prev.identity.clone();
            snap.fetched_at = prev.fetched_at;
            snap
        })
        .collect()
}

/// Last-known-good snapshots on disk (`~/.config/ohmyc/quota-cache.json`),
/// so a restart followed by a failed first fetch can still show last-known
/// bars instead of empty state cards. The in-memory cache is preferred; disk
/// is only consulted when memory is empty (fresh process).
fn cache_file() -> Option<std::path::PathBuf> {
    ohmyc_core::store::base_dir()
        .ok()
        .map(|dir| dir.join("quota-cache.json"))
}

fn persist_cache(snapshots: &[UsageSnapshot]) {
    let Some(path) = cache_file() else { return };
    let Some(dir) = path.parent() else { return };
    if std::fs::create_dir_all(dir).is_err() {
        return;
    }
    let Ok(json) = serde_json::to_string(snapshots) else {
        return;
    };
    let _ = std::fs::write(&path, json);
}

fn load_cache() -> Vec<UsageSnapshot> {
    let Some(path) = cache_file() else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

/// Blocking refresh shared by the poller loop and the quota commands: fetch
/// all providers, swap the cache, broadcast the event. Serialised so the
/// poller and a manual refresh can't overlap; poison-tolerant so one
/// panicked refresh can't brick the next.
pub fn refresh_now(app: &AppHandle) -> Vec<UsageSnapshot> {
    let cache = app.state::<QuotaCache>();
    let _guard = cache.refresh_lock.lock().unwrap_or_else(|e| e.into_inner());
    let previous = {
        let cached = cache.get();
        if cached.is_empty() {
            load_cache()
        } else {
            cached
        }
    };
    let snapshots = merge_stale(&previous, QuotaRegistry::new().fetch_all());
    cache.set(snapshots.clone());
    persist_cache(&snapshots);
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

/// Append one line to a file under ~/Library/Logs/OhMyC/, rotating at
/// 512 KiB. Diagnostic only — never fails, never panics. `pub` so the binary
/// crate can log tray/UI events to sibling files.
pub fn log_line(file_name: &str, line: &str) {
    use std::io::Write as _;
    let Some(home) = std::env::var_os("HOME") else {
        return;
    };
    let dir = std::path::PathBuf::from(home).join("Library/Logs/OhMyC");
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join(file_name);
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > 512 * 1024 {
            let _ = std::fs::rename(&path, dir.join(file_name.replace(".log", ".old.log")));
        }
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{line}");
    }
}

/// Append one line per poll cycle to ~/Library/Logs/OhMyC/quota-poller.log.
fn log_cycle(line: &str) {
    log_line("quota-poller.log", line);
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
            let snapshots = refresh_now(&app);
            log_cycle(&format!(
                "{} cycle {}ms [{}]",
                chrono::Local::now().to_rfc3339(),
                started.elapsed().as_millis(),
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

    mod merge_stale_cases {
        use ohmyc_core::quota::{
            Identity, MeterKind, QuotaProvider, SnapshotStatus, UsageMeter, UsageSnapshot, UsageWindow, WindowKind,
        };

        use super::super::merge_stale;

        fn good_snapshot() -> UsageSnapshot {
            UsageSnapshot::ok(
                QuotaProvider::Kimi,
                vec![UsageWindow {
                    kind: WindowKind::Session,
                    label: "5h".to_string(),
                    used_percent: Some(42.0),
                    resets_at: None,
                    window_seconds: Some(18000),
                    model: None,
                }],
                vec![UsageMeter {
                    label: "Booster wallet".to_string(),
                    value: 25.0,
                    kind: MeterKind::Dollars,
                    currency: Some("CNY".to_string()),
                }],
                Some(Identity {
                    email: None,
                    plan: Some("Plus".to_string()),
                }),
            )
        }

        #[test]
        fn token_expired_keeps_previous_good_data_and_status() {
            let prev = good_snapshot();
            let prev_fetched = prev.fetched_at;
            let next = UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::TokenExpired);
            let merged = merge_stale(&[prev], vec![next]);
            assert!(matches!(merged[0].status, SnapshotStatus::TokenExpired));
            assert_eq!(merged[0].windows.len(), 1);
            assert_eq!(merged[0].windows[0].used_percent, Some(42.0));
            assert_eq!(merged[0].meters.len(), 1);
            assert_eq!(
                merged[0].identity.as_ref().and_then(|i| i.plan.as_deref()),
                Some("Plus")
            );
            assert_eq!(merged[0].fetched_at, prev_fetched);
        }

        #[test]
        fn ok_snapshot_is_never_touched() {
            let mut next = good_snapshot();
            next.windows[0].used_percent = Some(7.0);
            let merged = merge_stale(&[good_snapshot()], vec![next]);
            assert_eq!(merged[0].windows[0].used_percent, Some(7.0));
        }

        #[test]
        fn no_previous_good_data_leaves_empty_state() {
            let next = UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::TokenExpired);
            let merged = merge_stale(&[], vec![next]);
            assert!(merged[0].windows.is_empty());
        }

        #[test]
        fn previous_non_ok_does_not_merge() {
            let prev = UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::TokenExpired);
            let next = UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::TokenExpired);
            let merged = merge_stale(&[prev], vec![next]);
            assert!(merged[0].windows.is_empty());
        }

        #[test]
        fn consecutive_failures_keep_the_original_good_data() {
            // success → failure → failure: the second failure must still show
            // the last good numbers, with the original fetch time.
            let first = merge_stale(
                &[good_snapshot()],
                vec![UsageSnapshot::with_status(
                    QuotaProvider::Kimi,
                    SnapshotStatus::TokenExpired,
                )],
            );
            let second = merge_stale(
                &first,
                vec![UsageSnapshot::with_status(
                    QuotaProvider::Kimi,
                    SnapshotStatus::RateLimited {
                        retry_after_seconds: Some(300),
                    },
                )],
            );
            assert!(matches!(second[0].status, SnapshotStatus::RateLimited { .. }));
            assert_eq!(second[0].windows.len(), 1);
            assert_eq!(second[0].windows[0].used_percent, Some(42.0));
            assert_eq!(second[0].meters.len(), 1);
            assert_eq!(second[0].fetched_at, first[0].fetched_at);
        }

        #[test]
        fn not_logged_in_never_merges() {
            let next = UsageSnapshot::with_status(QuotaProvider::Kimi, SnapshotStatus::NotLoggedIn);
            let merged = merge_stale(&[good_snapshot()], vec![next]);
            assert!(merged[0].windows.is_empty());
        }

        #[test]
        fn disk_cache_round_trips_through_merge() {
            // Persist a good snapshot, then a fresh process (empty memory)
            // hitting TokenExpired merges from disk instead of going blank.
            let _lock = super::ENV_LOCK.lock().unwrap();
            let home = tempfile::tempdir().unwrap();
            let prev_home = std::env::var("OHMYC_HOME").ok();
            std::env::set_var("OHMYC_HOME", home.path());

            super::super::persist_cache(&[good_snapshot()]);
            let loaded = super::super::load_cache();
            assert_eq!(loaded.len(), 1);
            assert_eq!(loaded[0].windows.len(), 1);
            let merged = merge_stale(
                &loaded,
                vec![UsageSnapshot::with_status(
                    QuotaProvider::Kimi,
                    SnapshotStatus::TokenExpired,
                )],
            );
            assert!(matches!(merged[0].status, SnapshotStatus::TokenExpired));
            assert_eq!(merged[0].windows[0].used_percent, Some(42.0));

            match prev_home {
                Some(v) => std::env::set_var("OHMYC_HOME", v),
                None => std::env::remove_var("OHMYC_HOME"),
            }
        }
    }
}
