use ohmyc_core::components::commands::Command;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct CommandsResponse {
    pub commands: Vec<Command>,
}

#[derive(Serialize)]
pub struct CommandResponse {
    pub command: Option<Command>,
}

#[tauri::command]
pub fn commands_list(origins: Option<serde_json::Value>) -> Result<CommandsResponse, ApiError> {
    let parsed = super::parse_origins(&origins)?;
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let commands = registry.list_commands(parsed.as_deref())?;
    Ok(CommandsResponse { commands })
}

#[tauri::command]
pub fn commands_get(name: String, locator_id: Option<String>) -> Result<CommandResponse, ApiError> {
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let commands = registry.list_commands(None)?;
    let command = match locator_id {
        Some(locator_id) => commands.into_iter().find(|command| command.locator_id == locator_id),
        None => commands.into_iter().find(|command| command.id == name),
    };
    Ok(CommandResponse { command })
}
