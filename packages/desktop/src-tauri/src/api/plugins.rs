use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
use ohmyc_core::plugins::{self, InstalledPlugin, Marketplace};
use serde::Serialize;
use std::collections::BTreeSet;

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
    let mut plugins = plugins::list_plugins(&dir, &settings)?;
    let mut seen: BTreeSet<String> = plugins.iter().map(|plugin| plugin.id.clone()).collect();
    let codex_dir = plugins::codex_plugins_cache_dir()?;
    for plugin in plugins::list_codex_plugins(&codex_dir)? {
        if seen.insert(plugin.id.clone()) {
            plugins.push(plugin);
        }
    }
    plugins.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.marketplace.cmp(&b.marketplace)));
    Ok(PluginsResponse { plugins })
}

#[tauri::command]
pub fn plugins_get(id: String) -> Result<PluginResponse, ApiError> {
    let dir = claude_home::plugins_dir()?;
    let settings = claude_home::settings_path()?;
    let plugin = match plugins::get_plugin(&dir, &settings, &id)? {
        Some(plugin) => Some(plugin),
        None => {
            let codex_dir = plugins::codex_plugins_cache_dir()?;
            plugins::list_codex_plugins(&codex_dir)?
                .into_iter()
                .find(|plugin| plugin.id == id)
        }
    };
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

    // Both smoke tests touch the process-global OHMYC_CLAUDE_HOME. They are
    // race-safe because they only assert "empty envelope" — whichever value
    // wins the race, the temp dir has no registry files, so the result is
    // the same. If a future test asserts env-dependent values, lift these
    // behind a Mutex like crates/ohmyc-core/src/claude_home.rs::ENV_LOCK.

    #[test]
    fn plugins_list_returns_empty_envelope_when_no_registry() {
        let tmp = tempfile::tempdir().unwrap();
        let codex_tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        let prev_codex = std::env::var("OHMYC_CODEX_PLUGINS_CACHE").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", tmp.path());
        std::env::set_var("OHMYC_CODEX_PLUGINS_CACHE", codex_tmp.path());
        let result = plugins_list();
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
