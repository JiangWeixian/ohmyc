//! Tauri command wrappers for ohmyc-core::quota. Snapshots already serialize
//! to the camelCase frontend contract in core, so both commands pass the
//! `Vec<UsageSnapshot>` straight through.

use ohmyc_core::quota::UsageSnapshot;
use tauri::{AppHandle, Manager};

use crate::quota_poller::{refresh_now, QuotaCache};

/// Return the shared cache. If the poller has not landed its first fetch yet
/// (app just started), fetch once so first paint is not empty. The fetch is
/// blocking I/O across eight providers — it must run on a blocking worker,
/// never on Tauri's main-thread command path.
#[tauri::command]
pub async fn quota_list(app: AppHandle) -> Result<Vec<UsageSnapshot>, String> {
    let cached = app.state::<QuotaCache>().get();
    if !cached.is_empty() {
        return Ok(cached);
    }
    tauri::async_runtime::spawn_blocking(move || refresh_now(&app))
        .await
        .map_err(|e| format!("quota refresh task failed: {e}"))
}

/// Force a fresh fetch: updates the shared cache, broadcasts `quota:changed`,
/// and returns the new snapshots to the caller.
#[tauri::command]
pub async fn quota_refresh(app: AppHandle) -> Result<Vec<UsageSnapshot>, String> {
    tauri::async_runtime::spawn_blocking(move || refresh_now(&app))
        .await
        .map_err(|e| format!("quota refresh task failed: {e}"))
}
