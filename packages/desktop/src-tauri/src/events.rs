//! Spawns the ohmyc-core watcher on app setup and forwards every FsEvent
//! as a Tauri event named `fs:changed`. The watcher is stored on the
//! Tauri state so dropping it (and stopping the thread) only happens at
//! app shutdown.

use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;

use ohmyc_core::watcher::{self, FsEvent};
use tauri::{AppHandle, Emitter, Manager};

pub const FS_CHANGED_EVENT: &str = "fs:changed";

/// Keeps the debouncer alive for the lifetime of the app.
pub struct WatcherGuard {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

/// Set up the watcher and the forwarder thread. Stores the debouncer in
/// Tauri state. Returns Ok even if the watcher fails to spawn — the rest
/// of the app stays functional, and the user will see stale data instead
/// of a crash.
pub fn spawn_watcher(app: &AppHandle) {
    let paths = match watcher::default_watch_paths() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("watcher: default_watch_paths failed: {e}");
            return;
        }
    };

    let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
    let debouncer = match watcher::spawn(paths, tx) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("watcher: spawn failed: {e}");
            return;
        }
    };
    app.manage(WatcherGuard { _debouncer: debouncer });

    let app_for_thread = app.clone();
    thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            let _ = app_for_thread.emit(FS_CHANGED_EVENT, &event);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fs_changed_event_name_is_stable() {
        assert_eq!(FS_CHANGED_EVENT, "fs:changed");
    }
}
