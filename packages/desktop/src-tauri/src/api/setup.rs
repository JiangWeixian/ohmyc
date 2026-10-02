//! Tauri command wrappers for setup: the readiness probe plus the one-click
//! plugin install the onboarding screen drives.
//!
//! `setup_status` is infallible on the wire — every failure is encoded as a
//! `SetupStatus` variant, so the frontend always receives a structured state,
//! never an error envelope.

use ohmyc_core::error::ApiError;
use ohmyc_core::install::{self, AgentInstallResult, AgentKind, AgentStatus};
use ohmyc_core::setup::{probe, SetupStatus};

/// Returns the local monitor store readiness. Never returns the DB path.
#[tauri::command]
pub fn setup_status() -> SetupStatus {
    probe()
}

/// Which agents are on this machine and what we can do for each.
#[tauri::command]
pub fn setup_detect_agents() -> Result<Vec<AgentStatus>, ApiError> {
    install::detect()
}

/// Drive each agent's own plugin installer. Partial success is normal and is
/// reported per agent rather than collapsed into one error.
#[tauri::command]
pub fn setup_install(agents: Vec<AgentKind>) -> Result<Vec<AgentInstallResult>, ApiError> {
    Ok(install::install_many(&agents))
}
