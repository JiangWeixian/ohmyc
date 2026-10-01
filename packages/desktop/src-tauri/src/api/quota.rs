//! Tauri command wrappers for ohmyc-core::quota. Snapshots already serialize
//! to the camelCase frontend contract in core, so both commands pass the
//! `Vec<UsageSnapshot>` straight through.

use ohmyc_core::quota::UsageSnapshot;
use tauri::{AppHandle, State};

use crate::quota_poller::{refresh_now, QuotaCache};

/// Return the shared cache. If the poller has not landed its first fetch yet
/// (app just started), fetch synchronously once so first paint is not empty.
#[tauri::command]
pub fn quota_list(app: AppHandle, cache: State<'_, QuotaCache>) -> Vec<UsageSnapshot> {
    if cache.is_empty() {
        return refresh_now(&app, &cache);
    }
    cache.get()
}

/// Force a fresh fetch: updates the shared cache, broadcasts `quota:changed`,
/// and returns the new snapshots to the caller.
#[tauri::command]
pub fn quota_refresh(app: AppHandle, cache: State<'_, QuotaCache>) -> Vec<UsageSnapshot> {
    refresh_now(&app, &cache)
}
