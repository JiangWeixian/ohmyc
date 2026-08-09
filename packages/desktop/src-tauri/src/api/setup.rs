//! Tauri command wrapper for the ohmyc-core setup readiness probe.
//! Infallible on the wire — every failure is encoded as a `SetupStatus` variant,
//! so the frontend always receives a structured state, never an error envelope.

use ohmyc_core::setup::{probe, SetupStatus};

/// Returns the local monitor store readiness. Never returns the DB path.
#[tauri::command]
pub fn setup_status() -> SetupStatus {
    probe()
}
