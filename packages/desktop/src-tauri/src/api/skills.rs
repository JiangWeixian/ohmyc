use ohmyc_core::components::skills::Skill;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct SkillsResponse {
    pub skills: Vec<Skill>,
}

#[derive(Serialize)]
pub struct SkillResponse {
    pub skill: Option<Skill>,
}

#[tauri::command]
pub fn skills_list(origins: Option<serde_json::Value>) -> Result<SkillsResponse, ApiError> {
    let parsed = super::parse_origins(&origins)?;
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let skills = registry.list_skills(parsed.as_deref())?;
    Ok(SkillsResponse { skills })
}

#[tauri::command]
pub fn skills_get(name: String, locator_id: Option<String>) -> Result<SkillResponse, ApiError> {
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let skills = registry.list_skills(None)?;
    let skill = match locator_id {
        Some(locator_id) => skills.into_iter().find(|skill| skill.locator_id == locator_id),
        None => skills.into_iter().find(|skill| skill.id == name),
    };
    Ok(SkillResponse { skill })
}
