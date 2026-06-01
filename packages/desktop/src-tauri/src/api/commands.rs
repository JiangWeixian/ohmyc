use ohmyc_core::components::commands::{self, Command};
use ohmyc_core::components::commands_dir;
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

fn include_claude(filter: &Option<serde_json::Value>) -> bool {
    let Some(v) = filter.as_ref() else {
        return true;
    };
    match v {
        serde_json::Value::String(s) => s.split(',').any(|p| p.trim() == "claude"),
        serde_json::Value::Array(items) => items.iter().any(|i| i.as_str() == Some("claude")),
        _ => true,
    }
}

#[tauri::command]
pub fn commands_list(
    origins: Option<serde_json::Value>,
) -> Result<CommandsResponse, ApiError> {
    if !include_claude(&origins) {
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
