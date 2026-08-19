//! Installs the OhMyC timeline plugin into the coding agents on this machine,
//! so the desktop app can finish setup instead of sending the user to a README.
//!
//! ## Why this shells out
//!
//! An earlier version of this module wrote Claude Code's
//! `plugins/installed_plugins.json` directly. Comparing that against what
//! `claude plugin install` actually produces showed every field was wrong: the
//! registry key is `timeline@ohmyc` (not `ohmyc-timeline`), the schema is
//! version 2, `installPath` points into Claude's own
//! `plugins/cache/<marketplace>/<plugin>/<version>/` after Claude clones the
//! repo there, and the plugin only counts as enabled once
//! `settings.json`'s `enabledPlugins` map says so — plus
//! `known_marketplaces.json` and a marketplace clone. Forging all of that means
//! reimplementing an undocumented private format and silently breaking whenever
//! it moves.
//!
//! Both agents ship a non-interactive CLI that does the whole job, so we call
//! it. OpenCode is the exception and stays a native edit: `opencode.json` is a
//! documented user-facing config file, not private state.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::providers::paths;

/// Marketplace this plugin is published through.
pub const MARKETPLACE: &str = "ohmyc";
/// Plugin id inside that marketplace.
pub const PLUGIN: &str = "timeline";
/// Marketplace source both CLIs accept.
pub const MARKETPLACE_SOURCE: &str = "JiangWeixian/ohmyc-plugins";
/// npm package OpenCode loads the plugin from.
pub const OPENCODE_PACKAGE: &str = "@ohmyc/timeline-plugin";

const OPENCODE_CONFIG_FILE: &str = "opencode.json";
const OPENCODE_SCHEMA: &str = "https://opencode.ai/config.json";

/// Directories to search for an agent CLI. A GUI app inherits the launchd
/// environment, not the user's shell, so `PATH` alone finds nothing — these are
/// where the agents actually install themselves.
const BIN_DIRS: [&str; 4] = [
    ".local/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    ".bun/bin",
];

/// Which agent an [`AgentStatus`] or [`AgentInstallResult`] refers to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    Claude,
    Codex,
    Opencode,
}

impl AgentKind {
    /// Name of the agent's CLI, when it installs plugins through one.
    fn binary(self) -> Option<&'static str> {
        match self {
            AgentKind::Claude => Some("claude"),
            AgentKind::Codex => Some("codex"),
            AgentKind::Opencode => None,
        }
    }
}

/// Result of one install attempt, serialized to the frontend as a tagged union.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case", tag = "state")]
pub enum InstallOutcome {
    /// The agent's installer ran and reported success.
    Installed,
    /// Already registered; nothing changed.
    AlreadyInstalled,
    /// The agent is not on this machine.
    NotPresent,
    /// We cannot drive this one. `hint` is shown to the user verbatim.
    Manual { hint: String },
    /// Something went wrong. `reason` carries the agent's own message.
    Failed { reason: String },
}

/// One agent's install attempt, paired so the UI can render a per-agent row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AgentInstallResult {
    pub agent: AgentKind,
    #[serde(flatten)]
    pub outcome: InstallOutcome,
}

/// One row of the "what can we set up for you" table on the onboarding screen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AgentStatus {
    pub agent: AgentKind,
    /// The agent's home directory exists on this machine.
    pub present: bool,
    /// The plugin is already registered for this agent.
    pub installed: bool,
    /// `install` can finish without the user leaving the app.
    pub automatic: bool,
}

/// One command to run, kept separate from running it so the argument shapes can
/// be asserted in tests without spawning an agent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentCommand {
    pub program: PathBuf,
    pub args: Vec<String>,
}

// ------------------------------------------------------------------
// Entry points
// ------------------------------------------------------------------

/// Probe every supported agent. An agent whose paths cannot be resolved is
/// reported as absent rather than sinking the whole call.
pub fn detect() -> Result<Vec<AgentStatus>, ApiError> {
    let opencode_config = opencode_config_path().ok();

    Ok(vec![
        agent_cli_status(AgentKind::Claude, paths::home_dir().map(|h| h.join(".claude")).ok()),
        agent_cli_status(AgentKind::Codex, paths::codex_home().ok()),
        AgentStatus {
            agent: AgentKind::Opencode,
            present: opencode_config
                .as_deref()
                .and_then(Path::parent)
                .is_some_and(Path::is_dir),
            installed: opencode_config
                .as_deref()
                .is_some_and(opencode_is_installed_at),
            automatic: true,
        },
    ])
}

/// Status for an agent we drive through its CLI. `installed` stays false: the
/// CLIs are idempotent, so re-running a completed install is harmless and
/// cheaper than parsing each agent's private state to find out.
fn agent_cli_status(agent: AgentKind, home: Option<PathBuf>) -> AgentStatus {
    AgentStatus {
        agent,
        present: home.is_some_and(|p| p.is_dir()),
        installed: false,
        automatic: agent.binary().and_then(find_binary).is_some(),
    }
}

/// Install for several agents, collecting one result each. One agent failing
/// never stops the others.
pub fn install_many(agents: &[AgentKind]) -> Vec<AgentInstallResult> {
    agents
        .iter()
        .map(|&agent| AgentInstallResult {
            agent,
            outcome: install(agent),
        })
        .collect()
}

/// Install the plugin for one agent.
pub fn install(agent: AgentKind) -> InstallOutcome {
    match agent {
        AgentKind::Opencode => match opencode_config_path() {
            Ok(path) => install_opencode_at(&path, OPENCODE_PACKAGE),
            Err(e) => InstallOutcome::Failed {
                reason: e.to_string(),
            },
        },
        AgentKind::Claude | AgentKind::Codex => {
            let Some(binary) = agent.binary() else {
                return InstallOutcome::NotPresent;
            };
            let Some(program) = find_binary(binary) else {
                return InstallOutcome::Manual {
                    hint: manual_hint(agent),
                };
            };
            run_all(&install_commands(agent, &program))
        }
    }
}

/// The commands that install the plugin for a CLI-driven agent, in order.
pub fn install_commands(agent: AgentKind, program: &Path) -> Vec<AgentCommand> {
    let selector = format!("{PLUGIN}@{MARKETPLACE}");
    match agent {
        AgentKind::Claude => vec![
            AgentCommand {
                program: program.to_path_buf(),
                args: vec![
                    "plugin".into(),
                    "marketplace".into(),
                    "add".into(),
                    MARKETPLACE_SOURCE.into(),
                ],
            },
            AgentCommand {
                program: program.to_path_buf(),
                args: vec!["plugin".into(), "install".into(), selector],
            },
        ],
        // Codex spells install `plugin add`, not `plugin install`.
        AgentKind::Codex => vec![
            AgentCommand {
                program: program.to_path_buf(),
                args: vec![
                    "plugin".into(),
                    "marketplace".into(),
                    "add".into(),
                    MARKETPLACE_SOURCE.into(),
                ],
            },
            AgentCommand {
                program: program.to_path_buf(),
                args: vec!["plugin".into(), "add".into(), selector],
            },
        ],
        AgentKind::Opencode => Vec::new(),
    }
}

/// The command to hand a user whose agent CLI we could not find.
pub fn manual_hint(agent: AgentKind) -> String {
    match agent {
        AgentKind::Claude => format!("claude plugin install {PLUGIN}@{MARKETPLACE}"),
        AgentKind::Codex => format!("codex plugin add {PLUGIN}@{MARKETPLACE}"),
        AgentKind::Opencode => format!("add \"{OPENCODE_PACKAGE}\" to opencode.json"),
    }
}

fn run_all(commands: &[AgentCommand]) -> InstallOutcome {
    for command in commands {
        match Command::new(&command.program).args(&command.args).output() {
            Ok(output) if output.status.success() => {}
            Ok(output) => {
                // The agent's own message beats anything we could invent, and
                // it is what the user would have seen running this by hand.
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let detail = [stderr.trim(), stdout.trim()]
                    .into_iter()
                    .find(|s| !s.is_empty())
                    .unwrap_or("no output")
                    .to_string();
                return InstallOutcome::Failed { reason: detail };
            }
            Err(e) => {
                return InstallOutcome::Failed {
                    reason: format!("could not run {}: {e}", command.program.display()),
                }
            }
        }
    }
    InstallOutcome::Installed
}

/// Locate an agent CLI without relying on an inherited `PATH`.
pub fn find_binary(name: &str) -> Option<PathBuf> {
    let home = paths::home_dir().ok();
    for dir in BIN_DIRS {
        let candidate = if dir.starts_with('/') {
            PathBuf::from(dir).join(name)
        } else {
            home.as_ref()?.join(dir).join(name)
        };
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    // Last resort: whatever PATH we did inherit.
    std::env::var_os("PATH").and_then(|path| {
        std::env::split_paths(&path)
            .map(|dir| dir.join(name))
            .find(|candidate| candidate.is_file())
    })
}

// ------------------------------------------------------------------
// OpenCode — path-injected core
// ------------------------------------------------------------------

/// `<opencode_home>/opencode.json` — the global OpenCode config.
pub fn opencode_config_path() -> Result<PathBuf, ApiError> {
    Ok(paths::opencode_home()?.join(OPENCODE_CONFIG_FILE))
}

/// True when `opencode.json` already lists the plugin package.
pub fn opencode_is_installed_at(config_path: &Path) -> bool {
    let Ok(Some(root)) = read_json(config_path) else {
        return false;
    };
    opencode_list_has(&root, OPENCODE_PACKAGE)
}

/// Append the plugin package to `plugin` in `opencode.json`, creating the file
/// when it does not exist. Existing keys and plugins are preserved, and a config
/// we could not parse is reported back rather than overwritten.
pub fn install_opencode_at(config_path: &Path, package: &str) -> InstallOutcome {
    let mut root = match read_json(config_path) {
        Ok(Some(value)) => value,
        Ok(None) => json!({ "$schema": OPENCODE_SCHEMA }),
        Err(reason) => return InstallOutcome::Failed { reason },
    };

    if !root.is_object() {
        return InstallOutcome::Failed {
            reason: format!("{OPENCODE_CONFIG_FILE} is not a JSON object"),
        };
    }
    match root.get("plugin") {
        Some(Value::Array(_)) => {}
        None => {
            root["plugin"] = json!([]);
        }
        Some(_) => {
            return InstallOutcome::Failed {
                reason: format!("{OPENCODE_CONFIG_FILE} has a non-array `plugin` field"),
            };
        }
    }

    if opencode_list_has(&root, package) {
        return InstallOutcome::AlreadyInstalled;
    }

    root["plugin"]
        .as_array_mut()
        .expect("plugin normalized to an array above")
        .push(Value::String(package.to_string()));

    match write_json_atomic(config_path, &root) {
        Ok(()) => InstallOutcome::Installed,
        Err(reason) => InstallOutcome::Failed { reason },
    }
}

fn opencode_list_has(root: &Value, package: &str) -> bool {
    root.get("plugin")
        .and_then(Value::as_array)
        .is_some_and(|plugins| {
            plugins
                .iter()
                .filter_map(Value::as_str)
                .any(|entry| entry == package || entry.starts_with(&format!("{package}@")))
        })
}

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

/// `Ok(None)` when absent, `Err(reason)` when present but unparseable — the
/// caller must not overwrite in the error case.
fn read_json(path: &Path) -> Result<Option<Value>, String> {
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("read {}: {e}", path.display())),
    };
    if raw.trim().is_empty() {
        return Ok(None);
    }
    serde_json::from_str(&raw).map(Some).map_err(|e| {
        format!(
            "{} is not valid JSON ({e}); leaving it untouched",
            path.display()
        )
    })
}

/// Temp-file + rename in the destination directory, mirroring `settings::write`.
fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    let dir = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;
    std::fs::create_dir_all(dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;

    let serialized = serde_json::to_string_pretty(value)
        .map_err(|e| format!("serialize {}: {e}", path.display()))?;

    let mut tmp = tempfile::NamedTempFile::new_in(dir)
        .map_err(|e| format!("create temp in {}: {e}", dir.display()))?;
    use std::io::Write;
    tmp.write_all(serialized.as_bytes())
        .map_err(|e| format!("write temp: {e}"))?;
    tmp.write_all(b"\n").map_err(|e| format!("write temp: {e}"))?;
    tmp.persist(path)
        .map_err(|e| format!("persist {}: {e}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write(path: &Path, body: &str) {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).unwrap();
        }
        std::fs::write(path, body).unwrap();
    }

    fn read(path: &Path) -> Value {
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
    }

    // -------------------------------------------------- command shapes
    //
    // These lock the exact CLI invocations verified by hand against
    // claude 2.x and codex. If an agent renames a subcommand, this is where it
    // should fail — not silently at install time on a user's machine.

    #[test]
    fn claude_commands_add_the_marketplace_then_install() {
        let cmds = install_commands(AgentKind::Claude, Path::new("/usr/local/bin/claude"));
        assert_eq!(cmds.len(), 2);
        assert_eq!(
            cmds[0].args,
            vec!["plugin", "marketplace", "add", "JiangWeixian/ohmyc-plugins"]
        );
        assert_eq!(cmds[1].args, vec!["plugin", "install", "timeline@ohmyc"]);
        assert_eq!(cmds[1].program, Path::new("/usr/local/bin/claude"));
    }

    #[test]
    fn codex_uses_plugin_add_not_plugin_install() {
        let cmds = install_commands(AgentKind::Codex, Path::new("/usr/local/bin/codex"));
        assert_eq!(cmds.len(), 2);
        assert_eq!(
            cmds[0].args,
            vec!["plugin", "marketplace", "add", "JiangWeixian/ohmyc-plugins"]
        );
        assert_eq!(
            cmds[1].args,
            vec!["plugin", "add", "timeline@ohmyc"],
            "codex spells it `plugin add`; `plugin install` does not exist there"
        );
    }

    #[test]
    fn opencode_has_no_cli_commands() {
        assert!(install_commands(AgentKind::Opencode, Path::new("/bin/true")).is_empty());
    }

    #[test]
    fn manual_hints_name_the_real_commands() {
        assert_eq!(
            manual_hint(AgentKind::Claude),
            "claude plugin install timeline@ohmyc"
        );
        assert_eq!(manual_hint(AgentKind::Codex), "codex plugin add timeline@ohmyc");
    }

    // -------------------------------------------------- running

    #[test]
    fn a_failing_command_surfaces_the_agents_own_message() {
        let outcome = run_all(&[AgentCommand {
            program: PathBuf::from("/bin/sh"),
            args: vec!["-c".into(), "echo 'plugin not found in marketplace' >&2; exit 1".into()],
        }]);
        match outcome {
            InstallOutcome::Failed { reason } => {
                assert_eq!(reason, "plugin not found in marketplace");
            }
            other => panic!("expected Failed, got {other:?}"),
        }
    }

    #[test]
    fn a_missing_binary_is_a_failure_not_a_panic() {
        let outcome = run_all(&[AgentCommand {
            program: PathBuf::from("/nonexistent/agent-cli"),
            args: vec!["plugin".into()],
        }]);
        assert!(matches!(outcome, InstallOutcome::Failed { .. }));
    }

    #[test]
    fn later_commands_do_not_run_after_an_earlier_failure() {
        let dir = TempDir::new().unwrap();
        let marker = dir.path().join("second-ran");
        let outcome = run_all(&[
            AgentCommand {
                program: PathBuf::from("/bin/sh"),
                args: vec!["-c".into(), "exit 1".into()],
            },
            AgentCommand {
                program: PathBuf::from("/bin/sh"),
                args: vec!["-c".into(), format!("touch {}", marker.display())],
            },
        ]);
        assert!(matches!(outcome, InstallOutcome::Failed { .. }));
        assert!(!marker.exists(), "install must stop at the first failure");
    }

    #[test]
    fn all_commands_succeeding_is_installed() {
        let outcome = run_all(&[AgentCommand {
            program: PathBuf::from("/bin/sh"),
            args: vec!["-c".into(), "exit 0".into()],
        }]);
        assert_eq!(outcome, InstallOutcome::Installed);
    }

    // -------------------------------------------------- binary lookup

    #[test]
    fn find_binary_falls_back_to_path() {
        // `sh` is not in any of the agent install dirs, so this exercises the
        // PATH fallback that keeps non-standard installs working.
        assert!(find_binary("sh").is_some());
    }

    #[test]
    fn find_binary_returns_none_for_an_unknown_command() {
        assert!(find_binary("definitely-not-a-real-agent-cli").is_none());
    }

    // -------------------------------------------------- OpenCode

    #[test]
    fn opencode_install_creates_config_with_schema() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);

        assert_eq!(
            install_opencode_at(&config, OPENCODE_PACKAGE),
            InstallOutcome::Installed
        );

        let root = read(&config);
        assert_eq!(root["$schema"], OPENCODE_SCHEMA);
        assert_eq!(root["plugin"][0], OPENCODE_PACKAGE);
    }

    #[test]
    fn opencode_install_appends_and_keeps_existing_config() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);
        write(
            &config,
            r#"{"$schema":"https://opencode.ai/config.json","theme":"dark","plugin":["some-other-plugin"]}"#,
        );

        assert_eq!(
            install_opencode_at(&config, OPENCODE_PACKAGE),
            InstallOutcome::Installed
        );

        let root = read(&config);
        assert_eq!(root["theme"], "dark");
        assert_eq!(root["plugin"][0], "some-other-plugin");
        assert_eq!(root["plugin"][1], OPENCODE_PACKAGE);
    }

    #[test]
    fn opencode_install_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);

        install_opencode_at(&config, OPENCODE_PACKAGE);
        assert_eq!(
            install_opencode_at(&config, OPENCODE_PACKAGE),
            InstallOutcome::AlreadyInstalled
        );
        assert_eq!(read(&config)["plugin"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn opencode_treats_versioned_entry_as_installed() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);
        write(&config, r#"{"plugin":["@ohmyc/timeline-plugin@1.0.6"]}"#);

        assert_eq!(
            install_opencode_at(&config, OPENCODE_PACKAGE),
            InstallOutcome::AlreadyInstalled
        );
        assert!(opencode_is_installed_at(&config));
    }

    #[test]
    fn opencode_install_refuses_to_overwrite_a_corrupt_config() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);
        write(&config, "{ oops");

        match install_opencode_at(&config, OPENCODE_PACKAGE) {
            InstallOutcome::Failed { reason } => assert!(reason.contains("not valid JSON")),
            other => panic!("expected Failed, got {other:?}"),
        }
        assert_eq!(std::fs::read_to_string(&config).unwrap(), "{ oops");
    }

    #[test]
    fn opencode_install_rejects_non_array_plugin_field() {
        let dir = TempDir::new().unwrap();
        let config = dir.path().join(OPENCODE_CONFIG_FILE);
        write(&config, r#"{"plugin":"not-an-array"}"#);

        match install_opencode_at(&config, OPENCODE_PACKAGE) {
            InstallOutcome::Failed { reason } => assert!(reason.contains("non-array")),
            other => panic!("expected Failed, got {other:?}"),
        }
    }

    // -------------------------------------------------- wire shape

    #[test]
    fn outcomes_serialize_as_a_tagged_union() {
        assert_eq!(
            serde_json::to_value(InstallOutcome::Installed).unwrap()["state"],
            "installed"
        );
        assert_eq!(
            serde_json::to_value(InstallOutcome::AlreadyInstalled).unwrap()["state"],
            "already_installed"
        );
        let manual = serde_json::to_value(InstallOutcome::Manual {
            hint: manual_hint(AgentKind::Claude),
        })
        .unwrap();
        assert_eq!(manual["state"], "manual");
        assert_eq!(manual["hint"], "claude plugin install timeline@ohmyc");
    }

    #[test]
    fn agent_kind_serializes_to_snake_case() {
        assert_eq!(serde_json::to_value(AgentKind::Opencode).unwrap(), "opencode");
        assert_eq!(serde_json::to_value(AgentKind::Claude).unwrap(), "claude");
    }

    #[test]
    fn result_flattens_agent_and_outcome_onto_one_object() {
        let value = serde_json::to_value(AgentInstallResult {
            agent: AgentKind::Codex,
            outcome: InstallOutcome::Failed {
                reason: "boom".into(),
            },
        })
        .unwrap();
        assert_eq!(value["agent"], "codex");
        assert_eq!(value["state"], "failed");
        assert_eq!(value["reason"], "boom");
    }
}
