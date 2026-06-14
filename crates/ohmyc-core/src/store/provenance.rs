//! Read provenance metadata from `<store>/.metadata/imports.json`.
//! Provenance is a read-time enrichment — when present, attach
//! `{ importPath, importedAt }` to a store component on `get`/`list`.
//!
//! Also defines `ComponentKind`, the discriminant shared by references,
//! listings, and the CRUD layer.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComponentKind {
    Agents,
    Skills,
    Commands,
    ModelConfigs,
}

impl ComponentKind {
    pub fn dir_name(self) -> &'static str {
        match self {
            ComponentKind::Agents => "agents",
            ComponentKind::Skills => "skills",
            ComponentKind::Commands => "commands",
            ComponentKind::ModelConfigs => "model-configs",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ComponentKind::Agents => "agent",
            ComponentKind::Skills => "skill",
            ComponentKind::Commands => "command",
            ComponentKind::ModelConfigs => "model-config",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub import_path: String,
    pub imported_at: String,
}

type Index = HashMap<String, HashMap<String, Provenance>>;

/// Read the index file. Returns an empty map when missing or malformed
/// (matches the TS server's defensive read).
pub fn read_index(index_path: &Path) -> Result<Index, ApiError> {
    let raw = match std::fs::read_to_string(index_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Index::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", index_path.display()))),
    };
    match serde_json::from_str::<Index>(&raw) {
        Ok(idx) => Ok(idx),
        Err(_) => Ok(Index::new()),
    }
}

pub fn get(index_path: &Path, kind: ComponentKind, id: &str) -> Result<Option<Provenance>, ApiError> {
    let idx = read_index(index_path)?;
    Ok(idx.get(kind.dir_name()).and_then(|m| m.get(id)).cloned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dir_name_matches_expectations() {
        assert_eq!(ComponentKind::Agents.dir_name(), "agents");
        assert_eq!(ComponentKind::Skills.dir_name(), "skills");
        assert_eq!(ComponentKind::Commands.dir_name(), "commands");
        assert_eq!(ComponentKind::ModelConfigs.dir_name(), "model-configs");
    }

    #[test]
    fn label_singular() {
        assert_eq!(ComponentKind::Agents.label(), "agent");
        assert_eq!(ComponentKind::ModelConfigs.label(), "model-config");
    }

    #[test]
    fn serde_round_trip() {
        let kinds = [
            ComponentKind::Agents,
            ComponentKind::Skills,
            ComponentKind::Commands,
            ComponentKind::ModelConfigs,
        ];
        for k in kinds {
            let json = serde_json::to_string(&k).unwrap();
            let back: ComponentKind = serde_json::from_str(&json).unwrap();
            assert_eq!(k, back);
        }
    }

    fn seeded_index(dir: &Path) -> std::path::PathBuf {
        let path = dir.join("imports.json");
        let content = r#"{
            "agents": { "alpha": { "importPath": "/src/alpha.md", "importedAt": "2026-01-01T00:00:00Z" } },
            "skills": {},
            "commands": {},
            "model-configs": { "anthropic/sonnet-4": { "importPath": "/src/m.json", "importedAt": "2026-02-01T00:00:00Z" } }
        }"#;
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn get_returns_provenance_when_present() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        let p = get(&path, ComponentKind::Agents, "alpha").unwrap().unwrap();
        assert_eq!(p.import_path, "/src/alpha.md");
    }

    #[test]
    fn get_returns_none_when_id_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        assert!(get(&path, ComponentKind::Agents, "nope").unwrap().is_none());
    }

    #[test]
    fn get_handles_model_configs_kind_with_hyphenated_key() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        let p = get(&path, ComponentKind::ModelConfigs, "anthropic/sonnet-4")
            .unwrap()
            .unwrap();
        assert_eq!(p.import_path, "/src/m.json");
    }

    #[test]
    fn returns_empty_when_index_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nonexistent.json");
        assert!(get(&path, ComponentKind::Agents, "x").unwrap().is_none());
    }

    #[test]
    fn returns_empty_when_index_malformed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("imports.json");
        std::fs::write(&path, "{ not valid json").unwrap();
        assert!(get(&path, ComponentKind::Agents, "x").unwrap().is_none());
    }
}
