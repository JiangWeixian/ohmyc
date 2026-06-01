use ohmyc_core::components::skills::{self, Skill};
use ohmyc_core::components::skills_dir;
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
pub fn skills_list(
    origins: Option<serde_json::Value>,
) -> Result<SkillsResponse, ApiError> {
    if !include_claude(&origins) {
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
