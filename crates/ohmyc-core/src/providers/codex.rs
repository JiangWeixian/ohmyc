use std::path::{Path, PathBuf};

use crate::components::{
    agents::{parse_codex_toml_agent, Agent},
    commands::{parse_codex_prompt, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct CodexProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl CodexProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::codex_home()?,
            project_root: None,
        })
    }

    pub fn from_home(home: PathBuf) -> Self {
        Self {
            home,
            project_root: None,
        }
    }

    pub fn with_project_root(mut self, project_root: PathBuf) -> Self {
        self.project_root = Some(project_root);
        self
    }

    pub fn agents(&self) -> Result<Vec<Agent>, ApiError> {
        let mut out = self.read_agents_dir(&self.home.join("agents"), Scope::Global)?;
        if let Some(project_root) = &self.project_root {
            out.extend(self.read_agents_dir(&project_root.join(".codex").join("agents"), Scope::Project)?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn read_agents_dir(&self, dir: &Path, scope: Scope) -> Result<Vec<Agent>, ApiError> {
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
            let entry = entry.map_err(ApiError::from)?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("toml") {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let raw =
                std::fs::read_to_string(&path).map_err(|e| ApiError::Io(format!("read {}: {e}", path.display())))?;
            if let Some(agent) = parse_codex_toml_agent(filename, &raw, &path, scope)? {
                out.push(agent);
            }
        }
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Codex],
            SourceProvider::Codex,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".codex").join("skills"),
                vec![Origin::Codex],
                SourceProvider::Codex,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn skills_from_plugins(&self) -> Result<Vec<Skill>, ApiError> {
        let cache = self.home.join("plugins").join("cache");
        let mut out = Vec::new();
        for plugin in crate::plugins::list_codex_plugins(&cache)? {
            let Some(first) = plugin.installs.first() else {
                continue;
            };
            out.extend(crate::plugins::parse_codex_plugin_skills(
                std::path::Path::new(&first.install_path),
                &plugin.id,
            )?);
        }
        Ok(out)
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = self.read_prompts_dir(&self.home.join("prompts"), Scope::Global)?;
        if let Some(project_root) = &self.project_root {
            out.extend(self.read_prompts_dir(&project_root.join(".codex").join("prompts"), Scope::Project)?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn read_prompts_dir(&self, dir: &Path, scope: Scope) -> Result<Vec<Command>, ApiError> {
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
            let entry = entry.map_err(ApiError::from)?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let raw =
                std::fs::read_to_string(&path).map_err(|e| ApiError::Io(format!("read {}: {e}", path.display())))?;
            if let Some(command) = parse_codex_prompt(filename, &raw, &path, scope)? {
                out.push(command);
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_provider_reads_toml_agents_and_legacy_prompts() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("prompts")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/review")).unwrap();
        std::fs::write(
            tmp.path().join("agents/reviewer.toml"),
            r#"
name = "reviewer"
description = "Reviews PRs"
developer_instructions = """
Review correctness, security, and missing tests.
"""
"#,
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("prompts/draftpr.md"),
            "---\ndescription: Draft a PR\nargument-hint: FILES=<paths>\n---\nDraft a PR for $FILES.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: Review code\n---\nSkill body",
        )
        .unwrap();

        let provider = CodexProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(provider.agents().unwrap()[0].id, "reviewer");
        assert_eq!(
            provider.skills().unwrap()[0].origins,
            vec![crate::components::Origin::Codex],
        );
        assert_eq!(provider.commands().unwrap()[0].id, "draftpr");
        assert_eq!(
            provider.commands().unwrap()[0].origins,
            vec![crate::components::Origin::Codex],
        );
    }
}
