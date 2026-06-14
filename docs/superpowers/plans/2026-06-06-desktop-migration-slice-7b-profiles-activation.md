# Desktop Migration — Slice 7b: Profiles Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the final two `use-profiles.ts` hooks (`useActivateProfile`, `useDeactivateProfile`) onto native Rust Tauri commands. Ports the entire transactional activation flow — file-based lock, symlinks, settings backup + deep merge, model-config env injection, plugin-marketplace registration, undo-stack rollback, and auto-restore-previous on failure.

**Architecture:** New `ohmyc-core::profiles::activation` module composes 4 internal building blocks (`lock`, `symlink`, `marketplace`, settings merge). Activation is one transactional state machine: acquire lock → preflight gate → deactivate previous → backup → write `.active` early (crash recovery) → create symlinks for agents/skills/commands → write plugin files (.claude-plugin, hooks, .mcp.json, .lsp.json) → deep-merge settings + inject model-config env vars + set enabledPlugins → write marketplace.json + register in installed_plugins.json + known_marketplaces.json. Every write pushes an `UndoAction` onto a stack; failure rewinds the stack in reverse and (if switching from another profile) auto-restores the previous one. Deactivation is the inverse: restore backup, remove symlinks, remove generated files, unregister plugin, remove `.active`. **Unix-only for slice 7b** (`std::os::unix::fs::symlink`); Windows symlink/junction support is a separate followup — symbolic-link creation on Windows needs admin or Dev Mode, so we explicitly bail with a typed error rather than silently degrade.

**Tech Stack:** Rust adds the `fs2` crate (BSD-licensed, well-maintained file-locking) for cross-process activation mutex. TypeScript reuses the existing transport seam + React Query infrastructure.

---

## Scope cut

In scope:
- `useActivateProfile` + `useDeactivateProfile` migrated end-to-end.
- File-based activation lock (cross-process safe via `fs2::FileExt::try_lock_exclusive`).
- Transactional rollback via typed undo stack.
- Auto-restore-previous on non-blocked failure (matches TS recursion).
- Per-profile settings backup naming (`settings.backup.<name>.json`).
- Symlinks for agents (file), commands (file), skills (directory).
- Plugin files generation (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`).
- Deep-merge settings + model-config env injection + enabledPlugins set.
- Synthetic `ohmyc-profiles` marketplace + `profile-<name>@ohmyc-profiles` plugin registration in `<claude_home>/plugins/{installed_plugins,known_marketplaces}.json`.
- `ActivationBlockedError` ApiError variant — surfaces missing components list to UI.

Out of scope:
- **Windows symlink/junction support** — `#[cfg(not(unix))]` returns `ApiError::Internal("symlinks not supported on this platform yet")`. Tracked for a follow-up Windows-portability slice.
- **TS server deletion** — slice 8.
- **fs:changed watcher broadening for `$OHMYC_HOME/profiles/`** — slice 8 watcher work. External-process activations still get caught via settings.json invalidation (slice 7 already wired `['profiles']` invalidation on settings.json writes).

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/profiles/lock.rs` — `LockGuard` RAII handle around `fs2` file lock; `try_acquire(profiles_dir) -> Result<LockGuard, ApiError>`.
- `crates/ohmyc-core/src/profiles/symlink.rs` — `create_file_symlink(source, dest)`, `create_dir_symlink(source, dest)` with `#[cfg(unix)]` gate.
- `crates/ohmyc-core/src/profiles/marketplace.rs` — synthetic `ohmyc-profiles` marketplace writers: `write_marketplace_json(base_dir, profiles)`, `register_profile_plugin(plugins_dir, name, install_path)`, `unregister_profile_plugin(plugins_dir, name)`, `register_known_marketplace(plugins_dir, base_dir) -> Snapshot`, `read_installed_plugins(plugins_dir) -> Value`, `write_installed_plugins(plugins_dir, Value)`, `read_known_marketplaces(plugins_dir) -> Value`, `write_known_marketplaces(plugins_dir, Value)`.
- `crates/ohmyc-core/src/profiles/activation.rs` — `activate(...)`, `deactivate(...)`, internal `deactivate_internal(...)`, `UndoAction` enum, deep-merge helpers, env-var injection.

**Modified files:**
- `crates/ohmyc-core/Cargo.toml` — add `fs2 = "0.4"` to `[dependencies]`.
- `crates/ohmyc-core/src/error.rs` — add `ApiError::ActivationBlocked { missing: Vec<String> }` variant.
- `crates/ohmyc-core/src/profiles/mod.rs` — `pub mod activation; pub mod lock; pub mod marketplace; pub mod symlink;`.
- `packages/desktop/src-tauri/src/api/profiles.rs` — add `profiles_activate` + `profiles_deactivate` Tauri commands.
- `packages/desktop/src-tauri/src/main.rs` — register the 2 new commands.
- `packages/ui/src/lib/transport/fetch.ts` — 2 new wire entries (POST + body).
- `packages/ui/src/lib/transport/transport.test.ts` — 1 new test asserting POST + body shape.
- `packages/ui/src/hooks/use-profiles.ts` — replace `activateProfile`/`deactivateProfile` raw fetches with `request()`; drop the deferred-comment block.
- `packages/ui/src/hooks/use-profiles.test.tsx` — extend with activate/deactivate coverage (success + `ActivationBlocked` wire shape).

---

## Wire-name convention

| JS wire | Rust function | Method | Body |
|---|---|---|---|
| `profiles.activate` | `profiles_activate` | POST | `{ name }` |
| `profiles.deactivate` | `profiles_deactivate` | POST | `{ name }` (name accepted but ignored on Rust side — matches TS route shape) |

---

## Task 1: Add `fs2` dep + `ActivationBlockedError` ApiError variant

**Files:**
- Modify: `crates/ohmyc-core/Cargo.toml`
- Modify: `crates/ohmyc-core/src/error.rs`

- [ ] **Step 1: Add `fs2` to core deps**

Open `crates/ohmyc-core/Cargo.toml`. After the `serde_yaml = "0.9"` line, add:

```toml
fs2 = "0.4"
```

- [ ] **Step 2: Add the failing test for the new ApiError variant**

Open `crates/ohmyc-core/src/error.rs`. In the `#[cfg(test)] mod tests` block, after `referenced_by_serializes_with_structured_detail`, append:

```rust
    #[test]
    fn activation_blocked_serializes_with_missing_array() {
        let err = ApiError::ActivationBlocked {
            missing: vec!["agent:reviewer".to_string(), "skill:deploy".to_string()],
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "ActivationBlocked");
        assert_eq!(json["detail"]["missing"], serde_json::json!(["agent:reviewer", "skill:deploy"]));
    }
```

- [ ] **Step 3: Run to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib error 2>&1 | tail -10`
Expected: compile error — `ActivationBlocked` variant not defined.

- [ ] **Step 4: Add the variant**

In `crates/ohmyc-core/src/error.rs`, add after the `ReferencedBy` variant:

```rust
    /// Profile activation refused because the profile references store
    /// components that are missing. Serializes as
    /// `{ code: "ActivationBlocked", detail: { missing: [...] } }` so
    /// the UI can render the missing-list in the activation dialog.
    #[error("activation blocked: {} missing component(s)", missing.len())]
    ActivationBlocked {
        missing: Vec<String>,
    },
```

- [ ] **Step 5: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib error 2>&1 | tail -10`
Expected: `test result: ok. 6 passed` (5 existing + 1 new).

- [ ] **Step 6: Commit**

```bash
git add crates/ohmyc-core/Cargo.toml crates/ohmyc-core/src/error.rs
git commit -m "feat(core): ApiError::ActivationBlocked + fs2 dep for activation lock"
```

---

## Task 2: Lock module — `profiles::lock::LockGuard`

**Files:**
- Create: `crates/ohmyc-core/src/profiles/lock.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs`

RAII guard around `fs2::FileExt::try_lock_exclusive`. Dropping the guard auto-releases the lock. The lock file is `<profiles_dir>/.activation.lock`.

- [ ] **Step 1: Create `lock.rs` with failing tests**

Create `crates/ohmyc-core/src/profiles/lock.rs`:

```rust
//! Cross-process file-lock for profile activation. Mirrors the TS
//! `LockService` (proper-lockfile), but uses `fs2::FileExt` for
//! POSIX `flock` semantics. The guard releases on drop.

use std::fs::{File, OpenOptions};
use std::path::Path;

use fs2::FileExt;

use crate::error::ApiError;

const LOCK_FILENAME: &str = ".activation.lock";

/// RAII handle that holds an exclusive advisory lock on the activation
/// lock file. Released when the guard is dropped (or explicitly via
/// `release()`). Drop is best-effort — fs2 will release on process
/// exit even if we panic before drop runs.
pub struct LockGuard {
    file: Option<File>,
}

impl LockGuard {
    /// Attempt to acquire the activation lock non-blockingly. Returns
    /// `ApiError::Conflict("Another activation is in progress...")` if
    /// another process or thread already holds it.
    pub fn try_acquire(profiles_dir: &Path) -> Result<Self, ApiError> {
        std::fs::create_dir_all(profiles_dir)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", profiles_dir.display())))?;
        let lock_path = profiles_dir.join(LOCK_FILENAME);
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .read(true)
            .open(&lock_path)
            .map_err(|e| ApiError::Io(format!("open lock {}: {e}", lock_path.display())))?;
        match file.try_lock_exclusive() {
            Ok(()) => Ok(Self { file: Some(file) }),
            Err(_) => Err(ApiError::Conflict(
                "Another activation is in progress. Wait a moment and try again.".to_string(),
            )),
        }
    }

    /// Explicit release. Drop also releases, but calling this surfaces
    /// any unlock errors (which Drop silently swallows).
    pub fn release(mut self) -> Result<(), ApiError> {
        if let Some(file) = self.file.take() {
            FileExt::unlock(&file)
                .map_err(|e| ApiError::Io(format!("unlock: {e}")))?;
        }
        Ok(())
    }
}

impl Drop for LockGuard {
    fn drop(&mut self) {
        if let Some(file) = self.file.take() {
            let _ = FileExt::unlock(&file);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_creates_lock_file_and_holds_until_drop() {
        let dir = tempfile::tempdir().unwrap();
        let guard = LockGuard::try_acquire(dir.path()).unwrap();
        assert!(dir.path().join(LOCK_FILENAME).exists());
        drop(guard);
        // Lock file persists after drop (only the lock itself releases);
        // re-acquiring should succeed.
        let g2 = LockGuard::try_acquire(dir.path()).unwrap();
        drop(g2);
    }

    #[test]
    fn second_acquire_returns_conflict_when_first_still_held() {
        let dir = tempfile::tempdir().unwrap();
        let _g1 = LockGuard::try_acquire(dir.path()).unwrap();
        let err = LockGuard::try_acquire(dir.path()).unwrap_err();
        match err {
            ApiError::Conflict(msg) => {
                assert!(msg.contains("Another activation is in progress"));
            }
            other => panic!("expected Conflict, got {other:?}"),
        }
    }

    #[test]
    fn explicit_release_succeeds_and_allows_reacquire() {
        let dir = tempfile::tempdir().unwrap();
        let g1 = LockGuard::try_acquire(dir.path()).unwrap();
        g1.release().unwrap();
        let _g2 = LockGuard::try_acquire(dir.path()).unwrap();
    }
}
```

Then open `crates/ohmyc-core/src/profiles/mod.rs` and add `pub mod lock;` after the `pub mod crud;` line:

```rust
pub mod crud;
pub mod lock;
pub mod preflight;
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::lock 2>&1 | tail -10`
Expected: `test result: ok. 3 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/lock.rs crates/ohmyc-core/src/profiles/mod.rs
git commit -m "feat(core): profiles::lock::LockGuard (fs2-backed activation mutex)"
```

---

## Task 3: Symlink helpers (Unix-only with cfg gate)

**Files:**
- Create: `crates/ohmyc-core/src/profiles/symlink.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs`

Wraps `std::os::unix::fs::symlink` for files and dirs (same fn signature on Unix — symlinks are typed at the kernel via the path you point at). Windows compilation returns `ApiError::Internal` immediately. The destination is removed first if it already exists (matches TS `try { lstat; unlink/rm }` pattern).

- [ ] **Step 1: Create `symlink.rs` with failing tests**

Create `crates/ohmyc-core/src/profiles/symlink.rs`:

```rust
//! Symlink helpers used by activation to expose store components inside
//! the profile dir. Unix-only for now: `std::os::unix::fs::symlink`
//! handles both file and directory targets. Windows compilation returns
//! `ApiError::Internal` — Windows symlinks require admin or Developer
//! Mode and are a separate portability slice.

use std::path::Path;

use crate::error::ApiError;

/// Create a symbolic link `dest -> source`. If `dest` already exists
/// (file, dir, or broken symlink), it is removed first. Mirrors the TS
/// `try { await lstat(destination); await unlink(destination) } catch
/// {} await symlink(source, destination)` pattern.
///
/// On Unix, a single `symlink` syscall handles both file and dir
/// targets — pass the same target type the caller expects.
pub fn create_symlink(source: &Path, dest: &Path) -> Result<(), ApiError> {
    #[cfg(unix)]
    {
        if dest.symlink_metadata().is_ok() {
            if dest.is_dir() && !dest.is_symlink() {
                std::fs::remove_dir_all(dest)
                    .map_err(|e| ApiError::Io(format!("remove {}: {e}", dest.display())))?;
            } else {
                std::fs::remove_file(dest)
                    .map_err(|e| ApiError::Io(format!("remove {}: {e}", dest.display())))?;
            }
        }
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
        }
        std::os::unix::fs::symlink(source, dest)
            .map_err(|e| ApiError::Io(format!("symlink {} -> {}: {e}", dest.display(), source.display())))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = (source, dest);
        Err(ApiError::Internal(
            "symlinks not supported on this platform yet (slice 7b is Unix-only)".to_string(),
        ))
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn creates_file_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        std::fs::write(&source, "hello").unwrap();
        let dest = dir.path().join("sub").join("link.md");
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
    }

    #[test]
    fn creates_dir_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source-dir");
        std::fs::create_dir_all(source.join("nested")).unwrap();
        std::fs::write(source.join("nested").join("inner.txt"), "x").unwrap();
        let dest = dir.path().join("link-dir");
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert!(dest.join("nested").join("inner.txt").exists());
    }

    #[test]
    fn replaces_existing_destination_file() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        std::fs::write(&source, "new").unwrap();
        let dest = dir.path().join("dest.md");
        std::fs::write(&dest, "old").unwrap();
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "new");
    }

    #[test]
    fn replaces_existing_dir_destination() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source-dir");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::write(source.join("a.txt"), "from-source").unwrap();
        let dest = dir.path().join("dest-dir");
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("b.txt"), "from-old-dest").unwrap();
        create_symlink(&source, &dest).unwrap();
        assert!(dest.symlink_metadata().unwrap().file_type().is_symlink());
        assert!(dest.join("a.txt").exists());
        assert!(!dest.join("b.txt").exists()); // old dest contents gone
    }
}
```

Then in `crates/ohmyc-core/src/profiles/mod.rs`, add `pub mod symlink;` so the section reads:

```rust
pub mod crud;
pub mod lock;
pub mod preflight;
pub mod symlink;
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::symlink 2>&1 | tail -10`
Expected: `test result: ok. 4 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/symlink.rs crates/ohmyc-core/src/profiles/mod.rs
git commit -m "feat(core): profiles::symlink helpers (Unix-only with Windows cfg gate)"
```

---

## Task 4: Marketplace JSON writers (`marketplace.rs`)

**Files:**
- Create: `crates/ohmyc-core/src/profiles/marketplace.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs`

Writes 3 files:
- `<base_dir>/.claude-plugin/marketplace.json` — synthetic marketplace listing every profile as a plugin.
- `<plugins_dir>/installed_plugins.json` — `register_profile_plugin` adds `profile-<name>@ohmyc-profiles` entry; `unregister_profile_plugin` removes it.
- `<plugins_dir>/known_marketplaces.json` — `register_known_marketplace` adds the `ohmyc-profiles` entry pointing at `base_dir`.

Each writer returns a snapshot (the pre-write state) so the activation undo stack can restore on failure.

- [ ] **Step 1: Create `marketplace.rs` with the type, writers, and failing tests**

Create `crates/ohmyc-core/src/profiles/marketplace.rs`:

```rust
//! Synthetic `ohmyc-profiles` marketplace — exposes each profile as a
//! pseudo-plugin so Claude Code's plugin registry can enable/disable it
//! via `enabledPlugins`. Mirrors the TS `writeMarketplace`,
//! `registerProfilePlugin`, `registerKnownMarketplace` trio.

use std::path::Path;

use serde_json::{json, Value};

use crate::error::ApiError;

/// Marketplace ID used in `installed_plugins.json` keys and
/// `known_marketplaces.json`. Mirrors TS
/// `ProfileService.MARKETPLACE_ID`.
pub const MARKETPLACE_ID: &str = "ohmyc-profiles";

/// Synthetic plugin ID for a profile: `profile-<name>@ohmyc-profiles`.
pub fn plugin_id(profile_name: &str) -> String {
    format!("profile-{profile_name}@{MARKETPLACE_ID}")
}

/// Read `<plugins_dir>/installed_plugins.json`. Missing/malformed →
/// `{ "version": 2, "plugins": {} }`.
pub fn read_installed_plugins(plugins_dir: &Path) -> Value {
    let path = plugins_dir.join("installed_plugins.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(v) => normalize_installed(v),
            Err(_) => default_installed(),
        },
        Err(_) => default_installed(),
    }
}

fn normalize_installed(mut v: Value) -> Value {
    let obj = v.as_object_mut().expect("expected object");
    if !obj.contains_key("version") {
        obj.insert("version".to_string(), json!(2));
    }
    if !obj.contains_key("plugins") {
        obj.insert("plugins".to_string(), json!({}));
    }
    v
}

fn default_installed() -> Value {
    json!({ "version": 2, "plugins": {} })
}

/// Write `<plugins_dir>/installed_plugins.json` (creates parent dir).
pub fn write_installed_plugins(plugins_dir: &Path, data: &Value) -> Result<(), ApiError> {
    std::fs::create_dir_all(plugins_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugins_dir.display())))?;
    let path = plugins_dir.join("installed_plugins.json");
    let raw = serde_json::to_string_pretty(data)
        .map_err(|e| ApiError::Internal(format!("serialize installed_plugins: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

/// Read `<plugins_dir>/known_marketplaces.json`. Missing/malformed → `{}`.
pub fn read_known_marketplaces(plugins_dir: &Path) -> Value {
    let path = plugins_dir.join("known_marketplaces.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| json!({})),
        Err(_) => json!({}),
    }
}

/// Write `<plugins_dir>/known_marketplaces.json` (creates parent dir).
pub fn write_known_marketplaces(plugins_dir: &Path, data: &Value) -> Result<(), ApiError> {
    std::fs::create_dir_all(plugins_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugins_dir.display())))?;
    let path = plugins_dir.join("known_marketplaces.json");
    let raw = serde_json::to_string_pretty(data)
        .map_err(|e| ApiError::Internal(format!("serialize known_marketplaces: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

/// Add/overwrite the `profile-<name>@ohmyc-profiles` entry in
/// installed_plugins. Mirrors TS `registerProfilePlugin`.
pub fn register_profile_plugin(
    plugins_dir: &Path,
    name: &str,
    install_path: &Path,
    now_iso8601: &str,
) -> Result<(), ApiError> {
    let mut installed = read_installed_plugins(plugins_dir);
    let id = plugin_id(name);
    if let Some(plugins) = installed
        .as_object_mut()
        .and_then(|o| o.get_mut("plugins"))
        .and_then(|v| v.as_object_mut())
    {
        plugins.insert(
            id,
            json!([{
                "scope": "user",
                "installPath": install_path.to_string_lossy().to_string(),
                "version": "1.0.0",
                "installedAt": now_iso8601,
                "lastUpdated": now_iso8601,
            }]),
        );
    }
    write_installed_plugins(plugins_dir, &installed)
}

/// Remove the `profile-<name>@ohmyc-profiles` entry. No-op if absent.
pub fn unregister_profile_plugin(plugins_dir: &Path, name: &str) -> Result<(), ApiError> {
    let mut installed = read_installed_plugins(plugins_dir);
    let id = plugin_id(name);
    let mut changed = false;
    if let Some(plugins) = installed
        .as_object_mut()
        .and_then(|o| o.get_mut("plugins"))
        .and_then(|v| v.as_object_mut())
    {
        if plugins.remove(&id).is_some() {
            changed = true;
        }
    }
    if changed {
        write_installed_plugins(plugins_dir, &installed)?;
    }
    Ok(())
}

/// Snapshot of the known_marketplaces.json before activation registers
/// the synthetic marketplace — used by the undo stack to restore.
pub struct KnownMarketplacesSnapshot(pub Value);

/// Adds the `ohmyc-profiles` marketplace entry pointing at `base_dir`.
/// Returns the pre-write snapshot for the undo stack.
pub fn register_known_marketplace(
    plugins_dir: &Path,
    base_dir: &Path,
    now_iso8601: &str,
) -> Result<KnownMarketplacesSnapshot, ApiError> {
    let known = read_known_marketplaces(plugins_dir);
    let snapshot = KnownMarketplacesSnapshot(known.clone());
    let mut next = known;
    if let Some(obj) = next.as_object_mut() {
        obj.insert(
            MARKETPLACE_ID.to_string(),
            json!({
                "source": { "source": "directory", "path": base_dir.to_string_lossy() },
                "installLocation": base_dir.to_string_lossy(),
                "lastUpdated": now_iso8601,
            }),
        );
    }
    write_known_marketplaces(plugins_dir, &next)?;
    Ok(snapshot)
}

/// Write `<base_dir>/.claude-plugin/marketplace.json` listing every
/// profile (name, source path, description, fixed version "1.0.0").
/// `profile_summaries` is `(name, description_or_name)` pairs sorted by
/// name — caller-supplied so this stays pure I/O.
pub fn write_marketplace_json(
    base_dir: &Path,
    profile_summaries: &[(String, String)],
) -> Result<(), ApiError> {
    let dir = base_dir.join(".claude-plugin");
    std::fs::create_dir_all(&dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let plugins: Vec<Value> = profile_summaries
        .iter()
        .map(|(name, desc)| {
            json!({
                "name": format!("profile-{name}"),
                "source": format!("./profiles/{name}"),
                "description": format!("OhMyC profile: {desc}"),
                "version": "1.0.0",
            })
        })
        .collect();
    let body = json!({
        "name": MARKETPLACE_ID,
        "description": "OhMyC profile-as-plugin marketplace",
        "owner": { "name": "ohmyc" },
        "plugins": plugins,
    });
    let path = dir.join("marketplace.json");
    let raw = serde_json::to_string_pretty(&body)
        .map_err(|e| ApiError::Internal(format!("serialize marketplace.json: {e}")))?;
    std::fs::write(&path, raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plugin_id_uses_marketplace_constant() {
        assert_eq!(plugin_id("dev"), "profile-dev@ohmyc-profiles");
    }

    #[test]
    fn read_installed_returns_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let v = read_installed_plugins(dir.path());
        assert_eq!(v["version"], 2);
        assert!(v["plugins"].is_object());
        assert_eq!(v["plugins"].as_object().unwrap().len(), 0);
    }

    #[test]
    fn register_profile_plugin_adds_entry_with_qualified_id() {
        let dir = tempfile::tempdir().unwrap();
        let install_path = dir.path().join("install");
        register_profile_plugin(dir.path(), "dev", &install_path, "2026-06-06T00:00:00Z").unwrap();
        let v = read_installed_plugins(dir.path());
        let id = "profile-dev@ohmyc-profiles";
        assert!(v["plugins"][id].is_array());
        assert_eq!(v["plugins"][id][0]["installPath"], install_path.to_string_lossy().as_ref());
        assert_eq!(v["plugins"][id][0]["scope"], "user");
        assert_eq!(v["plugins"][id][0]["version"], "1.0.0");
    }

    #[test]
    fn unregister_profile_plugin_removes_entry() {
        let dir = tempfile::tempdir().unwrap();
        register_profile_plugin(dir.path(), "dev", &dir.path().join("install"), "ts").unwrap();
        unregister_profile_plugin(dir.path(), "dev").unwrap();
        let v = read_installed_plugins(dir.path());
        assert!(v["plugins"]["profile-dev@ohmyc-profiles"].is_null());
    }

    #[test]
    fn unregister_profile_plugin_is_noop_when_absent() {
        let dir = tempfile::tempdir().unwrap();
        // Should not error and should not create the file:
        unregister_profile_plugin(dir.path(), "ghost").unwrap();
        assert!(!dir.path().join("installed_plugins.json").exists());
    }

    #[test]
    fn register_known_marketplace_writes_entry_and_returns_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let base = tempfile::tempdir().unwrap();
        let snapshot = register_known_marketplace(dir.path(), base.path(), "2026-06-06T00:00:00Z").unwrap();
        let v = read_known_marketplaces(dir.path());
        assert_eq!(v[MARKETPLACE_ID]["source"]["source"], "directory");
        assert_eq!(v[MARKETPLACE_ID]["source"]["path"], base.path().to_string_lossy().as_ref());
        assert_eq!(v[MARKETPLACE_ID]["installLocation"], base.path().to_string_lossy().as_ref());
        // Pre-write snapshot was empty:
        assert_eq!(snapshot.0, json!({}));
    }

    #[test]
    fn write_marketplace_json_lists_profiles_sorted_by_name() {
        let dir = tempfile::tempdir().unwrap();
        let summaries = vec![
            ("alpha".to_string(), "First".to_string()),
            ("beta".to_string(), "Second".to_string()),
        ];
        write_marketplace_json(dir.path(), &summaries).unwrap();
        let raw = std::fs::read_to_string(dir.path().join(".claude-plugin").join("marketplace.json")).unwrap();
        let v: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(v["name"], MARKETPLACE_ID);
        let plugins = v["plugins"].as_array().unwrap();
        assert_eq!(plugins.len(), 2);
        assert_eq!(plugins[0]["name"], "profile-alpha");
        assert_eq!(plugins[0]["source"], "./profiles/alpha");
        assert_eq!(plugins[0]["description"], "OhMyC profile: First");
        assert_eq!(plugins[1]["name"], "profile-beta");
    }
}
```

Then in `crates/ohmyc-core/src/profiles/mod.rs`, add `pub mod marketplace;`:

```rust
pub mod crud;
pub mod lock;
pub mod marketplace;
pub mod preflight;
pub mod symlink;
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::marketplace 2>&1 | tail -10`
Expected: `test result: ok. 7 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/marketplace.rs crates/ohmyc-core/src/profiles/mod.rs
git commit -m "feat(core): profiles::marketplace writers (marketplace.json + installed + known)"
```

---

## Task 5: Deep merge helper + env-var injection module

**Files:**
- Create: `crates/ohmyc-core/src/profiles/activation.rs`
- Modify: `crates/ohmyc-core/src/profiles/mod.rs`

Two small pure helpers used by the activation flow. Stand-alone TDD before adding the transactional logic in Tasks 6-9. Deep merge mirrors the TS `deepMerge`: recursive object merge, arrays/primitives replace.

- [ ] **Step 1: Create `activation.rs` with helpers + failing tests**

Create `crates/ohmyc-core/src/profiles/activation.rs`:

```rust
//! Profile activation — the transactional state machine. Built up
//! across Tasks 5-9: helpers first (deep merge, env injection), then
//! forward path, then undo stack, then auto-restore-previous.

use serde_json::{Map, Value};

/// Recursive merge: object → object recurses, arrays/primitives in
/// `source` overwrite `target`. Mirrors TS `deepMerge` exactly.
pub(crate) fn deep_merge(target: &Value, source: &Value) -> Value {
    match (target, source) {
        (Value::Object(t), Value::Object(s)) => {
            let mut out = t.clone();
            for (k, v) in s {
                let merged = match out.get(k) {
                    Some(existing) => deep_merge(existing, v),
                    None => v.clone(),
                };
                out.insert(k.clone(), merged);
            }
            Value::Object(out)
        }
        // For non-object source values, source overwrites:
        _ => source.clone(),
    }
}

/// Build the 4-or-5 env var map for a model config. Mirrors the TS
/// `environmentVariables` literal in `activate` Step 10.
pub(crate) fn build_env_vars(
    api_key: &str,
    base_url: &str,
    model_name: Option<&str>,
) -> Map<String, Value> {
    let mut env = Map::new();
    env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key.to_string()));
    env.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url.to_string()));
    env.insert("API_TIMEOUT_MS".to_string(), Value::String("3000000".to_string()));
    env.insert(
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC".to_string(),
        Value::String("1".to_string()),
    );
    if let Some(m) = model_name {
        if !m.is_empty() {
            env.insert("ANTHROPIC_MODEL".to_string(), Value::String(m.to_string()));
        }
    }
    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn deep_merge_recurses_into_objects() {
        let t = json!({ "a": { "b": 1, "c": 2 }, "d": 3 });
        let s = json!({ "a": { "c": 99, "e": 4 } });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": { "b": 1, "c": 99, "e": 4 }, "d": 3 }));
    }

    #[test]
    fn deep_merge_array_in_source_overwrites_target_array() {
        let t = json!({ "list": [1, 2, 3] });
        let s = json!({ "list": [4] });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "list": [4] }));
    }

    #[test]
    fn deep_merge_source_primitive_replaces_target_object() {
        let t = json!({ "a": { "b": 1 } });
        let s = json!({ "a": "scalar" });
        let out = deep_merge(&t, &s);
        assert_eq!(out, json!({ "a": "scalar" }));
    }

    #[test]
    fn build_env_vars_includes_anthropic_model_when_set() {
        let env = build_env_vars("sk-x", "https://api", Some("claude-sonnet-4"));
        assert_eq!(env.get("ANTHROPIC_MODEL").unwrap(), "claude-sonnet-4");
        assert_eq!(env.get("API_TIMEOUT_MS").unwrap(), "3000000");
    }

    #[test]
    fn build_env_vars_omits_anthropic_model_when_empty_or_none() {
        let env = build_env_vars("sk-x", "https://api", None);
        assert!(env.get("ANTHROPIC_MODEL").is_none());
        let env_empty = build_env_vars("sk-x", "https://api", Some(""));
        assert!(env_empty.get("ANTHROPIC_MODEL").is_none());
    }
}
```

Then in `crates/ohmyc-core/src/profiles/mod.rs`:

```rust
pub mod activation;
pub mod crud;
pub mod lock;
pub mod marketplace;
pub mod preflight;
pub mod symlink;
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -10`
Expected: `test result: ok. 5 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/profiles/activation.rs crates/ohmyc-core/src/profiles/mod.rs
git commit -m "feat(core): activation deep_merge + build_env_vars helpers"
```

---

## Task 6: `deactivate_internal` (no lock)

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/activation.rs`

Cleanup helper used both from within `activate` (when switching profiles) and from public `deactivate`. Mirrors TS `deactivateInternal`:
1. Restore per-profile settings backup (`<base>/settings.backup.<name>.json`) into `<claude_home>/settings.json`. Fall back to generic `<base>/settings.backup.json` if present. Delete the backup file after restore.
2. Remove all entries inside `<profile_dir>/{agents,skills,commands}/`.
3. Remove `<profile_dir>/.claude-plugin/`, `<profile_dir>/hooks/`, `<profile_dir>/.mcp.json`, `<profile_dir>/.lsp.json`.
4. Call `unregister_profile_plugin`.
5. Remove `<profiles_dir>/.active`.

All steps are best-effort — missing files/dirs don't error.

- [ ] **Step 1: Add failing tests for `deactivate_internal`**

Open `crates/ohmyc-core/src/profiles/activation.rs`. Inside the `#[cfg(test)] mod tests` block (after the helper tests), append:

```rust
    use std::path::PathBuf;

    /// Set up a minimal post-activation state: profile dir with symlinks,
    /// plugin files, .active marker, settings backup, registered plugin.
    struct ActivatedFixture {
        _root: tempfile::TempDir,
        base: PathBuf,
        profiles_dir: PathBuf,
        plugins_dir: PathBuf,
        claude_settings: PathBuf,
        profile_dir: PathBuf,
    }

    fn write(p: &std::path::Path, contents: &str) {
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(p, contents).unwrap();
    }

    fn setup_activated(name: &str) -> ActivatedFixture {
        let root = tempfile::tempdir().unwrap();
        let base = root.path().to_path_buf();
        let profiles_dir = base.join("profiles");
        let plugins_dir = base.join("claude-plugins");
        let claude_settings = base.join("claude-settings.json");
        let profile_dir = profiles_dir.join(name);
        // Pre-activation settings:
        write(&claude_settings, r#"{"model":"sonnet","effort":"high"}"#);
        // Backup snapshot:
        write(
            &base.join(format!("settings.backup.{name}.json")),
            r#"{"model":"sonnet"}"#,
        );
        // Profile dir + post-activation artifacts:
        std::fs::create_dir_all(&profile_dir).unwrap();
        write(&profile_dir.join("agents/reviewer.md"), "x");
        write(&profile_dir.join("commands/push.md"), "x");
        std::fs::create_dir_all(profile_dir.join("skills/deploy")).unwrap();
        write(&profile_dir.join(".claude-plugin/plugin.json"), "{}");
        write(&profile_dir.join("hooks/hooks.json"), "{}");
        write(&profile_dir.join(".mcp.json"), "{}");
        write(&profile_dir.join(".lsp.json"), "{}");
        write(&profiles_dir.join(".active"), name);
        // Pre-registered plugin entry:
        crate::profiles::marketplace::register_profile_plugin(
            &plugins_dir,
            name,
            &profile_dir,
            "2026-06-06T00:00:00Z",
        )
        .unwrap();
        ActivatedFixture { _root: root, base, profiles_dir, plugins_dir, claude_settings, profile_dir }
    }

    #[test]
    fn deactivate_internal_restores_settings_backup() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let settings: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(settings, json!({"model": "sonnet"})); // restored, effort dropped
        // Backup file cleaned up:
        assert!(!f.base.join("settings.backup.dev.json").exists());
    }

    #[test]
    fn deactivate_internal_removes_symlinks_and_generated_files() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        assert!(!f.profile_dir.join("agents/reviewer.md").exists());
        assert!(!f.profile_dir.join("commands/push.md").exists());
        assert!(!f.profile_dir.join("skills/deploy").exists());
        assert!(!f.profile_dir.join(".claude-plugin").exists());
        assert!(!f.profile_dir.join("hooks").exists());
        assert!(!f.profile_dir.join(".mcp.json").exists());
        assert!(!f.profile_dir.join(".lsp.json").exists());
    }

    #[test]
    fn deactivate_internal_unregisters_plugin_and_clears_active() {
        let f = setup_activated("dev");
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let installed = crate::profiles::marketplace::read_installed_plugins(&f.plugins_dir);
        assert!(installed["plugins"]["profile-dev@ohmyc-profiles"].is_null());
        assert!(!f.profiles_dir.join(".active").exists());
    }

    #[test]
    fn deactivate_internal_falls_back_to_generic_backup_when_per_profile_missing() {
        let f = setup_activated("dev");
        // Drop the per-profile backup; add a generic one:
        std::fs::remove_file(f.base.join("settings.backup.dev.json")).unwrap();
        write(&f.base.join("settings.backup.json"), r#"{"model":"generic"}"#);
        deactivate_internal(&f.base, &f.profiles_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let settings: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(settings["model"], "generic");
        assert!(!f.base.join("settings.backup.json").exists());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -10`
Expected: compile error — `deactivate_internal` not defined.

- [ ] **Step 3: Implement `deactivate_internal`**

In `crates/ohmyc-core/src/profiles/activation.rs`, after the `build_env_vars` function (and before `#[cfg(test)]`), add:

```rust
use std::path::Path;

use crate::error::ApiError;

use super::marketplace;

/// Internal cleanup — restores backup, removes generated artifacts.
/// No lock acquisition (callers hold the activation lock when needed).
/// All steps are best-effort; missing files/dirs are not errors.
pub fn deactivate_internal(
    base_dir: &Path,
    profiles_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    active_name: &str,
) -> Result<(), ApiError> {
    // 1. Restore per-profile backup (or fall back to generic).
    let per_profile = base_dir.join(format!("settings.backup.{active_name}.json"));
    let generic = base_dir.join("settings.backup.json");
    let restored = if let Ok(raw) = std::fs::read_to_string(&per_profile) {
        if let Some(parent) = claude_settings_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(claude_settings_path, raw)
            .map_err(|e| ApiError::Io(format!("write {}: {e}", claude_settings_path.display())))?;
        let _ = std::fs::remove_file(&per_profile);
        true
    } else {
        false
    };
    if !restored {
        if let Ok(raw) = std::fs::read_to_string(&generic) {
            if let Some(parent) = claude_settings_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(claude_settings_path, raw)
                .map_err(|e| ApiError::Io(format!("write {}: {e}", claude_settings_path.display())))?;
            let _ = std::fs::remove_file(&generic);
        }
    }

    let profile_dir = profiles_dir.join(active_name);

    // 2. Remove entries inside agents/, skills/, commands/.
    for sub in ["agents", "skills", "commands"] {
        let sub_dir = profile_dir.join(sub);
        let Ok(entries) = std::fs::read_dir(&sub_dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            // symlinks first; remove_file works for symlinks (file & dir)
            // but for non-symlink dirs we'd need remove_dir_all. Check
            // symlink_metadata to choose.
            let is_symlink = path
                .symlink_metadata()
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false);
            if is_symlink || path.is_file() {
                let _ = std::fs::remove_file(&path);
            } else if path.is_dir() {
                let _ = std::fs::remove_dir_all(&path);
            }
        }
    }

    // 3. Remove generated config files/dirs.
    let _ = std::fs::remove_dir_all(profile_dir.join(".claude-plugin"));
    let _ = std::fs::remove_dir_all(profile_dir.join("hooks"));
    let _ = std::fs::remove_file(profile_dir.join(".mcp.json"));
    let _ = std::fs::remove_file(profile_dir.join(".lsp.json"));

    // 4. Unregister synthetic plugin entry.
    marketplace::unregister_profile_plugin(plugins_dir, active_name)?;

    // 5. Remove .active marker.
    let _ = std::fs::remove_file(profiles_dir.join(".active"));

    Ok(())
}
```

Note that the test module references `Value` and `json!` macro. Add these imports to the top of the test module if not already imported:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    // ... rest of tests
}
```

(If the prior task's tests already imported `json` via `use serde_json::json;`, extend that line to `use serde_json::{json, Value};`.)

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -10`
Expected: `test result: ok. 9 passed` (5 helper + 4 deactivate_internal).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/activation.rs
git commit -m "feat(core): activation::deactivate_internal (backup restore + cleanup)"
```

---

## Task 7: `activate` forward path (no undo, no auto-restore)

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/activation.rs`

Implements the happy-path of the TS `activate`:
1. Preflight gate — return `ApiError::ActivationBlocked { missing }` if can't activate.
2. Get the profile.
3. Get previous active name (for switching).
4. If switching, call `deactivate_internal` for the previous.
5. Write `<base>/settings.backup.<name>.json` snapshot.
6. Write `<profiles_dir>/.active` with absolute path to profile dir.
7. Create symlinks for agents/skills/commands (skip empty arrays).
8. Write `.claude-plugin/plugin.json`.
9. Write `hooks/hooks.json` (iff `profile.hooks` set).
10. Write `.mcp.json` (iff `profile.mcpServers`).
11. Write `.lsp.json` (iff `profile.lspServers`).
12. Build merged settings: start with current claude settings → deep-merge `profile.settings` → inject env vars from model config → set enabledPlugins (profile.plugins + synthetic profile-`name`).
13. Write merged settings to `<claude_home>/settings.json`.
14. Write `<base>/.claude-plugin/marketplace.json` listing all profiles.
15. Call `register_known_marketplace` (also writes a snapshot for the undo stack in Task 8).
16. Call `register_profile_plugin`.

Return `Vec<String>` of settings warnings (from preflight).

For Task 7, undo is NOT wired yet — happy-path only. Task 8 adds rollback.

- [ ] **Step 1: Add failing tests for the forward path**

In `crates/ohmyc-core/src/profiles/activation.rs`, inside the test module, append:

```rust
    use super::super::{crud, preflight};

    struct ActivateFixture {
        _root: tempfile::TempDir,
        base: PathBuf,
        profiles_dir: PathBuf,
        store_dir: PathBuf,
        plugins_dir: PathBuf,
        claude_settings: PathBuf,
    }

    fn fresh() -> ActivateFixture {
        let root = tempfile::tempdir().unwrap();
        let base = root.path().to_path_buf();
        let profiles_dir = base.join("profiles");
        let store_dir = base.join("store");
        let plugins_dir = base.join("claude-plugins");
        let claude_settings = base.join("claude-settings.json");
        // Empty store skeleton:
        std::fs::create_dir_all(store_dir.join("agents")).unwrap();
        std::fs::create_dir_all(store_dir.join("skills")).unwrap();
        std::fs::create_dir_all(store_dir.join("commands")).unwrap();
        std::fs::create_dir_all(store_dir.join("model-configs")).unwrap();
        std::fs::create_dir_all(&profiles_dir).unwrap();
        write(&claude_settings, r#"{"model":"sonnet"}"#);
        ActivateFixture { _root: root, base, profiles_dir, store_dir, plugins_dir, claude_settings }
    }

    #[test]
    fn activate_writes_active_marker_with_absolute_path() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "agents": ["reviewer"]}),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let marker = std::fs::read_to_string(f.profiles_dir.join(".active")).unwrap();
        let marker = marker.trim();
        assert!(std::path::Path::new(marker).is_absolute());
        assert!(marker.ends_with("/profiles/dev") || marker.ends_with(r"\profiles\dev"));
    }

    #[test]
    fn activate_creates_symlinks_for_referenced_components() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        write(&f.store_dir.join("commands/push.md"), "x");
        std::fs::create_dir_all(f.store_dir.join("skills/deploy")).unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "agents": ["reviewer"],
                "skills": ["deploy"],
                "commands": ["push"],
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let pd = f.profiles_dir.join("dev");
        assert!(pd.join("agents/reviewer.md").symlink_metadata().unwrap().file_type().is_symlink());
        assert!(pd.join("skills/deploy").symlink_metadata().unwrap().file_type().is_symlink());
        assert!(pd.join("commands/push.md").symlink_metadata().unwrap().file_type().is_symlink());
    }

    #[test]
    fn activate_writes_plugin_files_when_profile_has_them() {
        let f = fresh();
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "hooks": { "PreToolUse": [] },
                "mcpServers": { "db": { "command": "node" } },
                "lspServers": { "ts": { "command": "tsc" } },
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let pd = f.profiles_dir.join("dev");
        assert!(pd.join(".claude-plugin/plugin.json").exists());
        assert!(pd.join("hooks/hooks.json").exists());
        assert!(pd.join(".mcp.json").exists());
        assert!(pd.join(".lsp.json").exists());
    }

    #[test]
    fn activate_deep_merges_settings_and_sets_enabled_plugins() {
        let f = fresh();
        write(&f.claude_settings, r#"{"model":"sonnet","env":{"X":"keep"}}"#);
        crud::create(
            &f.profiles_dir,
            &json!({
                "name": "dev",
                "settings": {"effort": "high", "env": {"Y": "new"}},
                "plugins": ["gitlab@market"],
            }),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let v: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(v["model"], "sonnet"); // preserved
        assert_eq!(v["effort"], "high"); // merged
        assert_eq!(v["env"]["X"], "keep"); // deep merge preserved sibling
        assert_eq!(v["env"]["Y"], "new"); // deep merge added new
        assert_eq!(v["enabledPlugins"]["gitlab@market"], true);
        assert_eq!(v["enabledPlugins"]["profile-dev@ohmyc-profiles"], true);
    }

    #[test]
    fn activate_injects_model_config_env_vars_when_present() {
        let f = fresh();
        write(
            &f.store_dir.join("model-configs/anthropic.json"),
            r#"{"name":"anthropic","apiKey":"sk-x","baseUrl":"https://api","modelName":"claude-sonnet-4","provider":""}"#,
        );
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "modelConfig": "anthropic"}),
        )
        .unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        let v: Value = serde_json::from_str(&std::fs::read_to_string(&f.claude_settings).unwrap()).unwrap();
        assert_eq!(v["env"]["ANTHROPIC_AUTH_TOKEN"], "sk-x");
        assert_eq!(v["env"]["ANTHROPIC_BASE_URL"], "https://api");
        assert_eq!(v["env"]["ANTHROPIC_MODEL"], "claude-sonnet-4");
    }

    #[test]
    fn activate_writes_marketplace_and_registers_plugin() {
        let f = fresh();
        crud::create(&f.profiles_dir, &json!({"name": "dev", "description": "Dev"})).unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap();
        // marketplace.json listing dev:
        assert!(f.base.join(".claude-plugin/marketplace.json").exists());
        // installed_plugins.json has the synthetic id:
        let installed = marketplace::read_installed_plugins(&f.plugins_dir);
        assert!(installed["plugins"]["profile-dev@ohmyc-profiles"].is_array());
        // known_marketplaces.json has the entry:
        let known = marketplace::read_known_marketplaces(&f.plugins_dir);
        assert_eq!(known["ohmyc-profiles"]["source"]["source"], "directory");
    }

    #[test]
    fn activate_returns_activation_blocked_when_components_missing() {
        let f = fresh();
        crud::create(&f.profiles_dir, &json!({"name": "dev", "agents": ["ghost"]})).unwrap();
        let err = activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "dev")
            .unwrap_err();
        match err {
            ApiError::ActivationBlocked { missing } => {
                assert_eq!(missing, vec!["agent:ghost".to_string()]);
            }
            other => panic!("expected ActivationBlocked, got {other:?}"),
        }
    }

    #[test]
    fn activate_deactivates_previous_profile_before_activating_new() {
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(&f.profiles_dir, &json!({"name": "first", "agents": ["reviewer"]})).unwrap();
        crud::create(&f.profiles_dir, &json!({"name": "second"})).unwrap();
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "first")
            .unwrap();
        // First is active, has agent symlink:
        assert!(f.profiles_dir.join("first/agents/reviewer.md").exists());
        // Switch:
        activate_forward(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "second")
            .unwrap();
        // First's symlinks removed:
        assert!(!f.profiles_dir.join("first/agents/reviewer.md").exists());
        // Active marker points at second:
        let marker = std::fs::read_to_string(f.profiles_dir.join(".active")).unwrap();
        assert!(marker.trim().ends_with("/profiles/second") || marker.trim().ends_with(r"\profiles\second"));
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -15`
Expected: compile error — `activate_forward` not defined.

- [ ] **Step 3: Implement `activate_forward`**

In `crates/ohmyc-core/src/profiles/activation.rs`, after `deactivate_internal` (and before `#[cfg(test)]`), add:

```rust
use super::crud;
use super::preflight;
use super::symlink as sym;

/// Forward path of activation — no undo, no auto-restore. Tasks 8-9
/// wrap this with the transactional machinery. Returns the settings
/// warnings list (overwrite warnings from preflight).
pub(crate) fn activate_forward(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
) -> Result<Vec<String>, ApiError> {
    // 1. Preflight gate.
    let pre = preflight::preflight(profiles_dir, store_dir, claude_settings_path, name)?;
    if !pre.can_activate {
        return Err(ApiError::ActivationBlocked { missing: pre.missing });
    }

    // 2. Load the profile.
    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };

    // 3. Record previous active (for the switch case).
    let previous_active = crud::read_active_profile_name(profiles_dir)?;

    // 4. If switching, deactivate the previous profile.
    if let Some(prev) = previous_active.as_deref() {
        deactivate_internal(base_dir, profiles_dir, plugins_dir, claude_settings_path, prev)?;
    }

    // 5. Per-profile settings backup.
    let backup_path = base_dir.join(format!("settings.backup.{name}.json"));
    let current_settings_raw = std::fs::read_to_string(claude_settings_path).unwrap_or_else(|_| "{}".to_string());
    let current_settings: Value = serde_json::from_str(&current_settings_raw).unwrap_or_else(|_| json!({}));
    std::fs::write(&backup_path, serde_json::to_string_pretty(&current_settings).unwrap())
        .map_err(|e| ApiError::Io(format!("write backup {}: {e}", backup_path.display())))?;

    let profile_dir = profiles_dir.join(name);
    std::fs::create_dir_all(&profile_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", profile_dir.display())))?;

    // 6. Write .active marker with absolute path (canonicalize falls back
    //    to the joined path if profile_dir isn't fully resolvable — e.g.
    //    on first activation when symlinks haven't been created yet).
    let absolute = profile_dir.canonicalize().unwrap_or(profile_dir.clone());
    std::fs::write(profiles_dir.join(".active"), absolute.to_string_lossy().to_string())
        .map_err(|e| ApiError::Io(format!("write .active: {e}")))?;

    // 7. Symlinks.
    for agent in &profile.agents {
        let source = store_dir.join("agents").join(format!("{agent}.md"));
        let dest = profile_dir.join("agents").join(format!("{agent}.md"));
        sym::create_symlink(&source, &dest)?;
    }
    for skill in &profile.skills {
        let source = store_dir.join("skills").join(skill);
        let dest = profile_dir.join("skills").join(skill);
        sym::create_symlink(&source, &dest)?;
    }
    for cmd in &profile.commands {
        let source = store_dir.join("commands").join(format!("{cmd}.md"));
        let dest = profile_dir.join("commands").join(format!("{cmd}.md"));
        sym::create_symlink(&source, &dest)?;
    }

    // 8. Plugin files.
    let plugin_dir = profile_dir.join(".claude-plugin");
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugin_dir.display())))?;
    let description = profile.description.clone().unwrap_or_else(|| name.to_string());
    let plugin_json = json!({
        "name": format!("profile-{name}"),
        "version": "1.0.0",
        "description": format!("OhMyC profile: {description}"),
    });
    std::fs::write(
        plugin_dir.join("plugin.json"),
        serde_json::to_string_pretty(&plugin_json).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write plugin.json: {e}")))?;

    // 9. hooks/hooks.json (iff profile.hooks present).
    if let Some(hooks) = profile.hooks.as_ref() {
        let hooks_dir = profile_dir.join("hooks");
        std::fs::create_dir_all(&hooks_dir)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", hooks_dir.display())))?;
        let body = json!({ "hooks": hooks });
        std::fs::write(
            hooks_dir.join("hooks.json"),
            serde_json::to_string_pretty(&body).unwrap(),
        )
        .map_err(|e| ApiError::Io(format!("write hooks.json: {e}")))?;
    }

    // 10. .mcp.json (iff profile.mcpServers).
    if let Some(mcp) = profile.mcp_servers.as_ref() {
        let body = json!({ "mcpServers": mcp });
        std::fs::write(
            profile_dir.join(".mcp.json"),
            serde_json::to_string_pretty(&body).unwrap(),
        )
        .map_err(|e| ApiError::Io(format!("write .mcp.json: {e}")))?;
    }

    // 11. .lsp.json (iff profile.lspServers).
    if let Some(lsp) = profile.lsp_servers.as_ref() {
        std::fs::write(
            profile_dir.join(".lsp.json"),
            serde_json::to_string_pretty(lsp).unwrap(),
        )
        .map_err(|e| ApiError::Io(format!("write .lsp.json: {e}")))?;
    }

    // 12. Build merged settings.
    let mut merged = current_settings.clone();
    if let Some(ps) = profile.settings.as_ref() {
        merged = deep_merge(&merged, &Value::Object(ps.clone()));
    }
    // Inject model-config env vars.
    if let Some(mc_name) = profile.model_config.as_deref() {
        if let Some(mc) = crate::store::model_configs::get(&store_dir.join("model-configs"), mc_name)? {
            let model = if mc.model_name.is_empty() { None } else { Some(mc.model_name.as_str()) };
            let env = build_env_vars(&mc.api_key, &mc.base_url, model);
            let existing_env = merged
                .get("env")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();
            let mut combined = existing_env;
            for (k, v) in env {
                combined.insert(k, v);
            }
            merged.as_object_mut().unwrap().insert("env".to_string(), Value::Object(combined));
        }
        // Missing model config → skip silently (matches TS).
    }
    // Set enabledPlugins.
    let mut enabled = merged
        .get("enabledPlugins")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    for plugin_id in &profile.plugins {
        enabled.insert(plugin_id.clone(), Value::Bool(true));
    }
    enabled.insert(marketplace::plugin_id(name), Value::Bool(true));
    merged.as_object_mut().unwrap().insert("enabledPlugins".to_string(), Value::Object(enabled));

    // 13. Write merged settings.
    if let Some(parent) = claude_settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }
    std::fs::write(
        claude_settings_path,
        serde_json::to_string_pretty(&merged).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write settings: {e}")))?;

    // 14. Write marketplace.json listing all profiles.
    let listing = crud::list(profiles_dir)?;
    let summaries: Vec<(String, String)> = listing
        .profiles
        .iter()
        .map(|p| {
            (
                p.name.clone(),
                p.description.clone().unwrap_or_else(|| p.name.clone()),
            )
        })
        .collect();
    marketplace::write_marketplace_json(base_dir, &summaries)?;

    // 15. Register known marketplace.
    let now = current_iso8601();
    marketplace::register_known_marketplace(plugins_dir, base_dir, &now)?;

    // 16. Register the synthetic plugin entry.
    marketplace::register_profile_plugin(plugins_dir, name, &profile_dir, &now)?;

    Ok(pre.settings_warnings)
}

/// Today's UTC instant in RFC3339 ('Z' suffix). chrono is already a
/// workspace dep via timeline.
fn current_iso8601() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -15`
Expected: `test result: ok. 17 passed` (9 prior + 8 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/activation.rs
git commit -m "feat(core): activate_forward — happy-path transactional activation"
```

---

## Task 8: Add typed undo stack + rollback

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/activation.rs`

Refactors `activate_forward` to push `UndoAction` entries onto a `Vec` after each side-effecting step. On any error, drain the stack in reverse — best-effort, swallow errors. Public function name: keep `activate_forward` as the inner that returns Result with undo-applied-on-failure semantics.

Using a typed enum (instead of boxed closures) makes the rollback auditable and tests can inspect intermediate state without monomorphization headaches.

- [ ] **Step 1: Add failing tests for rollback**

In the test module, append:

```rust
    #[test]
    fn rollback_when_symlink_creation_fails_clears_active_marker() {
        // Force symlink failure by making the destination parent unwritable —
        // tricky portably, so instead point the store at a missing source for
        // a skill (the create_symlink call still succeeds since the source is
        // a path string, not a real check). Use a more direct approach: a
        // profile that references a "skill" whose store path is actually a
        // FILE not a dir — create_dir_all inside create_symlink's
        // remove_dir_all branch will try to wipe the file. Simpler: corrupt
        // mid-flow by simulating preflight passing but mid-write failure
        // via a permission-denied path.
        //
        // Pragmatic approach: skip filesystem-poisoning. Instead, write a
        // .lsp.json blocker — pre-create a DIRECTORY at the destination
        // <profile_dir>/.lsp.json so create-as-file fails. Then assert
        // rollback wiped .active and the backup.
        let f = fresh();
        std::fs::create_dir_all(f.profiles_dir.join("dev/.lsp.json")).unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "dev", "lspServers": {"ts": {}}}),
        )
        .unwrap();
        let result = activate_forward(
            &f.base,
            &f.profiles_dir,
            &f.store_dir,
            &f.plugins_dir,
            &f.claude_settings,
            "dev",
        );
        assert!(result.is_err());
        // Undo should have removed .active and the backup:
        assert!(!f.profiles_dir.join(".active").exists());
        assert!(!f.base.join("settings.backup.dev.json").exists());
        // Settings.json should be untouched (still the pre-activation value):
        let raw = std::fs::read_to_string(&f.claude_settings).unwrap();
        assert!(raw.contains("\"model\""));
        assert!(!raw.contains("profile-dev@ohmyc-profiles"));
    }
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation::tests::rollback_when_symlink_creation_fails_clears_active_marker 2>&1 | tail -10`
Expected: test FAILS — the current forward path leaves `.active` and the backup behind.

- [ ] **Step 3: Add the UndoAction enum + refactor activate_forward**

In `crates/ohmyc-core/src/profiles/activation.rs`, ABOVE the existing `pub(crate) fn activate_forward(...)`, add:

```rust
use std::path::PathBuf;

/// Typed undo step. Each variant captures enough state to fully reverse
/// the corresponding forward step. Run in reverse order on failure.
#[derive(Debug)]
enum UndoAction {
    RemoveFile(PathBuf),
    RemoveDir(PathBuf),
    RestoreFile(PathBuf, Vec<u8>),
    RestoreInstalled(Value),
    RestoreKnown(Value),
    RestoreSettings(Vec<u8>),
}

impl UndoAction {
    fn run(&self, plugins_dir: &Path, claude_settings_path: &Path) {
        let _ = match self {
            UndoAction::RemoveFile(p) => std::fs::remove_file(p).map(|_| ()),
            UndoAction::RemoveDir(p) => std::fs::remove_dir_all(p).map(|_| ()),
            UndoAction::RestoreFile(p, contents) => std::fs::write(p, contents).map(|_| ()),
            UndoAction::RestoreInstalled(v) => {
                marketplace::write_installed_plugins(plugins_dir, v).map(|_| ()).map_err(io_passthrough)
            }
            UndoAction::RestoreKnown(v) => {
                marketplace::write_known_marketplaces(plugins_dir, v).map(|_| ()).map_err(io_passthrough)
            }
            UndoAction::RestoreSettings(bytes) => std::fs::write(claude_settings_path, bytes).map(|_| ()),
        };
    }
}

fn io_passthrough(e: ApiError) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, format!("{e:?}"))
}

fn rollback(actions: &[UndoAction], plugins_dir: &Path, claude_settings_path: &Path) {
    for action in actions.iter().rev() {
        action.run(plugins_dir, claude_settings_path);
    }
}
```

Now replace the body of `activate_forward` so each side effect is wrapped: take the action, then push the corresponding UndoAction. Use `?`-bubbling with rollback on the error path via a closure pattern. Replace the entire `pub(crate) fn activate_forward(...)` body with:

```rust
pub(crate) fn activate_forward(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
) -> Result<Vec<String>, ApiError> {
    let mut undo: Vec<UndoAction> = Vec::new();

    let result = activate_inner(
        base_dir,
        profiles_dir,
        store_dir,
        plugins_dir,
        claude_settings_path,
        name,
        &mut undo,
    );

    if result.is_err() {
        rollback(&undo, plugins_dir, claude_settings_path);
    }
    result
}

fn activate_inner(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
    undo: &mut Vec<UndoAction>,
) -> Result<Vec<String>, ApiError> {
    // 1. Preflight gate.
    let pre = preflight::preflight(profiles_dir, store_dir, claude_settings_path, name)?;
    if !pre.can_activate {
        return Err(ApiError::ActivationBlocked { missing: pre.missing });
    }

    // 2. Load the profile.
    let Some(profile) = crud::get(profiles_dir, name)? else {
        return Err(ApiError::NotFound { kind: "profile", name: name.to_string() });
    };

    // 3. Record previous active.
    let previous_active = crud::read_active_profile_name(profiles_dir)?;

    // 4. Deactivate previous (no undo push — restored separately by the
    //    auto-restore-previous step in Task 9).
    if let Some(prev) = previous_active.as_deref() {
        deactivate_internal(base_dir, profiles_dir, plugins_dir, claude_settings_path, prev)?;
    }

    // 5. Backup current settings.
    let current_settings_bytes = std::fs::read(claude_settings_path).unwrap_or_else(|_| b"{}".to_vec());
    let current_settings: Value = serde_json::from_slice(&current_settings_bytes).unwrap_or_else(|_| json!({}));
    let backup_path = base_dir.join(format!("settings.backup.{name}.json"));
    std::fs::write(&backup_path, serde_json::to_string_pretty(&current_settings).unwrap())
        .map_err(|e| ApiError::Io(format!("write backup {}: {e}", backup_path.display())))?;
    undo.push(UndoAction::RemoveFile(backup_path.clone()));

    let profile_dir = profiles_dir.join(name);
    std::fs::create_dir_all(&profile_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", profile_dir.display())))?;

    // 6. .active marker.
    let absolute = profile_dir.canonicalize().unwrap_or(profile_dir.clone());
    let active_path = profiles_dir.join(".active");
    std::fs::write(&active_path, absolute.to_string_lossy().to_string())
        .map_err(|e| ApiError::Io(format!("write .active: {e}")))?;
    undo.push(UndoAction::RemoveFile(active_path));

    // 7. Symlinks (each pushes an undo).
    for agent in &profile.agents {
        let source = store_dir.join("agents").join(format!("{agent}.md"));
        let dest = profile_dir.join("agents").join(format!("{agent}.md"));
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }
    for skill in &profile.skills {
        let source = store_dir.join("skills").join(skill);
        let dest = profile_dir.join("skills").join(skill);
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }
    for cmd in &profile.commands {
        let source = store_dir.join("commands").join(format!("{cmd}.md"));
        let dest = profile_dir.join("commands").join(format!("{cmd}.md"));
        sym::create_symlink(&source, &dest)?;
        undo.push(UndoAction::RemoveFile(dest));
    }

    // 8. Plugin files.
    let plugin_dir = profile_dir.join(".claude-plugin");
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", plugin_dir.display())))?;
    let description = profile.description.clone().unwrap_or_else(|| name.to_string());
    let plugin_json = json!({
        "name": format!("profile-{name}"),
        "version": "1.0.0",
        "description": format!("OhMyC profile: {description}"),
    });
    std::fs::write(
        plugin_dir.join("plugin.json"),
        serde_json::to_string_pretty(&plugin_json).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write plugin.json: {e}")))?;
    undo.push(UndoAction::RemoveDir(plugin_dir));

    // 9. hooks.
    if let Some(hooks) = profile.hooks.as_ref() {
        let hooks_dir = profile_dir.join("hooks");
        std::fs::create_dir_all(&hooks_dir)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", hooks_dir.display())))?;
        let body = json!({ "hooks": hooks });
        std::fs::write(
            hooks_dir.join("hooks.json"),
            serde_json::to_string_pretty(&body).unwrap(),
        )
        .map_err(|e| ApiError::Io(format!("write hooks.json: {e}")))?;
        undo.push(UndoAction::RemoveDir(hooks_dir));
    }

    // 10. .mcp.json.
    if let Some(mcp) = profile.mcp_servers.as_ref() {
        let body = json!({ "mcpServers": mcp });
        let path = profile_dir.join(".mcp.json");
        std::fs::write(&path, serde_json::to_string_pretty(&body).unwrap())
            .map_err(|e| ApiError::Io(format!("write .mcp.json: {e}")))?;
        undo.push(UndoAction::RemoveFile(path));
    }

    // 11. .lsp.json.
    if let Some(lsp) = profile.lsp_servers.as_ref() {
        let path = profile_dir.join(".lsp.json");
        std::fs::write(&path, serde_json::to_string_pretty(lsp).unwrap())
            .map_err(|e| ApiError::Io(format!("write .lsp.json: {e}")))?;
        undo.push(UndoAction::RemoveFile(path));
    }

    // 12. Settings merge.
    let mut merged = current_settings.clone();
    if let Some(ps) = profile.settings.as_ref() {
        merged = deep_merge(&merged, &Value::Object(ps.clone()));
    }
    if let Some(mc_name) = profile.model_config.as_deref() {
        if let Some(mc) = crate::store::model_configs::get(&store_dir.join("model-configs"), mc_name)? {
            let model = if mc.model_name.is_empty() { None } else { Some(mc.model_name.as_str()) };
            let env = build_env_vars(&mc.api_key, &mc.base_url, model);
            let existing_env = merged
                .get("env")
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();
            let mut combined = existing_env;
            for (k, v) in env {
                combined.insert(k, v);
            }
            merged.as_object_mut().unwrap().insert("env".to_string(), Value::Object(combined));
        }
    }
    let mut enabled = merged
        .get("enabledPlugins")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    for plugin_id in &profile.plugins {
        enabled.insert(plugin_id.clone(), Value::Bool(true));
    }
    enabled.insert(marketplace::plugin_id(name), Value::Bool(true));
    merged.as_object_mut().unwrap().insert("enabledPlugins".to_string(), Value::Object(enabled));

    // 13. Write merged settings — undo restores the pre-write bytes.
    if let Some(parent) = claude_settings_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }
    std::fs::write(
        claude_settings_path,
        serde_json::to_string_pretty(&merged).unwrap(),
    )
    .map_err(|e| ApiError::Io(format!("write settings: {e}")))?;
    undo.push(UndoAction::RestoreSettings(current_settings_bytes));

    // 14. marketplace.json.
    let listing = crud::list(profiles_dir)?;
    let summaries: Vec<(String, String)> = listing
        .profiles
        .iter()
        .map(|p| (p.name.clone(), p.description.clone().unwrap_or_else(|| p.name.clone())))
        .collect();
    marketplace::write_marketplace_json(base_dir, &summaries)?;
    undo.push(UndoAction::RemoveDir(base_dir.join(".claude-plugin")));

    // 15. known_marketplaces — snapshot for undo.
    let now = current_iso8601();
    let known_snapshot = marketplace::register_known_marketplace(plugins_dir, base_dir, &now)?;
    undo.push(UndoAction::RestoreKnown(known_snapshot.0));

    // 16. installed_plugins — snapshot for undo.
    let installed_snapshot = marketplace::read_installed_plugins(plugins_dir);
    marketplace::register_profile_plugin(plugins_dir, name, &profile_dir, &now)?;
    undo.push(UndoAction::RestoreInstalled(installed_snapshot));

    Ok(pre.settings_warnings)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -15`
Expected: all 18 tests pass (17 prior + 1 new rollback test).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/activation.rs
git commit -m "feat(core): typed UndoAction stack + reverse-order rollback on failure"
```

---

## Task 9: Auto-restore-previous on non-blocked failure

**Files:**
- Modify: `crates/ohmyc-core/src/profiles/activation.rs`

Wraps `activate_forward` with a recursive auto-restore: if activation fails AND it's NOT `ActivationBlocked`, AND we had a previous active profile, recursively call `activate_forward(previous)`. The recursion is bounded (depth 1) because the previous-previous chain is broken by the deactivation in step 4.

Refactor to capture `previous_active` BEFORE the deactivation so the wrapper can use it.

- [ ] **Step 1: Add a failing test for auto-restore**

In the test module, append:

```rust
    #[test]
    fn auto_restore_previous_when_switching_fails_non_blocked() {
        // Activate profile-a (has all components), then try to switch to
        // profile-b which has a poisoned destination causing mid-flight
        // failure. profile-a must be restored as active.
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-a", "agents": ["reviewer"]}),
        )
        .unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-b", "lspServers": {"ts": {}}}),
        )
        .unwrap();
        // Pre-create the lsp blocker (a directory at .lsp.json's destination)
        // BEFORE activate_b runs:
        activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-a")
            .unwrap();
        std::fs::create_dir_all(f.profiles_dir.join("profile-b/.lsp.json")).unwrap();
        let result = activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-b");
        assert!(result.is_err());
        // profile-a should be restored:
        let active = crud::read_active_profile_name(&f.profiles_dir).unwrap();
        assert_eq!(active.as_deref(), Some("profile-a"));
        // profile-a's symlink should still exist:
        assert!(f.profiles_dir.join("profile-a/agents/reviewer.md").exists());
    }

    #[test]
    fn auto_restore_does_not_fire_when_failure_is_activation_blocked() {
        // If activate fails with ActivationBlocked, we should NOT try to
        // restore (the missing-components case is recoverable user error,
        // not a partial-state cleanup).
        let f = fresh();
        write(&f.store_dir.join("agents/reviewer.md"), "x");
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-a", "agents": ["reviewer"]}),
        )
        .unwrap();
        crud::create(
            &f.profiles_dir,
            &json!({"name": "profile-b", "agents": ["ghost"]}),
        )
        .unwrap();
        activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-a")
            .unwrap();
        let err = activate(&f.base, &f.profiles_dir, &f.store_dir, &f.plugins_dir, &f.claude_settings, "profile-b")
            .unwrap_err();
        assert!(matches!(err, ApiError::ActivationBlocked { .. }));
        // ActivationBlocked happens BEFORE step 4 (deactivate previous),
        // so profile-a should still be active without any auto-restore.
        let active = crud::read_active_profile_name(&f.profiles_dir).unwrap();
        assert_eq!(active.as_deref(), Some("profile-a"));
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation::tests::auto_restore 2>&1 | tail -10`
Expected: compile error — public `activate` not defined.

- [ ] **Step 3: Implement public `activate` wrapper**

In `crates/ohmyc-core/src/profiles/activation.rs`, after `activate_inner` (and before `#[cfg(test)]`), add:

```rust
/// Public activation entrypoint. Acquires no lock (the Tauri command
/// layer holds the lock). Wraps `activate_forward` with auto-restore:
/// if a non-blocked failure occurs AFTER we deactivated the previous
/// profile, recursively re-activate the previous one. Best-effort —
/// the recursive call's result is swallowed.
pub fn activate(
    base_dir: &Path,
    profiles_dir: &Path,
    store_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
    name: &str,
) -> Result<Vec<String>, ApiError> {
    // Capture previous BEFORE attempting — read it directly from the
    // marker so we know whether to restore on failure.
    let previous = crud::read_active_profile_name(profiles_dir)?;
    let outcome = activate_forward(
        base_dir,
        profiles_dir,
        store_dir,
        plugins_dir,
        claude_settings_path,
        name,
    );
    match outcome {
        Ok(warnings) => Ok(warnings),
        Err(err) => {
            // ActivationBlocked happens BEFORE we touch state, so no
            // restore needed. Only restore for "real" mid-flight failures.
            if !matches!(err, ApiError::ActivationBlocked { .. }) {
                if let Some(prev) = previous {
                    if prev != name {
                        let _ = activate_forward(
                            base_dir,
                            profiles_dir,
                            store_dir,
                            plugins_dir,
                            claude_settings_path,
                            &prev,
                        );
                    }
                }
            }
            Err(err)
        }
    }
}

/// Public deactivation entrypoint — caller-supplied paths so this is
/// testable without env vars.
pub fn deactivate(
    base_dir: &Path,
    profiles_dir: &Path,
    plugins_dir: &Path,
    claude_settings_path: &Path,
) -> Result<(), ApiError> {
    let Some(active) = crud::read_active_profile_name(profiles_dir)? else {
        return Ok(()); // no active profile → no-op
    };
    deactivate_internal(base_dir, profiles_dir, plugins_dir, claude_settings_path, &active)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib profiles::activation 2>&1 | tail -15`
Expected: `test result: ok. 20 passed` (18 prior + 2 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/profiles/activation.rs
git commit -m "feat(core): public activate/deactivate with auto-restore-previous on failure"
```

---

## Task 10: Wire `profiles_activate` + `profiles_deactivate` Tauri commands

**Files:**
- Modify: `packages/desktop/src-tauri/src/api/profiles.rs`

Both commands acquire the activation lock via `LockGuard` (which auto-releases on Drop). The lock is held for the duration of the operation, matching the TS try/finally pattern.

- [ ] **Step 1: Add failing smoke tests**

Open `packages/desktop/src-tauri/src/api/profiles.rs`. Inside the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn profiles_activate_returns_not_found_for_missing_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_activate("ghost".to_string());
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        // No profile → preflight throws NotFound (or empty profile dir →
        // activation_blocked branch never triggers since preflight itself
        // errors first). Either Err is acceptable; just assert non-Ok.
        assert!(r.is_err());
    }

    #[test]
    fn profiles_deactivate_is_no_op_when_no_active_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let prev = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_HOME", tmp.path());
        let r = profiles_deactivate("any-name".to_string());
        match prev {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        // No active marker → public deactivate returns Ok(()).
        assert!(r.is_ok());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml api::profiles 2>&1 | tail -10`
Expected: compile error — `profiles_activate` and `profiles_deactivate` not defined.

- [ ] **Step 3: Implement the commands**

In `packages/desktop/src-tauri/src/api/profiles.rs`, after `profiles_preflight` (and before `#[cfg(test)]`), add:

```rust
use ohmyc_core::profiles::activation;
use ohmyc_core::profiles::lock::LockGuard;

#[derive(Serialize)]
pub struct ActivateResponse {
    pub success: bool,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn profiles_activate(name: String) -> Result<ActivateResponse, ApiError> {
    let base_dir = store::base_dir()?;
    let profiles_dir = store::store_profiles_dir()?;
    let store_dir = store::store_dir()?;
    let plugins_dir = claude_home::plugins_dir()?;
    let claude_settings = claude_home::settings_path()?;
    let _guard = LockGuard::try_acquire(&profiles_dir)?;
    let warnings = activation::activate(
        &base_dir,
        &profiles_dir,
        &store_dir,
        &plugins_dir,
        &claude_settings,
        &name,
    )?;
    Ok(ActivateResponse { success: true, warnings })
}

#[tauri::command]
pub fn profiles_deactivate(_name: String) -> Result<DeleteOk, ApiError> {
    // The TS route's name path-param is informational only — deactivate
    // operates on whatever .active points at. We accept the arg for
    // wire-shape backward compat.
    let base_dir = store::base_dir()?;
    let profiles_dir = store::store_profiles_dir()?;
    let plugins_dir = claude_home::plugins_dir()?;
    let claude_settings = claude_home::settings_path()?;
    let _guard = LockGuard::try_acquire(&profiles_dir)?;
    activation::deactivate(&base_dir, &profiles_dir, &plugins_dir, &claude_settings)?;
    Ok(DeleteOk { success: true })
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml api::profiles 2>&1 | tail -10`
Expected: 4 passing (2 prior smoke + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/api/profiles.rs
git commit -m "feat(desktop): profiles_activate + profiles_deactivate tauri commands"
```

---

## Task 11: Register the 2 commands in `main.rs`

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add the registrations**

Open `packages/desktop/src-tauri/src/main.rs`. The block currently ends with `profiles_preflight` (slice 7). Insert right after that:

```rust
            ohmyc_desktop_lib::api::profiles::profiles_activate,
            ohmyc_desktop_lib::api::profiles::profiles_deactivate,
```

- [ ] **Step 2: Verify the desktop crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): register profiles_activate + profiles_deactivate"
```

---

## Task 12: Add 2 entries to `fetch.ts` URL table + POST route test

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts`

Both wires are POST with `{ name }` in the body. Server side reads from the path; transport seam passes name via body for simplicity.

- [ ] **Step 1: Map HTTP 422 → `ActivationBlocked` in the fetch error path**

Open `packages/ui/src/lib/transport/fetch.ts`. Find the error-mapping block (added in slice 6 review fix) that currently reads roughly:

```ts
    let code: string
    if (res.status === 404) {
      code = 'NotFound'
    }
    else if (res.status === 409) {
      code = (data && typeof data === 'object' && 'referencedBy' in (data as object)) ? 'ReferencedBy' : 'Conflict'
    }
    else {
      code = 'Internal'
    }
    const message = (data && typeof data === 'object' && 'error' in (data as object))
      ? String((data as { error: unknown }).error)
      : (text || res.statusText)
    throw { code, message, data }
```

Replace with a version that ALSO maps 422 → `ActivationBlocked` and lifts `missing` into `detail.missing` so it matches the Tauri wire shape (`detail: { missing: [...] }`):

```ts
    let code: string
    let detail: unknown = data
    if (res.status === 404) {
      code = 'NotFound'
    }
    else if (res.status === 409) {
      code = (data && typeof data === 'object' && 'referencedBy' in (data as object)) ? 'ReferencedBy' : 'Conflict'
    }
    else if (res.status === 422 && data && typeof data === 'object' && 'missing' in (data as object)) {
      // TS server's activation-blocked response: { error, missing: [...] }
      // Normalize to the Tauri wire shape so UI consumers can read
      // error.detail.missing regardless of transport.
      code = 'ActivationBlocked'
      detail = { missing: (data as { missing: unknown }).missing }
    }
    else {
      code = 'Internal'
    }
    const message = (data && typeof data === 'object' && 'error' in (data as object))
      ? String((data as { error: unknown }).error)
      : (text || res.statusText)
    throw { code, message, detail, data }
```

Note: `data` is preserved for backward compat with any consumer reading `error.data`; new code should read `error.detail`.

- [ ] **Step 2: Add the wire entries**

Open `packages/ui/src/lib/transport/fetch.ts`. Replace the `profiles.preflight` line (added in slice 7) so the block reads:

```ts
  'profiles.preflight': a => `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}/preflight`,
  'profiles.activate': a => ({
    url: `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}/activate`,
    method: 'POST',
    body: {},
  }),
  'profiles.deactivate': a => ({
    url: `/api/profiles/${encodeURIComponent(String(a.name ?? ''))}/deactivate`,
    method: 'POST',
    body: {},
  }),
```

- [ ] **Step 3: Add a POST route test**

Open `packages/ui/src/lib/transport/transport.test.ts`. Append at the bottom of the `describe('transport seam', ...)` block, before the closing `})`:

```ts
  it('fetch transport routes profiles.activate with POST + empty body', async () => {
    const calls: { url: string, method?: string, body?: string }[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method,
        body: init?.body as string | undefined,
      })
      return new Response(JSON.stringify({ success: true, warnings: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('profiles.activate', { name: 'dev' })
      expect(calls).toEqual([{
        url: '/api/profiles/dev/activate',
        method: 'POST',
        body: '{}',
      }])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 4: Run the transport tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/lib/transport/transport.test.ts 2>&1 | tail -15`
Expected: all transport tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(transport): wire activate/deactivate + map 422 to ActivationBlocked"
```

---

## Task 13: Migrate `useActivateProfile` + `useDeactivateProfile` off raw fetch

**Files:**
- Modify: `packages/ui/src/hooks/use-profiles.ts`

Drop the deferred-slice comment block. Replace both raw-fetch functions with `request()` calls.

- [ ] **Step 1: Replace the activation hooks block**

Open `packages/ui/src/hooks/use-profiles.ts`. Find the comment block that begins with `/** Activation hooks deferred to the follow-up...` and the two raw-fetch functions (`activateProfile`, `deactivateProfile`) that follow it.

Replace that entire block (the comment + both functions, lines 25-45-ish) with nothing — delete it.

Then find the `useActivateProfile` and `useDeactivateProfile` hooks lower in the file. Replace both with:

```ts
export function useActivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      request<{ success: boolean, warnings: string[] }>('profiles.activate', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeactivateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      request<{ success: boolean }>('profiles.deactivate', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
```

The mutation signature stays `(name: string) => ...` so the existing UI consumers (`profiles-view.tsx:215-216`, `active-profile-chip.tsx:30`, `app.tsx:45`) don't need to change.

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-profiles.ts
git commit -m "feat(ui): migrate useActivate/useDeactivate to request() (slice 7b)"
```

---

## Task 14: Extend `use-profiles.test.tsx` with activation coverage

**Files:**
- Modify: `packages/ui/src/hooks/use-profiles.test.tsx`

Add coverage for the two newly-migrated hooks, including the `ActivationBlocked` wire shape.

- [ ] **Step 1: Add the test cases**

Open `packages/ui/src/hooks/use-profiles.test.tsx`. After the existing `describe('usePreflight', ...)` block, append a new top-level describe:

```tsx
import {
  useActivateProfile,
  useCreateProfile,
  useDeactivateProfile,
  useDeleteProfile,
  usePreflight,
  useProfile,
  useProfiles,
  useUpdateProfile,
} from './use-profiles'
```

(Note: if the imports are already there in a multi-import block from slice 7, just add `useActivateProfile` and `useDeactivateProfile` to that existing block — don't add a duplicate import statement.)

Then append the new describe block at the bottom of the file:

```tsx
describe('useActivateProfile + useDeactivateProfile', () => {
  it('activate sends { name } and returns { success, warnings }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.activate', async (args) => {
      captured = args
      return { success: true, warnings: ["Settings key 'effort' would be overwritten"] }
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
    expect(result.current.data?.warnings).toHaveLength(1)
  })

  it('activate surfaces ActivationBlocked with missing-components list', async () => {
    // Real ApiError::ActivationBlocked serializes as
    //   { code: 'ActivationBlocked', detail: { missing: [...] } }
    // The UI's activation dialog reads error.detail.missing to render
    // the "missing components" list. Mirror the actual shape so this
    // test would catch a regression the way the slice-5 review would.
    setMockHandler('profiles.activate', async () => {
      throw Object.assign(new Error('activation blocked'), {
        code: 'ActivationBlocked',
        detail: { missing: ['agent:reviewer', 'skill:deploy'] },
      })
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string, detail?: { missing?: string[] } }
    expect(err.code).toBe('ActivationBlocked')
    expect(err.detail?.missing).toEqual(['agent:reviewer', 'skill:deploy'])
  })

  it('activate surfaces lock-held Conflict', async () => {
    setMockHandler('profiles.activate', async () => {
      throw Object.assign(new Error('lock held'), {
        code: 'Conflict',
        detail: 'Another activation is in progress. Wait a moment and try again.',
      })
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string, detail?: string }
    expect(err.code).toBe('Conflict')
    expect(err.detail).toContain('Another activation is in progress')
  })

  it('deactivate sends { name } and returns { success: true }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.deactivate', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeactivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
  })
})
```

- [ ] **Step 2: Run the new tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/hooks/use-profiles.test.tsx 2>&1 | tail -15`
Expected: 14 tests pass (10 prior from slice 7 + 4 new).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-profiles.test.tsx
git commit -m "test(ui): coverage for useActivate/useDeactivate incl. ActivationBlocked"
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
- core: ~24 new activation/lock/symlink/marketplace tests on top of slice 7's 197 → **~221 passing**.
- desktop: 2 new activation smoke tests on top of slice 7's 28 → **30 passing**.
- ui: 4 new use-profiles tests + 1 new transport test on top of slice 7's 176 → **~181 passing**; 3 pre-existing menubar failures remain.

- [ ] **Web bundle still builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm -r build 2>&1 | tail -10`
Expected: `Done` / no errors. The TS server is still alive (slice 8 will delete it).

- [ ] **Manual smoke test (recommended)**

After merging, in a fresh `pnpm --filter @ohmyc/desktop tauri dev` session:
1. Create a profile referencing existing store components.
2. Click activate — verify `~/.claude/settings.json` gets `enabledPlugins["profile-<name>@ohmyc-profiles"]: true` + your `env` vars.
3. Verify `~/.claude/plugins/installed_plugins.json` has the synthetic entry.
4. Verify the profile dir has agents/skills/commands symlinks pointing into `$OHMYC_HOME/store/`.
5. Deactivate — verify settings is restored, symlinks gone.
6. Activate two profiles in sequence — verify the second's settings replace the first's, not stack.

---

## Self-review notes

**Spec coverage:**
- Spec says slice 7 = "Profiles — list/get/create/update/delete/activate/deactivate/preflight." Slice 7 covered CRUD + preflight; this slice 7b finishes with **activate + deactivate**.
- All 12 numbered TS `activate` steps mapped to Rust: lock (Tauri command), preflight gate (Task 7 step 1), deactivate previous (step 4), backup (step 5), .active write (step 6), symlinks (step 7), plugin files (8-11), settings merge + env + enabledPlugins (step 12), marketplace + register (14-16).
- TS rollback semantics mirrored via typed UndoAction enum (Task 8).
- TS auto-restore-previous mirrored via the public `activate` wrapper (Task 9).

**Scope cuts documented (top of plan):**
- Windows symlink support → followup portability slice.
- TS server deletion → slice 8.
- Watcher broadening for `$OHMYC_HOME/profiles/` → slice 8.

**Type consistency:**
- `ApiError::ActivationBlocked { missing: Vec<String> }` matches TS `ActivationBlockedError { missing: string[] }` end-to-end.
- Marketplace constants: `MARKETPLACE_ID = "ohmyc-profiles"`, `plugin_id("dev") == "profile-dev@ohmyc-profiles"` — matches TS exactly.
- `ActivateResponse { success, warnings }` matches the TS route's `{ success: true, warnings: result.warnings }`.
- `DeleteOk { success }` reused from slice-7 delete command.

**Placeholder scan:** None — all code blocks complete.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-desktop-migration-slice-7b-profiles-activation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — `executing-plans` skill in this session.

Which approach?
