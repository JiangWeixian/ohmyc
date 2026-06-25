//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` and
//! `$OHMYC_HOME` I/O, parsing, and watchers. No Tauri imports —
//! testable standalone.

pub mod claude_home;
pub mod components;
pub mod configs;
pub mod error;
pub mod plugins;
pub mod settings;
pub mod setup;
pub mod store;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
