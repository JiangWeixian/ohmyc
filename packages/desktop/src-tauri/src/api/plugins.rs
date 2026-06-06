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
    Ok(PluginsResponse { plugins: plugins::list_plugins(&dir, &settings)? })
}

#[tauri::command]
pub fn plugins_get(id: String) -> Result<PluginResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    let Some(plugin) = plugins::get_plugin(&dir, &settings, &id)? else {
        return Err(ApiError::NotFound { kind: "plugin", name: id });
    };
    Ok(PluginResponse { plugin })
}

#[tauri::command]
pub fn marketplaces_list() -> Result<MarketplacesResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    Ok(MarketplacesResponse { marketplaces: plugins::list_marketplaces(&dir)? })
}

#[tauri::command]
pub fn marketplaces_get(id: String) -> Result<MarketplaceResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let Some(marketplace) = plugins::get_marketplace(&dir, &id)? else {
        return Err(ApiError::NotFound { kind: "marketplace", name: id });
    };
    Ok(MarketplaceResponse { marketplace })
}
