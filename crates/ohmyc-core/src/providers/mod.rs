pub mod claude;
pub mod codex;
pub mod opencode;
pub mod paths;
pub mod shared_agents;

use crate::components::Origin;
use crate::components::{agents::Agent, commands::Command, skills::Skill};
use crate::error::ApiError;

pub struct ProviderRegistry {
    cwd: std::path::PathBuf,
    project_root: std::path::PathBuf,
}

impl ProviderRegistry {
    pub fn new(cwd: impl Into<std::path::PathBuf>) -> Self {
        let cwd = cwd.into();
        let project_root = paths::find_project_root(&cwd);
        Self { cwd, project_root }
    }

    pub fn current_dir() -> Result<Self, ApiError> {
        let cwd = std::env::current_dir().map_err(|e| ApiError::Io(format!("current_dir: {e}")))?;
        Ok(Self::new(cwd))
    }

    pub fn cwd(&self) -> &std::path::Path {
        &self.cwd
    }

    pub fn project_root(&self) -> &std::path::Path {
        &self.project_root
    }

    pub fn list_agents(&self, origins: Option<&[Origin]>) -> Result<Vec<Agent>, ApiError> {
        // Providers are intentionally stateless: each API reads only the
        // requested resource type. A shared inventory cache would need
        // watcher-driven invalidation across project roots, origin filters,
        // and plugin enablement, which is not needed for the first version.
        let mut out = Vec::new();
        out.extend(
            claude::ClaudeProvider::new()?
                .with_project_root(self.project_root.clone())
                .agents()?,
        );
        out.extend(
            codex::CodexProvider::new()?
                .with_project_root(self.project_root.clone())
                .agents()?,
        );
        out.extend(
            opencode::OpenCodeProvider::new()?
                .with_project_root(self.project_root.clone())
                .agents()?,
        );
        out.retain(|agent| matches_origin_filter(origins, &agent.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn list_skills(&self, origins: Option<&[Origin]>) -> Result<Vec<Skill>, ApiError> {
        // Keep this skills-only. Do not call a plugin or provider helper that
        // parses agents/commands as a side effect; cross-resource caching is
        // a later optimization once watcher invalidation is mature.
        let mut out = Vec::new();
        let codex = codex::CodexProvider::new()?.with_project_root(self.project_root.clone());
        out.extend(
            claude::ClaudeProvider::new()?
                .with_project_root(self.project_root.clone())
                .skills()?,
        );
        out.extend(
            shared_agents::SharedAgentsProvider::new()?
                .with_project_root(self.project_root.clone())
                .skills()?,
        );
        out.extend(codex.skills()?);
        out.extend(codex.skills_from_plugins()?);
        out.extend(
            opencode::OpenCodeProvider::new()?
                .with_project_root(self.project_root.clone())
                .skills()?,
        );
        out.retain(|skill| matches_origin_filter(origins, &skill.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn list_commands(&self, origins: Option<&[Origin]>) -> Result<Vec<Command>, ApiError> {
        // Commands are parsed independently for the same reason as agents and
        // skills: this keeps refresh behavior simple and avoids stale cache
        // state after config or plugin changes.
        let mut out = Vec::new();
        out.extend(
            claude::ClaudeProvider::new()?
                .with_project_root(self.project_root.clone())
                .commands()?,
        );
        out.extend(
            codex::CodexProvider::new()?
                .with_project_root(self.project_root.clone())
                .commands()?,
        );
        out.extend(
            opencode::OpenCodeProvider::new()?
                .with_project_root(self.project_root.clone())
                .commands()?,
        );
        out.retain(|command| matches_origin_filter(origins, &command.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }
}

pub fn matches_origin_filter(filter: Option<&[Origin]>, resource_origins: &[Origin]) -> bool {
    let Some(filter) = filter else {
        return true;
    };
    filter
        .iter()
        .any(|selected| resource_origins.iter().any(|origin| origin == selected))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_filter_matches_resources_with_any_selected_origin() {
        assert!(matches_origin_filter(None, &[crate::components::Origin::Codex]));
        assert!(matches_origin_filter(
            Some(&[crate::components::Origin::Opencode]),
            &[crate::components::Origin::Codex, crate::components::Origin::Opencode,],
        ));
        assert!(!matches_origin_filter(
            Some(&[crate::components::Origin::Claude]),
            &[crate::components::Origin::Codex, crate::components::Origin::Opencode,],
        ));
    }

    #[test]
    fn registry_lists_shared_and_codex_skills_for_codex_origin() {
        let codex_home = tempfile::tempdir().unwrap();
        let shared_home = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(codex_home.path().join("skills/native")).unwrap();
        std::fs::create_dir_all(shared_home.path().join("skills/shared")).unwrap();
        std::fs::write(
            codex_home.path().join("skills/native/SKILL.md"),
            "---\nname: native\ndescription: Native\n---\nBody",
        )
        .unwrap();
        std::fs::write(
            shared_home.path().join("skills/shared/SKILL.md"),
            "---\nname: shared\ndescription: Shared\n---\nBody",
        )
        .unwrap();

        let prev_codex = std::env::var("OHMYC_CODEX_HOME").ok();
        let prev_agents = std::env::var("OHMYC_AGENTS_HOME").ok();
        std::env::set_var("OHMYC_CODEX_HOME", codex_home.path());
        std::env::set_var("OHMYC_AGENTS_HOME", shared_home.path());

        let cwd = tempfile::tempdir().unwrap();
        let registry = ProviderRegistry::new(cwd.path());
        let skills = registry.list_skills(Some(&[crate::components::Origin::Codex])).unwrap();

        match prev_codex {
            Some(v) => std::env::set_var("OHMYC_CODEX_HOME", v),
            None => std::env::remove_var("OHMYC_CODEX_HOME"),
        }
        match prev_agents {
            Some(v) => std::env::set_var("OHMYC_AGENTS_HOME", v),
            None => std::env::remove_var("OHMYC_AGENTS_HOME"),
        }

        let ids: Vec<_> = skills.iter().map(|skill| skill.id.as_str()).collect();
        assert!(ids.contains(&"native"));
        assert!(ids.contains(&"shared"));
    }
}
