use std::path::PathBuf;

use crate::components::{
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct SharedAgentsProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl SharedAgentsProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::shared_agents_home()?,
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

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Codex, Origin::Opencode],
            SourceProvider::Shared,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Shared,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".agents").join("skills"),
                vec![Origin::Codex, Origin::Opencode],
                SourceProvider::Shared,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Shared,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_agents_provider_marks_skills_as_codex_and_opencode() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/fast-commit")).unwrap();
        std::fs::write(
            tmp.path().join("skills/fast-commit/SKILL.md"),
            "---\nname: fast-commit\ndescription: Commit quickly\n---\nSkill body",
        )
        .unwrap();

        let provider = SharedAgentsProvider::from_home(tmp.path().to_path_buf());
        let skills = provider.skills().unwrap();
        assert_eq!(skills[0].id, "fast-commit");
        assert_eq!(
            skills[0].origins,
            vec![crate::components::Origin::Codex, crate::components::Origin::Opencode,],
        );
        assert_eq!(skills[0].source_provider, crate::components::SourceProvider::Shared,);
    }
}
