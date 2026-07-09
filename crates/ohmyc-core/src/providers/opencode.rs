use std::path::{Path, PathBuf};

use crate::components::{
    agents::{self, agent_from_opencode_config, Agent},
    commands::{self, command_from_opencode_config, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct OpenCodeProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl OpenCodeProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::opencode_home()?,
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
            Origin::Opencode,
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(custom_dir) = self.custom_config_dir() {
            out.extend(agents::list_with_meta(
                &custom_dir.join("agents"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Local,
                Scope::Global,
                SourceKind::Global,
                None,
            )?);
        }
        if let Some(project_root) = &self.project_root {
            out.extend(agents::list_with_meta(
                &project_root.join(".opencode").join("agents"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        self.read_config_agents(&mut out)?;
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Opencode],
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(custom_dir) = self.custom_config_dir() {
            out.extend(skills::list_with_origins_and_meta(
                &custom_dir.join("skills"),
                vec![Origin::Opencode],
                SourceProvider::Opencode,
                ComponentSource::Local,
                Scope::Global,
                SourceKind::Global,
                None,
            )?);
        }
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".opencode").join("skills"),
                vec![Origin::Opencode],
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = commands::list_with_meta(
            &self.home.join("commands"),
            Origin::Opencode,
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(custom_dir) = self.custom_config_dir() {
            out.extend(commands::list_with_meta(
                &custom_dir.join("commands"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Local,
                Scope::Global,
                SourceKind::Global,
                None,
            )?);
        }
        if let Some(project_root) = &self.project_root {
            out.extend(commands::list_with_meta(
                &project_root.join(".opencode").join("commands"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        self.read_config_commands(&mut out)?;
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn custom_config_dir(&self) -> Option<PathBuf> {
        std::env::var("OPENCODE_CONFIG_DIR")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
    }

    fn config_paths(&self) -> Vec<PathBuf> {
        let mut paths = vec![self.home.join("opencode.json"), self.home.join("opencode.jsonc")];
        if let Ok(custom) = std::env::var("OPENCODE_CONFIG") {
            let custom = custom.trim();
            if !custom.is_empty() {
                paths.push(PathBuf::from(custom));
            }
        }
        paths
    }

    fn project_config_paths(&self) -> Vec<PathBuf> {
        self.project_root
            .as_ref()
            .map(|root| vec![root.join("opencode.json"), root.join("opencode.jsonc")])
            .unwrap_or_default()
    }

    fn config_sources(&self) -> Result<Vec<(PathBuf, Scope, serde_json::Value)>, ApiError> {
        let mut out = Vec::new();
        for path in self.config_paths().into_iter().chain(self.project_config_paths()) {
            let Some(json) = read_jsonc(&path)? else {
                continue;
            };
            let scope = if self.project_root.as_ref().is_some_and(|root| path.starts_with(root)) {
                Scope::Project
            } else {
                Scope::Global
            };
            out.push((path, scope, json));
        }
        if let Ok(raw) = std::env::var("OPENCODE_CONFIG_CONTENT") {
            if !raw.trim().is_empty() {
                let value = json5::from_str::<serde_json::Value>(&raw)
                    .map_err(|e| ApiError::Parse(format!("jsonc OPENCODE_CONFIG_CONTENT: {e}")))?;
                out.push((PathBuf::from("OPENCODE_CONFIG_CONTENT"), Scope::Global, value));
            }
        }
        Ok(out)
    }

    fn read_config_agents(&self, out: &mut Vec<Agent>) -> Result<(), ApiError> {
        for (path, scope, json) in self.config_sources()? {
            let Some(map) = json.get("agent").and_then(|v| v.as_object()) else {
                continue;
            };
            for (id, value) in map {
                if let Some(agent) = agent_from_opencode_config(id, value, &path, scope) {
                    out.push(agent);
                }
            }
        }
        Ok(())
    }

    fn read_config_commands(&self, out: &mut Vec<Command>) -> Result<(), ApiError> {
        for (path, scope, json) in self.config_sources()? {
            let Some(map) = json.get("command").and_then(|v| v.as_object()) else {
                continue;
            };
            for (id, value) in map {
                if let Some(command) = command_from_opencode_config(id, value, &path, scope) {
                    out.push(command);
                }
            }
        }
        Ok(())
    }
}

fn read_jsonc(path: &Path) -> Result<Option<serde_json::Value>, ApiError> {
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    };
    let value = json5::from_str::<serde_json::Value>(&raw)
        .map_err(|e| ApiError::Parse(format!("jsonc {}: {e}", path.display())))?;
    Ok(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn opencode_provider_reads_markdown_and_jsonc_resources() {
        let _lock = ENV_LOCK.lock().unwrap();
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("commands")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/native")).unwrap();
        std::fs::write(
            tmp.path().join("agents/review.md"),
            "---\ndescription: Reviews code\nmode: subagent\n---\nReview carefully.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("commands/test.md"),
            "---\ndescription: Run tests\nagent: build\n---\nRun tests.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/native/SKILL.md"),
            "---\nname: native\ndescription: Native OpenCode skill\n---\nSkill body.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("opencode.jsonc"),
            r#"{
              // config-backed resources
              "agent": {
                "planner": {
                  "description": "Plans work",
                  "mode": "primary",
                  "prompt": "Plan without editing."
                }
              },
              "command": {
                "component": {
                  "description": "Create a component",
                  "template": "Create $ARGUMENTS",
                },
              },
            }"#,
        )
        .unwrap();

        let provider = OpenCodeProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(provider.agents().unwrap().len(), 2);
        assert_eq!(provider.commands().unwrap().len(), 2);
        assert_eq!(
            provider.skills().unwrap()[0].origins,
            vec![crate::components::Origin::Opencode],
        );
    }

    #[test]
    fn opencode_provider_reads_env_config_sources() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let custom_file = tempfile::NamedTempFile::new().unwrap();
        let custom_dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(custom_dir.path().join("agents")).unwrap();
        std::fs::create_dir_all(custom_dir.path().join("commands")).unwrap();
        std::fs::create_dir_all(custom_dir.path().join("skills/envskill")).unwrap();
        std::fs::write(
            custom_file.path(),
            r#"{
              "agent": {"envfile": {"description": "From env file", "prompt": "agent"}},
              "command": {"envcmd": {"description": "From env file", "template": "cmd"}}
            }"#,
        )
        .unwrap();
        std::fs::write(
            custom_dir.path().join("agents/envdir.md"),
            "---\ndescription: From env dir\n---\nAgent",
        )
        .unwrap();
        std::fs::write(
            custom_dir.path().join("commands/envdircmd.md"),
            "---\ndescription: From env dir\n---\nCommand",
        )
        .unwrap();
        std::fs::write(
            custom_dir.path().join("skills/envskill/SKILL.md"),
            "---\nname: envskill\ndescription: From env dir\n---\nSkill",
        )
        .unwrap();

        let prev_config = std::env::var("OPENCODE_CONFIG").ok();
        let prev_content = std::env::var("OPENCODE_CONFIG_CONTENT").ok();
        let prev_dir = std::env::var("OPENCODE_CONFIG_DIR").ok();
        std::env::set_var("OPENCODE_CONFIG", custom_file.path());
        std::env::set_var(
            "OPENCODE_CONFIG_CONTENT",
            r#"{"agent":{"inline":{"description":"Inline","prompt":"inline"}}}"#,
        );
        std::env::set_var("OPENCODE_CONFIG_DIR", custom_dir.path());

        let provider = OpenCodeProvider::from_home(home.path().to_path_buf());
        let agents = provider.agents().unwrap();
        let commands = provider.commands().unwrap();
        let skills = provider.skills().unwrap();

        match prev_config {
            Some(value) => std::env::set_var("OPENCODE_CONFIG", value),
            None => std::env::remove_var("OPENCODE_CONFIG"),
        }
        match prev_content {
            Some(value) => std::env::set_var("OPENCODE_CONFIG_CONTENT", value),
            None => std::env::remove_var("OPENCODE_CONFIG_CONTENT"),
        }
        match prev_dir {
            Some(value) => std::env::set_var("OPENCODE_CONFIG_DIR", value),
            None => std::env::remove_var("OPENCODE_CONFIG_DIR"),
        }

        let agent_ids: Vec<_> = agents.iter().map(|agent| agent.id.as_str()).collect();
        let command_ids: Vec<_> = commands.iter().map(|command| command.id.as_str()).collect();
        let skill_ids: Vec<_> = skills.iter().map(|skill| skill.id.as_str()).collect();
        assert!(agent_ids.contains(&"envdir"));
        assert!(agent_ids.contains(&"envfile"));
        assert!(agent_ids.contains(&"inline"));
        assert!(command_ids.contains(&"envcmd"));
        assert!(command_ids.contains(&"envdircmd"));
        assert!(skill_ids.contains(&"envskill"));
    }
}
