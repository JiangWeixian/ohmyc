# Desktop Migration — Slice 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the structural plumbing for the desktop migration: a new `ohmyc-core` Rust crate, a main window opened from the popover, and a transport seam in the frontend. Migrates zero endpoints — verifies the wiring works end-to-end.

**Architecture:** Workspace-level Cargo.toml registers a new `crates/ohmyc-core` library crate containing only `ApiError` + `claude_home::resolve()` for now. The Tauri app depends on it. A new `open_main_window` Tauri command builds a 1200×800 main window on demand. The popover gets an `Open OhMyC →` button that invokes it. The frontend gains `packages/ui/src/lib/transport.ts` which selects `tauri | fetch | mock` based on `VITE_TRANSPORT`; no hooks migrate yet.

**Tech Stack:** Rust (Tauri 2, thiserror, dirs, tempfile, rstest), TypeScript (@tauri-apps/api), Vite env vars, vitest.

---

## File Structure

**New files:**
- `Cargo.toml` (workspace root) — register `crates/ohmyc-core` and `packages/desktop/src-tauri` as workspace members.
- `crates/ohmyc-core/Cargo.toml`
- `crates/ohmyc-core/src/lib.rs`
- `crates/ohmyc-core/src/error.rs`
- `crates/ohmyc-core/src/claude_home.rs`
- `packages/desktop/src-tauri/src/windows.rs`
- `packages/ui/src/lib/transport.ts`
- `packages/ui/src/lib/transport/tauri.ts`
- `packages/ui/src/lib/transport/fetch.ts`
- `packages/ui/src/lib/transport/mock.ts`
- `packages/ui/src/lib/transport/transport.test.ts`

**Modified files:**
- `packages/desktop/src-tauri/Cargo.toml` — add `ohmyc-core` path dep.
- `packages/desktop/src-tauri/src/lib.rs` — re-export `windows` module.
- `packages/desktop/src-tauri/src/main.rs` — register `open_main_window` in `invoke_handler!`; add `Open OhMyC` menu item before `Quit`.
- `packages/ui/src/components/menubar/menubar-page.tsx` — add `Open OhMyC →` button.
- `packages/ui/src/components/menubar/menubar-page.test.tsx` — assert button presence + click invokes the command.

---

## Task 1: Create workspace root `Cargo.toml`

**Files:**
- Create: `Cargo.toml` (repo root)

- [ ] **Step 1: Create the workspace manifest**

Create `/Volumes/ORICO/Users/jiangwei/projects/claudeui/Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = [
  "crates/ohmyc-core",
  "packages/desktop/src-tauri",
]

[workspace.package]
edition = "2021"
authors = ["JiangWeixian"]
license = "MIT"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
dirs = "5"
tempfile = "3"
rstest = "0.21"
```

- [ ] **Step 2: Verify cargo recognizes the workspace**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo metadata --format-version 1 --no-deps --offline 2>&1 | head -3`
Expected: JSON output starting with `{"packages":[...]` — no error. (Crates may not yet exist; we'll add them next.)

It is OK if this errors with "no members found" — the next tasks add them. Skip if so.

- [ ] **Step 3: Commit**

```bash
git add Cargo.toml
git commit -m "chore: introduce cargo workspace root"
```

---

## Task 2: Scaffold `crates/ohmyc-core` skeleton

**Files:**
- Create: `crates/ohmyc-core/Cargo.toml`
- Create: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the crate manifest**

Create `crates/ohmyc-core/Cargo.toml`:

```toml
[package]
name = "ohmyc-core"
version = "0.1.0"
edition.workspace = true
authors.workspace = true
license.workspace = true
description = "Domain logic for OhMyC desktop: ~/.claude I/O, parsing, watchers"

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
dirs = { workspace = true }

[dev-dependencies]
tempfile = { workspace = true }
rstest = { workspace = true }
```

- [ ] **Step 2: Create the library entry point**

Create `crates/ohmyc-core/src/lib.rs`:

```rust
//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` I/O,
//! parsing, and watchers. No Tauri imports — testable standalone.

pub mod claude_home;
pub mod error;

pub use error::ApiError;
```

- [ ] **Step 3: Verify the crate builds (will fail — referenced modules missing)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-core 2>&1 | tail -5`
Expected: errors like `file not found for module 'claude_home'` and `'error'`. Next tasks add them.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/Cargo.toml crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): scaffold ohmyc-core crate"
```

---

## Task 3: Implement `ApiError` enum (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/error.rs`

- [ ] **Step 1: Write the failing tests**

Create `crates/ohmyc-core/src/error.rs`:

```rust
//! Canonical error type returned by every ohmyc-core operation.
//! Serializes to a stable JSON shape consumed by the frontend
//! transport layer.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "detail")]
pub enum ApiError {
    #[error("not found: {kind} '{name}'")]
    NotFound { kind: &'static str, name: String },

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("parse error: {0}")]
    Parse(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for ApiError {
    fn from(value: std::io::Error) -> Self {
        ApiError::Io(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_serializes_with_code_and_detail() {
        let err = ApiError::NotFound { kind: "profile", name: "missing".to_string() };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "NotFound");
        assert_eq!(json["detail"]["kind"], "profile");
        assert_eq!(json["detail"]["name"], "missing");
    }

    #[test]
    fn invalid_input_serializes_with_string_detail() {
        let err = ApiError::InvalidInput("missing field".to_string());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "InvalidInput");
        assert_eq!(json["detail"], "missing field");
    }

    #[test]
    fn io_error_converts_via_from() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let api_err: ApiError = io_err.into();
        match api_err {
            ApiError::Io(msg) => assert!(msg.contains("no such file")),
            _ => panic!("expected ApiError::Io"),
        }
    }

    #[test]
    fn display_includes_variant_specific_message() {
        let err = ApiError::Conflict("already active".to_string());
        assert_eq!(format!("{err}"), "conflict: already active");
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib error 2>&1 | tail -15`
Expected: `test result: ok. 4 passed; 0 failed`. (Note: `claude_home` module is still missing — Task 4 fixes that. If the build errors on missing `claude_home`, temporarily comment its `pub mod` line in `lib.rs` to run these tests, then restore.)

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/error.rs
git commit -m "feat(core): add ApiError with stable serialized shape"
```

---

## Task 4: Implement `claude_home` resolver (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/claude_home.rs`

- [ ] **Step 1: Write the failing tests + implementation together**

Create `crates/ohmyc-core/src/claude_home.rs`:

```rust
//! Resolves the on-disk root that the OhMyC backend reads from.
//! Default: `$HOME/.claude`. Overridable via `OHMYC_CLAUDE_HOME` for
//! tests and for users with a non-standard layout.

use std::path::{Path, PathBuf};

use crate::error::ApiError;

const ENV_OVERRIDE: &str = "OHMYC_CLAUDE_HOME";

/// Resolve the active claude-home directory.
///
/// Lookup order:
/// 1. `OHMYC_CLAUDE_HOME` env var (if set and non-empty)
/// 2. `$HOME/.claude`
///
/// Returns `ApiError::Internal` if no home dir can be determined.
pub fn resolve() -> Result<PathBuf, ApiError> {
    if let Ok(override_path) = std::env::var(ENV_OVERRIDE) {
        if !override_path.is_empty() {
            return Ok(PathBuf::from(override_path));
        }
    }
    let home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(home.join(".claude"))
}

/// Resolve a path relative to claude-home.
pub fn join<P: AsRef<Path>>(rel: P) -> Result<PathBuf, ApiError> {
    Ok(resolve()?.join(rel))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // The env var is process-global; serialize tests that mutate it.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env<F: FnOnce()>(key: &str, value: Option<&str>, f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(key).ok();
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
        f();
        match prev {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }

    #[test]
    fn resolve_uses_env_override_when_set() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = resolve().unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude"));
        });
    }

    #[test]
    fn resolve_falls_back_to_home_dot_claude_when_env_unset() {
        with_env(ENV_OVERRIDE, None, || {
            let path = resolve().unwrap();
            assert!(path.ends_with(".claude"));
        });
    }

    #[test]
    fn resolve_ignores_empty_env_var() {
        with_env(ENV_OVERRIDE, Some(""), || {
            let path = resolve().unwrap();
            assert!(path.ends_with(".claude"));
        });
    }

    #[test]
    fn join_concatenates_relative_path() {
        with_env(ENV_OVERRIDE, Some("/tmp/fake-claude"), || {
            let path = join("profiles/default.yaml").unwrap();
            assert_eq!(path, PathBuf::from("/tmp/fake-claude/profiles/default.yaml"));
        });
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib claude_home 2>&1 | tail -15`
Expected: `test result: ok. 4 passed; 0 failed`.

- [ ] **Step 3: Run the full crate test suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core 2>&1 | tail -15`
Expected: `test result: ok. 8 passed; 0 failed` (4 from error + 4 from claude_home).

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/claude_home.rs
git commit -m "feat(core): add claude_home::resolve with OHMYC_CLAUDE_HOME override"
```

---

## Task 5: Wire `ohmyc-core` into the Tauri crate

**Files:**
- Modify: `packages/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Update Tauri Cargo.toml**

Replace the entire contents of `packages/desktop/src-tauri/Cargo.toml` with:

```toml
[package]
name = "ohmyc-desktop"
version = "0.1.0"
description = "OhMyC menu bar app"
authors.workspace = true
edition.workspace = true

[lib]
name = "ohmyc_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }
serde = { workspace = true }
serde_json = { workspace = true }
ohmyc-core = { path = "../../../crates/ohmyc-core" }

[target."cfg(target_os = \"macos\")".dependencies]
window-vibrancy = "0.5"

[dev-dependencies]
tauri = { version = "2", features = ["test"] }
```

- [ ] **Step 2: Verify the workspace builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --workspace 2>&1 | tail -5`
Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/Cargo.toml
git commit -m "chore(desktop): depend on ohmyc-core via workspace path"
```

---

## Task 6: Add `open_main_window` Tauri command (TDD-light)

**Files:**
- Create: `packages/desktop/src-tauri/src/windows.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create the windows module**

Create `packages/desktop/src-tauri/src/windows.rs`:

```rust
//! Main window construction and visibility commands.
//!
//! The main window is built on demand by the `open_main_window` command —
//! it is not declared in `tauri.conf.json`, because the popover should be
//! the only auto-built window at launch.

use tauri::{LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

pub const MAIN_LABEL: &str = "main";
const DEFAULT_WIDTH: f64 = 1200.0;
const DEFAULT_HEIGHT: f64 = 800.0;

/// Show the main window. Builds it on first call; brings it to front on
/// subsequent calls.
#[tauri::command]
pub fn open_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(MAIN_LABEL) {
        existing.show().map_err(|e| e.to_string())?;
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, MAIN_LABEL, WebviewUrl::App("index.html".into()))
        .title("OhMyC")
        .inner_size(DEFAULT_WIDTH, DEFAULT_HEIGHT)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_size_constants_are_sane() {
        assert_eq!(DEFAULT_WIDTH, 1200.0);
        assert_eq!(DEFAULT_HEIGHT, 800.0);
    }

    #[test]
    fn main_label_is_stable() {
        // Frontend invokes by this label; changing it is a breaking change.
        assert_eq!(MAIN_LABEL, "main");
        // LogicalSize must remain accessible for future tweaks.
        let _ = LogicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    }
}
```

- [ ] **Step 2: Re-export the module from `lib.rs`**

Open `packages/desktop/src-tauri/src/lib.rs`, replace its contents with:

```rust
pub mod popover;
pub mod tray;
pub mod windows;
```

- [ ] **Step 3: Verify the crate still builds + tests pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-desktop --lib 2>&1 | tail -10`
Expected: `test result: ok` with the existing tests plus the 2 new ones.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/windows.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add open_main_window command"
```

---

## Task 7: Register `open_main_window` + add tray menu item

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Update `invoke_handler!` to include the new command**

In `packages/desktop/src-tauri/src/main.rs`, find:

```rust
        .invoke_handler(tauri::generate_handler![hide_popover])
```

Replace with:

```rust
        .invoke_handler(tauri::generate_handler![
            hide_popover,
            ohmyc_desktop_lib::windows::open_main_window,
        ])
```

- [ ] **Step 2: Add `Open OhMyC` menu item before `Quit`**

Find the block that constructs `quit_item` and `menu`:

```rust
            let quit_item = MenuItem::with_id(
                app,
                TrayMenuId::Quit.as_str(),
                "Quit OhMyC",
                true,
                Some("CmdOrCtrl+Q"),
            )?;
            let menu = Menu::with_items(app, &[&quit_item])?;
```

Replace with:

```rust
            let open_item = MenuItem::with_id(
                app,
                TrayMenuId::OpenMain.as_str(),
                "Open OhMyC",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let quit_item = MenuItem::with_id(
                app,
                TrayMenuId::Quit.as_str(),
                "Quit OhMyC",
                true,
                Some("CmdOrCtrl+Q"),
            )?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;
```

- [ ] **Step 3: Update the menu event handler**

Find:

```rust
                .on_menu_event(|app, event| {
                    if let Some(TrayMenuId::Quit) = TrayMenuId::from_id(event.id.as_ref()) {
                        app.exit(0);
                    }
                })
```

Replace with:

```rust
                .on_menu_event(|app, event| {
                    match TrayMenuId::from_id(event.id.as_ref()) {
                        Some(TrayMenuId::Quit) => app.exit(0),
                        Some(TrayMenuId::OpenMain) => {
                            let _ = ohmyc_desktop_lib::windows::open_main_window(app.clone());
                        }
                        None => {}
                    }
                })
```

- [ ] **Step 4: Extend `TrayMenuId` enum**

Open `packages/desktop/src-tauri/src/tray.rs`. Find the `TrayMenuId` enum and its `as_str` / `from_id` impls. Add an `OpenMain` variant. The file currently looks roughly like:

```rust
pub enum TrayMenuId { Quit }
impl TrayMenuId {
    pub fn as_str(&self) -> &'static str { match self { Self::Quit => "quit" } }
    pub fn from_id(id: &str) -> Option<Self> { match id { "quit" => Some(Self::Quit), _ => None } }
}
```

Replace those with:

```rust
pub enum TrayMenuId {
    Quit,
    OpenMain,
}

impl TrayMenuId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Quit => "quit",
            Self::OpenMain => "open-main",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "quit" => Some(Self::Quit),
            "open-main" => Some(Self::OpenMain),
            _ => None,
        }
    }
}
```

If the existing `tray.rs` has tests for `TrayMenuId`, update them to cover `OpenMain` similarly. Run the existing test file once and adjust to keep parity:

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-desktop --lib tray 2>&1 | tail -10`

- [ ] **Step 5: Verify build + tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build --workspace && cargo test --workspace 2>&1 | tail -10`
Expected: `Finished` and all tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs packages/desktop/src-tauri/src/tray.rs
git commit -m "feat(desktop): register open_main_window + tray menu item"
```

---

## Task 8: Create the frontend transport seam (TDD)

**Files:**
- Create: `packages/ui/src/lib/transport.ts`
- Create: `packages/ui/src/lib/transport/tauri.ts`
- Create: `packages/ui/src/lib/transport/fetch.ts`
- Create: `packages/ui/src/lib/transport/mock.ts`
- Create: `packages/ui/src/lib/transport/transport.test.ts`

- [ ] **Step 1: Write the test first**

Create `packages/ui/src/lib/transport/transport.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'

import { resetMock, setMockHandler } from './mock'
import { __setTransportForTests, request, resetTransportForTests } from '../transport'

describe('transport seam', () => {
  afterEach(() => {
    resetMock()
    resetTransportForTests()
  })

  it('routes wire name to mock handler in tests', async () => {
    setMockHandler('profiles.list', async () => [{ name: 'default' }])
    __setTransportForTests('mock')

    const result = await request<Array<{ name: string }>>('profiles.list', {})

    expect(result).toEqual([{ name: 'default' }])
  })

  it('propagates handler arguments to the mock', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return []
    })
    __setTransportForTests('mock')

    await request('timeline.heatmap', { year: 2026, metric: 'tokens' })

    expect(captured).toEqual({ year: 2026, metric: 'tokens' })
  })

  it('rejects with ApiError shape when handler throws', async () => {
    setMockHandler('profiles.get', async () => {
      throw Object.assign(new Error('missing'), {
        code: 'NotFound',
        detail: { kind: 'profile', name: 'x' },
      })
    })
    __setTransportForTests('mock')

    await expect(request('profiles.get', { name: 'x' })).rejects.toMatchObject({
      code: 'NotFound',
      message: 'missing',
      detail: { kind: 'profile', name: 'x' },
    })
  })

  it('throws when no handler is registered for a wire name', async () => {
    __setTransportForTests('mock')

    await expect(request('unknown.op', {})).rejects.toMatchObject({
      code: 'Internal',
    })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -10`
Expected: failures — module not found.

- [ ] **Step 3: Create the mock transport**

Create `packages/ui/src/lib/transport/mock.ts`:

```ts
import type { Transport } from '../transport'

type Handler = (args: unknown) => Promise<unknown>

const handlers = new Map<string, Handler>()

export function setMockHandler(wire: string, handler: Handler): void {
  handlers.set(wire, handler)
}

export function resetMock(): void {
  handlers.clear()
}

export const mockTransport: Transport = async (wire, args) => {
  const handler = handlers.get(wire)
  if (!handler) {
    throw { code: 'Internal', message: `no mock handler registered for '${wire}'` }
  }
  try {
    return await handler(args)
  }
  catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string, message?: string, detail?: unknown }
      throw { code: e.code, message: e.message ?? '', detail: e.detail }
    }
    throw { code: 'Internal', message: err instanceof Error ? err.message : String(err) }
  }
}
```

- [ ] **Step 4: Create the Tauri transport**

Create `packages/ui/src/lib/transport/tauri.ts`:

```ts
import { invoke } from '@tauri-apps/api/core'

import type { Transport } from '../transport'

export const tauriTransport: Transport = async (wire, args) => {
  const cmd = wire.replace(/\./g, '_')
  try {
    return await invoke(cmd, (args ?? {}) as Record<string, unknown>)
  }
  catch (raw) {
    // Tauri command errors that already match { code, ... } pass through;
    // otherwise wrap as Internal so the caller sees a stable shape.
    if (raw && typeof raw === 'object' && 'code' in raw) {
      const e = raw as { code: string, message?: string, detail?: unknown }
      throw { code: e.code, message: e.message ?? '', detail: e.detail }
    }
    throw { code: 'Internal', message: typeof raw === 'string' ? raw : JSON.stringify(raw) }
  }
}
```

- [ ] **Step 5: Create the fetch transport**

Create `packages/ui/src/lib/transport/fetch.ts`:

```ts
import type { Transport } from '../transport'

// Wire names map to /api paths by replacing '.' with '/'.
// e.g. 'timeline.heatmap' -> '/api/timeline/heatmap'.
//
// This implementation is intentionally simple — full per-endpoint
// HTTP semantics (method, query vs. body) are out of scope for the
// foundations slice. Endpoint slices add their own routing as they
// migrate from fetch to invoke. For now this is registered but no
// hook uses it via the seam yet.

export const fetchTransport: Transport = async (wire, args) => {
  const path = `/api/${wire.replace(/\./g, '/')}`
  const url = args && Object.keys(args as object).length > 0
    ? `${path}?${new URLSearchParams(args as Record<string, string>).toString()}`
    : path
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  return res.json()
}
```

- [ ] **Step 6: Create the transport entry**

Create `packages/ui/src/lib/transport.ts`:

```ts
import { fetchTransport } from './transport/fetch'
import { mockTransport } from './transport/mock'
import { tauriTransport } from './transport/tauri'

export type Transport = (wire: string, args?: unknown) => Promise<unknown>

export interface ApiError {
  code: string
  message: string
  detail?: unknown
}

type TransportName = 'tauri' | 'fetch' | 'mock'

function pickFromEnv(): TransportName {
  // Vite injects VITE_TRANSPORT at build time. Default is 'fetch' for the
  // legacy web dev loop; the Tauri build sets VITE_TRANSPORT=tauri in
  // packages/desktop. Tests override via __setTransportForTests.
  const raw = (import.meta.env?.VITE_TRANSPORT ?? 'fetch') as string
  if (raw === 'tauri' || raw === 'mock') {
    return raw
  }
  return 'fetch'
}

let active: TransportName = pickFromEnv()

function resolve(name: TransportName): Transport {
  switch (name) {
    case 'tauri': return tauriTransport
    case 'mock': return mockTransport
    case 'fetch': return fetchTransport
  }
}

export async function request<T>(wire: string, args?: unknown): Promise<T> {
  return resolve(active)(wire, args) as Promise<T>
}

/** Test-only: swap the active transport. */
export function __setTransportForTests(name: TransportName): void {
  active = name
}

/** Test-only: restore env-derived selection. */
export function resetTransportForTests(): void {
  active = pickFromEnv()
}
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: `Test Files  1 passed (1)` and 4 tests passing.

- [ ] **Step 8: Verify the full UI test suite still passes**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass (existing 121 + 4 new).

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/lib/transport.ts packages/ui/src/lib/transport/
git commit -m "feat(ui): add transport seam (tauri/fetch/mock) with env selection"
```

---

## Task 9: Configure `VITE_TRANSPORT` for desktop build

**Files:**
- Modify: `packages/desktop/vite.config.ts`

- [ ] **Step 1: Read the current desktop vite config**

Open `packages/desktop/vite.config.ts`. Find the `defineConfig({ ... })` block.

- [ ] **Step 2: Inject `VITE_TRANSPORT=tauri` via `define`**

Add a `define` entry inside `defineConfig({ ... })`:

```ts
define: {
  'import.meta.env.VITE_TRANSPORT': JSON.stringify('tauri'),
},
```

If a `define` key already exists, merge the new entry in.

- [ ] **Step 3: Verify the desktop build picks up the variable**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/desktop && pnpm build 2>&1 | tail -5`
Expected: build succeeds. (We're not asserting the value here — Task 10's smoke test catches that.)

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/vite.config.ts
git commit -m "chore(desktop): set VITE_TRANSPORT=tauri at build time"
```

---

## Task 10: Add "Open OhMyC →" button to the popover (TDD)

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-page.test.tsx`

- [ ] **Step 1: Add the failing test**

Open `packages/ui/src/components/menubar/menubar-page.test.tsx`. At the top, add:

```ts
import { fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => undefined),
}))
```

(If `vi` is already imported, just add `fireEvent` and the `vi.mock` block.)

Inside the existing `describe('MenubarPage', () => { ... })` block (find it by searching for `describe('MenubarPage'` or similar), add:

```ts
it('renders an Open OhMyC button that invokes open_main_window then hide_popover', async () => {
  const { invoke } = await import('@tauri-apps/api/core')
  ;(invoke as ReturnType<typeof vi.fn>).mockClear()

  const { findByRole } = render(<MenubarPage />)
  const button = await findByRole('button', { name: /open ohmyc/i })

  fireEvent.click(button)

  // Two invokes fire in order: open_main_window, then hide_popover.
  const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
  expect(calls).toEqual(['open_main_window', 'hide_popover'])
})
```

If the existing test file imports `MenubarPage` from a different path, mirror its style. If there is no `describe('MenubarPage')` block, find whichever describe wraps the existing menubar-page tests and add the `it` there.

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- menubar-page.test.tsx 2>&1 | tail -15`
Expected: failure — no button with text "Open OhMyC".

- [ ] **Step 3: Add the button to MenubarPage**

Open `packages/ui/src/components/menubar/menubar-page.tsx`. At the top of the file, add to the imports:

```tsx
import { invoke } from '@tauri-apps/api/core'
```

Find the closing `</div>` of the outer `<div data-menubar-page>` (the wrapper around header + chart + footer). Just before that closing tag, after the footer `<div>` that renders `footerMeta`, add:

```tsx
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            await invoke('open_main_window')
            await invoke('hide_popover')
          }}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
        >
          Open OhMyC →
        </button>
      </div>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- menubar-page.test.tsx 2>&1 | tail -15`
Expected: all tests in the file pass, including the new one.

- [ ] **Step 5: Run the full UI suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-page.test.tsx
git commit -m "feat(menubar): add Open OhMyC button that opens main window"
```

---

## Task 11: Manual smoke test

**Files:** none

- [ ] **Step 1: Start the desktop app**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/desktop tauri dev`
(or whatever the existing `tauri dev` script name is — check `packages/desktop/package.json` for the exact alias.)

Wait for the Rust build to finish and the popover to be reachable from the tray icon.

- [ ] **Step 2: Verify the popover renders the new button**

Click the tray icon. The popover should open with the chart, the footer ("peak ..." line), and a new right-aligned `Open OhMyC →` button below the footer.

Expected: button visible, monochrome style matches the footer text. No layout shift, popover height fits without scrolling.

- [ ] **Step 3: Click `Open OhMyC →` and verify the main window opens**

Click the button.

Expected:
- A new 1200×800 window opens titled "OhMyC".
- The popover hides.
- The main window shows the existing React app (Profiles route by default per DESIGN.md).

- [ ] **Step 4: Verify the main window persists across popover toggles**

Click the tray icon to reopen the popover. The popover renders. Click `Open OhMyC →` again.

Expected: the existing main window comes to front (no second window). Popover hides.

- [ ] **Step 5: Verify the tray menu item works**

Right-click the tray icon. A menu appears with `Open OhMyC` above `Quit`. Click `Open OhMyC`.

Expected: the main window comes to front. (If it was closed, a new one opens.)

- [ ] **Step 6: Close the main window and verify the app stays alive**

Close the main window via its red close button. The tray icon should remain. Click the tray icon — the popover still opens. Click `Open OhMyC →` — a fresh main window builds.

Expected: closing the window does not quit the app.

- [ ] **Step 7: Quit and re-launch sanity check**

Right-click tray → `Quit`. App exits cleanly. Re-launch with `pnpm --filter @ohmyc/desktop tauri dev` — popover opens normally, no startup errors in console.

- [ ] **Step 8: If anything failed, note which step and report back**

Do not mark this task complete until all 7 steps pass.

---

## Done criteria for Slice 1

- `cargo test --workspace` green.
- `pnpm -r test` green.
- `pnpm -r build` green.
- `pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin` produces a binary.
- Manual smoke test (Task 11) passes all 7 steps.
- No endpoint hooks have changed yet — `packages/ui/src/hooks/*.ts` still call `fetch()` directly. That is correct for this slice; endpoint migration starts in Slice 2 (Timeline).

---

## What this slice does NOT do (intentional)

- Does not migrate any hook off `fetch()` — the transport seam exists but no hook consumes it yet. Slice 2 (Timeline) is the first hook to flip.
- Does not implement `events.rs` or fs watchers — they land with the first endpoint that needs them (Timeline).
- Does not delete any CLI server code — every TS endpoint stays alive until its hook flips.
- Does not validate the main window's actual UI quality (router renders, scroll behavior, etc.) — that's an existing surface, unchanged. Smoke test only verifies the window opens.
