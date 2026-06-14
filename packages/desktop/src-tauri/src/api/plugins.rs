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
pub fn plugins_list() -> Result<PluginsResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    Ok(PluginsResponse {
        plugins: plugins::list_plugins(&dir, &settings)?,
    })
}

#[tauri::command]
pub fn plugins_get(id: String) -> Result<PluginResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    let Some(plugin) = plugins::get_plugin(&dir, &settings, &id)? else {
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

    // Both smoke tests touch the process-global OHMYC_CLAUDE_HOME. They are
    // race-safe because they only assert "empty envelope" — whichever value
    // wins the race, the temp dir has no registry files, so the result is
    // the same. If a future test asserts env-dependent values, lift these
    // behind a Mutex like crates/ohmyc-core/src/claude_home.rs::ENV_LOCK.

    #[test]
    fn plugins_list_returns_empty_envelope_when_no_registry() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        let result = plugins_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
        assert!(result.unwrap().plugins.is_empty());
    }

    #[test]
    fn marketplaces_list_returns_empty_envelope_when_no_registry() {
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
}
