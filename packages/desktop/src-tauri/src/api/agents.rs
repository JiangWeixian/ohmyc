use ohmyc_core::components::agents::{self, Agent};
use ohmyc_core::components::agents_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct AgentsResponse {
    pub agents: Vec<Agent>,
}

#[derive(Serialize)]
pub struct AgentResponse {
    pub agent: Option<Agent>,
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
pub fn agents_list(
    origins: Option<serde_json::Value>,
) -> Result<AgentsResponse, ApiError> {
    if !include_claude(&origins) {
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
