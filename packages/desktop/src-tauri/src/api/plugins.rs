use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
use ohmyc_core::plugins::{self, InstalledPlugin, Marketplace};
use serde::Serialize;

#[derive(Serialize)]
pub struct PluginsResponse {
    pub plugins: Vec<InstalledPlugin>,
}

#[derive(Serialize)]
pub struct PluginResponse {
    pub plugin: InstalledPlugin,
}

#[derive(Serialize)]
pub struct MarketplacesResponse {
    pub marketplaces: Vec<Marketplace>,
}

#[derive(Serialize)]
pub struct MarketplaceResponse {
    pub marketplace: Marketplace,
}

#[tauri::command]
pub fn plugins_list(origins: Option<serde_json::Value>) -> Result<PluginsResponse, ApiError> {
    let parsed = super::parse_origins(&origins)?;
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let plugins = registry.list_plugins(parsed.as_deref())?;
    Ok(PluginsResponse { plugins })
}

#[tauri::command]
pub fn plugins_get(id: String, locator_id: Option<String>) -> Result<PluginResponse, ApiError> {
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let plugin = registry.get_plugin(&id, locator_id.as_deref())?;
    let Some(plugin) = plugin else {
        return Err(ApiError::NotFound {
            kind: "plugin",
            name: id,
        });
    };
    Ok(PluginResponse { plugin })
}

#[tauri::command]
pub fn marketplaces_list() -> Result<MarketplacesResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    Ok(MarketplacesResponse {
        marketplaces: plugins::list_marketplaces(&dir)?,
    })
}

#[tauri::command]
pub fn marketplaces_get(id: String) -> Result<MarketplaceResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let Some(marketplace) = plugins::get_marketplace(&dir, &id)? else {
        return Err(ApiError::NotFound {
            kind: "marketplace",
            name: id,
        });
    };
    Ok(MarketplaceResponse { marketplace })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn plugins_list_returns_empty_envelope_when_no_registry() {
        let _lock = ENV_LOCK.lock().unwrap();
        let tmp = tempfile::tempdir().unwrap();
        let codex_tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        let prev_codex = std::env::var("OHMYC_CODEX_PLUGINS_CACHE").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        std::env::set_var("OHMYC_CODEX_PLUGINS_CACHE", codex_tmp.path());
        let result = plugins_list(None);
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        match prev_codex {
            Some(v) => std::env::set_var("OHMYC_CODEX_PLUGINS_CACHE", v),
            None => std::env::remove_var("OHMYC_CODEX_PLUGINS_CACHE"),
        }
        assert!(result.unwrap().plugins.is_empty());
    }

    #[test]
    fn marketplaces_list_returns_empty_envelope_when_no_registry() {
        let _lock = ENV_LOCK.lock().unwrap();
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        let result = marketplaces_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        assert!(result.unwrap().marketplaces.is_empty());
    }

    #[test]
    fn plugins_list_filters_codex_and_get_uses_locator() {
        let _lock = ENV_LOCK.lock().unwrap();
        let claude_home = tempfile::tempdir().unwrap();
        let codex_cache = tempfile::tempdir().unwrap();
        let claude_install = claude_home.path().join("installed/toolbox");
        let codex_install = codex_cache.path().join("local/toolbox/1.0.0");
        std::fs::create_dir_all(claude_home.path().join("plugins")).unwrap();
        std::fs::create_dir_all(&claude_install).unwrap();
        std::fs::create_dir_all(codex_install.join(".codex-plugin")).unwrap();
        std::fs::write(
            claude_install.join("plugin.json"),
            r#"{"name":"toolbox","version":"1.0.0"}"#,
        )
        .unwrap();
        std::fs::write(
            codex_install.join(".codex-plugin/plugin.json"),
            r#"{"name":"toolbox","version":"1.0.0"}"#,
        )
        .unwrap();
        std::fs::write(
            claude_home.path().join("plugins/installed_plugins.json"),
            serde_json::json!({
                "version": 2,
                "plugins": {
                    "toolbox@local": [{
                        "version": "1.0.0",
                        "installedAt": "2026-01-01",
                        "lastUpdated": "2026-01-01",
                        "installPath": claude_install.to_string_lossy(),
                        "scope": "user"
                    }]
                }
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            claude_home.path().join("settings.json"),
            r#"{"enabledPlugins":{"toolbox@local":true}}"#,
        )
        .unwrap();

        let prev_claude = std::env::var("OHMYC_CLAUDE_HOME").ok();
        let prev_codex = std::env::var("OHMYC_CODEX_PLUGINS_CACHE").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", claude_home.path());
        std::env::set_var("OHMYC_CODEX_PLUGINS_CACHE", codex_cache.path());

        let codex_plugins = plugins_list(Some(serde_json::json!("codex"))).unwrap().plugins;
        let locator_id = codex_plugins[0].locator_id.clone();
        let got = plugins_get("toolbox@local".to_string(), Some(locator_id))
            .unwrap()
            .plugin;

        match prev_claude {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        match prev_codex {
            Some(v) => std::env::set_var("OHMYC_CODEX_PLUGINS_CACHE", v),
            None => std::env::remove_var("OHMYC_CODEX_PLUGINS_CACHE"),
        }

        assert_eq!(codex_plugins.len(), 1);
        assert_eq!(
            codex_plugins[0].source_provider,
            ohmyc_core::components::SourceProvider::Codex
        );
        assert_eq!(got.source_provider, ohmyc_core::components::SourceProvider::Codex);
    }
}
