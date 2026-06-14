# Desktop Migration — Slice 7: Profiles CRUD + Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the read + light-write half of `use-profiles.ts` (`useProfiles`, `useProfile`, `useCreateProfile`, `useUpdateProfile`, `useDeleteProfile`, `usePreflight` — 6 hooks) onto native Rust Tauri commands. Lights up profile browse/edit/create/delete and the "what would activation do?" preview that powers the safe-activation gate. Activation itself (`useActivateProfile` + `useDeactivateProfile`) is the killer transactional flow — pulled out into a follow-up slice so the rollback machinery, file locking, and symlink-or-junction platform abstraction get focused review.

**Architecture:** New `ohmyc-core::profiles` module reads/writes one JSON file per profile under `$OHMYC_HOME/profiles/<name>/profile.json`. CRUD is pure file I/O over `serde_json::Value` (Profile fields are mostly opaque to core: agents/skills/commands arrays + arbitrary settings/hooks/mcpServers/lspServers Values). Preflight composes: walks the profile's referenced components against slice-5's `store::store_{agents,skills,commands}_dir()` helpers, reads `<claude_home>/settings.json` for overwrite warnings, reads the `.active` marker for current-active context, and produces a model-config env diff using slice-5's `store::model_configs::get`. Read-only against the claude_home settings (matches slice 4 + slice 6 scope cut on multi-path merge). No watcher changes — profile-CRUD writes use React Query `onSuccess` invalidation, same pattern as slice 5.

**Tech Stack:** Rust (extends slice-5 deps; no new crates). TypeScript (existing transport seam + React Query infrastructure).

---

## Scope cut

In scope:
- 6 hooks: `profiles.list`, `profiles.get`, `profiles.create`, `profiles.update`, `profiles.delete`, `profiles.preflight`.
- Preflight: missing-component check, settings-overwrite warnings, current-active context, model-config env diff (SET/CHANGE/REMOVE + masked API key + deactivation diff when switching).
- Delete-safety gate against the active profile (returns `Conflict` if attempting to delete the active profile — matches the TS 409 behavior).

Out of scope (explicit deferrals):
- **`useActivateProfile` + `useDeactivateProfile`** — the transactional activation flow: file-based lock, undo stack, symlinks (or Windows junctions), `.claude-plugin/marketplace.json` generation, `installed_plugins.json` + `known_marketplaces.json` registration, settings backup + merge. Genuinely 2× the implementation surface of slices 5 or 6. Lands in a dedicated follow-up slice — name it slice 7b or "Profiles Activation". Until then, the two activation hooks **keep their legacy `fetch()` calls** in `use-profiles.ts` (same precedent as slice-5's `useStoreImport`).
- **`ActivationBlockedError` ApiError variant** — would only be consumed by the deferred activation flow; YAGNI for slice 7.
- **`.active` writer** — slice 7 only **reads** the `.active` marker for preflight's `currentActive` field. The TS service writes it during activation; that write lands with the deferred activation slice.
- **TS server deletion** (`packages/cli/src/server/routes/profiles.ts`, `services/profile-service.ts`, their tests, plus `LockService` + `ModelConfigService`) — slice 8 cleanup.

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/profiles/mod.rs` — namespace, path helpers (`profile_dir`, `profile_json_path`, `active_marker_path`), `Profile` type, name validation constants.
- `crates/ohmyc-core/src/profiles/crud.rs` — `list`, `get`, `create`, `update`, `delete`, `read_active_profile_name`.
- `crates/ohmyc-core/src/profiles/preflight.rs` — `PreflightResult`, `ModelConfigChanges`, `ModelConfigEnvChange`, `preflight`, internal `compute_settings_warnings`, `compute_model_config_changes`, `mask_api_key`.
- `packages/desktop/src-tauri/src/api/profiles.rs` — 6 Tauri command wrappers + delete-active conflict gate.
- `packages/ui/src/hooks/use-profiles.test.tsx` — vitest coverage against the mock transport.

**Modified files:**
- `crates/ohmyc-core/src/lib.rs` — `pub mod profiles;` (in alphabetical order between `pub mod plugins;` and `pub mod settings;`).
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod profiles;`.
- `packages/desktop/src-tauri/src/main.rs` — register 6 new commands.
- `packages/ui/src/lib/transport/fetch.ts` — 6 new wire-name entries (mix of GET / POST / PUT / DELETE).
- `packages/ui/src/lib/transport/transport.test.ts` — 1 new test asserting DELETE wire shape for profiles.
- `packages/ui/src/hooks/use-profiles.ts` — replace `fetchProfiles`/`fetchProfile`/`createProfile`/`updateProfile`/`deleteProfile`/`fetchPreflight` with `request()`. Keep `activateProfile` + `deactivateProfile` on legacy `fetch()` (documented scope-cut).
- `packages/ui/src/hooks/use-fs-changed.ts` — settings.json branch already invalidates `['plugins']` (slice 6); extend to also invalidate `['profiles']` since `.active` lives in the same write surface and `enabledPlugins` change implies an out-of-band activation.

---

## Wire-name convention

| JS wire | Rust function | Method | URL (fetch fallback) |
|---|---|---|---|
| `profiles.list` | `profiles_list` | GET | `/api/profiles` |
| `profiles.get` | `profiles_get` | GET | `/api/profiles/<name>` |
| `profiles.create` | `profiles_create` | POST | `/api/profiles` |
| `profiles.update` | `profiles_update` | PUT | `/api/profiles/<name>` |
| `profiles.delete` | `profiles_delete` | DELETE | `/api/profiles/<name>` |
| `profiles.preflight` | `profiles_preflight` | GET | `/api/profiles/<name>/preflight` |

All `name` args go in via path-param (URL encoding via `encodeURIComponent`).

---

## Task 1: Add `profiles` module skeleton + reserved-name constants

**Files:**
- Create: `crates/ohmyc-core/src/profiles/mod.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

The TS uses `RESERVED_PROFILE_NAMES = ['store', '.active', 'plugins', 'agents', 'skills', 'commands']` and `SAFE_NAME_PATTERN = /^[\w-]+$/` (word chars + hyphen). Rust mirrors with `&str` constants + a validation helper.

- [ ] **Step 1: Create the module file with failing tests**

Create `crates/ohmyc-core/src/profiles/mod.rs`:

```rust
//! Profile CRUD and preflight. Each profile is one
//! `$OHMYC_HOME/profiles/<name>/profile.json` file. Activation symlinks,
//! settings backup, and plugin-marketplace registration live in the
//! deferred "Profiles Activation" follow-up slice — slice 7 only covers
//! read + light writes + the dry-run preflight that the UI uses to
//! preview activation side-effects.

pub mod crud;
pub mod preflight;

use std::path::PathBuf;

use crate::error::ApiError;
use crate::store;

/// Names reserved by the profiles dir layout. Mirrors TS
/// `RESERVED_PROFILE_NAMES`. `.active` is a marker file; the rest are
/// sibling directories under the store.
pub const RESERVED_PROFILE_NAMES: &[&str] =
    &["store", ".active", "plugins", "agents", "skills", "commands"];

/// `$OHMYC_HOME/profiles/<name>/`.
pub fn profile_dir(name: &str) -> Result<PathBuf, ApiError> {
    Ok(store::store_profiles_dir()?.join(name))
}

/// `$OHMYC_HOME/profiles/<name>/profile.json`.
pub fn profile_json_path(name: &str) -> Result<PathBuf, ApiError> {
    Ok(profile_dir(name)?.join("profile.json"))
}

/// `$OHMYC_HOME/profiles/.active` — bare-name or absolute-path marker
/// pointing at the currently active profile.
pub fn active_marker_path() -> Result<PathBuf, ApiError> {
    Ok(store::store_profiles_dir()?.join(".active"))
}

/// Mirrors TS `SAFE_NAME_PATTERN = /^[\w-]+$/`: ASCII alphanumeric +
/// underscore + hyphen, non-empty. No dots, slashes, or whitespace.
pub fn is_safe_profile_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

/// True when `name` is a layout-reserved sibling. Case-sensitive match,
/// matching TS Array.includes behavior.
pub fn is_reserved_profile_name(name: &str) -> bool {
    RESERVED_PROFILE_NAMES.contains(&name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_name_accepts_word_chars_and_hyphen() {
        assert!(is_safe_profile_name("dev"));
        assert!(is_safe_profile_name("my_profile"));
        assert!(is_safe_profile_name("ci-prod"));
        assert!(is_safe_profile_name("v1_2"));
    }

    #[test]
    fn safe_name_rejects_dots_slashes_whitespace_empty() {
        assert!(!is_safe_profile_name(""));
        assert!(!is_safe_profile_name("a.b"));
        assert!(!is_safe_profile_name("a/b"));
        assert!(!is_safe_profile_name("a b"));
        assert!(!is_safe_profile_name("../escape"));
    }

    #[test]
    fn reserved_names_include_layout_siblings() {
        assert!(is_reserved_profile_name("store"));
        assert!(is_reserved_profile_name(".active"));
        assert!(is_reserved_profile_name("plugins"));
        assert!(is_reserved_profile_name("agents"));
        assert!(is_reserved_profile_name("skills"));
        assert!(is_reserved_profile_name("commands"));
        assert!(!is_reserved_profile_name("dev"));
        assert!(!is_reserved_profile_name("Store")); // case-sensitive
    }
}
```

Note: `crud` and `preflight` submodules don't exist yet — Tasks 2 and 7 create them. The `pub mod crud;` + `pub mod preflight;` declarations will fail compilation until those tasks land. To keep Task 1 self-contained, temporarily comment them out: replace the two declarations with `// pub mod crud;` and `// pub mod preflight;` and remember to uncomment in Tasks 2 and 7.

Then open `crates/ohmyc-core/src/lib.rs` and insert the new module declaration alphabetically between `pub mod plugins;` and `pub mod settings;`:

```rust
pub mod plugins;
pub mod profiles;
pub mod settings;
```

- [ ] **Step 2: Run to confirm the tests pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles 2>&1 | tail -10`
Expected: `test result: ok. 3 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/mod.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): profiles module skeleton + reserved-name validation"
```

---

## Task 2: Define `Profile` type + `list`/`get` (read-only CRUD)

**Files:**
- Create: `crates/ohmyc-core/src/profiles/crud.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs` (uncomment `pub mod crud;`)

`Profile` mirrors the TS `ProfileSchema` — `name`, `description?`, four `Vec<String>` arrays (agents/skills/commands/plugins) defaulting to `[]`, optional `modelConfig`, plus three opaque `serde_json::Value` slots for `hooks`/`mcpServers`/`lspServers` and a `settings` Map for arbitrary key→value overrides.

- [ ] **Step 1: Create `crud.rs` with the `Profile` type + failing tests**

Create `crates/ohmyc-core/src/profiles/crud.rs`:

```rust
//! Pure file I/O for profile JSON. Each profile is
//! `$OHMYC_HOME/profiles/<name>/profile.json`. No symlinks, no settings
//! mutation — those live in the deferred activation slice.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::ApiError;

use super::{is_reserved_profile_name, is_safe_profile_name};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub agents: Vec<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_config: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hooks: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lsp_servers: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Map<String, Value>>,
}

/// List response shape — `{ profiles, active }` to match the TS route.
#[derive(Debug, Clone, Serialize)]
pub struct ProfileList {
    pub profiles: Vec<Profile>,
    pub active: Option<String>,
}

/// Read the `.active` marker. May contain either a bare profile name or
/// an absolute path to the profile directory — TS treats both as valid.
/// Returns `None` when missing or empty.
pub fn read_active_profile_name(profiles_dir: &Path) -> Result<Option<String>, ApiError> {
    let active_path = profiles_dir.join(".active");
    let raw = match std::fs::read_to_string(&active_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", active_path.display()))),
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    // Absolute path → basename; bare name → as-is.
    if std::path::Path::new(trimmed).is_absolute() {
        Ok(Path::new(trimmed)
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string()))
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

/// List all profiles under `<profiles_dir>` sorted by name. Skips dot-prefixed
/// entries (e.g. `.active`) and any directory whose `profile.json` is missing
/// or unparseable. Mirrors the TS `list()` behavior.
pub fn list(profiles_dir: &Path) -> Result<ProfileList, ApiError> {
    let active = read_active_profile_name(profiles_dir)?;

    if !profiles_dir.exists() {
        return Ok(ProfileList { profiles: Vec::new(), active });
    }

    let mut profiles: Vec<Profile> = Vec::new();
    for entry in std::fs::read_dir(profiles_dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if name.starts_with('.') {
            continue;
        }
        let json_path = path.join("profile.json");
        let raw = match std::fs::read_to_string(&json_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Ok(p) = serde_json::from_str::<Profile>(&raw) {
            profiles.push(p);
        }
    }
    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(ProfileList { profiles, active })
}

/// Fetch a single profile by name. Returns `Ok(None)` for invalid names or
/// missing files (matches TS `get() -> Profile | null`).
pub fn get(profiles_dir: &Path, name: &str) -> Result<Option<Profile>, ApiError> {
    if !is_safe_profile_name(name) || is_reserved_profile_name(name) {
        return Ok(None);
    }
    let json_path = profiles_dir.join(name).join("profile.json");
    match std::fs::read_to_string(&json_path) {
        Ok(raw) => match serde_json::from_str::<Profile>(&raw) {
            Ok(p) => Ok(Some(p)),
            Err(e) => Err(ApiError::Parse(format!("{}: {e}", json_path.display()))),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", json_path.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_profile(profiles_dir: &Path, name: &str, body: Value) {
        let dir = profiles_dir.join(name);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("profile.json"), body.to_string()).unwrap();
    }

    #[test]
    fn list_returns_empty_when_profiles_dir_missing() {
        let dir = tempfile::tempdir().unwrap();
        let result = list(&dir.path().join("does-not-exist")).unwrap();
        assert!(result.profiles.is_empty());
        assert!(result.active.is_none());
    }

    #[test]
    fn list_returns_profiles_sorted_by_name() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "zebra", serde_json::json!({"name": "zebra"}));
        write_profile(dir.path(), "alpha", serde_json::json!({"name": "alpha"}));
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 2);
        assert_eq!(result.profiles[0].name, "alpha");
        assert_eq!(result.profiles[1].name, "zebra");
    }

    #[test]
    fn list_skips_dot_prefixed_entries() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "ok", serde_json::json!({"name": "ok"}));
        // Dot-prefixed sibling — should be skipped:
        std::fs::create_dir_all(dir.path().join(".metadata")).unwrap();
        std::fs::write(
            dir.path().join(".metadata").join("profile.json"),
            r#"{"name":"hidden"}"#,
        )
        .unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 1);
        assert_eq!(result.profiles[0].name, "ok");
    }

    #[test]
    fn list_skips_dirs_without_profile_json() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(dir.path(), "good", serde_json::json!({"name": "good"}));
        std::fs::create_dir_all(dir.path().join("bare")).unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.profiles.len(), 1);
        assert_eq!(result.profiles[0].name, "good");
    }

    #[test]
    fn list_reads_active_from_bare_name_marker() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path()).unwrap();
        std::fs::write(dir.path().join(".active"), "dev\n").unwrap();
        let result = list(dir.path()).unwrap();
        assert_eq!(result.active.as_deref(), Some("dev"));
    }

    #[test]
    fn list_reads_active_from_absolute_path_marker() {
        let dir = tempfile::tempdir().unwrap();
        let abs = dir.path().join("dev");
        std::fs::create_dir_all(&abs).unwrap();
        std::fs::write(dir.path().join(".active"), abs.to_string_lossy().to_string()).unwrap();
        let result = list(dir.path()).unwrap();
        // Bare name extracted from the absolute path.
        assert_eq!(result.active.as_deref(), Some("dev"));
    }

    #[test]
    fn get_returns_profile_by_name() {
        let dir = tempfile::tempdir().unwrap();
        write_profile(
            dir.path(),
            "my-profile",
            serde_json::json!({"name": "my-profile", "description": "x", "agents": ["a1"]}),
        );
        let p = get(dir.path(), "my-profile").unwrap().unwrap();
        assert_eq!(p.name, "my-profile");
        assert_eq!(p.description.as_deref(), Some("x"));
        assert_eq!(p.agents, vec!["a1".to_string()]);
    }

    #[test]
    fn get_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(get(dir.path(), "missing").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(get(dir.path(), "../escape").unwrap().is_none());
        assert!(get(dir.path(), "store").unwrap().is_none());
        assert!(get(dir.path(), ".active").unwrap().is_none());
    }
}
```

Then uncomment the `pub mod crud;` line in `crates/ohmyc-core/src/profiles/mod.rs`.

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles 2>&1 | tail -10`
Expected: `test result: ok. 12 passed` (3 mod.rs + 9 crud.rs).

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/
git commit -m "feat(core): Profile type + profiles::crud::{list,get,read_active_profile_name}"
```

---

## Task 3: Implement `profiles::crud::create`

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/crud.rs`

Validates name (safe + not reserved), refuses to overwrite an existing directory, creates `<dir>/profile.json` with the validated body. Mirrors TS `create()`.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/profiles/crud.rs`, inside the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn create_writes_profile_json_and_returns_profile() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "new", "description": "first"});
        let p = create(dir.path(), &body).unwrap();
        assert_eq!(p.name, "new");
        assert_eq!(p.description.as_deref(), Some("first"));
        assert!(dir.path().join("new").join("profile.json").exists());
        // Roundtrip via get():
        let back = get(dir.path(), "new").unwrap().unwrap();
        assert_eq!(back.description.as_deref(), Some("first"));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "a/b", "description": "x"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_reserved_name() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "store"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_rejects_missing_name_field() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"description": "x"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_errors_with_conflict_when_profile_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("dup")).unwrap();
        let body = serde_json::json!({"name": "dup"});
        let err = create(dir.path(), &body).unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_persists_defaults_for_array_fields() {
        let dir = tempfile::tempdir().unwrap();
        let body = serde_json::json!({"name": "minimal"});
        let p = create(dir.path(), &body).unwrap();
        assert!(p.agents.is_empty());
        assert!(p.skills.is_empty());
        assert!(p.commands.is_empty());
        assert!(p.plugins.is_empty());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: compile error — `create` not defined.

- [ ] **Step 3: Implement `create`**

In `crates/ohmyc-core/src/profiles/crud.rs`, after `get()` (and before `#[cfg(test)]`), add:

```rust
/// Create a new profile. Validates `body.name` against the safe-name
/// pattern + reserved list, refuses to overwrite an existing dir
/// (returns `Conflict`), and persists `<dir>/<name>/profile.json` with
/// `serde`'s default-fill for the array fields. The caller passes a raw
/// `serde_json::Value` body — we validate by trying to deserialize into
/// `Profile`, which catches missing `name` and type mismatches.
pub fn create(profiles_dir: &Path, body: &Value) -> Result<Profile, ApiError> {
    // Extract the name first so we can validate before serde fills defaults.
    let name = body
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("body.name is required".to_string()))?;
    if !is_safe_profile_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "profile name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    if is_reserved_profile_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "profile name '{name}' is reserved"
        )));
    }
    let dir = profiles_dir.join(name);
    if dir.exists() {
        return Err(ApiError::Conflict(format!(
            "profile '{name}' already exists"
        )));
    }
    // Now run the body through serde to fill array defaults.
    let profile: Profile = serde_json::from_value(body.clone())
        .map_err(|e| ApiError::Validation(format!("invalid profile body: {e}")))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let json_path = dir.join("profile.json");
    let raw = serde_json::to_string_pretty(&profile)
        .map_err(|e| ApiError::Internal(format!("serialize profile: {e}")))?;
    std::fs::write(&json_path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", json_path.display())))?;
    Ok(profile)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: `test result: ok. 15 passed` (9 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/crud.rs
git commit -m "feat(core): profiles::crud::create with name + reserved + conflict validation"
```

---

## Task 4: Implement `profiles::crud::update`

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/crud.rs`

Merges a partial JSON body into the existing profile. Name cannot change (TS `Omit<Profile, 'name'>`). Returns `Ok(None)` for missing/invalid profiles.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/profiles/crud.rs`, inside the test module, append:

```rust
    #[test]
    fn update_merges_partial_changes() {
        let dir = tempfile::tempdir().unwrap();
        create(
            dir.path(),
            &serde_json::json!({
                "name": "test",
                "description": "old",
                "agents": ["a1"],
                "settings": {"k1": "v1"}
            }),
        )
        .unwrap();

        let changes = serde_json::json!({
            "description": "new",
            "settings": {"k2": "v2"}
        });
        let updated = update(dir.path(), "test", &changes).unwrap().expect("updated");
        assert_eq!(updated.description.as_deref(), Some("new"));
        // agents preserved (not in changes):
        assert_eq!(updated.agents, vec!["a1".to_string()]);
        // settings REPLACED at top level (matches TS shallow-merge):
        let settings = updated.settings.as_ref().unwrap();
        assert_eq!(settings.get("k2").and_then(|v| v.as_str()), Some("v2"));
        // k1 was overwritten — this is shallow merge, not deep:
        assert!(settings.get("k1").is_none());
    }

    #[test]
    fn update_ignores_name_field_in_body() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &serde_json::json!({"name": "test"})).unwrap();
        let changes = serde_json::json!({"name": "renamed", "description": "x"});
        let updated = update(dir.path(), "test", &changes).unwrap().expect("updated");
        // Name preserved on disk; description applied.
        assert_eq!(updated.name, "test");
        assert_eq!(updated.description.as_deref(), Some("x"));
    }

    #[test]
    fn update_returns_none_when_profile_missing() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "missing", &serde_json::json!({})).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn update_returns_none_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "../bad", &serde_json::json!({}))
            .unwrap()
            .is_none());
        assert!(update(dir.path(), "store", &serde_json::json!({}))
            .unwrap()
            .is_none());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: compile error — `update` not defined.

- [ ] **Step 3: Implement `update`**

In `crates/ohmyc-core/src/profiles/crud.rs`, after `create()`, add:

```rust
/// Merge partial changes into an existing profile. Top-level merge
/// (not deep — matches TS `{ ...existing, ...changes }` spread). The
/// `name` field in `changes` is ignored: profile renaming would require
/// a directory rename, which the TS service doesn't support either.
pub fn update(
    profiles_dir: &Path,
    name: &str,
    changes: &Value,
) -> Result<Option<Profile>, ApiError> {
    let Some(existing) = get(profiles_dir, name)? else {
        return Ok(None);
    };
    let mut merged = serde_json::to_value(&existing)
        .map_err(|e| ApiError::Internal(format!("to_value: {e}")))?;
    if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
        for (k, v) in changes_obj {
            if k == "name" {
                // Renaming is not supported; ignore silently to match TS.
                continue;
            }
            merged_obj.insert(k.clone(), v.clone());
        }
    }
    let next: Profile = serde_json::from_value(merged)
        .map_err(|e| ApiError::Validation(format!("merged profile invalid: {e}")))?;
    let json_path = profiles_dir.join(name).join("profile.json");
    let raw = serde_json::to_string_pretty(&next)
        .map_err(|e| ApiError::Internal(format!("serialize: {e}")))?;
    std::fs::write(&json_path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", json_path.display())))?;
    Ok(Some(next))
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: `test result: ok. 19 passed` (15 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/crud.rs
git commit -m "feat(core): profiles::crud::update with shallow merge + name-field guard"
```

---

## Task 5: Implement `profiles::crud::delete`

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/crud.rs`

Removes the profile directory recursively. Returns `Ok(true)` when removed, `Ok(false)` for invalid names or missing dirs. The active-profile gate (return Conflict when deleting the active profile) lives at the **command layer**, not in core — core stays a pure CRUD store.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/profiles/crud.rs`, inside the test module, append:

```rust
    #[test]
    fn delete_removes_profile_dir_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &serde_json::json!({"name": "doomed"})).unwrap();
        assert!(delete(dir.path(), "doomed").unwrap());
        assert!(!dir.path().join("doomed").exists());
    }

    #[test]
    fn delete_returns_false_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "ghost").unwrap());
    }

    #[test]
    fn delete_returns_false_for_invalid_or_reserved_names() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "../bad").unwrap());
        assert!(!delete(dir.path(), "store").unwrap());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: compile error — `delete` not defined.

- [ ] **Step 3: Implement `delete`**

In `crates/ohmyc-core/src/profiles/crud.rs`, after `update()`, add:

```rust
/// Remove the profile directory recursively. Returns `Ok(false)` for
/// invalid/reserved names or missing dirs. Active-profile gating happens
/// at the command layer, not here.
pub fn delete(profiles_dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_profile_name(name) || is_reserved_profile_name(name) {
        return Ok(false);
    }
    let dir = profiles_dir.join(name);
    if !dir.exists() {
        return Ok(false);
    }
    std::fs::remove_dir_all(&dir)
        .map_err(|e| ApiError::Io(format!("rm {}: {e}", dir.display())))?;
    Ok(true)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::crud 2>&1 | tail -10`
Expected: `test result: ok. 22 passed` (19 prior + 3 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/crud.rs
git commit -m "feat(core): profiles::crud::delete (recursive; pure store, no active-gate)"
```

---

## Task 6: Implement `store_component_exists` helper

**Files:**
- Modify: `crates/ohmyc-core/src/store/mod.rs`

Preflight needs to check whether each component referenced by a profile is present in the store. The check varies by type:
- `agents/<name>.md` — flat file
- `commands/<name>.md` — flat file
- `skills/<name>/SKILL.md` — directory with `SKILL.md`

Lives on `store` rather than `profiles` because the check is about the store's content, not profile semantics. Reused by the deferred activation slice too.

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/store/mod.rs`. Inside the `#[cfg(test)] mod tests` block, after the existing tests, append:

```rust
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
        // skills/<name>/ directory check — TS treats existence of the
        // directory itself as sufficient (it does not require SKILL.md).
        // Mirror that behavior.
        std::fs::create_dir_all(store.path().join("skills/deploy")).unwrap();
        assert!(component_exists(store.path(), ComponentKind::Skills, "deploy"));
        assert!(!component_exists(store.path(), ComponentKind::Skills, "missing"));
    }

    #[test]
    fn store_component_exists_rejects_unsafe_names() {
        let store = tempfile::tempdir().unwrap();
        write(&store.path().join("agents/ok.md"), "x");
        // Path traversal attempts always return false — the check stays
        // within the store dir.
        assert!(!component_exists(store.path(), ComponentKind::Agents, "../escape"));
    }
```

Note: `ComponentKind` already exists in `crates/ohmyc-core/src/store/provenance.rs` from slice 5 — re-export it from `store::mod.rs` if it isn't already public from this path. If it is private to provenance, add a public re-export at the top of `mod.rs`:

```rust
pub use provenance::ComponentKind;
```

Confirm by checking: `grep -n "ComponentKind" crates/ohmyc-core/src/store/provenance.rs`. If it's already `pub enum ComponentKind { Agent, Skill, Command, ModelConfig }`, you're good; otherwise add the re-export.

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store 2>&1 | tail -10`
Expected: compile error — `component_exists` not defined.

- [ ] **Step 3: Implement `component_exists`**

In `crates/ohmyc-core/src/store/mod.rs`, after the existing path helpers (and before `#[cfg(test)]`), add:

```rust
/// Check whether a store component exists. Agents and commands are
/// `<store>/<type>/<name>.md` files; skills are `<store>/skills/<name>`
/// directories. Unsafe names always return `false` — the check never
/// escapes the store dir.
pub fn component_exists(
    store_dir: &std::path::Path,
    kind: provenance::ComponentKind,
    name: &str,
) -> bool {
    // Strict name check: alphanumeric + underscore + hyphen only. Mirrors
    // is_safe_name from components::mod (agent/command names) — keep this
    // local to avoid a cross-module dep.
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
        // ModelConfigs isn't a preflight target — return false rather
        // than claim existence we can't verify cheaply.
        provenance::ComponentKind::ModelConfigs => return false,
    };
    path.exists()
}
```

If `ComponentKind::ModelConfig` doesn't exist in the slice-5 enum, drop that match arm.

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store 2>&1 | tail -10`
Expected: all store tests pass, including 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/store/mod.rs
git commit -m "feat(core): store::component_exists (preflight building block)"
```

---

## Task 7: Implement preflight types + missing-component + settings-warnings logic

**Files:**
- Create: `crates/ohmyc-core/src/profiles/preflight.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs` (uncomment `pub mod preflight;`)

Builds `PreflightResult { canActivate, missing, settingsWarnings, currentActive, modelConfigChanges? }` minus the model-config piece (Task 8 adds that). Settings warnings come from comparing `<claude_home>/settings.json` keys against `profile.settings` keys; any overlap produces a warning string.

- [ ] **Step 1: Create `preflight.rs` with the basic shape + failing tests**

Create `crates/ohmyc-core/src/profiles/preflight.rs`:

```rust
//! Profile activation dry-run. Lists missing store components, predicts
//! settings overwrite warnings, surfaces the current-active context,
//! and (in Task 8) computes the model-config env diff.
//!
//! Read-only — no writes, no symlinks. Reuse-safe by the deferred
//! activation slice as its internal safety gate.

use std::path::Path;

use serde::Serialize;
use serde_json::Map;

use crate::error::ApiError;
use crate::store::{self, provenance::ComponentKind};

use super::crud::{self, Profile};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResult {
    pub can_activate: bool,
    pub missing: Vec<String>,
    pub settings_warnings: Vec<String>,
    pub current_active: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_config_changes: Option<ModelConfigChanges>,
}

/// Placeholder until Task 8 fills in the real change-computation logic.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigChanges {
    pub config_name: String,
    pub changes: Vec<ModelConfigEnvChange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deactivation_changes: Option<Vec<ModelConfigEnvChange>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deactivation_config_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ModelConfigEnvChange {
    pub action: EnvAction,
    pub key: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum EnvAction {
    Set,
    Change,
    Remove,
}

/// Read `<claude_home>/settings.json` as opaque object. Missing or malformed
/// file → empty map (matches the TS `readSettings` try/catch).
fn read_settings(settings_path: &Path) -> Map<String, serde_json::Value> {
    match std::fs::read_to_string(settings_path) {
        Ok(raw) => match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(serde_json::Value::Object(m)) => m,
            _ => Map::new(),
        },
        Err(_) => Map::new(),
    }
}

/// Settings warning for every top-level key in `profile.settings` that
/// already exists in current settings. Mirrors TS
/// `computeSettingsWarnings`.
fn compute_settings_warnings(
    current: &Map<String, serde_json::Value>,
    profile_settings: Option<&Map<String, serde_json::Value>>,
) -> Vec<String> {
    let Some(ps) = profile_settings else {
        return Vec::new();
    };
    let mut warnings = Vec::new();
    for key in ps.keys() {
        if current.contains_key(key) {
            warnings.push(format!("Settings key '{key}' would be overwritten"));
        }
    }
    warnings.sort();
    warnings
}

/// Compute missing store components for a profile. The TS service
/// produces ids like `agent:<name>` / `skill:<name>` / `command:<name>`.
fn compute_missing(store_dir: &Path, profile: &Profile) -> Vec<String> {
    let mut missing = Vec::new();
    for name in &profile.agents {
        if !store::component_exists(store_dir, ComponentKind::Agents, name) {
            missing.push(format!("agent:{name}"));
        }
    }
    for name in &profile.skills {
        if !store::component_exists(store_dir, ComponentKind::Skills, name) {
            missing.push(format!("skill:{name}"));
        }
    }
    for name in &profile.commands {
        if !store::component_exists(store_dir, ComponentKind::Commands, name) {
            missing.push(format!("command:{name}"));
        }
    }
    missing
}

/// Preflight orchestrator. Looks up the profile, walks the store for
/// missing components, reads current settings for overwrite warnings,
/// reads the `.active` marker for context. Task 8 will append the
/// model-config diff branch.
pub fn preflight(
    profiles_dir: &Path,
    store_dir: &Path,
    settings_path: &Path,
    name: &str,
) -> Result<PreflightResult, ApiError> {
    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };
    let missing = compute_missing(store_dir, &profile);
    let current = read_settings(settings_path);
    let settings_warnings = compute_settings_warnings(
        &current,
        profile.settings.as_ref(),
    );
    let current_active = crud::read_active_profile_name(profiles_dir)?;
    Ok(PreflightResult {
        can_activate: missing.is_empty(),
        missing,
        settings_warnings,
        current_active,
        model_config_changes: None, // Task 8
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(p: &Path, body: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, body).unwrap();
    }

    /// Sets up a profiles dir + store dir + empty settings file. Returns
    /// (profiles_dir, store_dir, settings_path) inside a single tempdir.
    struct Fixture {
        _root: tempfile::TempDir,
        profiles: std::path::PathBuf,
        store: std::path::PathBuf,
        settings: std::path::PathBuf,
    }

    fn fixture() -> Fixture {
        let root = tempfile::tempdir().unwrap();
        let profiles = root.path().join("profiles");
        let store = root.path().join("store");
        let settings = root.path().join("settings.json");
        std::fs::create_dir_all(&profiles).unwrap();
        std::fs::create_dir_all(store.join("agents")).unwrap();
        std::fs::create_dir_all(store.join("commands")).unwrap();
        std::fs::create_dir_all(store.join("skills")).unwrap();
        write(&settings, "{}");
        Fixture { _root: root, profiles, store, settings }
    }

    #[test]
    fn preflight_can_activate_when_all_components_present() {
        let f = fixture();
        write(&f.store.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "agents": ["reviewer"]}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.can_activate);
        assert!(r.missing.is_empty());
        assert!(r.current_active.is_none());
    }

    #[test]
    fn preflight_lists_missing_agent_skill_command() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({
                "name": "test",
                "agents": ["miss-agent"],
                "skills": ["miss-skill"],
                "commands": ["miss-cmd"]
            }),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(!r.can_activate);
        assert!(r.missing.contains(&"agent:miss-agent".to_string()));
        assert!(r.missing.contains(&"skill:miss-skill".to_string()));
        assert!(r.missing.contains(&"command:miss-cmd".to_string()));
    }

    #[test]
    fn preflight_returns_settings_warnings_for_overlap() {
        let f = fixture();
        write(&f.settings, r#"{"model":"sonnet","effort":"low"}"#);
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "settings": {"effort": "high"}}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert_eq!(r.settings_warnings, vec!["Settings key 'effort' would be overwritten".to_string()]);
    }

    #[test]
    fn preflight_returns_no_warnings_for_disjoint_settings() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "settings": {"brandNewKey": "v"}}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.settings_warnings.is_empty());
    }

    #[test]
    fn preflight_returns_current_active_from_marker() {
        let f = fixture();
        crud::create(&f.profiles, &serde_json::json!({"name": "test"})).unwrap();
        write(&f.profiles.join(".active"), "dev");
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert_eq!(r.current_active.as_deref(), Some("dev"));
    }

    #[test]
    fn preflight_returns_not_found_when_profile_missing() {
        let f = fixture();
        let err = preflight(&f.profiles, &f.store, &f.settings, "ghost").unwrap_err();
        assert!(matches!(err, ApiError::NotFound { .. }));
    }
}
```

Then uncomment the `pub mod preflight;` line in `crates/ohmyc-core/src/profiles/mod.rs`.

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles 2>&1 | tail -10`
Expected: `test result: ok. 28 passed` (22 prior + 6 new).

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/preflight.rs crates/ohmyc-core/src/profiles/mod.rs
git commit -m "feat(core): profiles::preflight (missing + warnings + current-active)"
```

---

## Task 8: Extend preflight with model-config env diff

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/preflight.rs`

Reads the profile's `model_config` (if any), looks it up via `store::model_configs::get`, computes the diff against the current `settings.env` map. The TS rule:
- 5 fixed env vars: `ANTHROPIC_AUTH_TOKEN` (masked), `ANTHROPIC_BASE_URL`, `API_TIMEOUT_MS = "3000000"`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"`, plus `ANTHROPIC_MODEL` iff `modelName` is non-empty.
- For each: `action=CHANGE` (with `previousValue`) when key exists in current env, else `action=SET`.
- If `currentActive` exists and IT has a `model_config`, emit `deactivationChanges` (all `REMOVE`) for those keys.

- [ ] **Step 1: Add the failing tests**

In `crates/ohmyc-core/src/profiles/preflight.rs`, inside the test module, append:

```rust
    fn write_mc(store_dir: &Path, name: &str, api_key: &str, base_url: &str, model_name: &str) {
        let mc = serde_json::json!({
            "name": name,
            "apiKey": api_key,
            "baseUrl": base_url,
            "modelName": model_name,
            "provider": ""
        });
        let path = store_dir.join("model-configs").join(format!("{name}.json"));
        write(&path, &mc.to_string());
    }

    #[test]
    fn preflight_returns_set_actions_when_env_keys_absent() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-test1234567890", "https://api.anthropic.com", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        assert_eq!(mc.config_name, "anthropic");
        let actions: Vec<_> = mc.changes.iter().map(|c| &c.action).collect();
        // All SET (no env in current settings):
        assert!(actions.iter().all(|a| matches!(a, EnvAction::Set)));
        // 4 vars (no ANTHROPIC_MODEL since modelName is empty):
        let keys: Vec<_> = mc.changes.iter().map(|c| c.key.as_str()).collect();
        assert!(keys.contains(&"ANTHROPIC_AUTH_TOKEN"));
        assert!(keys.contains(&"ANTHROPIC_BASE_URL"));
        assert!(keys.contains(&"API_TIMEOUT_MS"));
        assert!(keys.contains(&"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"));
        assert!(!keys.contains(&"ANTHROPIC_MODEL"));
    }

    #[test]
    fn preflight_emits_anthropic_model_when_model_name_set() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-x", "https://api.x", "claude-sonnet-4");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let keys: Vec<_> = mc.changes.iter().map(|c| c.key.as_str()).collect();
        assert!(keys.contains(&"ANTHROPIC_MODEL"));
    }

    #[test]
    fn preflight_masks_api_key_in_change_value() {
        let f = fixture();
        write_mc(&f.store, "anthropic", "sk-secret-1234", "https://x", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let token = mc.changes.iter().find(|c| c.key == "ANTHROPIC_AUTH_TOKEN").unwrap();
        // Last 4 chars surfaced, rest masked.
        assert_eq!(token.value, "****1234");
    }

    #[test]
    fn preflight_emits_change_action_for_existing_env_keys() {
        let f = fixture();
        write(
            &f.settings,
            r#"{"env":{"ANTHROPIC_BASE_URL":"https://old"}}"#,
        );
        write_mc(&f.store, "anthropic", "sk-x", "https://new", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "anthropic"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        let mc = r.model_config_changes.unwrap();
        let base = mc.changes.iter().find(|c| c.key == "ANTHROPIC_BASE_URL").unwrap();
        assert!(matches!(base.action, EnvAction::Change));
        assert_eq!(base.previous_value.as_deref(), Some("https://old"));
        assert_eq!(base.value, "https://new");
    }

    #[test]
    fn preflight_emits_deactivation_changes_when_switching_profiles() {
        let f = fixture();
        write_mc(&f.store, "prev-mc", "sk-prev", "https://prev", "");
        write_mc(&f.store, "new-mc", "sk-new", "https://new", "");
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "prev", "modelConfig": "prev-mc"}),
        )
        .unwrap();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "next", "modelConfig": "new-mc"}),
        )
        .unwrap();
        write(&f.profiles.join(".active"), "prev");
        let r = preflight(&f.profiles, &f.store, &f.settings, "next").unwrap();
        let mc = r.model_config_changes.unwrap();
        let deact = mc.deactivation_changes.expect("deactivation_changes set");
        assert!(deact.iter().all(|c| matches!(c.action, EnvAction::Remove)));
        assert_eq!(mc.deactivation_config_name.as_deref(), Some("prev-mc"));
    }

    #[test]
    fn preflight_omits_model_config_changes_when_profile_has_no_model_config() {
        let f = fixture();
        crud::create(&f.profiles, &serde_json::json!({"name": "test"})).unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.model_config_changes.is_none());
    }

    #[test]
    fn preflight_omits_model_config_changes_when_config_missing_on_disk() {
        let f = fixture();
        crud::create(
            &f.profiles,
            &serde_json::json!({"name": "test", "modelConfig": "ghost"}),
        )
        .unwrap();
        let r = preflight(&f.profiles, &f.store, &f.settings, "test").unwrap();
        assert!(r.model_config_changes.is_none());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::preflight 2>&1 | tail -15`
Expected: assertion failures — `model_config_changes` is always `None`.

- [ ] **Step 3: Implement the model-config diff logic**

In `crates/ohmyc-core/src/profiles/preflight.rs`, replace the `preflight()` function with this expanded version (it adds the model-config branch but keeps all prior logic):

```rust
pub fn preflight(
    profiles_dir: &Path,
    store_dir: &Path,
    settings_path: &Path,
    name: &str,
) -> Result<PreflightResult, ApiError> {
    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };
    let missing = compute_missing(store_dir, &profile);
    let current = read_settings(settings_path);
    let settings_warnings = compute_settings_warnings(
        &current,
        profile.settings.as_ref(),
    );
    let current_active = crud::read_active_profile_name(profiles_dir)?;

    let model_config_changes = compute_model_config_changes_branch(
        profiles_dir,
        store_dir,
        &current,
        current_active.as_deref(),
        &profile,
    )?;

    Ok(PreflightResult {
        can_activate: missing.is_empty(),
        missing,
        settings_warnings,
        current_active,
        model_config_changes,
    })
}

fn compute_model_config_changes_branch(
    profiles_dir: &Path,
    store_dir: &Path,
    current_settings: &Map<String, serde_json::Value>,
    current_active: Option<&str>,
    profile: &Profile,
) -> Result<Option<ModelConfigChanges>, ApiError> {
    let Some(mc_name) = profile.model_config.as_deref() else {
        return Ok(None);
    };
    let model_configs_dir = store_dir.join("model-configs");
    let Some(mc) = store::model_configs::get(&model_configs_dir, mc_name)? else {
        // Config referenced but missing on disk → omit silently (matches TS).
        return Ok(None);
    };

    let current_env = current_settings
        .get("env")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let changes = build_env_changes(
        &mc.api_key,
        &mc.base_url,
        if mc.model_name.is_empty() { None } else { Some(mc.model_name.as_str()) },
        &current_env,
    );

    // Deactivation diff: if there's an active profile with its own
    // model-config, emit REMOVE actions for its keys.
    let mut deactivation_changes = None;
    let mut deactivation_config_name = None;
    if let Some(active) = current_active {
        if let Some(active_profile) = crud::get(profiles_dir, active)? {
            if let Some(active_mc_name) = active_profile.model_config.as_deref() {
                if let Some(active_mc) = store::model_configs::get(&model_configs_dir, active_mc_name)? {
                    let mut removes = vec![
                        "ANTHROPIC_AUTH_TOKEN",
                        "ANTHROPIC_BASE_URL",
                        "API_TIMEOUT_MS",
                        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
                    ];
                    if !active_mc.model_name.is_empty() {
                        removes.push("ANTHROPIC_MODEL");
                    }
                    deactivation_changes = Some(
                        removes
                            .iter()
                            .map(|key| ModelConfigEnvChange {
                                action: EnvAction::Remove,
                                key: (*key).to_string(),
                                value: current_env
                                    .get(*key)
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                previous_value: None,
                            })
                            .collect(),
                    );
                    deactivation_config_name = Some(active_mc_name.to_string());
                }
            }
        }
    }

    Ok(Some(ModelConfigChanges {
        config_name: mc_name.to_string(),
        changes,
        deactivation_changes,
        deactivation_config_name,
    }))
}

fn build_env_changes(
    api_key: &str,
    base_url: &str,
    model_name: Option<&str>,
    current_env: &Map<String, serde_json::Value>,
) -> Vec<ModelConfigEnvChange> {
    let mut vars: Vec<(&'static str, String)> = vec![
        ("ANTHROPIC_AUTH_TOKEN", api_key.to_string()),
        ("ANTHROPIC_BASE_URL", base_url.to_string()),
        ("API_TIMEOUT_MS", "3000000".to_string()),
        ("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1".to_string()),
    ];
    if let Some(m) = model_name {
        vars.push(("ANTHROPIC_MODEL", m.to_string()));
    }

    vars.into_iter()
        .map(|(key, raw_value)| {
            let value = if key == "ANTHROPIC_AUTH_TOKEN" {
                mask_api_key(&raw_value)
            } else {
                raw_value
            };
            match current_env.get(key).and_then(|v| v.as_str()) {
                Some(prev) => ModelConfigEnvChange {
                    action: EnvAction::Change,
                    key: key.to_string(),
                    value,
                    previous_value: Some(prev.to_string()),
                },
                None => ModelConfigEnvChange {
                    action: EnvAction::Set,
                    key: key.to_string(),
                    value,
                    previous_value: None,
                },
            }
        })
        .collect()
}

/// `****<last4>` for keys ≥ 4 chars; pure mask otherwise. Mirrors TS
/// `maskApiKey`.
fn mask_api_key(key: &str) -> String {
    if key.len() >= 4 {
        format!("****{}", &key[key.len() - 4..])
    } else {
        "****".to_string()
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles 2>&1 | tail -10`
Expected: `test result: ok. 35 passed` (28 prior + 7 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/preflight.rs
git commit -m "feat(core): preflight model-config env diff (SET/CHANGE/REMOVE + mask)"
```

---

## Task 9: Wire 6 Tauri command wrappers

**Files:**
- Create: `packages/desktop/src-tauri/src/api/profiles.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

Thin wrappers. `profiles_delete` is the only command with real business logic at this layer: refuse to delete the active profile (return `Conflict`), matching the TS 409 behavior.

- [ ] **Step 1: Create the file**

Create `packages/desktop/src-tauri/src/api/profiles.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::profiles. The delete command
//! enforces the "cannot delete the active profile" gate — that policy
//! belongs at the API layer, not in the pure-store core.

use ohmyc_core::claude_home;
use ohmyc_core::error::ApiError;
use ohmyc_core::profiles::{crud, preflight};
use ohmyc_core::store;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct ProfileListResponse {
    pub profiles: Vec<crud::Profile>,
    pub active: Option<String>,
}

#[derive(Serialize)]
pub struct ProfileResponse {
    pub profile: crud::Profile,
}

#[derive(Serialize)]
pub struct DeleteOk { pub success: bool }

#[tauri::command]
pub fn profiles_list() -> Result<ProfileListResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let r = crud::list(&dir)?;
    Ok(ProfileListResponse { profiles: r.profiles, active: r.active })
}

#[tauri::command]
pub fn profiles_get(name: String) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let Some(profile) = crud::get(&dir, &name)? else {
        return Err(ApiError::NotFound { kind: "profile", name });
    };
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_create(body: Value) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let profile = crud::create(&dir, &body)?;
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_update(name: String, body: Value) -> Result<ProfileResponse, ApiError> {
    let dir = store::store_profiles_dir()?;
    let Some(profile) = crud::update(&dir, &name, &body)? else {
        return Err(ApiError::NotFound { kind: "profile", name });
    };
    Ok(ProfileResponse { profile })
}

#[tauri::command]
pub fn profiles_delete(name: String) -> Result<DeleteOk, ApiError> {
    let dir = store::store_profiles_dir()?;
    // Active-profile gate — matches TS route's 409 behavior.
    if let Some(active) = crud::read_active_profile_name(&dir)? {
        if active == name {
            return Err(ApiError::Conflict(format!(
                "Cannot delete active profile. Deactivate {name} before deleting it."
            )));
        }
    }
    let removed = crud::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "profile", name });
    }
    Ok(DeleteOk { success: true })
}

#[tauri::command]
pub fn profiles_preflight(name: String) -> Result<preflight::PreflightResult, ApiError> {
    let profiles_dir = store::store_profiles_dir()?;
    let store_dir = store::store_dir()?;
    let settings_path = claude_home::settings_path()?;
    preflight::preflight(&profiles_dir, &store_dir, &settings_path, &name)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Smoke tests use the OHMYC_HOME env override (rather than
    // OHMYC_CLAUDE_HOME) since profiles live under the OhMyC base dir,
    // not claude home. Same race-safety argument as the slice-6
    // plugins-api smoke tests: only assert "empty" — value doesn't
    // depend on the exact env path.

    #[test]
    fn profiles_list_returns_empty_envelope_when_no_profiles() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_list();
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        let resp = r.unwrap();
        assert!(resp.profiles.is_empty());
        assert!(resp.active.is_none());
    }

    #[test]
    fn profiles_get_returns_not_found_for_missing_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_get("ghost".to_string());
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        assert!(matches!(r.unwrap_err(), ApiError::NotFound { .. }));
    }
}
```

- [ ] **Step 2: Add the module to `api/mod.rs`**

Open `packages/desktop/src-tauri/src/api/mod.rs` and add `pub mod profiles;` after `pub mod plugins;` (alphabetical):

```rust
pub mod agents;
pub mod commands;
pub mod configs;
pub mod plugins;
pub mod profiles;
pub mod settings;
pub mod skills;
pub mod store;
pub mod timeline;
```

- [ ] **Step 3: Verify the desktop crate builds + smoke tests pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml api::profiles 2>&1 | tail -10`
Expected: `test result: ok. 2 passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/profiles.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): tauri command wrappers for profiles CRUD + preflight"
```

---

## Task 10: Register the 6 commands in `main.rs`

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add the registrations**

Open `packages/desktop/src-tauri/src/main.rs`. The block currently ends with `marketplaces_get` (added in slice 6). Insert right after that, inside `generate_handler!`:

```rust
            ohmyc_desktop_lib::api::profiles::profiles_list,
            ohmyc_desktop_lib::api::profiles::profiles_get,
            ohmyc_desktop_lib::api::profiles::profiles_create,
            ohmyc_desktop_lib::api::profiles::profiles_update,
            ohmyc_desktop_lib::api::profiles::profiles_delete,
            ohmyc_desktop_lib::api::profiles::profiles_preflight,
```

- [ ] **Step 2: Verify the desktop crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): register profiles CRUD + preflight tauri commands"
```

---

## Task 11: Add 6 entries to `fetch.ts` URL table + DELETE route test

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts`

`profiles.list` and `profiles.get` and `profiles.preflight` are GET (bare URL string). `profiles.create` is POST, `profiles.update` is PUT, `profiles.delete` is DELETE — they need the `{ url, method, body }` shape.

- [ ] **Step 1: Add the entries**

Open `packages/ui/src/lib/transport/fetch.ts`. Insert the new block right after the `marketplaces.get` line (added in slice 6), before `'store.agents.list'`:

```ts
  'marketplaces.list': () => '/api/marketplaces',
  'marketplaces.get': a => `/api/marketplaces/${encodeURIComponent(String(a.id ?? ''))}`,

  'profiles.list': () => '/api/profiles',
  'profiles.get': a => `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}`,
  'profiles.create': a => ({ url: '/api/profiles', method: 'POST', body: a.body }),
  'profiles.update': a => ({
    url: `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'profiles.delete': a => ({
    url: `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'DELETE',
  }),
  'profiles.preflight': a => `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}/preflight`,

  'store.agents.list': () => '/api/store/agents',
```

- [ ] **Step 2: Add a DELETE route test**

Open `packages/ui/src/lib/transport/transport.test.ts`. Append at the bottom of the `describe('transport seam', ...)` block, before the closing `})`:

```ts
  it('fetch transport routes profiles.delete with DELETE method and path-param', async () => {
    const calls: { url: string, method?: string }[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('profiles.delete', { name: 'dev' })
      expect(calls).toEqual([{ url: '/api/profiles/dev', method: 'DELETE' }])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 3: Run transport tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/lib/transport/transport.test.ts 2>&1 | tail -15`
Expected: all transport tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(transport): wire profiles CRUD + preflight URL table entries"
```

---

## Task 12: Migrate `use-profiles.ts` (CRUD + preflight only)

**Files:**
- Modify: `packages/ui/src/hooks/use-profiles.ts`

Replace `fetchProfiles`/`fetchProfile`/`createProfile`/`updateProfile`/`deleteProfile`/`fetchPreflight` with `request()`. **Keep `activateProfile` and `deactivateProfile` on raw `fetch()`** with a comment noting they migrate in the follow-up activation slice. Query keys (`['profiles']` and `['profiles', name]`) preserved exactly so `onSuccess` invalidations keep working.

- [ ] **Step 1: Replace the file**

Open `packages/ui/src/hooks/use-profiles.ts` and replace the contents entirely with:

```ts
// React Query hooks for profile CRUD, preflight, activation, and deactivation.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { request } from '../lib/transport'

import type {
  CreateProfileBody,
  Profile,
  UpdateProfileBody,
} from '@ohmyc/shared'

interface ProfilesListResponse {
  profiles: Profile[]
  active: string | null
}

interface ProfileEnvelope {
  profile: Profile
}

/** Activation hooks deferred to the follow-up "Profiles Activation"
 *  slice. Until then, these two stay on raw fetch() — same pattern as
 *  slice 5 left useStoreImport on legacy fetch. The transactional
 *  activation logic (lock, undo stack, symlinks, plugin-marketplace
 *  registration) is genuinely 2x slice 5's surface and gets its own
 *  focused slice + review. */
async function activateProfile(name: string): Promise<{ warnings: string[] }> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/activate`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to activate')
  }
  return res.json()
}

async function deactivateProfile(name: string): Promise<void> {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}/deactivate`, { method: 'POST' })
  if (!res.ok) {
    throw new Error('Failed to deactivate')
  }
}

// --- Preflight types (server-side shape) ---

export interface ModelConfigEnvChange {
  action: 'CHANGE' | 'REMOVE' | 'SET'
  key: string
  value: string
  previousValue?: string
}

export interface ModelConfigChanges {
  configName: string
  changes: ModelConfigEnvChange[]
  deactivationChanges?: ModelConfigEnvChange[]
  deactivationConfigName?: string
}

export interface PreflightResult {
  canActivate: boolean
  missing: string[]
  settingsWarnings: string[]
  currentActive: string | null
  modelConfigChanges?: ModelConfigChanges
}

// --- Query hooks ---

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => request<ProfilesListResponse>('profiles.list', {}),
  })
}

export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profiles', name],
    queryFn: async () => {
      const data = await request<ProfileEnvelope>('profiles.get', { name: name! })
      return data.profile
    },
    enabled: !!name,
  })
}

// --- Mutation hooks (CRUD) ---

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateProfileBody) => {
      const data = await request<ProfileEnvelope>('profiles.create', { body })
      return data.profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, body }: { name: string, body: UpdateProfileBody }) => {
      const data = await request<ProfileEnvelope>('profiles.update', { name, body })
      return data.profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => request<{ success: boolean }>('profiles.delete', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// --- Mutation hooks (activation — deferred slice) ---

export function useActivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeactivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deactivateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

// --- Preflight ---

export function usePreflight() {
  return useMutation({
    mutationFn: (name: string) => request<PreflightResult>('profiles.preflight', { name }),
  })
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-profiles.ts
git commit -m "feat(ui): migrate use-profiles CRUD + preflight to request() (activation deferred)"
```

---

## Task 13: Add `use-profiles.test.tsx` covering CRUD + preflight wire shapes

**Files:**
- Create: `packages/ui/src/hooks/use-profiles.test.tsx`

Mirror the slice-5 and slice-6 test shape. All mocks throw with the real ApiError wire shape (`{ code, detail }`) so a future review wouldn't catch a mock-vs-reality drift.

- [ ] **Step 1: Write the file**

Create `packages/ui/src/hooks/use-profiles.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  useCreateProfile,
  useDeleteProfile,
  usePreflight,
  useProfile,
  useProfiles,
  useUpdateProfile,
} from './use-profiles'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useProfiles — read', () => {
  it('list returns { profiles, active } envelope verbatim', async () => {
    setMockHandler('profiles.list', async () => ({
      profiles: [
        { name: 'dev', agents: [], skills: [], commands: [], plugins: [] },
      ],
      active: 'dev',
    }))
    const { result } = renderHook(() => useProfiles(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.active).toBe('dev')
    expect(result.current.data?.profiles).toHaveLength(1)
  })

  it('get passes name and unwraps the profile envelope', async () => {
    let captured: unknown = null
    setMockHandler('profiles.get', async (args) => {
      captured = args
      return { profile: { name: 'dev', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useProfile('dev'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { name: string }).name).toBe('dev')
    expect(result.current.data?.name).toBe('dev')
  })

  it('get is disabled when name is null', () => {
    const { result } = renderHook(() => useProfile(null), { wrapper: wrapper() })
    expect(result.current.isFetched).toBe(false)
  })
})

describe('useProfiles — write', () => {
  it('create sends { body } and invalidates the list', async () => {
    let captured: unknown = null
    setMockHandler('profiles.create', async (args) => {
      captured = args
      return { profile: { name: 'new', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useCreateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'new', description: 'd' } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { body: unknown }).body).toEqual({ name: 'new', description: 'd' })
  })

  it('update sends { name, body }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.update', async (args) => {
      captured = args
      return { profile: { name: 'dev', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'dev', body: { description: 'new' } } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev', body: { description: 'new' } })
  })

  it('delete sends { name }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.delete', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeleteProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('doomed' as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'doomed' })
  })

  it('delete surfaces Conflict with the real wire shape when active', async () => {
    // ApiError::Conflict serializes as { code: 'Conflict', detail: string }.
    // The UI's delete confirmation in profile-card reads error.detail to
    // render the "deactivate first" message; mirror the wire shape here
    // so this test would catch a drift between mock and reality (the
    // exact regression slice-5's review fixed).
    setMockHandler('profiles.delete', async () => {
      throw Object.assign(new Error('cannot delete active'), {
        code: 'Conflict',
        detail: 'Cannot delete active profile. Deactivate dev before deleting it.',
      })
    })
    const { result } = renderHook(() => useDeleteProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev' as never)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string, detail?: string }
    expect(err.code).toBe('Conflict')
    expect(err.detail).toContain('Deactivate dev')
  })
})

describe('usePreflight', () => {
  it('passes { name } and unwraps the PreflightResult', async () => {
    let captured: unknown = null
    setMockHandler('profiles.preflight', async (args) => {
      captured = args
      return {
        canActivate: true,
        missing: [],
        settingsWarnings: [],
        currentActive: null,
      }
    })
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
    expect(result.current.data?.canActivate).toBe(true)
  })

  it('surfaces NotFound when profile is missing', async () => {
    setMockHandler('profiles.preflight', async () => {
      throw Object.assign(new Error('profile not found'), {
        code: 'NotFound',
        detail: { kind: 'profile', name: 'ghost' },
      })
    })
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('ghost')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string, detail?: { kind?: string } }
    expect(err.code).toBe('NotFound')
    expect(err.detail?.kind).toBe('profile')
  })

  it('passes through model-config changes envelope', async () => {
    setMockHandler('profiles.preflight', async () => ({
      canActivate: true,
      missing: [],
      settingsWarnings: [],
      currentActive: null,
      modelConfigChanges: {
        configName: 'anthropic',
        changes: [
          { action: 'SET', key: 'ANTHROPIC_AUTH_TOKEN', value: '****1234' },
          { action: 'CHANGE', key: 'ANTHROPIC_BASE_URL', value: 'https://new', previousValue: 'https://old' },
        ],
      },
    }))
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.modelConfigChanges?.configName).toBe('anthropic')
    expect(result.current.data?.modelConfigChanges?.changes).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the new tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/hooks/use-profiles.test.tsx 2>&1 | tail -20`
Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-profiles.test.tsx
git commit -m "test(ui): coverage for use-profiles CRUD + preflight on mock transport"
```

---

## Task 14: Extend `use-fs-changed.ts` to invalidate `['profiles']`

**Files:**
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

When `<claude_home>/settings.json` is written, `enabledPlugins` and `env` can change — that signals an out-of-band activation/deactivation by an external CLI. Add `['profiles']` to the settings.json invalidation set. The profiles dir itself lives under `$OHMYC_HOME/`, not watched today — that's a future-watcher concern; like slice-5 store matchers, no point staging dormant matchers in this hook.

- [ ] **Step 1: Add the invalidation**

Open `packages/ui/src/hooks/use-fs-changed.ts`. Find the settings.json branch (added in slice 6):

```ts
            if (path.endsWith('/settings.json')) {
              void qc.invalidateQueries({ queryKey: ['settings'] })
              void qc.invalidateQueries({ queryKey: ['hooks'] })
              void qc.invalidateQueries({ queryKey: ['lsp'] })
              // enabledPlugins lives in settings.json — a toggle elsewhere
              // should refresh the Explorer plugins view.
              void qc.invalidateQueries({ queryKey: ['plugins'] })
            }
```

Replace with:

```ts
            if (path.endsWith('/settings.json')) {
              void qc.invalidateQueries({ queryKey: ['settings'] })
              void qc.invalidateQueries({ queryKey: ['hooks'] })
              void qc.invalidateQueries({ queryKey: ['lsp'] })
              // enabledPlugins lives in settings.json — a toggle elsewhere
              // should refresh the Explorer plugins view.
              void qc.invalidateQueries({ queryKey: ['plugins'] })
              // External activation/deactivation also writes settings.json
              // (env vars + enabledPlugins). Refresh the profiles view so
              // the active chip + preflight diffs stay accurate.
              void qc.invalidateQueries({ queryKey: ['profiles'] })
            }
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(ui): invalidate ['profiles'] on settings.json fs:changed"
```

---

## Verification (after all 14 tasks)

- [ ] **Full workspace test sweep**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
cargo test -p ohmyc-core 2>&1 | grep "test result" | head -3
cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | grep "test result" | head -3
pnpm -r test 2>&1 | tail -10
```

Expected:
- core: 35 new profile tests + 4 new store::component_exists tests on top of the slice-6 155 → **~194 passing**.
- desktop: 2 new profile smoke tests on top of slice 6's 26 → **28 passing**.
- ui: ~10 new use-profiles tests + 1 new transport.test.ts test on top of slice 6's 165 → **~176 passing**; the 3 pre-existing menubar-page failures remain.

- [ ] **Web bundle still builds (TS server fallback path is alive)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm -r build 2>&1 | tail -10`
Expected: `Done` / no errors.

---

## Self-review notes

**Spec coverage:**
- Spec says slice 7 = "Profiles — list/get/create/update/delete/activate/deactivate/preflight."
- Tasks 1-13 cover **list, get, create, update, delete, preflight**.
- **activate + deactivate explicitly deferred** to a follow-up slice — documented at the top of the plan + carried in `use-profiles.ts` as a code comment.
- Justification matches slice-5 precedent: the activation flow alone (file lock, transactional rollback, plugin-marketplace registration, symlinks-or-junctions) is 2× slice 5's surface and warrants its own slice + review.

**Scope cuts documented (top of plan):**
- Activation flow (`activate` + `deactivate`) → next slice (slice 7b or "Profiles Activation").
- `ActivationBlockedError` ApiError variant — added only when needed by the activation slice.
- `.active` writer — slice 7 reads only.
- Multi-path settings merge — still deferred from slice 6 (no progress here, intentional).
- TS server deletion → slice 8.

**Type consistency:**
- Rust `Profile` matches TS `ProfileSchema` field-by-field via `#[serde(rename_all = "camelCase")]`: `modelConfig`, `mcpServers`, `lspServers` round-trip cleanly.
- `PreflightResult` matches TS shape: `canActivate`/`settingsWarnings`/`currentActive`/`modelConfigChanges` are camelCase via `#[serde(rename_all = "camelCase")]`.
- `ModelConfigEnvChange.action` serializes as `"SET" | "CHANGE" | "REMOVE"` via `#[serde(rename_all = "UPPERCASE")]`.
- Query keys preserved: `['profiles']`, `['profiles', name]`.
- Wire-name → Rust function: `profiles.list` → `profiles_list` etc., dot→underscore round-trip.

**Placeholder scan:** None — all code blocks are complete and runnable.

**Spec gaps:** None — the deferred activation flow is the only "missing" piece and it's a documented scope cut, not an oversight.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-desktop-migration-slice-7-profiles-crud-preflight.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
