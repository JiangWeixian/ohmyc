use std::path::PathBuf;

use crate::components::{
    agents::{self, Agent},
    commands::{self, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct ClaudeProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl ClaudeProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: crate::claude_home::resolve()?,
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
        let mut out = agents::list_with_meta(
            &self.home.join("agents"),
            Origin::Claude,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(agents::list_with_meta(
                &project_root.join(".claude").join("agents"),
                Origin::Claude,
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.extend(self.plugin_agents()?);
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Claude, Origin::Opencode],
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".claude").join("skills"),
                vec![Origin::Claude, Origin::Opencode],
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.extend(self.plugin_skills()?);
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = commands::list_with_meta(
            &self.home.join("commands"),
            Origin::Claude,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(commands::list_with_meta(
                &project_root.join(".claude").join("commands"),
                Origin::Claude,
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.extend(self.plugin_commands()?);
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn plugin_agents(&self) -> Result<Vec<Agent>, ApiError> {
        let mut out = Vec::new();
        let plugins = crate::plugins::list_plugins(&self.home.join("plugins"), &self.home.join("settings.json"))?;
        for plugin in plugins {
            if !plugin.enabled {
                continue;
            }
            let Some(first) = plugin.installs.first() else {
                continue;
            };
            out.extend(crate::plugins::parse_claude_plugin_agents(
                std::path::Path::new(&first.install_path),
                &plugin.id,
            )?);
        }
        Ok(out)
    }

    fn plugin_skills(&self) -> Result<Vec<Skill>, ApiError> {
        // Keep plugin parsing resource-specific. A skills request should not parse
        // plugin agents and commands unless a later measured cache design needs it.
        let mut out = Vec::new();
        let plugins = crate::plugins::list_plugins(&self.home.join("plugins"), &self.home.join("settings.json"))?;
        for plugin in plugins {
            if !plugin.enabled {
                continue;
            }
            let Some(first) = plugin.installs.first() else {
                continue;
            };
            out.extend(crate::plugins::parse_claude_plugin_skills(
                std::path::Path::new(&first.install_path),
                &plugin.id,
            )?);
        }
        Ok(out)
    }

    fn plugin_commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = Vec::new();
        let plugins = crate::plugins::list_plugins(&self.home.join("plugins"), &self.home.join("settings.json"))?;
        for plugin in plugins {
            if !plugin.enabled {
                continue;
            }
            let Some(first) = plugin.installs.first() else {
                continue;
            };
            out.extend(crate::plugins::parse_claude_plugin_commands(
                std::path::Path::new(&first.install_path),
                &plugin.id,
            )?);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_provider_reads_global_agents_skills_and_commands() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/review")).unwrap();
        std::fs::create_dir_all(tmp.path().join("commands")).unwrap();
        std::fs::write(
            tmp.path().join("agents/reviewer.md"),
            "---\nname: reviewer\ndescription: Reviews code\n---\nAgent body",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: Review code\n---\nSkill body",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("commands/ship.md"),
            "---\nname: ship\ndescription: Ship it\n---\nCommand body",
        )
        .unwrap();

        let provider = ClaudeProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(
            provider.agents().unwrap()[0].origins,
            vec![crate::components::Origin::Claude],
        );
        assert_eq!(
            provider.skills().unwrap()[0].origins,
            vec![crate::components::Origin::Claude, crate::components::Origin::Opencode,],
        );
        assert_eq!(
            provider.commands().unwrap()[0].origins,
            vec![crate::components::Origin::Claude],
        );
    }

    #[test]
    fn claude_provider_reads_plugin_skills_agents_and_commands() {
        let tmp = tempfile::tempdir().unwrap();
        let plugin = tmp.path().join("plugin");
        std::fs::create_dir_all(plugin.join(".claude-plugin")).unwrap();
        std::fs::create_dir_all(plugin.join("skills/review")).unwrap();
        std::fs::create_dir_all(plugin.join("agents")).unwrap();
        std::fs::create_dir_all(plugin.join("commands")).unwrap();
        std::fs::write(
            plugin.join(".claude-plugin/plugin.json"),
            r#"{"name":"toolbox","version":"1.0.0"}"#,
        )
        .unwrap();
        std::fs::write(
            plugin.join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: Review\n---\nBody",
        )
        .unwrap();
        std::fs::write(
            plugin.join("agents/reviewer.md"),
            "---\nname: reviewer\ndescription: Reviews\n---\nBody",
        )
        .unwrap();
        std::fs::write(
            plugin.join("commands/ship.md"),
            "---\nname: ship\ndescription: Ship\n---\nBody",
        )
        .unwrap();

        let resources = crate::plugins::parse_claude_plugin_resources(&plugin, "toolbox@local").unwrap();
        assert_eq!(resources.skills[0].source, crate::components::ComponentSource::Plugin);
        assert_eq!(resources.agents[0].plugin_id.as_deref(), Some("toolbox@local"));
        assert_eq!(resources.commands[0].origins, vec![crate::components::Origin::Claude],);
    }
}
