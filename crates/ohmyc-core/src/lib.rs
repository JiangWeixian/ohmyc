//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` I/O,
//! parsing, and watchers. No Tauri imports — testable standalone.

pub mod claude_home;
pub mod error;

pub use error::ApiError;
