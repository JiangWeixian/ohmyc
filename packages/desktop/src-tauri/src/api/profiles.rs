//! Tauri command wrappers for ohmyc-core::profiles. The delete command
//! enforces the "cannot delete the active profile" gate — that policy
//! belongs at the API layer, not in the pure-store core.

use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
use ohmyc_core::profiles::activation;
use ohmyc_core::profiles::lock::LockGuard;
use ohmyc_core::profiles::{crud, preflight};
use ohmyc_core::store;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct ProfileListResponse {
    pub profiles: Vec<crud::Profile>,
    pub active: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProfileResponse {
    pub profile: crud::Profile,
}

#[derive(Debug, Serialize)]
pub struct DeleteOk {
    pub success: bool,
}

#[tauri::command]
pub fn profiles_list() -> Result<ProfileListResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let r = crud::list(&dir)?;
    Ok(ProfileListResponse {
        profiles: r.profiles,
        active: r.active,
    })
}

#[tauri::command]
pub fn profiles_get(name: String) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let Some(profile) = crud::get(&dir, &name)? else {
        return Err(ApiError::NotFound { kind: "profile", name });
    };
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_create(body: Value) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let profile = crud::create(&dir, &body)?;
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_update(name: String, body: Value) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let Some(profile) = crud::update(&dir, &name, &body)? else {
        return Err(ApiError::NotFound { kind: "profile", name });
    };
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_delete(name: String) -> Result<DeleteOk, ApiError> {
    let dir = store::store_profiles_dir()?;
    if let Some(active) = crud::read_active_profile_name(&dir)? {
        if active == name {
            return Err(ApiError::Conflict(format!(
                "Cannot delete active profile. Deactivate {name} before deleting it."
            )));
        }
    }
    let removed = crud::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "profile", name });
    }
    Ok(DeleteOk { success: true })
}

#[tauri::command]
pub fn profiles_preflight(name: String) -> Result<preflight::PreflightResult, ApiError> {
    let profiles_dir = store::store_profiles_dir()?;
    let store_dir = store::store_dir()?;
    let settings_path = claude_home::settings_path()?;
    preflight::preflight(&profiles_dir, &store_dir, &settings_path, &name)
}

#[derive(Serialize)]
pub struct ActivateResponse {
    pub success: bool,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn profiles_activate(name: String) -> Result<ActivateResponse, ApiError> {
    let base_dir = store::base_dir()?;
    let profiles_dir = store::store_profiles_dir()?;
    let store_dir = store::store_dir()?;
    let plugins_dir = claude_home::plugins_dir()?;
    let claude_settings = claude_home::settings_path()?;
    let _guard = LockGuard::try_acquire(&profiles_dir)?;
    let warnings = activation::activate(
        &base_dir,
        &profiles_dir,
        &store_dir,
        &plugins_dir,
        &claude_settings,
        &name,
    )?;
    Ok(ActivateResponse {
        success: true,
        warnings,
    })
}

#[tauri::command]
pub fn profiles_deactivate(_name: String) -> Result<DeleteOk, ApiError> {
    let base_dir = store::base_dir()?;
    let profiles_dir = store::store_profiles_dir()?;
    let plugins_dir = claude_home::plugins_dir()?;
    let claude_settings = claude_home::settings_path()?;
    let _guard = LockGuard::try_acquire(&profiles_dir)?;
    activation::deactivate(&base_dir, &profiles_dir, &plugins_dir, &claude_settings)?;
    Ok(DeleteOk { success: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Activation reads BOTH OHMYC_HOME (store/profiles) and
    // OHMYC_CLAUDE_HOME (plugins_dir + settings_path). The CLAUDE_HOME
    // var is also mutated by api/plugins.rs::tests, so we serialize all
    // env access in this module to prevent cross-test bleed. The mutex
    // is module-local — sibling modules with their own ENV_LOCK pattern
    // (see crates/ohmyc-core/src/claude_home.rs) are independent.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Override both env vars to the same tempdir for the duration of
    /// `f`, then restore. Panics propagate through (poisoning the lock,
    /// but `cargo test` aborts on poison anyway).
    fn with_isolated_env<F: FnOnce(&std::path::Path) -> R, R>(f: F) -> R {
        let _guard = ENV_LOCK.lock().unwrap();
        let tmp = tempfile::tempdir().unwrap();
        let prev_home = std::env::var("OHMYC_HOME").ok();
        let prev_claude = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        let result = f(tmp.path());
        match prev_home {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        match prev_claude {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        result
    }

    #[test]
    fn profiles_list_returns_empty_envelope_when_no_profiles() {
        let resp = with_isolated_env(|_| profiles_list()).unwrap();
        assert!(resp.profiles.is_empty());
        assert!(resp.active.is_none());
    }

    #[test]
    fn profiles_get_returns_not_found_for_missing_profile() {
        let r = with_isolated_env(|_| profiles_get("ghost".to_string()));
        assert!(matches!(r.unwrap_err(), ApiError::NotFound { .. }));
    }

    #[test]
    fn profiles_activate_returns_error_for_missing_profile() {
        let r = with_isolated_env(|_| profiles_activate("ghost".to_string()));
        assert!(r.is_err());
    }

    #[test]
    fn profiles_deactivate_is_no_op_when_no_active_profile() {
        let r = with_isolated_env(|_| profiles_deactivate("any-name".to_string()));
        assert!(r.is_ok());
    }
}
