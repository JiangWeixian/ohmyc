//! Tauri command wrappers for ohmyc-core::settings.
//!
//! `project` parameter is accepted for web-side compatibility but
//! IGNORED on desktop (slice 4 scope: global-only). Desktop has no
//! project context — adding it would require a working-dir abstraction
//! that's out of scope.

use ohmyc_core::error::ApiError;
use ohmyc_core::settings::{self, SettingsRead, SettingsWrite};
use serde_json::Value;

#[tauri::command]
pub fn settings_get(_project: Option<String>) -> Result<SettingsRead, ApiError> {
    settings::read()
}

#[tauri::command]
pub fn settings_set(content: Value, _project: Option<String>) -> Result<SettingsWrite, ApiError> {
    settings::write(&content)
}
