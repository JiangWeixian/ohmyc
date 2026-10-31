//! Tauri command wrappers for OhMyC app settings (`settings.get` / `settings.set`).
//! A successful write applies side effects immediately: tray visibility,
//! poller wake, and a `settings:changed` broadcast carrying the fresh
//! resolved view so every window stays in sync.

use ohmyc_core::error::ApiError;
use ohmyc_core::settings::{self, ResolvedSettings, SettingsPatch};
use tauri::{AppHandle, Emitter, Manager};

use crate::quota_poller::PollerWake;

pub const SETTINGS_CHANGED_EVENT: &str = "settings:changed";

#[tauri::command]
pub fn settings_get() -> Result<ResolvedSettings, ApiError> {
    Ok(settings::resolve())
}

#[tauri::command]
pub fn settings_set(app: AppHandle, patch: SettingsPatch) -> Result<ResolvedSettings, ApiError> {
    validate_patch(&patch)?;
    settings::write_patch(&patch)?;
    // Side effects only after the write lands: a failed write must leave
    // native state (and other windows) untouched.
    if let Some(visible) = patch.menubar.as_ref().and_then(|m| m.icon_visible) {
        apply_menubar_visibility(&app, visible);
    }
    app.state::<PollerWake>().0.send(()).ok();
    let resolved = settings::resolve();
    let _ = app.emit(SETTINGS_CHANGED_EVENT, &resolved);
    Ok(resolved)
}

/// Show or hide the tray icon. No-op when the tray has not been built yet
/// (e.g. very early startup) — setup applies the resolved value once built.
pub fn apply_menubar_visibility(app: &AppHandle, visible: bool) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_visible(visible);
    }
}

fn validate_patch(patch: &SettingsPatch) -> Result<(), ApiError> {
    if let Some(secs) = patch.quota.as_ref().and_then(|q| q.poll_secs) {
        if secs == 0 {
            return Err(ApiError::Validation("quota.pollSecs must be > 0".to_string()));
        }
    }
    if let Some(intensity) = patch.theme.as_ref().and_then(|t| t.intensity.as_deref()) {
        if !matches!(intensity, "calm" | "expressive") {
            return Err(ApiError::Validation("theme.intensity must be calm or expressive".to_string()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ohmyc_core::settings::{QuotaSettings, ThemeSettings};

    #[test]
    fn patch_rejects_zero_poll_secs() {
        let patch = SettingsPatch {
            quota: Some(QuotaSettings {
                poll_secs: Some(0),
                ..QuotaSettings::default()
            }),
            ..SettingsPatch::default()
        };
        assert!(matches!(validate_patch(&patch), Err(ApiError::Validation(_))));
    }

    #[test]
    fn patch_rejects_unknown_theme_intensity() {
        let patch = SettingsPatch {
            theme: Some(ThemeSettings {
                id: None,
                intensity: Some("loud".to_string()),
            }),
            ..SettingsPatch::default()
        };
        assert!(matches!(validate_patch(&patch), Err(ApiError::Validation(_))));
    }

    #[test]
    fn patch_accepts_valid_values() {
        let patch = SettingsPatch {
            quota: Some(QuotaSettings {
                poll_secs: Some(60),
                ..QuotaSettings::default()
            }),
            theme: Some(ThemeSettings {
                id: Some("amber".to_string()),
                intensity: Some("calm".to_string()),
            }),
            ..SettingsPatch::default()
        };
        assert!(validate_patch(&patch).is_ok());
    }
}
