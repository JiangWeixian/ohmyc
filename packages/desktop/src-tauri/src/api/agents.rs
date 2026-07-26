use ohmyc_core::components::agents::Agent;
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

#[tauri::command]
pub fn agents_list(origins: Option<serde_json::Value>) -> Result<AgentsResponse, ApiError> {
    let parsed = super::parse_origins(&origins)?;
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let agents = registry.list_agents(parsed.as_deref())?;
    Ok(AgentsResponse { agents })
}

#[tauri::command]
pub fn agents_get(name: String, locator_id: Option<String>) -> Result<AgentResponse, ApiError> {
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let agents = registry.list_agents(None)?;
    let agent = match locator_id {
        Some(locator_id) => agents.into_iter().find(|agent| agent.locator_id == locator_id),
        None => agents.into_iter().find(|agent| agent.id == name),
    };
    Ok(AgentResponse { agent })
}
