pub mod claude;
pub mod codex;
pub mod opencode;
pub mod paths;
pub mod shared_agents;

use crate::components::Origin;
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
}
