use std::collections::BTreeSet;

use ohmyc_core::components::skills::{self, Skill};
use ohmyc_core::components::{agents_shared_skills_dir, skills_dir, Origin};
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
    let mut out = Vec::new();
    let mut seen = BTreeSet::new();
    if include_origin(&origins, "claude") {
        let dir = skills_dir()?;
        for skill in skills::list_with_origin(&dir, Origin::Claude)? {
            seen.insert(skill.id.clone());
            out.push(skill);
        }
    }
    if include_origin(&origins, "agents") {
        let dir = agents_shared_skills_dir()?;
        for skill in skills::list_with_origin(&dir, Origin::Agents)? {
            if seen.insert(skill.id.clone()) {
                out.push(skill);
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(SkillsResponse { skills: out })
}

#[tauri::command]
pub fn skills_get(name: String) -> Result<SkillResponse, ApiError> {
    let dir = skills_dir()?;
    let skill = match skills::get_with_origin(&dir, &name, Origin::Claude)? {
        Some(skill) => Some(skill),
        None => {
            let dir = agents_shared_skills_dir()?;
            skills::get_with_origin(&dir, &name, Origin::Agents)?
        }
    };
    Ok(SkillResponse { skill })
}
