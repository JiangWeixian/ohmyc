//! Tauri command wrappers for OhMyC app settings (`settings.get` / `settings.set`).
//! Event broadcast and side effects (poller wake, tray visibility) are wired
//! in the settings-sync task.

use ohmyc_core::error::ApiError;
use ohmyc_core::settings::{self, ResolvedSettings, SettingsPatch};

#[tauri::command]
pub fn settings_get() -> Result<ResolvedSettings, ApiError> {
    Ok(settings::resolve())
}

#[tauri::command]
pub fn settings_set(patch: SettingsPatch) -> Result<ResolvedSettings, ApiError> {
    settings::write_patch(&patch)?;
    Ok(settings::resolve())
}
