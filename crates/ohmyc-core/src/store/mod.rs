//! Store CRUD — agents/skills/commands/model-configs managed by OhMyC.
//! Lives under `$OHMYC_HOME/store/`, separate from `<claude_home>/` which
//! holds the user's Claude Code config. This namespace also owns
//! provenance metadata (where each component was imported from) and the
//! reference-check that gates delete-safety against active profiles.

pub mod model_configs;
pub mod provenance;
pub mod references;

use std::path::PathBuf;

use crate::error::ApiError;

pub use provenance::ComponentKind;

const ENV_HOME: &str = "OHMYC_HOME";

/// Resolve `$OHMYC_HOME` (default `~/.config/ohmyc/`). Mirrors
/// `packages/cli/src/server/services/config-locator.ts::writeBaseDir`.
pub fn base_dir() -> Result<PathBuf, ApiError> {
    if let Ok(home) = std::env::var(ENV_HOME) {
        if !home.is_empty() {
            return Ok(PathBuf::from(home));
        }
    }
    let user_home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(user_home.join(".config").join("ohmyc"))
}

pub fn store_dir() -> Result<PathBuf, ApiError> {
    Ok(base_dir()?.join("store"))
}

pub fn store_agents_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("agents"))
}

pub fn store_skills_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("skills"))
}

pub fn store_commands_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("commands"))
}

pub fn store_model_configs_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("model-configs"))
}

pub fn store_profiles_dir() -> Result<PathBuf, ApiError> {
    Ok(base_dir()?.join("profiles"))
}

pub fn provenance_index_path() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join(".metadata").join("imports.json"))
}

pub fn component_exists(
    store_dir: &std::path::Path,
    kind: provenance::ComponentKind,
    name: &str,
) -> bool {
    if name.is_empty()
        || name.contains("..")
        || name.contains('/')
        || name.contains('\\')
    {
        return false;
    }
    let path = match kind {
        provenance::ComponentKind::Agents => store_dir.join("agents").join(format!("{name}.md")),
        provenance::ComponentKind::Commands => store_dir.join("commands").join(format!("{name}.md")),
        provenance::ComponentKind::Skills => store_dir.join("skills").join(name),
        provenance::ComponentKind::ModelConfigs => return false,
    };
    path.exists()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use crate::store::ComponentKind;

    fn write(p: &std::path::Path, body: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, body).unwrap();
    }

    #[test]
    fn store_component_exists_agents_md_file() {
        let store = tempfile::tempdir().unwrap();
        write(&store.path().join("agents/reviewer.md"), "x");
        assert!(component_exists(store.path(), ComponentKind::Agents, "reviewer"));
        assert!(!component_exists(store.path(), ComponentKind::Agents, "missing"));
    }

    #[test]
    fn store_component_exists_commands_md_file() {
        let store = tempfile::tempdir().unwrap();
        write(&store.path().join("commands/push.md"), "x");
        assert!(component_exists(store.path(), ComponentKind::Commands, "push"));
        assert!(!component_exists(store.path(), ComponentKind::Commands, "missing"));
    }

    #[test]
    fn store_component_exists_skills_dir_with_skill_md() {
        let store = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(store.path().join("skills/deploy")).unwrap();
        assert!(component_exists(store.path(), ComponentKind::Skills, "deploy"));
        assert!(!component_exists(store.path(), ComponentKind::Skills, "missing"));
    }

    #[test]
    fn store_component_exists_rejects_unsafe_names() {
        let store = tempfile::tempdir().unwrap();
        write(&store.path().join("agents/ok.md"), "x");
        assert!(!component_exists(store.path(), ComponentKind::Agents, "../escape"));
    }

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn base_dir_honors_ohmyc_home_env() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        assert_eq!(base_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    #[test]
    fn store_paths_compose_under_base() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        assert_eq!(store_agents_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/store/agents"));
        assert_eq!(store_skills_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/store/skills"));
        assert_eq!(
            store_commands_dir().unwrap(),
            PathBuf::from("/tmp/fake-ohmyc/store/commands"),
        );
        assert_eq!(
            store_model_configs_dir().unwrap(),
            PathBuf::from("/tmp/fake-ohmyc/store/model-configs"),
        );
        assert_eq!(store_profiles_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/profiles"));
        assert_eq!(
            provenance_index_path().unwrap(),
            PathBuf::from("/tmp/fake-ohmyc/store/.metadata/imports.json"),
        );
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }
}
