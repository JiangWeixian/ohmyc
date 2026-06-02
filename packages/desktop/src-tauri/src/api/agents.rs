use ohmyc_core::components::agents::{self, Agent};
use ohmyc_core::components::agents_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

use super::include_origin;

#[derive(Serialize)]
pub struct AgentsResponse {
    pub agents: Vec<Agent>,
}

#[derive(Serialize)]
pub struct AgentResponse {
    pub agent: Option<Agent>,
}

#[tauri::command]
pub fn agents_list(
    origins: Option<serde_json::Value>,
) -> Result<AgentsResponse, ApiError> {
    if !include_origin(&origins, "claude") {
        return Ok(AgentsResponse { agents: Vec::new() });
    }
    let dir = agents_dir()?;
    let agents = agents::list(&dir)?;
    Ok(AgentsResponse { agents })
}

#[tauri::command]
pub fn agents_get(name: String) -> Result<AgentResponse, ApiError> {
    let dir = agents_dir()?;
    let agent = agents::get(&dir, &name)?;
    Ok(AgentResponse { agent })
}
