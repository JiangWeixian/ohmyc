//! Tauri command wrappers for ohmyc-core::store CRUD. 4 entity types ×
//! 5 ops (list/get/create/update/delete). Delete commands honor a
//! `force` flag — when false, refuse if any profile references the
//! component and return Conflict with the referencing profile names.

use ohmyc_core::components::{agents, commands, skills};
use ohmyc_core::components::agents::Agent;
use ohmyc_core::components::commands::Command;
use ohmyc_core::components::skills::Skill;
use ohmyc_core::error::ApiError;
use ohmyc_core::store::{
    self,
    model_configs::{self, ModelConfig},
    provenance::{self, ComponentKind, Provenance},
    references,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize)]
pub struct AgentDto {
    #[serde(flatten)]
    pub agent: Agent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct SkillDto {
    #[serde(flatten)]
    pub skill: Skill,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct CommandDto {
    #[serde(flatten)]
    pub command: Command,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct ModelConfigDto {
    #[serde(flatten)]
    pub config: ModelConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct ListAgents { pub agents: Vec<AgentDto> }
#[derive(Serialize)]
pub struct GetAgent { pub agent: AgentDto }
#[derive(Serialize)]
pub struct ListSkills { pub skills: Vec<SkillDto> }
#[derive(Serialize)]
pub struct GetSkill { pub skill: SkillDto }
#[derive(Serialize)]
pub struct ListCommands { pub commands: Vec<CommandDto> }
#[derive(Serialize)]
pub struct GetCommand { pub command: CommandDto }
#[derive(Serialize)]
pub struct ListModelConfigs {
    #[serde(rename = "modelConfigs")]
    pub model_configs: Vec<ModelConfigDto>,
}
#[derive(Serialize)]
pub struct GetModelConfig {
    #[serde(rename = "modelConfig")]
    pub config: ModelConfigDto,
}
#[derive(Serialize)]
pub struct DeleteOk { pub success: bool }

fn attach_provenance<T>(kind: ComponentKind, id: &str, item: T) -> Result<(T, Option<Provenance>), ApiError> {
    let idx_path = store::provenance_index_path()?;
    let p = provenance::get(&idx_path, kind, id)?;
    Ok((item, p))
}

// --- Agents ---

#[tauri::command]
pub fn store_agents_list() -> Result<ListAgents, ApiError> {
    let dir = store::store_agents_dir()?;
    let raw = agents::list(&dir)?;
    let mut out: Vec<AgentDto> = Vec::with_capacity(raw.len());
    for a in raw {
        let id = a.id.clone();
        let (agent, provenance) = attach_provenance(ComponentKind::Agents, &id, a)?;
        out.push(AgentDto { agent, provenance });
    }
    Ok(ListAgents { agents: out })
}

#[tauri::command]
pub fn store_agents_get(name: String) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let a = agents::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "agent", name: name.clone() })?;
    let (agent, provenance) = attach_provenance(ComponentKind::Agents, &name, a)?;
    Ok(GetAgent { agent: AgentDto { agent, provenance } })
}

#[derive(Deserialize)]
pub struct CreateAgentBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_agents_create(body: CreateAgentBody) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let a = agents::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetAgent { agent: AgentDto { agent: a, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateAgentBody {
    pub frontmatter: Option<Value>,
    pub content: Option<String>,
}

#[tauri::command]
pub fn store_agents_update(name: String, body: UpdateAgentBody) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let updated = agents::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "agent", name: name.clone() })?;
    Ok(GetAgent { agent: AgentDto { agent: updated, provenance: None } })
}

#[tauri::command]
pub fn store_agents_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Agents, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::ReferencedBy { kind: "agent", name, profiles: refs });
        }
    }
    let dir = store::store_agents_dir()?;
    let removed = agents::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "agent", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Skills ---

#[tauri::command]
pub fn store_skills_list() -> Result<ListSkills, ApiError> {
    let dir = store::store_skills_dir()?;
    let raw = skills::list(&dir)?;
    let mut out: Vec<SkillDto> = Vec::with_capacity(raw.len());
    for s in raw {
        let id = s.id.clone();
        let (skill, provenance) = attach_provenance(ComponentKind::Skills, &id, s)?;
        out.push(SkillDto { skill, provenance });
    }
    Ok(ListSkills { skills: out })
}

#[tauri::command]
pub fn store_skills_get(name: String) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let s = skills::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "skill", name: name.clone() })?;
    let (skill, provenance) = attach_provenance(ComponentKind::Skills, &name, s)?;
    Ok(GetSkill { skill: SkillDto { skill, provenance } })
}

#[derive(Deserialize)]
pub struct CreateSkillBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_skills_create(body: CreateSkillBody) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let s = skills::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetSkill { skill: SkillDto { skill: s, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateSkillBody { pub frontmatter: Option<Value>, pub content: Option<String> }

#[tauri::command]
pub fn store_skills_update(name: String, body: UpdateSkillBody) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let updated = skills::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "skill", name: name.clone() })?;
    Ok(GetSkill { skill: SkillDto { skill: updated, provenance: None } })
}

#[tauri::command]
pub fn store_skills_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Skills, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::ReferencedBy { kind: "skill", name, profiles: refs });
        }
    }
    let dir = store::store_skills_dir()?;
    let removed = skills::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "skill", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Commands ---

#[tauri::command]
pub fn store_commands_list() -> Result<ListCommands, ApiError> {
    let dir = store::store_commands_dir()?;
    let raw = commands::list(&dir)?;
    let mut out: Vec<CommandDto> = Vec::with_capacity(raw.len());
    for c in raw {
        let id = c.id.clone();
        let (command, provenance) = attach_provenance(ComponentKind::Commands, &id, c)?;
        out.push(CommandDto { command, provenance });
    }
    Ok(ListCommands { commands: out })
}

#[tauri::command]
pub fn store_commands_get(name: String) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let c = commands::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "command", name: name.clone() })?;
    let (command, provenance) = attach_provenance(ComponentKind::Commands, &name, c)?;
    Ok(GetCommand { command: CommandDto { command, provenance } })
}

#[derive(Deserialize)]
pub struct CreateCommandBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_commands_create(body: CreateCommandBody) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let c = commands::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetCommand { command: CommandDto { command: c, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateCommandBody { pub frontmatter: Option<Value>, pub content: Option<String> }

#[tauri::command]
pub fn store_commands_update(name: String, body: UpdateCommandBody) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let updated = commands::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "command", name: name.clone() })?;
    Ok(GetCommand { command: CommandDto { command: updated, provenance: None } })
}

#[tauri::command]
pub fn store_commands_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Commands, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::ReferencedBy { kind: "command", name, profiles: refs });
        }
    }
    let dir = store::store_commands_dir()?;
    let removed = commands::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "command", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Model configs ---

#[tauri::command]
pub fn store_model_configs_list() -> Result<ListModelConfigs, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let raw = model_configs::list(&dir)?;
    let mut out: Vec<ModelConfigDto> = Vec::with_capacity(raw.len());
    for c in raw {
        let id = c.name.clone();
        let (config, provenance) = attach_provenance(ComponentKind::ModelConfigs, &id, c)?;
        out.push(ModelConfigDto { config, provenance });
    }
    Ok(ListModelConfigs { model_configs: out })
}

#[tauri::command]
pub fn store_model_configs_get(name: String) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let c = model_configs::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "model-config", name: name.clone() })?;
    let (config, provenance) = attach_provenance(ComponentKind::ModelConfigs, &name, c)?;
    Ok(GetModelConfig { config: ModelConfigDto { config, provenance } })
}

#[tauri::command]
pub fn store_model_configs_create(body: ModelConfig) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let c = model_configs::create(&dir, &body)?;
    Ok(GetModelConfig { config: ModelConfigDto { config: c, provenance: None } })
}

#[tauri::command]
pub fn store_model_configs_update(
    name: String,
    body: Value,
) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let updated = model_configs::update(&dir, &name, &body)?
        .ok_or_else(|| ApiError::NotFound { kind: "model-config", name: name.clone() })?;
    Ok(GetModelConfig { config: ModelConfigDto { config: updated, provenance: None } })
}

#[tauri::command]
pub fn store_model_configs_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::ModelConfigs, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::ReferencedBy { kind: "model-config", name, profiles: refs });
        }
    }
    let dir = store::store_model_configs_dir()?;
    let removed = model_configs::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "model-config", name });
    }
    Ok(DeleteOk { success: true })
}
