use ohmyc_core::components::commands::{self, Command};
use ohmyc_core::components::commands_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

use super::include_origin;

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
    if !include_origin(&origins, "claude") {
        return Ok(CommandsResponse { commands: Vec::new() });
    }
    let dir = commands_dir()?;
    let commands = commands::list(&dir)?;
    Ok(CommandsResponse { commands })
}

#[tauri::command]
pub fn commands_get(name: String) -> Result<CommandResponse, ApiError> {
    let dir = commands_dir()?;
    let command = commands::get(&dir, &name)?;
    Ok(CommandResponse { command })
}
