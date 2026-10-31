//! OhMyC app settings — `<ohmyc_home>/settings.json` storage and the
//! env > file > default resolution layer. Sparse on disk: only fields the
//! user explicitly set are written; missing fields resolve to defaults.
//! A missing or corrupt file resolves to all defaults, and the next
//! `write_patch` rewrites it as valid JSON.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::ApiError;
use crate::quota::types::QuotaProvider;

pub const DEFAULT_POLL_SECS: u64 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingSource {
    Env,
    Settings,
    Default,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSetting<T> {
    pub value: T,
    pub source: SettingSource,
    pub env_var: Option<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSettings {
    pub quota_enabled: ResolvedSetting<bool>,
    pub quota_poll_secs: ResolvedSetting<u64>,
    pub providers: BTreeMap<QuotaProvider, ResolvedSetting<bool>>,
    pub menubar_icon_visible: ResolvedSetting<bool>,
    pub theme_id: ResolvedSetting<String>,
    pub theme_intensity: ResolvedSetting<String>,
}

impl ResolvedSettings {
    /// Per-provider switch only — the master switch (`quota_enabled`) is
    /// ANDed in by the poller, not here.
    pub fn provider_enabled(&self, p: QuotaProvider) -> bool {
        self.providers.get(&p).is_some_and(|r| r.value)
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsFile {
    #[serde(default = "schema_version")]
    pub version: u32,
    pub quota: Option<QuotaSettings>,
    pub menubar: Option<MenubarSettings>,
    pub theme: Option<ThemeSettings>,
}

fn schema_version() -> u32 {
    1
}

/// A settings patch has the file's shape: every field is optional, and only
/// the present fields are merged into the existing file.
pub type SettingsPatch = AppSettingsFile;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaSettings {
    pub enabled: Option<bool>,
    pub poll_secs: Option<u64>,
    pub providers: Option<BTreeMap<QuotaProvider, ProviderSettings>>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettings {
    pub enabled: Option<bool>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenubarSettings {
    pub icon_visible: Option<bool>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub id: Option<String>,
    pub intensity: Option<String>,
}

pub fn settings_path() -> Result<PathBuf, ApiError> {
    Ok(crate::store::base_dir()?.join("settings.json"))
}

fn read_file_at(path: &Path) -> AppSettingsFile {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn write_patch(patch: &SettingsPatch) -> Result<(), ApiError> {
    let path = settings_path()?;
    write_patch_at(&path, patch)
}

fn write_patch_at(path: &Path, patch: &SettingsPatch) -> Result<(), ApiError> {
    let mut file = read_file_at(path);
    merge(&mut file, patch);
    file.version = schema_version();
    let raw = serde_json::to_string_pretty(&file)
        .map_err(|e| ApiError::Internal(format!("serialize settings.json: {e}")))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("create {}: {e}", parent.display())))?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, raw).map_err(|e| ApiError::Io(format!("write {}: {e}", tmp.display())))?;
    std::fs::rename(&tmp, path).map_err(|e| ApiError::Io(format!("rename to {}: {e}", path.display())))?;
    Ok(())
}

fn merge(file: &mut AppSettingsFile, patch: &SettingsPatch) {
    if let Some(pq) = &patch.quota {
        let quota = file.quota.get_or_insert_with(QuotaSettings::default);
        if pq.enabled.is_some() {
            quota.enabled = pq.enabled;
        }
        if pq.poll_secs.is_some() {
            quota.poll_secs = pq.poll_secs;
        }
        if let Some(providers) = &pq.providers {
            let target = quota.providers.get_or_insert_with(BTreeMap::new);
            for (provider, settings) in providers {
                if settings.enabled.is_some() {
                    target.insert(*provider, settings.clone());
                }
            }
        }
    }
    if let Some(pm) = &patch.menubar {
        let menubar = file.menubar.get_or_insert_with(MenubarSettings::default);
        if pm.icon_visible.is_some() {
            menubar.icon_visible = pm.icon_visible;
        }
    }
    if let Some(pt) = &patch.theme {
        let theme = file.theme.get_or_insert_with(ThemeSettings::default);
        if pt.id.is_some() {
            theme.id = pt.id.clone();
        }
        if pt.intensity.is_some() {
            theme.intensity = pt.intensity.clone();
        }
    }
}

pub fn resolve() -> ResolvedSettings {
    resolve_with(&read_file_at(&settings_path().unwrap_or_default()), &|name| std::env::var(name).ok())
}

fn pick_bool(
    env: &dyn Fn(&str) -> Option<String>,
    env_name: &'static str,
    file_value: Option<bool>,
    default: bool,
) -> ResolvedSetting<bool> {
    if let Some(value) = env(env_name).and_then(|v| parse_env_bool(&v)) {
        return ResolvedSetting { value, source: SettingSource::Env, env_var: Some(env_name) };
    }
    match file_value {
        Some(value) => ResolvedSetting { value, source: SettingSource::Settings, env_var: None },
        None => ResolvedSetting { value: default, source: SettingSource::Default, env_var: None },
    }
}

fn pick_string(
    env: &dyn Fn(&str) -> Option<String>,
    env_name: &'static str,
    file_value: Option<String>,
    default: &str,
) -> ResolvedSetting<String> {
    if let Some(value) = env(env_name).map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
        return ResolvedSetting { value, source: SettingSource::Env, env_var: Some(env_name) };
    }
    match file_value {
        Some(value) => ResolvedSetting { value, source: SettingSource::Settings, env_var: None },
        None => ResolvedSetting { value: default.to_string(), source: SettingSource::Default, env_var: None },
    }
}

fn parse_env_bool(value: &str) -> Option<bool> {
    match value.trim() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

fn provider_env(p: QuotaProvider) -> &'static str {
    match p {
        QuotaProvider::Claude => "OHMYC_QUOTA_CLAUDE_ENABLED",
        QuotaProvider::Codex => "OHMYC_QUOTA_CODEX_ENABLED",
        QuotaProvider::Cursor => "OHMYC_QUOTA_CURSOR_ENABLED",
        QuotaProvider::Grok => "OHMYC_QUOTA_GROK_ENABLED",
        QuotaProvider::Gemini => "OHMYC_QUOTA_GEMINI_ENABLED",
        QuotaProvider::Kimi => "OHMYC_QUOTA_KIMI_ENABLED",
        QuotaProvider::OpenCodeGo => "OHMYC_QUOTA_OPENCODE_ENABLED",
        QuotaProvider::Glm => "OHMYC_QUOTA_GLM_ENABLED",
    }
}

pub fn resolve_with(file: &AppSettingsFile, env: &dyn Fn(&str) -> Option<String>) -> ResolvedSettings {
    let quota = file.quota.clone().unwrap_or_default();
    let quota_enabled = pick_bool(env, "OHMYC_QUOTA_ENABLED", quota.enabled, true);
    let quota_poll_secs = match env("OHMYC_QUOTA_POLL_SECS")
        .and_then(|v| v.trim().parse::<u64>().ok())
        .filter(|secs| *secs > 0)
    {
        Some(value) => ResolvedSetting { value, source: SettingSource::Env, env_var: Some("OHMYC_QUOTA_POLL_SECS") },
        None => match quota.poll_secs {
            Some(value) => ResolvedSetting { value, source: SettingSource::Settings, env_var: None },
            None => ResolvedSetting { value: DEFAULT_POLL_SECS, source: SettingSource::Default, env_var: None },
        },
    };
    let provider_files = quota.providers.unwrap_or_default();
    let providers = QuotaProvider::ALL
        .into_iter()
        .map(|p| {
            let file_value = provider_files.get(&p).and_then(|s| s.enabled);
            let default = !matches!(p, QuotaProvider::Claude);
            (p, pick_bool(env, provider_env(p), file_value, default))
        })
        .collect();
    let menubar_icon_visible = pick_bool(
        env,
        "OHMYC_MENUBAR_ICON_ENABLED",
        file.menubar.as_ref().and_then(|m| m.icon_visible),
        true,
    );
    let theme = file.theme.clone().unwrap_or_default();
    let theme_id = pick_string(env, "OHMYC_THEME", theme.id, "phosphor");
    let theme_intensity = pick_string(env, "OHMYC_THEME_INTENSITY", theme.intensity, "expressive");
    ResolvedSettings {
        quota_enabled,
        quota_poll_secs,
        providers,
        menubar_icon_visible,
        theme_id,
        theme_intensity,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::types::QuotaProvider;
    use std::collections::BTreeMap;

    fn no_env(_: &str) -> Option<String> {
        None
    }

    fn file_with_claude(enabled: bool) -> AppSettingsFile {
        let mut providers = BTreeMap::new();
        providers.insert(QuotaProvider::Claude, ProviderSettings { enabled: Some(enabled) });
        AppSettingsFile {
            quota: Some(QuotaSettings {
                enabled: None,
                poll_secs: None,
                providers: Some(providers),
            }),
            ..AppSettingsFile::default()
        }
    }

    #[test]
    fn defaults_when_nothing_set() {
        let r = resolve_with(&AppSettingsFile::default(), &no_env);
        assert!(r.quota_enabled.value);
        assert!(!r.providers[&QuotaProvider::Claude].value);
        assert!(r.providers[&QuotaProvider::Codex].value);
        assert_eq!(r.quota_poll_secs.value, 300);
        assert!(r.menubar_icon_visible.value);
        assert_eq!(r.theme_id.value, "phosphor");
        assert_eq!(r.theme_intensity.value, "expressive");
        assert!(matches!(r.quota_enabled.source, SettingSource::Default));
        assert!(matches!(r.providers[&QuotaProvider::Claude].source, SettingSource::Default));
        assert!(matches!(r.theme_id.source, SettingSource::Default));
    }

    #[test]
    fn file_overrides_default() {
        let r = resolve_with(&file_with_claude(true), &no_env);
        assert!(r.providers[&QuotaProvider::Claude].value);
        assert!(matches!(r.providers[&QuotaProvider::Claude].source, SettingSource::Settings));
    }

    #[test]
    fn env_overrides_file() {
        let env = |name: &str| (name == "OHMYC_QUOTA_CLAUDE_ENABLED").then(|| "0".to_string());
        let r = resolve_with(&file_with_claude(true), &env);
        assert!(!r.providers[&QuotaProvider::Claude].value);
        assert!(matches!(r.providers[&QuotaProvider::Claude].source, SettingSource::Env));
        assert_eq!(r.providers[&QuotaProvider::Claude].env_var, Some("OHMYC_QUOTA_CLAUDE_ENABLED"));
    }

    #[test]
    fn invalid_env_ignored() {
        let env = |name: &str| match name {
            "OHMYC_QUOTA_POLL_SECS" => Some("0".to_string()),
            "OHMYC_QUOTA_CODEX_ENABLED" => Some("maybe".to_string()),
            _ => None,
        };
        let r = resolve_with(&AppSettingsFile::default(), &env);
        assert_eq!(r.quota_poll_secs.value, 300);
        assert!(matches!(r.quota_poll_secs.source, SettingSource::Default));
        assert!(r.providers[&QuotaProvider::Codex].value);
        assert!(matches!(r.providers[&QuotaProvider::Codex].source, SettingSource::Default));
        let env_abc = |name: &str| (name == "OHMYC_QUOTA_POLL_SECS").then(|| "abc".to_string());
        assert_eq!(resolve_with(&AppSettingsFile::default(), &env_abc).quota_poll_secs.value, 300);
    }

    #[test]
    fn explicit_env_disable_is_env_source() {
        let env = |name: &str| (name == "OHMYC_QUOTA_CLAUDE_ENABLED").then(|| "0".to_string());
        let r = resolve_with(&AppSettingsFile::default(), &env);
        assert!(!r.providers[&QuotaProvider::Claude].value);
        assert!(matches!(r.providers[&QuotaProvider::Claude].source, SettingSource::Env));
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let dir = std::env::temp_dir().join(format!("ohmyc-settings-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, "{ not json").unwrap();
        let file = read_file_at(&path);
        let r = resolve_with(&file, &no_env);
        assert!(r.quota_enabled.value);
        write_patch_at(&path, &SettingsPatch::default()).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(serde_json::from_str::<serde_json::Value>(&raw).is_ok());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
