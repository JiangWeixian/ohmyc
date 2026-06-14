use ohmyc_core::components::skills::{self, Skill};
use ohmyc_core::components::skills_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

use super::include_origin;

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
    if !include_origin(&origins, "claude") {
        return Ok(SkillsResponse { skills: Vec::new() });
    }
    let dir = skills_dir()?;
    let skills = skills::list(&dir)?;
    Ok(SkillsResponse { skills })
}

#[tauri::command]
pub fn skills_get(name: String) -> Result<SkillResponse, ApiError> {
    let dir = skills_dir()?;
    let skill = skills::get(&dir, &name)?;
    Ok(SkillResponse { skill })
}
