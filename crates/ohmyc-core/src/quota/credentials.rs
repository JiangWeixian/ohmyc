//! Read-only credential resolution for the six quota providers.
//!
//! Hard rules:
//! - **Never refresh or write back tokens.** Grok and Kimi rotate refresh
//!   tokens on use; touching them would log the user out of their own CLI.
//!   An expired token surfaces as `CredentialOutcome::Expired`, which becomes
//!   `SnapshotStatus::TokenExpired` ("open the official CLI once to recover").
//! - Credentials are read → used → discarded. They are never written to disk,
//!   never logged, and never embedded in error messages.

use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::Value;

/// Outcome of resolving one provider's locally stored credential.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialOutcome {
    Token(String),
    NotLoggedIn,
    Expired,
}

/// Codex needs the ChatGPT account id as a request header alongside the
/// bearer token, so its resolver carries both.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexTokens {
    pub access_token: String,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CodexOutcome {
    Tokens(CodexTokens),
    NotLoggedIn,
}

#[cfg(all(target_os = "macos", not(test)))]
const KEYCHAIN_TIMEOUT: Duration = Duration::from_secs(3);
const AGENT_STATUS_TIMEOUT: Duration = Duration::from_secs(10);
/// Grok/Kimi tokens are short-lived; treat them as expired this early so we
/// never hand out a token that dies mid-request.
const EARLY_EXPIRY_MARGIN_SECONDS: i64 = 60;

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var(name)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .map(PathBuf::from)
}

fn home_join(rel: &str) -> Option<PathBuf> {
    Some(dirs::home_dir()?.join(rel))
}

fn read_json(path: &PathBuf) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn non_empty_str(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
}

/// `now + margin >= expires` → treat as expired.
fn epoch_expired(expires_epoch_seconds: f64, margin_seconds: i64) -> bool {
    let now = Utc::now().timestamp() as f64;
    now + margin_seconds as f64 >= expires_epoch_seconds
}

/// Epoch milliseconds → expiry check with zero margin.
fn epoch_millis_expired(expires_epoch_millis: f64) -> bool {
    epoch_expired(expires_epoch_millis / 1000.0, 0)
}

/// Parse an expiry value that may be an RFC3339 string, a numeric string, or
/// a JSON number in epoch seconds (values ≥ 1e12 are treated as millis).
fn flexible_expiry_epoch_seconds(value: &Value) -> Option<f64> {
    match value {
        Value::String(s) => {
            let s = s.trim();
            if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                return Some(dt.timestamp() as f64);
            }
            s.parse::<f64>().ok().map(normalize_epoch_seconds)
        }
        Value::Number(n) => n.as_f64().map(normalize_epoch_seconds),
        _ => None,
    }
}

fn normalize_epoch_seconds(v: f64) -> f64 {
    if v >= 1e12 {
        v / 1000.0
    } else {
        v
    }
}

/// Run a command with a hard timeout: the wait happens on a spawned thread;
/// on timeout the child is killed by pid and reaped.
fn run_with_timeout(mut command: Command, timeout: Duration) -> Option<Output> {
    use std::sync::mpsc;
    command.stdout(Stdio::piped()).stderr(Stdio::null());
    let child = command.spawn().ok()?;
    let pid = child.id();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(output)) => Some(output),
        Ok(Err(_)) | Err(mpsc::RecvTimeoutError::Disconnected) => None,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            kill_process(pid);
            // Reap the killed child so it does not linger as a zombie.
            let _ = rx.recv_timeout(Duration::from_secs(2));
            None
        }
    }
}

fn kill_process(pid: u32) {
    #[cfg(unix)]
    {
        let _ = Command::new("/bin/kill").arg("-9").arg(pid.to_string()).status();
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/F"]).status();
    }
}

fn find_on_path(names: &[&str]) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
            #[cfg(windows)]
            {
                let exe = dir.join(format!("{name}.exe"));
                if exe.is_file() {
                    return Some(exe);
                }
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Claude
//
// Chain: env `CLAUDE_CODE_OAUTH_TOKEN` → macOS Keychain entry
// "Claude Code-credentials" (via /usr/bin/security, no Security-framework
// prompt) → `<claude_home>/.credentials.json`. The JSON shape in both stores
// is `{ "claudeAiOauth": { "accessToken", "expiresAt" (epoch ms) } }`.
// ---------------------------------------------------------------------------

pub fn claude_home() -> Option<PathBuf> {
    env_path("OHMYC_QUOTA_CLAUDE_HOME").or_else(|| crate::claude_home::resolve().ok())
}

pub fn claude() -> CredentialOutcome {
    if let Ok(token) = std::env::var("CLAUDE_CODE_OAUTH_TOKEN") {
        if let Some(token) = non_empty_str(Some(&Value::String(token))) {
            return CredentialOutcome::Token(token);
        }
    }
    if let Some(blob) = claude_keychain_blob() {
        if let Some(outcome) = claude_from_json_str(&blob) {
            return outcome;
        }
    }
    let Some(path) = claude_home().map(|h| h.join(".credentials.json")) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(text) = std::fs::read_to_string(path).ok() else {
        return CredentialOutcome::NotLoggedIn;
    };
    claude_from_json_str(&text).unwrap_or(CredentialOutcome::NotLoggedIn)
}

fn claude_from_json_str(text: &str) -> Option<CredentialOutcome> {
    let json: Value = serde_json::from_str(text).ok()?;
    let oauth = json.get("claudeAiOauth")?;
    let token = non_empty_str(oauth.get("accessToken"))?;
    if let Some(expires_ms) = oauth.get("expiresAt").and_then(Value::as_f64) {
        if epoch_millis_expired(expires_ms) {
            return Some(CredentialOutcome::Expired);
        }
    }
    Some(CredentialOutcome::Token(token))
}

/// Read the `Claude Code-credentials` generic-password entry through the
/// `security` CLI. Claude Code wrote its own ACL onto the entry, so this path
/// does not pop an authorization dialog. Hard-capped at 3s: if macOS decides
/// to prompt anyway, we give up instead of hanging the fetch.
///
/// Disabled under `cfg(test)` so hermetic tests can never touch the real
/// keychain of a developer machine or CI runner.
fn claude_keychain_blob() -> Option<String> {
    #[cfg(all(target_os = "macos", not(test)))]
    {
        let mut command = Command::new("/usr/bin/security");
        command
            .arg("find-generic-password")
            .arg("-s")
            .arg("Claude Code-credentials")
            .arg("-w");
        let output = run_with_timeout(command, KEYCHAIN_TIMEOUT)?;
        if !output.status.success() {
            return None;
        }
        let blob = String::from_utf8(output.stdout).ok()?.trim().to_string();
        if blob.is_empty() {
            None
        } else {
            Some(blob)
        }
    }
    #[cfg(not(all(target_os = "macos", not(test))))]
    {
        None
    }
}

// ---------------------------------------------------------------------------
// Codex
//
// `<codex_home>/auth.json` → `tokens.access_token` + `tokens.account_id`.
// No local expiry precheck: the wham usage endpoint answers 401 for stale
// tokens and we map that to TokenExpired.
// ---------------------------------------------------------------------------

pub fn codex_home() -> Option<PathBuf> {
    env_path("OHMYC_QUOTA_CODEX_HOME").or_else(|| crate::providers::paths::codex_home().ok())
}

pub fn codex() -> CodexOutcome {
    let Some(path) = codex_home().map(|h| h.join("auth.json")) else {
        return CodexOutcome::NotLoggedIn;
    };
    let Some(json) = read_json(&path) else {
        return CodexOutcome::NotLoggedIn;
    };
    let tokens = json.get("tokens");
    let Some(access_token) = non_empty_str(tokens.and_then(|t| t.get("access_token"))) else {
        return CodexOutcome::NotLoggedIn;
    };
    CodexOutcome::Tokens(CodexTokens {
        access_token,
        account_id: non_empty_str(tokens.and_then(|t| t.get("account_id"))),
    })
}

// ---------------------------------------------------------------------------
// Cursor
//
// Chain:
// 1. macOS Keychain generic-password `cursor-access-token` (account
//    `cursor-user`) — the cursor-agent CLI persists its session there (raw
//    JWT, sibling `cursor-refresh-token` entry untouched). Read via
//    /usr/bin/security, same no-prompt pattern as Claude.
// 2. The Cursor CLI (`cursor-agent`, newer builds also `agent`) — running
//    `status --format json`; only builds that both authenticate
//    (`isAuthenticated: true`) and expose `auth.accessToken` in stdout are
//    trusted (current builds report booleans only). Binary lookup: env
//    `OHMYC_QUOTA_CURSOR_AGENT` → PATH → well-known install dirs, because a
//    Finder-launched app inherits launchd's sparse PATH and misses
//    ~/.local/bin where the installer puts cursor-agent.
// 3. `auth.json` written by `cursor-agent login` under the platform config
//    home (`$XDG_CONFIG_HOME/cursor` / `~/.config/cursor`, `%APPDATA%\cursor`
//    on Windows; older builds used `~/.cursor`). Current macOS builds moved
//    to the keychain instead, so this mainly covers Linux/Windows and legacy
//    installs. Path overridable via `OHMYC_QUOTA_CURSOR_AUTH_JSON`.
// 4. The IDE's `state.vscdb` SQLite db, opened read-only + immutable so we
//    never create WAL files in Cursor's directory:
//    `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'`.
//    Path overridable via `OHMYC_QUOTA_CURSOR_STATE_DB`.
// ---------------------------------------------------------------------------

pub fn cursor() -> CredentialOutcome {
    if let Some(token) = cursor_keychain_token() {
        return CredentialOutcome::Token(token);
    }
    if let Some(token) = cursor_from_agent_cli() {
        return CredentialOutcome::Token(token);
    }
    if let Some(token) = cursor_from_auth_json() {
        return CredentialOutcome::Token(token);
    }
    cursor_from_state_db()
}

fn cursor_auth_json_path() -> Option<PathBuf> {
    if let Some(path) = env_path("OHMYC_QUOTA_CURSOR_AUTH_JSON") {
        return Some(path);
    }
    let home = dirs::home_dir()?;
    // `mut` is only exercised by the Windows/Linux cfg blocks below.
    #[allow(unused_mut)]
    let mut candidates = vec![home.join(".config/cursor/auth.json"), home.join(".cursor/auth.json")];
    #[cfg(target_os = "windows")]
    if let Some(appdata) = std::env::var_os("APPDATA") {
        candidates.insert(0, PathBuf::from(appdata).join("cursor").join("auth.json"));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
    {
        candidates.insert(0, xdg.join("cursor").join("auth.json"));
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn cursor_from_auth_json() -> Option<String> {
    let path = cursor_auth_json_path()?;
    let json = read_json(&path)?;
    non_empty_str(json.get("accessToken"))
}

/// `cursor-access-token` / `cursor-user` in the login keychain. The value is
/// the raw access token (a JWT), not a JSON envelope. Hard-capped at 3s like
/// the Claude read: if macOS ever decides to prompt, we give up instead of
/// hanging the fetch. Disabled under cfg(test) — hermetic tests never touch
/// the real keychain.
fn cursor_keychain_token() -> Option<String> {
    #[cfg(all(target_os = "macos", not(test)))]
    {
        let mut command = Command::new("/usr/bin/security");
        command
            .arg("find-generic-password")
            .arg("-s")
            .arg("cursor-access-token")
            .arg("-a")
            .arg("cursor-user")
            .arg("-w");
        let output = run_with_timeout(command, KEYCHAIN_TIMEOUT)?;
        if !output.status.success() {
            return None;
        }
        let token = String::from_utf8(output.stdout).ok()?.trim().to_string();
        if token.is_empty() {
            None
        } else {
            Some(token)
        }
    }
    #[cfg(not(all(target_os = "macos", not(test))))]
    {
        None
    }
}

fn cursor_agent_binary() -> Option<PathBuf> {
    env_path("OHMYC_QUOTA_CURSOR_AGENT")
        .or_else(|| find_on_path(&["cursor-agent", "agent"]))
        .or_else(|| {
            // GUI apps get launchd's PATH (/usr/bin:/bin:...), which misses
            // user-local bins. Probe the installer's default locations.
            let mut candidates = vec![];
            if let Some(home) = dirs::home_dir() {
                candidates.push(home.join(".local/bin/cursor-agent"));
            }
            candidates.push(PathBuf::from("/opt/homebrew/bin/cursor-agent"));
            candidates.push(PathBuf::from("/usr/local/bin/cursor-agent"));
            candidates.into_iter().find(|p| p.is_file())
        })
}

fn cursor_from_agent_cli() -> Option<String> {
    let binary = cursor_agent_binary()?;
    let mut command = Command::new(binary);
    command.arg("status").arg("--format").arg("json");
    let output = run_with_timeout(command, AGENT_STATUS_TIMEOUT)?;
    if !output.status.success() {
        return None;
    }
    let json: Value = serde_json::from_slice(&output.stdout).ok()?;
    // `agent` is a contested binary name (Grok's CLI installs one too) — only
    // trust stdout that looks like a Cursor status payload.
    json.get("isAuthenticated").and_then(Value::as_bool).filter(|ok| *ok)?;
    non_empty_str(json.get("auth").and_then(|a| a.get("accessToken")))
}

fn cursor_state_db_path() -> Option<PathBuf> {
    if let Some(path) = env_path("OHMYC_QUOTA_CURSOR_STATE_DB") {
        return Some(path);
    }
    let rel = "User/globalStorage/state.vscdb";
    #[cfg(target_os = "macos")]
    {
        home_join(&format!("Library/Application Support/Cursor/{rel}"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA").map(|base| PathBuf::from(base).join("Cursor").join(rel))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let base = std::env::var_os("XDG_CONFIG_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| home_join(".config"))?;
        Some(base.join("Cursor").join(rel))
    }
}

fn cursor_from_state_db() -> CredentialOutcome {
    let Some(path) = cursor_state_db_path() else {
        return CredentialOutcome::NotLoggedIn;
    };
    if !path.is_file() {
        return CredentialOutcome::NotLoggedIn;
    }
    // `mode=ro&immutable=1`: read-only and no WAL sidecars, so opening the db
    // leaves zero footprints in Cursor's directory.
    let escaped = path
        .display()
        .to_string()
        .replace('%', "%25")
        .replace('?', "%3F")
        .replace('#', "%23");
    let uri = format!("file:{escaped}?mode=ro&immutable=1");
    let conn = rusqlite::Connection::open_with_flags(
        &uri,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    );
    let Ok(conn) = conn else {
        return CredentialOutcome::NotLoggedIn;
    };
    let token: Option<String> = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'",
            [],
            |row| row.get(0),
        )
        .ok();
    match token {
        Some(token) if !token.trim().is_empty() => CredentialOutcome::Token(token),
        _ => CredentialOutcome::NotLoggedIn,
    }
}

// ---------------------------------------------------------------------------
// Grok
//
// `<grok_home>/auth.json`: a map keyed by OIDC issuer (e.g.
// `https://auth.x.ai::<uuid>`). We take the entry whose issuer contains
// `auth.x.ai` (first entry with a `key` field as fallback); `key` is the
// access token. `expires_at` may be RFC3339 or epoch (s/ms) — 60s margin.
// ---------------------------------------------------------------------------

pub fn grok() -> CredentialOutcome {
    let Some(path) = env_path("OHMYC_QUOTA_GROK_HOME")
        .or_else(|| home_join(".grok"))
        .map(|h| h.join("auth.json"))
    else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(json) = read_json(&path) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(entries) = json.as_object() else {
        return CredentialOutcome::NotLoggedIn;
    };
    let has_key = |v: &Value| non_empty_str(v.get("key")).is_some();
    let entry = entries
        .iter()
        .find(|(issuer, v)| issuer.contains("auth.x.ai") && has_key(v))
        .or_else(|| entries.iter().find(|(_, v)| has_key(v)));
    let Some((_, entry)) = entry else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(token) = non_empty_str(entry.get("key")) else {
        return CredentialOutcome::NotLoggedIn;
    };
    if let Some(expires) = entry.get("expires_at").and_then(flexible_expiry_epoch_seconds) {
        if epoch_expired(expires, EARLY_EXPIRY_MARGIN_SECONDS) {
            return CredentialOutcome::Expired;
        }
    }
    CredentialOutcome::Token(token)
}

// ---------------------------------------------------------------------------
// Gemini
//
// `<gemini_home>/oauth_creds.json` → `access_token`; `expiry_date` is epoch
// milliseconds. We never use `refresh_token` (read-only policy).
// ---------------------------------------------------------------------------

pub fn gemini() -> CredentialOutcome {
    let Some(path) = env_path("OHMYC_QUOTA_GEMINI_HOME")
        .or_else(|| home_join(".gemini"))
        .map(|h| h.join("oauth_creds.json"))
    else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(json) = read_json(&path) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(token) = non_empty_str(json.get("access_token")) else {
        return CredentialOutcome::NotLoggedIn;
    };
    if let Some(expiry_ms) = json.get("expiry_date").and_then(Value::as_f64) {
        if epoch_millis_expired(expiry_ms) {
            return CredentialOutcome::Expired;
        }
    }
    CredentialOutcome::Token(token)
}

// ---------------------------------------------------------------------------
// Kimi
//
// `<kimi_home>/credentials/kimi-code.json`. Field names verified against
// CodexBar's KimiSettingsReader.swift: snake_case `access_token` /
// `refresh_token` / `expires_at` (epoch seconds, number or numeric string).
// We additionally accept camelCase variants defensively. Never write this
// file: Kimi rotates refresh tokens, so the CLI owns renewal. 60s margin.
// ---------------------------------------------------------------------------

pub fn kimi() -> CredentialOutcome {
    let Some(path) = env_path("OHMYC_QUOTA_KIMI_HOME")
        .or_else(|| home_join(".kimi-code"))
        .map(|h| h.join("credentials").join("kimi-code.json"))
    else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(json) = read_json(&path) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let token = non_empty_str(json.get("access_token"))
        .or_else(|| non_empty_str(json.get("accessToken")))
        .or_else(|| non_empty_str(json.get("token")));
    let Some(token) = token else {
        return CredentialOutcome::NotLoggedIn;
    };
    let expiry = json
        .get("expires_at")
        .or_else(|| json.get("expiresAt"))
        .and_then(flexible_expiry_epoch_seconds);
    if let Some(expires) = expiry {
        if epoch_expired(expires, EARLY_EXPIRY_MARGIN_SECONDS) {
            return CredentialOutcome::Expired;
        }
    }
    CredentialOutcome::Token(token)
}

// ---------------------------------------------------------------------------
// OpenCode Go (opencode's subscription product)
//
// Chain: env `OPENCODE_API_KEY` → `<opencode data home>/auth.json`, where the
// data home is `OHMYC_QUOTA_OPENCODE_HOME` → `$XDG_DATA_HOME/opencode` →
// `~/.local/share/opencode`. Note this is the XDG **data** home, distinct
// from `crate::providers::paths::opencode_home` (the XDG **config** home).
// Entries look like `{"opencode-go": {"type": "api", "key": "..."}}`; Go and
// Zen share one key, so `opencode-go` is preferred with an `opencode`
// fallback. There is no expiry field → no precheck; a dead key surfaces as
// 401 → TokenExpired at fetch time.
// ---------------------------------------------------------------------------

pub fn opencode_go() -> CredentialOutcome {
    if let Ok(key) = std::env::var("OPENCODE_API_KEY") {
        if let Some(key) = non_empty_str(Some(&Value::String(key))) {
            return CredentialOutcome::Token(key);
        }
    }
    let Some(path) = opencode_data_home().map(|h| h.join("auth.json")) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let Some(json) = read_json(&path) else {
        return CredentialOutcome::NotLoggedIn;
    };
    let key = ["opencode-go", "opencode"]
        .iter()
        .find_map(|name| non_empty_str(json.get(*name).and_then(|entry| entry.get("key"))));
    match key {
        Some(key) => CredentialOutcome::Token(key),
        None => CredentialOutcome::NotLoggedIn,
    }
}

fn opencode_data_home() -> Option<PathBuf> {
    if let Some(path) = env_path("OHMYC_QUOTA_OPENCODE_HOME") {
        return Some(path);
    }
    #[cfg(windows)]
    {
        // No XDG on Windows; opencode keeps data under the roaming profile.
        std::env::var_os("APPDATA").map(|base| PathBuf::from(base).join("opencode"))
    }
    #[cfg(not(windows))]
    {
        let base = std::env::var_os("XDG_DATA_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .or_else(|| home_join(".local/share"))?;
        Some(base.join("opencode"))
    }
}

// GLM Coding Plan (Zhipu Z.ai)
//
// Z.ai has no first-party CLI, so like OpenCode Go this is "config files +
// env". Regions are separate accounts with separate keys and hosts: the
// international console (api.z.ai) and the China console (open.bigmodel.cn).
// The credential source tells us the region: opencode's `zhipuai-coding-plan`
// provider id is the China plan, `zai-coding-plan` / `zai` are international.
//
// Chain: env `ZAI_API_KEY` → `GLM_API_KEY` → `ZHIPU_API_KEY` (international) →
// opencode `auth.json` keys `zai-coding-plan` / `zhipuai-coding-plan` / `zai` →
// `~/.config/zai/key.json` (`OHMYC_QUOTA_GLM_CONFIG_HOME` overrides the config
// dir; fields `apiKey` / `api_key`) → `~/.pi/agent/models.json`
// (`OHMYC_QUOTA_PI_HOME`; `providers.zai.apiKey`). No expiry fields anywhere
// → no precheck; a dead key surfaces as 401 → TokenExpired at fetch time.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GlmRegion {
    International,
    China,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GlmCredential {
    pub key: String,
    pub region: GlmRegion,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GlmOutcome {
    Credential(GlmCredential),
    NotLoggedIn,
}

pub fn glm() -> GlmOutcome {
    for env in ["ZAI_API_KEY", "GLM_API_KEY", "ZHIPU_API_KEY"] {
        if let Ok(key) = std::env::var(env) {
            if let Some(key) = non_empty_str(Some(&Value::String(key))) {
                return GlmOutcome::Credential(GlmCredential {
                    key,
                    region: GlmRegion::International,
                });
            }
        }
    }
    if let Some(path) = opencode_data_home().map(|h| h.join("auth.json")) {
        if let Some(json) = read_json(&path) {
            // Order matters: the China plan id must be checked before the
            // plain `zai` pay-as-you-go id so a machine with both resolves to
            // the subscription key.
            for (name, region) in [
                ("zai-coding-plan", GlmRegion::International),
                ("zhipuai-coding-plan", GlmRegion::China),
                ("zai", GlmRegion::International),
            ] {
                if let Some(key) = non_empty_str(json.get(name).and_then(|entry| entry.get("key"))) {
                    return GlmOutcome::Credential(GlmCredential { key, region });
                }
            }
        }
    }
    if let Some(dir) = env_path("OHMYC_QUOTA_GLM_CONFIG_HOME").or_else(|| home_join(".config/zai")) {
        if let Some(json) = read_json(&dir.join("key.json")) {
            if let Some(key) = non_empty_str(json.get("apiKey")).or_else(|| non_empty_str(json.get("api_key"))) {
                return GlmOutcome::Credential(GlmCredential {
                    key,
                    region: GlmRegion::International,
                });
            }
        }
    }
    if let Some(dir) = env_path("OHMYC_QUOTA_PI_HOME").or_else(|| home_join(".pi/agent")) {
        if let Some(json) = read_json(&dir.join("models.json")) {
            if let Some(key) = non_empty_str(
                json.get("providers")
                    .and_then(|p| p.get("zai"))
                    .and_then(|z| z.get("apiKey")),
            ) {
                return GlmOutcome::Credential(GlmCredential {
                    key,
                    region: GlmRegion::International,
                });
            }
        }
    }
    GlmOutcome::NotLoggedIn
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::quota::testutil::{EnvGuard, ENV_LOCK};
    use std::io::Write;

    fn write_file(dir: &std::path::Path, rel: &str, contents: &str) {
        let path = dir.join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
    }

    fn future_epoch_ms() -> i64 {
        Utc::now().timestamp_millis() + 3_600_000
    }

    fn past_epoch_ms() -> i64 {
        Utc::now().timestamp_millis() - 3_600_000
    }

    #[test]
    fn claude_reads_credentials_json_from_quota_home_override() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            ".credentials.json",
            &format!(
                r#"{{"claudeAiOauth":{{"accessToken":"sk-ant-test","expiresAt":{}}}}}"#,
                future_epoch_ms()
            ),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_CLAUDE_HOME", home.path().to_str().unwrap());
        let _token = EnvGuard::unset("CLAUDE_CODE_OAUTH_TOKEN");
        assert_eq!(claude(), CredentialOutcome::Token("sk-ant-test".to_string()));
    }

    #[test]
    fn claude_env_token_wins_over_file() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            ".credentials.json",
            r#"{"claudeAiOauth":{"accessToken":"from-file"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_CLAUDE_HOME", home.path().to_str().unwrap());
        let _token = EnvGuard::set("CLAUDE_CODE_OAUTH_TOKEN", "from-env");
        assert_eq!(claude(), CredentialOutcome::Token("from-env".to_string()));
    }

    #[test]
    fn claude_expired_credentials_report_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            ".credentials.json",
            &format!(
                r#"{{"claudeAiOauth":{{"accessToken":"sk-ant-old","expiresAt":{}}}}}"#,
                past_epoch_ms()
            ),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_CLAUDE_HOME", home.path().to_str().unwrap());
        let _token = EnvGuard::unset("CLAUDE_CODE_OAUTH_TOKEN");
        assert_eq!(claude(), CredentialOutcome::Expired);
    }

    #[test]
    fn claude_missing_everything_is_not_logged_in() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _home = EnvGuard::set("OHMYC_QUOTA_CLAUDE_HOME", home.path().to_str().unwrap());
        let _token = EnvGuard::unset("CLAUDE_CODE_OAUTH_TOKEN");
        assert_eq!(claude(), CredentialOutcome::NotLoggedIn);
    }

    #[test]
    fn codex_reads_tokens_and_account_id() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            r#"{"tokens":{"access_token":"codex-at","account_id":"acc-123","refresh_token":"rt"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_CODEX_HOME", home.path().to_str().unwrap());
        assert_eq!(
            codex(),
            CodexOutcome::Tokens(CodexTokens {
                access_token: "codex-at".to_string(),
                account_id: Some("acc-123".to_string()),
            })
        );
    }

    #[test]
    fn codex_missing_auth_json_is_not_logged_in() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _home = EnvGuard::set("OHMYC_QUOTA_CODEX_HOME", home.path().to_str().unwrap());
        assert_eq!(codex(), CodexOutcome::NotLoggedIn);
    }

    #[test]
    fn grok_picks_auth_x_ai_entry_and_checks_expiry() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let future = (Utc::now().timestamp() + 3600).to_string();
        write_file(
            home.path(),
            "auth.json",
            &format!(
                r#"{{"https://other.example.com::u1":{{"key":"other"}},
                     "https://auth.x.ai::u2":{{"key":"grok-at","expires_at":"{future}"}}}}"#
            ),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_GROK_HOME", home.path().to_str().unwrap());
        assert_eq!(grok(), CredentialOutcome::Token("grok-at".to_string()));
    }

    #[test]
    fn grok_rfc3339_past_expiry_reports_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            r#"{"https://auth.x.ai::u2":{"key":"grok-old","expires_at":"2020-01-01T00:00:00Z"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_GROK_HOME", home.path().to_str().unwrap());
        assert_eq!(grok(), CredentialOutcome::Expired);
    }

    #[test]
    fn grok_epoch_millis_expiry_is_understood() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            &format!(
                r#"{{"https://auth.x.ai::u2":{{"key":"grok-at","expires_at":{}}}}}"#,
                future_epoch_ms()
            ),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_GROK_HOME", home.path().to_str().unwrap());
        assert_eq!(grok(), CredentialOutcome::Token("grok-at".to_string()));
    }

    #[test]
    fn gemini_expired_oauth_creds_report_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "oauth_creds.json",
            &format!(
                r#"{{"access_token":"ya29.old","refresh_token":"rt","expiry_date":{}}}"#,
                past_epoch_ms()
            ),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_GEMINI_HOME", home.path().to_str().unwrap());
        assert_eq!(gemini(), CredentialOutcome::Expired);
    }

    #[test]
    fn gemini_valid_oauth_creds_yield_token() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "oauth_creds.json",
            &format!(r#"{{"access_token":"ya29.fresh","expiry_date":{}}}"#, future_epoch_ms()),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_GEMINI_HOME", home.path().to_str().unwrap());
        assert_eq!(gemini(), CredentialOutcome::Token("ya29.fresh".to_string()));
    }

    #[test]
    fn kimi_reads_snake_case_cli_credential() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let future = Utc::now().timestamp() + 900;
        write_file(
            home.path(),
            "credentials/kimi-code.json",
            &format!(r#"{{"access_token":"kimi-at","refresh_token":"rt","expires_at":{future}}}"#),
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_KIMI_HOME", home.path().to_str().unwrap());
        assert_eq!(kimi(), CredentialOutcome::Token("kimi-at".to_string()));
    }

    #[test]
    fn kimi_expired_token_reports_expired() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "credentials/kimi-code.json",
            r#"{"access_token":"kimi-old","expires_at":1700000000}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_KIMI_HOME", home.path().to_str().unwrap());
        assert_eq!(kimi(), CredentialOutcome::Expired);
    }

    #[test]
    fn cursor_reads_token_from_state_db() {
        let _lock = ENV_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("state.vscdb");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)", [])
            .unwrap();
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('cursorAuth/accessToken', 'cursor-at')",
            [],
        )
        .unwrap();
        drop(conn);
        let _db = EnvGuard::set("OHMYC_QUOTA_CURSOR_STATE_DB", db_path.to_str().unwrap());
        let _agent = EnvGuard::set("OHMYC_QUOTA_CURSOR_AGENT", "/nonexistent/agent");
        let _auth_json = EnvGuard::set("OHMYC_QUOTA_CURSOR_AUTH_JSON", "/nonexistent/auth.json");
        assert_eq!(cursor(), CredentialOutcome::Token("cursor-at".to_string()));
        // The immutable read must not leave WAL sidecars behind.
        assert!(!db_path.with_extension("vscdb-wal").exists());
        assert!(!db_path.with_extension("vscdb-shm").exists());
    }

    #[test]
    fn cursor_reads_token_from_auth_json() {
        let _lock = ENV_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let auth_path = dir.path().join("auth.json");
        std::fs::write(&auth_path, r#"{"accessToken":"cursor-json-at"}"#).unwrap();
        let _agent = EnvGuard::set("OHMYC_QUOTA_CURSOR_AGENT", "/nonexistent/agent");
        let _auth_json = EnvGuard::set("OHMYC_QUOTA_CURSOR_AUTH_JSON", auth_path.to_str().unwrap());
        let _db = EnvGuard::set("OHMYC_QUOTA_CURSOR_STATE_DB", "/nonexistent/state.vscdb");
        assert_eq!(cursor(), CredentialOutcome::Token("cursor-json-at".to_string()));
    }

    #[test]
    fn cursor_missing_everything_is_not_logged_in() {
        let _lock = ENV_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let _db = EnvGuard::set(
            "OHMYC_QUOTA_CURSOR_STATE_DB",
            dir.path().join("state.vscdb").to_str().unwrap(),
        );
        let _agent = EnvGuard::set("OHMYC_QUOTA_CURSOR_AGENT", "/nonexistent/agent");
        let _auth_json = EnvGuard::set("OHMYC_QUOTA_CURSOR_AUTH_JSON", "/nonexistent/auth.json");
        assert_eq!(cursor(), CredentialOutcome::NotLoggedIn);
    }

    #[test]
    fn flexible_expiry_accepts_rfc3339_and_epochs() {
        assert_eq!(
            flexible_expiry_epoch_seconds(&Value::String("2026-10-01T00:00:00Z".into())),
            Some(
                DateTime::parse_from_rfc3339("2026-10-01T00:00:00Z")
                    .unwrap()
                    .timestamp() as f64
            )
        );
        assert_eq!(
            flexible_expiry_epoch_seconds(&serde_json::json!(1_780_000_000)),
            Some(1_780_000_000.0)
        );
        assert_eq!(
            flexible_expiry_epoch_seconds(&serde_json::json!(1_780_000_000_000_i64)),
            Some(1_780_000_000.0)
        );
        assert_eq!(flexible_expiry_epoch_seconds(&Value::Null), None);
    }

    #[test]
    fn opencode_env_key_wins_over_file() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            r#"{"opencode-go":{"type":"api","key":"oc-from-file"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _env = EnvGuard::set("OPENCODE_API_KEY", "oc-from-env");
        assert_eq!(opencode_go(), CredentialOutcome::Token("oc-from-env".to_string()));
    }

    #[test]
    fn opencode_go_key_is_preferred_over_zen_key() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            r#"{"opencode":{"type":"api","key":"zen-key"},"opencode-go":{"type":"api","key":"go-key"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _env = EnvGuard::unset("OPENCODE_API_KEY");
        assert_eq!(opencode_go(), CredentialOutcome::Token("go-key".to_string()));
    }

    #[test]
    fn opencode_zen_key_is_fallback() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        write_file(
            home.path(),
            "auth.json",
            r#"{"opencode":{"type":"api","key":"zen-key"}}"#,
        );
        let _home = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _env = EnvGuard::unset("OPENCODE_API_KEY");
        assert_eq!(opencode_go(), CredentialOutcome::Token("zen-key".to_string()));
    }

    #[test]
    fn opencode_missing_file_is_not_logged_in() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _home = EnvGuard::set("OHMYC_QUOTA_OPENCODE_HOME", home.path().to_str().unwrap());
        let _env = EnvGuard::unset("OPENCODE_API_KEY");
        assert_eq!(opencode_go(), CredentialOutcome::NotLoggedIn);
    }

    // GLM ----------------------------------------------------------------

    /// Isolate every location the GLM resolver reads, plus its env keys.
    fn glm_env(home: &tempfile::TempDir) -> Vec<EnvGuard> {
        vec![
            EnvGuard::set(
                "OHMYC_QUOTA_OPENCODE_HOME",
                home.path().join("opencode").to_str().unwrap(),
            ),
            EnvGuard::set(
                "OHMYC_QUOTA_GLM_CONFIG_HOME",
                home.path().join("config").to_str().unwrap(),
            ),
            EnvGuard::set("OHMYC_QUOTA_PI_HOME", home.path().join("pi").to_str().unwrap()),
            EnvGuard::unset("ZAI_API_KEY"),
            EnvGuard::unset("GLM_API_KEY"),
            EnvGuard::unset("ZHIPU_API_KEY"),
        ]
    }

    #[test]
    fn glm_env_keys_win_and_default_to_international() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = glm_env(&home);
        let _key = EnvGuard::set("ZAI_API_KEY", "zai-from-env");
        match glm() {
            GlmOutcome::Credential(credential) => {
                assert_eq!(credential.key, "zai-from-env");
                assert_eq!(credential.region, GlmRegion::International);
            }
            other => panic!("expected credential, got {other:?}"),
        }
    }

    #[test]
    fn glm_falls_back_to_legacy_env_names_in_order() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = glm_env(&home);
        let _keys = [
            EnvGuard::unset("ZAI_API_KEY"),
            EnvGuard::set("GLM_API_KEY", "glm-legacy"),
        ];
        match glm() {
            GlmOutcome::Credential(credential) => assert_eq!(credential.key, "glm-legacy"),
            other => panic!("expected credential, got {other:?}"),
        }
    }

    #[test]
    fn glm_opencode_coding_plan_keys_carry_their_region() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = glm_env(&home);
        write_file(
            home.path().join("opencode").as_path(),
            "auth.json",
            r#"{"zai":{"type":"api","key":"payg"},"zhipuai-coding-plan":{"type":"api","key":"cn-plan"}}"#,
        );
        // The China plan id wins over the plain pay-as-you-go id — and it
        // flips the region to the bigmodel.cn host.
        match glm() {
            GlmOutcome::Credential(credential) => {
                assert_eq!(credential.key, "cn-plan");
                assert_eq!(credential.region, GlmRegion::China);
            }
            other => panic!("expected credential, got {other:?}"),
        }
    }

    #[test]
    fn glm_international_coding_plan_key_is_international() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = glm_env(&home);
        write_file(
            home.path().join("opencode").as_path(),
            "auth.json",
            r#"{"zai-coding-plan":{"type":"api","key":"intl-plan"}}"#,
        );
        match glm() {
            GlmOutcome::Credential(credential) => {
                assert_eq!(credential.key, "intl-plan");
                assert_eq!(credential.region, GlmRegion::International);
            }
            other => panic!("expected credential, got {other:?}"),
        }
    }

    #[test]
    fn glm_config_and_pi_files_are_the_last_resorts() {
        let _lock = ENV_LOCK.lock().unwrap();
        // Each scenario needs its own home: files written by an earlier
        // scenario would otherwise leak into the later one's lookup order.
        let config_home = tempfile::tempdir().unwrap();
        {
            let _env = glm_env(&config_home);
            // glm_env points OHMYC_QUOTA_GLM_CONFIG_HOME at <home>/config.
            write_file(
                config_home.path().join("config").as_path(),
                "key.json",
                r#"{"apiKey":"config-key"}"#,
            );
            assert_eq!(
                glm(),
                GlmOutcome::Credential(GlmCredential {
                    key: "config-key".to_string(),
                    region: GlmRegion::International
                })
            );
        }
        let pi_home = tempfile::tempdir().unwrap();
        {
            let _env = glm_env(&pi_home);
            write_file(
                pi_home.path().join("pi").as_path(),
                "models.json",
                r#"{"providers":{"zai":{"apiKey":"pi-key"}}}"#,
            );
            assert_eq!(
                glm(),
                GlmOutcome::Credential(GlmCredential {
                    key: "pi-key".to_string(),
                    region: GlmRegion::International
                })
            );
        }
    }

    #[test]
    fn glm_missing_everything_is_not_logged_in() {
        let _lock = ENV_LOCK.lock().unwrap();
        let home = tempfile::tempdir().unwrap();
        let _env = glm_env(&home);
        assert_eq!(glm(), GlmOutcome::NotLoggedIn);
    }
}
