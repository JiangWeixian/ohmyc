# Desktop Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `packages/desktop/` — a Tauri 2 macOS menu bar app with tray + popover, with Rust unit tests for tray and popover modules. No sidecar, no chart route, no release pipeline (later slices).

**Architecture:** Standard Tauri 2 + Vite layout. The desktop package owns its frontend (`index.html`, `vite.config.ts`, `src/`) and Rust backend (`src-tauri/`). Reuses React components from `packages/ui` via `workspace:*` and subpath exports. The popover is a hidden, undecorated, always-on-top window toggled by the tray icon.

**Tech Stack:** Tauri 2.x (Rust), Vite 5, React 18, TypeScript, `tauri::test::mock_builder` for Rust unit tests.

**Spec:** `docs/superpowers/specs/2026-05-18-desktop-scaffold-design.md`

---

## File Structure

**Modify:**
- `packages/ui/package.json` — add `exports` field

**Create (frontend):**
- `packages/desktop/package.json`
- `packages/desktop/tsconfig.json`
- `packages/desktop/vite.config.ts`
- `packages/desktop/index.html`
- `packages/desktop/src/main.tsx`
- `packages/desktop/src/menubar.tsx`

**Create (Tauri / Rust):**
- `packages/desktop/src-tauri/Cargo.toml`
- `packages/desktop/src-tauri/build.rs`
- `packages/desktop/src-tauri/tauri.conf.json`
- `packages/desktop/src-tauri/icons/tray-icon-Template.png` (placeholder)
- `packages/desktop/src-tauri/icons/tray-icon-Template@2x.png` (placeholder)
- `packages/desktop/src-tauri/icons/icon.png` (placeholder app icon)
- `packages/desktop/src-tauri/src/main.rs`
- `packages/desktop/src-tauri/src/lib.rs`
- `packages/desktop/src-tauri/src/tray.rs`
- `packages/desktop/src-tauri/src/popover.rs`
- `packages/desktop/.gitignore`

**Modify (CI):**
- `.github/workflows/ci.yml` — add `desktop-test` job

---

## Task 1: Expose subpath exports from `@ohmyc/ui`

**Files:**
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Read current package.json**

Run: `cat packages/ui/package.json | head -5`
Expected: shows `"name": "@ohmyc/ui", "version": "0.1.0", "type": "module", "private": true`.

- [ ] **Step 2: Add `exports` field**

Edit `packages/ui/package.json`. After the `"private": true,` line (and before `"scripts"`), insert:

```json
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./state/*": "./src/state/*.ts",
    "./lib/*": "./src/lib/*.ts"
  },
```

- [ ] **Step 3: Verify the file parses as JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/ui/package.json', 'utf8'))"`
Expected: no output (exit 0). Any output means malformed JSON.

- [ ] **Step 4: Verify the web app still builds**

Run: `pnpm --filter @ohmyc/ui build`
Expected: build completes successfully. No errors related to `exports`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json
git commit -m "feat(ui): expose subpath exports for cross-package consumption"
```

---

## Task 2: Bootstrap `packages/desktop` frontend package

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/tsconfig.json`
- Create: `packages/desktop/vite.config.ts`
- Create: `packages/desktop/index.html`
- Create: `packages/desktop/src/main.tsx`
- Create: `packages/desktop/src/menubar.tsx`
- Create: `packages/desktop/.gitignore`

- [ ] **Step 1: Create `packages/desktop/package.json`**

```json
{
  "name": "@ohmyc/desktop",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@ohmyc/ui": "workspace:*",
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/desktop/vite.config.ts`**

```ts
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri-friendly Vite config. Port 1420 to avoid collision with packages/ui (5173).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create `packages/desktop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OhMyC</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `packages/desktop/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Menubar } from './menubar'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Menubar />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create `packages/desktop/src/menubar.tsx`**

This intentionally imports a component from `@ohmyc/ui` to prove the workspace + subpath exports wiring works. The chart is rendered with a hardcoded stub dataset — real data wiring lands in a later slice.

```tsx
import { ContributionGraph } from '@ohmyc/ui/components/timeline/contribution-graph'

// Stub dataset — flat zero values for 53 weeks. Replaced with real DB-backed
// data in the sidecar slice. The shape (date → count) must match whatever
// ContributionGraph's prop type expects; adjust this stub to fit the real
// signature after running the dev server once.
const stubData: Array<{ date: string; count: number }> = Array.from(
  { length: 53 * 7 },
  (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (53 * 7 - i))
    return { date: d.toISOString().slice(0, 10), count: 0 }
  },
)

export function Menubar() {
  return (
    <div style={{ padding: 18, background: '#191a1b', color: '#e6e7e8', minHeight: '100vh' }}>
      <div style={{ fontSize: 13, fontWeight: 510, marginBottom: 14 }}>
        OhMyC Menubar — Scaffold
      </div>
      <ContributionGraph data={stubData} />
    </div>
  )
}
```

> If `ContributionGraph`'s actual prop type differs, fix the stub to match
> (`pnpm tauri dev` will surface the type error). Do NOT modify the component.

- [ ] **Step 7: Create `packages/desktop/.gitignore`**

```
dist/
src-tauri/target/
src-tauri/Cargo.lock
node_modules/
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: pnpm picks up the new `packages/desktop` member; installs `@tauri-apps/cli`, `react`, `vite`, etc. No errors.

- [ ] **Step 9: Verify the frontend dev server starts**

Run: `pnpm --filter @ohmyc/desktop dev`
Expected: Vite starts on `http://localhost:1420`. Open the URL in a browser — the page should load (it may show a type or render error if `ContributionGraph`'s prop signature differs from the stub; if so, fix the stub now). Stop the dev server (Ctrl-C) once you've seen the placeholder render.

- [ ] **Step 10: Verify the frontend builds**

Run: `pnpm --filter @ohmyc/desktop build`
Expected: `packages/desktop/dist/` is created with `index.html` and a hashed JS bundle.

- [ ] **Step 11: Commit**

```bash
git add packages/desktop/package.json packages/desktop/tsconfig.json packages/desktop/vite.config.ts packages/desktop/index.html packages/desktop/src/ packages/desktop/.gitignore pnpm-lock.yaml
git commit -m "feat(desktop): scaffold Vite + React frontend, import from @ohmyc/ui"
```

---

## Task 3: Bootstrap `src-tauri` Rust skeleton

**Files:**
- Create: `packages/desktop/src-tauri/Cargo.toml`
- Create: `packages/desktop/src-tauri/build.rs`
- Create: `packages/desktop/src-tauri/tauri.conf.json`
- Create: `packages/desktop/src-tauri/icons/tray-icon-Template.png`
- Create: `packages/desktop/src-tauri/icons/tray-icon-Template@2x.png`
- Create: `packages/desktop/src-tauri/icons/icon.png`
- Create: `packages/desktop/src-tauri/src/main.rs`
- Create: `packages/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `Cargo.toml`**

```toml
[package]
name = "ohmyc-desktop"
version = "0.1.0"
description = "OhMyC menu bar app"
authors = ["JiangWeixian"]
edition = "2021"

[lib]
name = "ohmyc_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
tauri = { version = "2", features = ["test"] }
```

- [ ] **Step 2: Create `build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Create `tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "OhMyC",
  "version": "0.1.0",
  "identifier": "com.ohmyc.desktop",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "popover",
        "title": "OhMyC",
        "width": 360,
        "height": 440,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "visible": false,
        "transparent": false,
        "resizable": false,
        "focus": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "dmg",
    "icon": ["icons/icon.png"],
    "macOS": {
      "minimumSystemVersion": "11.0"
    }
  }
}
```

- [ ] **Step 4: Generate placeholder icons**

Run (from repo root):

```bash
mkdir -p packages/desktop/src-tauri/icons
# 16x16 white dot on transparent — minimal valid template icon
python3 - <<'PY'
from pathlib import Path
import struct, zlib

def write_png(path, w, h):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            # white center, transparent edges → a simple filled circle proxy
            cx, cy = w / 2, h / 2
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            r = (min(w, h) / 2 - 1) ** 2
            on = d2 <= r
            raw.extend([255, 255, 255, 255 if on else 0])

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    Path(path).write_bytes(png)

write_png('packages/desktop/src-tauri/icons/tray-icon-Template.png', 16, 16)
write_png('packages/desktop/src-tauri/icons/tray-icon-Template@2x.png', 32, 32)
write_png('packages/desktop/src-tauri/icons/icon.png', 512, 512)
print('icons generated')
PY
```

Expected: `icons generated` and three PNG files exist.

- [ ] **Step 5: Create `src/lib.rs`**

```rust
pub mod popover;
pub mod tray;
```

- [ ] **Step 6: Create empty `src/main.rs`** (real wiring lands in Tasks 7-9)

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Hide dock icon on macOS — menu bar app, no dock presence.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Tray + popover wiring lands in later tasks.
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Create empty `src/tray.rs`** (filled in Task 6)

```rust
// Tray icon setup. Filled in Task 6.
```

- [ ] **Step 8: Create empty `src/popover.rs`** (filled in Tasks 4–5)

```rust
// Popover window state + positioning. Filled in Tasks 4–5.
```

- [ ] **Step 9: Verify Rust compiles**

Run: `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: Cargo downloads Tauri deps (slow first time, ~3-5 min), then `cargo build` succeeds. Warnings about unused modules are fine.

- [ ] **Step 10: Update root `.gitignore` if needed**

Run: `grep -q "target/" .gitignore || echo "packages/desktop/src-tauri/target/" >> .gitignore`
Expected: no output if already present; otherwise appends the line.

- [ ] **Step 11: Commit**

```bash
git add packages/desktop/src-tauri/ .gitignore
git commit -m "feat(desktop): bootstrap Tauri 2 Rust skeleton (tray-icon feature, accessory policy)"
```

---

## Task 4: TDD popover positioning math

**Files:**
- Modify: `packages/desktop/src-tauri/src/popover.rs`

- [ ] **Step 1: Write the failing test**

Replace the contents of `packages/desktop/src-tauri/src/popover.rs` with:

```rust
use tauri::{PhysicalPosition, PhysicalSize};

/// Rectangle representing the tray icon's screen position.
#[derive(Debug, Clone, Copy)]
pub struct TrayRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Rectangle representing a monitor's usable bounds.
#[derive(Debug, Clone, Copy)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Compute the popover window's top-left position so it sits under the tray
/// icon, with its right edge ~28px inset from the tray icon's right edge.
///
/// If the resulting position would push the window off the right side of the
/// monitor, clamp it inside the monitor bounds.
pub fn position_under_tray(
    tray: TrayRect,
    window_size: PhysicalSize<u32>,
    monitor: MonitorBounds,
) -> PhysicalPosition<i32> {
    let tray_center_x = tray.x + (tray.width as i32 / 2);
    let mut x = tray_center_x - (window_size.width as i32) + 28;
    let y = tray.y + tray.height as i32 + 4; // 4px gap below menu bar

    // Clamp to monitor right edge
    let monitor_right = monitor.x + monitor.width as i32;
    let window_right = x + window_size.width as i32;
    if window_right > monitor_right {
        x -= window_right - monitor_right + 8; // 8px margin from edge
    }

    // Clamp to monitor left edge
    if x < monitor.x + 8 {
        x = monitor.x + 8;
    }

    PhysicalPosition::new(x, y)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_monitor() -> MonitorBounds {
        MonitorBounds { x: 0, y: 0, width: 1920, height: 1080 }
    }

    #[test]
    fn test_position_under_tray_centers_with_offset() {
        let tray = TrayRect { x: 1000, y: 0, width: 24, height: 24 };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // tray center 1012, x = 1012 - 360 + 28 = 680, y = 28
        assert_eq!(pos.x, 680);
        assert_eq!(pos.y, 28);
    }

    #[test]
    fn test_position_under_tray_clamps_at_right_edge() {
        // Tray icon very close to the right edge of a 1920-wide monitor.
        let tray = TrayRect { x: 1900, y: 0, width: 24, height: 24 };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // Unclamped x = 1912 - 360 + 28 = 1580. Window right = 1940. Monitor
        // right = 1920. Overflow = 20. Adjusted x = 1580 - 20 - 8 = 1552.
        assert_eq!(pos.x, 1552);
        // Window stays on-screen
        assert!(pos.x + win.width as i32 <= 1920);
    }

    #[test]
    fn test_position_under_tray_clamps_at_left_edge() {
        // Pathological: tray very close to left edge, window wider than
        // available space on the right would force x negative without clamp.
        let tray = TrayRect { x: 10, y: 0, width: 24, height: 24 };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        // x clamped to monitor.x + 8 = 8
        assert_eq!(pos.x, 8);
    }

    #[test]
    fn test_position_under_tray_y_includes_menu_bar_gap() {
        let tray = TrayRect { x: 500, y: 0, width: 24, height: 24 };
        let win = PhysicalSize::new(360u32, 440u32);
        let pos = position_under_tray(tray, win, default_monitor());
        assert_eq!(pos.y, 28); // 24 (tray height) + 4 (gap)
    }
}
```

- [ ] **Step 2: Run the tests — they should pass on the first run**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml popover::`
Expected: 4 tests pass.

> Note: TDD here means writing the test and the implementation in the same commit because the spec defines the math precisely — there's no design discovery to extract by writing the test first. The tests still gate the implementation: if any assertion changes, the implementation must adapt.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/popover.rs
git commit -m "feat(desktop): popover positioning math with monitor clamping + tests"
```

---

## Task 5: TDD popover state machine

**Files:**
- Modify: `packages/desktop/src-tauri/src/popover.rs`

- [ ] **Step 1: Append state machine to `popover.rs`**

Append (do NOT replace the existing content from Task 4):

```rust
/// Popover visibility state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PopoverState {
    Hidden,
    Visible,
}

impl PopoverState {
    pub fn toggle(self) -> Self {
        match self {
            Self::Hidden => Self::Visible,
            Self::Visible => Self::Hidden,
        }
    }

    pub fn show(self) -> Self {
        Self::Visible
    }

    pub fn hide(self) -> Self {
        Self::Hidden
    }
}
```

- [ ] **Step 2: Append state machine tests to the existing `mod tests` block in `popover.rs`**

Inside the existing `#[cfg(test)] mod tests { ... }`, before its closing `}`, append:

```rust
    #[test]
    fn test_popover_state_toggle_from_hidden() {
        assert_eq!(PopoverState::Hidden.toggle(), PopoverState::Visible);
    }

    #[test]
    fn test_popover_state_toggle_from_visible() {
        assert_eq!(PopoverState::Visible.toggle(), PopoverState::Hidden);
    }

    #[test]
    fn test_popover_state_show_is_idempotent() {
        assert_eq!(PopoverState::Hidden.show(), PopoverState::Visible);
        assert_eq!(PopoverState::Visible.show(), PopoverState::Visible);
    }

    #[test]
    fn test_popover_state_hide_is_idempotent() {
        assert_eq!(PopoverState::Visible.hide(), PopoverState::Hidden);
        assert_eq!(PopoverState::Hidden.hide(), PopoverState::Hidden);
    }
```

- [ ] **Step 3: Run the tests**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml popover::`
Expected: 8 tests pass (4 from Task 4 + 4 new).

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/popover.rs
git commit -m "feat(desktop): popover state machine (hidden/visible) + tests"
```

---

## Task 6: TDD tray menu construction

**Files:**
- Modify: `packages/desktop/src-tauri/src/tray.rs`

- [ ] **Step 1: Write failing tests + implementation**

Replace the contents of `packages/desktop/src-tauri/src/tray.rs` with:

```rust
use serde::Serialize;

/// Identifier for tray menu items. Used to dispatch on click in main.rs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TrayMenuId {
    Quit,
}

impl TrayMenuId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Quit => "quit",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "quit" => Some(Self::Quit),
            _ => None,
        }
    }
}

/// What kind of tray icon event was received.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayClick {
    /// Left-click on the tray icon → toggle the popover.
    Left,
    /// Right-click on the tray icon → show the tray menu.
    Right,
}

/// Map a Tauri click event (button + button_state) into our internal
/// `TrayClick`. We only act on Up events to avoid double-firing on press.
pub fn classify_click(button: &str, button_state: &str) -> Option<TrayClick> {
    if button_state != "Up" {
        return None;
    }
    match button {
        "Left" => Some(TrayClick::Left),
        "Right" => Some(TrayClick::Right),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_menu_id_round_trip() {
        let id = TrayMenuId::Quit;
        let s = id.as_str();
        assert_eq!(s, "quit");
        assert_eq!(TrayMenuId::from_str(s), Some(id));
    }

    #[test]
    fn test_tray_menu_id_from_unknown_string() {
        assert_eq!(TrayMenuId::from_str("invalid"), None);
        assert_eq!(TrayMenuId::from_str(""), None);
    }

    #[test]
    fn test_classify_click_left_up() {
        assert_eq!(classify_click("Left", "Up"), Some(TrayClick::Left));
    }

    #[test]
    fn test_classify_click_right_up() {
        assert_eq!(classify_click("Right", "Up"), Some(TrayClick::Right));
    }

    #[test]
    fn test_classify_click_ignores_down_events() {
        assert_eq!(classify_click("Left", "Down"), None);
        assert_eq!(classify_click("Right", "Down"), None);
    }

    #[test]
    fn test_classify_click_ignores_unknown_button() {
        assert_eq!(classify_click("Middle", "Up"), None);
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml tray::`
Expected: 6 tests pass.

- [ ] **Step 3: Run the full unit test suite**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: 14 tests pass total (8 popover + 6 tray).

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/tray.rs
git commit -m "feat(desktop): tray menu IDs + click classifier with tests"
```

---

## Task 7: Wire tray + popover into `main.rs`

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

This is integration code — the real Tauri runtime work that the unit tests cannot exercise. Manual verification at the end of this task.

- [ ] **Step 1: Replace `main.rs` with the wired version**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use ohmyc_desktop_lib::popover::{position_under_tray, MonitorBounds, PopoverState, TrayRect};
use ohmyc_desktop_lib::tray::{classify_click, TrayClick, TrayMenuId};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, PhysicalSize, WindowEvent};

struct PopoverGuard(Mutex<PopoverState>);

fn main() {
    tauri::Builder::default()
        .manage(PopoverGuard(Mutex::new(PopoverState::Hidden)))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Build tray menu (right-click)
            let quit_item = MenuItem::with_id(app, TrayMenuId::Quit.as_str(), "Quit OhMyC", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if let Some(TrayMenuId::Quit) = TrayMenuId::from_str(event.id.as_ref()) {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, rect, .. } = event {
                        let button_str = match button {
                            MouseButton::Left => "Left",
                            MouseButton::Right => "Right",
                            _ => return,
                        };
                        let state_str = match button_state {
                            MouseButtonState::Up => "Up",
                            MouseButtonState::Down => "Down",
                        };
                        let Some(click) = classify_click(button_str, state_str) else {
                            return;
                        };

                        let app = tray.app_handle();
                        match click {
                            TrayClick::Left => {
                                toggle_popover(app, rect.position.x as i32, rect.position.y as i32, rect.size.width as u32, rect.size.height as u32);
                            }
                            TrayClick::Right => {
                                // Menu shows automatically because we attached it.
                            }
                        }
                    }
                })
                .build(app)?;

            // Auto-hide popover on focus loss
            let popover_window = app.get_webview_window("popover").unwrap();
            let app_handle = app.handle().clone();
            popover_window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    if let Some(win) = app_handle.get_webview_window("popover") {
                        let _ = win.hide();
                        let guard = app_handle.state::<PopoverGuard>();
                        let mut state = guard.0.lock().unwrap();
                        *state = state.hide();
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_popover(app: &tauri::AppHandle, tray_x: i32, tray_y: i32, tray_w: u32, tray_h: u32) {
    let guard = app.state::<PopoverGuard>();
    let mut state = guard.0.lock().unwrap();

    let Some(window) = app.get_webview_window("popover") else { return };
    match *state {
        PopoverState::Hidden => {
            // Compute position
            let size = window.outer_size().unwrap_or(PhysicalSize::new(360, 440));
            let monitor = window
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| MonitorBounds {
                    x: m.position().x,
                    y: m.position().y,
                    width: m.size().width,
                    height: m.size().height,
                })
                .unwrap_or(MonitorBounds { x: 0, y: 0, width: 1920, height: 1080 });

            let tray = TrayRect { x: tray_x, y: tray_y, width: tray_w, height: tray_h };
            let pos = position_under_tray(tray, size, monitor);
            let _ = window.set_position(pos);
            let _ = window.show();
            let _ = window.set_focus();
            *state = state.show();
        }
        PopoverState::Visible => {
            let _ = window.hide();
            *state = state.hide();
        }
    }
}
```

- [ ] **Step 2: Verify Rust still compiles**

Run: `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: builds clean. If `TrayIconEvent::Click` field names differ in your Tauri 2 minor version, adjust the destructuring (the variant always carries `button`, `button_state`, `rect`, `id`, `position`).

- [ ] **Step 3: Verify unit tests still pass**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: all 14 tests still pass. `main.rs` is not tested directly — it is integration code that the unit tests under `popover::` and `tray::` cover the pure-logic pieces of.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): wire tray icon + popover toggle + focus-loss auto-hide"
```

---

## Task 8: Add ESC-to-hide from the frontend

**Files:**
- Modify: `packages/desktop/src/menubar.tsx`
- Modify: `packages/desktop/src-tauri/src/main.rs`

The popover should hide when ESC is pressed inside it. ESC is captured by the React app (since the webview owns keyboard focus), which calls a Tauri command to hide the window.

- [ ] **Step 1: Add `hide_popover` command to `main.rs`**

In `packages/desktop/src-tauri/src/main.rs`, add this function below `toggle_popover`:

```rust
#[tauri::command]
fn hide_popover(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("popover") {
        let _ = win.hide();
        let guard = app.state::<PopoverGuard>();
        let mut state = guard.0.lock().unwrap();
        *state = state.hide();
    }
}
```

Then in the `tauri::Builder::default()` chain in `main()`, before `.run(...)`, add the invoke handler:

```rust
.invoke_handler(tauri::generate_handler![hide_popover])
```

Place it directly after `.manage(...)` for readability:

```rust
tauri::Builder::default()
    .manage(PopoverGuard(Mutex::new(PopoverState::Hidden)))
    .invoke_handler(tauri::generate_handler![hide_popover])
    .setup(|app| {
```

- [ ] **Step 2: Wire ESC in `menubar.tsx`**

Replace `packages/desktop/src/menubar.tsx` with:

```tsx
import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { ContributionGraph } from '@ohmyc/ui/components/timeline/contribution-graph'

const stubData: Array<{ date: string; count: number }> = Array.from(
  { length: 53 * 7 },
  (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (53 * 7 - i))
    return { date: d.toISOString().slice(0, 10), count: 0 }
  },
)

export function Menubar() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void invoke('hide_popover')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ padding: 18, background: '#191a1b', color: '#e6e7e8', minHeight: '100vh' }}>
      <div style={{ fontSize: 13, fontWeight: 510, marginBottom: 14 }}>
        OhMyC Menubar — Scaffold
      </div>
      <ContributionGraph data={stubData} />
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ohmyc/desktop build && cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: both succeed.

- [ ] **Step 4: Verify tests still pass**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: 14 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/menubar.tsx packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): ESC inside popover hides via tauri command"
```

---

## Task 9: Manual smoke test

This task is not a code change — it is the human-in-the-loop verification of everything the unit tests cannot cover (macOS tray rendering, popover show/hide visibly, focus-loss behavior, ESC dismissal).

- [ ] **Step 1: Run `pnpm tauri:dev`**

Run: `pnpm --filter @ohmyc/desktop tauri:dev`

Expected: Vite starts on `http://localhost:1420`. Cargo compiles src-tauri (slow on first launch, ~30s incremental thereafter). A tray icon appears in the macOS menu bar.

- [ ] **Step 2: Verify dock icon is hidden**

Look at the macOS dock. There should be NO OhMyC icon. If one appears, `set_activation_policy(Accessory)` did not take effect — re-check the cfg gate.

- [ ] **Step 3: Verify tray icon adapts to menu bar theme**

If you can toggle macOS light/dark mode quickly, do so. The tray icon should auto-invert (white in dark mode, black in light mode). If it stays one color, the `-Template` suffix on the filename or `icon_as_template(true)` is misconfigured.

- [ ] **Step 4: Left-click the tray icon → popover appears anchored beneath it**

The popover should render the placeholder ("OhMyC Menubar — Scaffold") and the `ContributionGraph` component (rendered with zero-count stub data, so likely a faint or empty heatmap).

- [ ] **Step 5: Left-click the tray icon again → popover hides**

- [ ] **Step 6: Left-click to show, then click anywhere outside the popover → popover hides** (focus-loss auto-hide)

- [ ] **Step 7: Left-click to show, then press ESC inside the popover → popover hides**

- [ ] **Step 8: Right-click the tray icon → `Quit OhMyC` menu item appears. Click it → app exits cleanly.**

- [ ] **Step 9: Document any issues found and fix them in follow-up commits before moving on.**

For each issue: write a one-line reproduction, fix the root cause (don't paper over), re-run from Step 1.

- [ ] **Step 10: When all 8 checks pass, commit any fixes made during smoke test**

If no fixes were needed, skip this step. If fixes were made:

```bash
git add packages/desktop/
git commit -m "fix(desktop): <one-line description of smoke-test fix>"
```

---

## Task 10: Add CI job for desktop tests

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect existing CI**

Run: `cat .github/workflows/ci.yml`
Expected: shows existing jobs (likely lint, type-check, test). Note the YAML structure so the new job slots in correctly.

- [ ] **Step 2: Append `desktop-test` job**

Add this job at the end of the `jobs:` section in `.github/workflows/ci.yml` (adjust indentation to match the file's existing jobs):

```yaml
  desktop-test:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/desktop/src-tauri
      - name: Run Rust unit tests
        run: cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml
```

- [ ] **Step 3: Validate the workflow YAML locally if possible**

If `actionlint` is installed: run `actionlint .github/workflows/ci.yml`.
Otherwise: visually verify indentation and that the job sits at the same indent level as the existing jobs.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run desktop Rust unit tests on macOS"
```

- [ ] **Step 5: Push the branch and verify CI green**

```bash
git push
```

Then open the PR / branch on GitHub and confirm:
- The new `desktop-test` job appears.
- It passes.
- All previously-existing jobs still pass.

If `desktop-test` fails in CI but passes locally, the most likely causes are:
- macOS runner has a different default Rust version → pin in `dtolnay/rust-toolchain` if needed.
- First-time Cargo download timing out → re-run; cache populates on second run.

---

## Self-review notes

**Spec coverage:** Every spec section maps to at least one task:

| Spec section | Tasks |
|---|---|
| Architecture (file tree) | Tasks 2, 3 |
| packages/ui changes (exports) | Task 1 |
| Tauri configuration | Task 3 |
| Behavior — tray + popover | Tasks 6, 7, 8 |
| Positioning math | Task 4 |
| Test strategy (Rust unit only) | Tasks 4, 5, 6 |
| CI | Task 10 |
| Error handling | (manual: smoke test in Task 9) |
| Success criteria | Task 9 (smoke test verifies all 8) |

**Type consistency:** `TrayRect`, `MonitorBounds`, `PopoverState`, `TrayMenuId`, `TrayClick` are defined in Tasks 4–6 and consumed in Task 7's `main.rs` with matching names. `position_under_tray`, `classify_click` signatures match between definition and consumption.

**Placeholder scan:** No TBD, TODO, or "implement later" in any task. Every code-changing step includes the actual code. Exact paths and commands throughout.
