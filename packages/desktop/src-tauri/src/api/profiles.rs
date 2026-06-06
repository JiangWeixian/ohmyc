//! Tauri command wrappers for ohmyc-core::profiles. The delete command
//! enforces the "cannot delete the active profile" gate — that policy
//! belongs at the API layer, not in the pure-store core.

use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
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
pub struct DeleteOk { pub success: bool }

#[tauri::command]
pub fn profiles_list() -> Result<ProfileListResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let r = crud::list(&dir)?;
    Ok(ProfileListResponse { profiles: r.profiles, active: r.active })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_list_returns_empty_envelope_when_no_profiles() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        let resp = r.unwrap();
        assert!(resp.profiles.is_empty());
        assert!(resp.active.is_none());
    }

    #[test]
    fn profiles_get_returns_not_found_for_missing_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_get("ghost".to_string());
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        assert!(matches!(r.unwrap_err(), ApiError::NotFound { .. }));
    }
}
