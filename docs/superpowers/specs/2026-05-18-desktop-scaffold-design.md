# Desktop Scaffold — Tauri 2 Menu Bar App, v0.1 Slice 1

**Date:** 2026-05-18
**Branch:** develop
**Upstream design:** `~/.gstack/projects/JiangWeixian-claudeui/jiangwei-develop-design-20260517-201139.md`
**Upstream wireframe:** `~/.gstack/projects/JiangWeixian-claudeui/designs/menubar-popover-20260517/index.html`
**Status:** APPROVED (brainstorming phase)

## Purpose

First implementation slice of the OhMyC Desktop menu bar app. Scaffolds a new
`packages/desktop/` Tauri 2 package with a tray icon and a hidden popover window,
and exposes `packages/ui` components for cross-package consumption via a
`workspace:*` dependency. No sidecar, no chart route, no auto-update in this slice —
each lands in a later slice.

The goal is a foundation that:
- runs `pnpm --filter @ohmyc/desktop tauri dev` and produces a tray icon you can
  click to toggle a popover window;
- loads the popover content from the desktop package's own Vite dev server
  (default Tauri+Vite layout, not a cross-package devUrl);
- can import a React component from `@ohmyc/ui` to prove the workspace wiring
  works, even though the chart itself lands in a later slice;
- has Rust unit tests for tray and popover logic.

## Out of scope (deferred to later slices)

- Sidecar process spawning the bun-compiled CLI
- `/menubar` chart route, dual-line + heatmap views, hero data
- File-watch for live updates
- Launch-at-login toggle
- Auto-update via Tauri updater
- macOS code signing / notarization
- GitHub Actions release workflow
- Onboarding / empty state UI
- Main window + "Open OhMyC" item (deferred to v0.2)

## Architecture

```
packages/desktop/
├── package.json                    # deps: @tauri-apps/cli, @tauri-apps/api,
│                                   #   react, react-dom, @ohmyc/ui (workspace:*)
├── index.html                      # Vite entry, mounts #root
├── vite.config.ts                  # port 1420, react plugin
├── tsconfig.json                   # extends repo root tsconfig.json, JSX react-jsx
└── src/
    ├── main.tsx                    # ReactDOM.createRoot mount
    └── menubar.tsx                 # Slice 1: placeholder content + one
                                    #   <ContributionGraph> imported from
                                    #   @ohmyc/ui, rendered with a hardcoded
                                    #   stub dataset (no DB read, no API call)

packages/desktop/src-tauri/
├── Cargo.toml                      # tauri = "2", tauri-build = "2",
│                                   #   serde, serde_json
├── tauri.conf.json                 # devUrl: http://localhost:1420
│                                   # frontendDist: ../dist
│                                   # tray + window config (decorations off,
│                                   #   always-on-top, skip-taskbar, hidden
│                                   #   on launch)
├── build.rs
├── icons/
│   ├── tray-icon-Template.png      # 16×16 (macOS auto-inverts for light/dark)
│   ├── tray-icon-Template@2x.png   # 32×32 retina
│   └── icon.icns                   # app icon (multi-size)
└── src/
    ├── main.rs                     # Tauri Builder, registers tray + popover
    ├── lib.rs                      # public re-exports for tests
    ├── tray.rs                     # tray icon setup, click handler,
    │                               #   `Quit` menu item
    └── popover.rs                  # popover window creation, show/hide
                                    #   state machine, positioning math
```

## packages/ui changes

Today `packages/ui/package.json` has no `exports` field — the package is treated
as an application, not a library. To let `packages/desktop` consume components,
add this field:

```jsonc
{
  "name": "@ohmyc/ui",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./state/*": "./src/state/*.ts",
    "./lib/*": "./src/lib/*.ts"
  }
}
```

No component file moves, renames, or is rewritten. The Vite dev server for the
web app continues to use its internal `@/` alias as before. The new `exports`
field is consumed only by sibling workspace packages.

The `*` in subpath patterns matches any characters including path separators
(Node.js subpath patterns spec), so
`@ohmyc/ui/components/timeline/contribution-graph` correctly resolves under the
`./components/*` pattern.

This slice imports exactly one component (`ContributionGraph`) from
`@ohmyc/ui/components/timeline/contribution-graph` to prove the wiring. If the
import resolves and the component renders inside the desktop Vite build, the
workspace + exports wiring is correct.

## Tauri configuration

`packages/desktop/src-tauri/tauri.conf.json` highlights:

```jsonc
{
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist",
    "beforeDevCommand": "pnpm vite",
    "beforeBuildCommand": "pnpm vite build"
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
    "trayIcon": {
      "id": "main",
      "iconPath": "icons/tray-icon-Template.png",
      "iconAsTemplate": true
    }
  },
  "identifier": "com.ohmyc.desktop",
  "productName": "OhMyC"
}
```

The `"-Template"` suffix on the tray icon filename + `iconAsTemplate: true`
together tell macOS to auto-invert the icon for light/dark menu bars. Without
this, the icon stays one color regardless of theme.

## Behavior — tray + popover

1. **App launch.** Tray icon appears in the menu bar. Popover window is created
   hidden. No main window, no dock icon (controlled by `activationPolicy:
   accessory` set during setup in `main.rs`).

2. **Tray left-click.** Toggles popover visibility:
   - if popover hidden → compute position from tray icon coordinates, show + focus
   - if popover visible → hide

3. **Tray right-click.** Shows tray menu (single item: `Quit`).

4. **Popover loses focus.** Auto-hides. Implemented via Tauri's `WindowEvent::Focused(false)` listener calling `popover::hide`. `alwaysOnTop: true` does not interfere — it only affects z-order while visible.

5. **ESC pressed inside popover.** Hides the popover (Tauri event from frontend
   → Rust → `popover::hide`).

6. **Quit.** Standard Tauri `app.exit(0)` from the tray menu item.

## Positioning math

The popover should appear under the tray icon, anchored ~28px from the right
edge so the tail (visual triangle from the wireframe) lines up with the icon.

```rust
// popover.rs
fn position_under_tray(tray_rect: Rect, window_size: PhysicalSize<u32>) -> PhysicalPosition<i32> {
    let x = tray_rect.x + (tray_rect.width as i32 / 2) - (window_size.width as i32) + 28;
    let y = tray_rect.y + tray_rect.height as i32 + 4; // 4px gap below menu bar
    PhysicalPosition::new(x, y)
}
```

Edge cases:
- Tray icon near the right edge of the screen → clamp x so the window stays
  on-screen (subtract overflow from x).
- Multi-monitor → use the monitor containing the tray icon for clamping. Tauri
  exposes monitor info via the window manager.

Both clamping behaviors are testable as pure functions (no Tauri runtime needed).

## Test strategy — Rust unit only

This slice uses Rust unit tests only (per D1 decision). No Vitest, no E2E.

**Test surface:**

| File | Test target |
|------|-------------|
| `tray.rs` | Tray menu construction; `on_left_click` emits `popover::toggle`; `on_right_click` shows menu |
| `popover.rs` | Show/hide state machine; `position_under_tray` math (including edge clamping); ESC handler routes to `hide` |

**Test infrastructure:**

- `tauri::test::mock_builder()` for any tests that need a Tauri App instance.
- Pure functions (positioning math, state transitions) tested as plain Rust units
  without Tauri runtime.
- Tests live in `#[cfg(test)] mod tests { ... }` at the bottom of each module.
- `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml` runs in <1s.

**Test naming convention:** `test_<unit>_<scenario>` — e.g.
`test_position_under_tray_clamps_at_right_edge`,
`test_popover_state_hide_when_visible`.

**Targets per file:**
- `tray.rs`: ≥3 tests (menu construction, left-click event, right-click menu show)
- `popover.rs`: ≥5 tests (show, hide, toggle from hidden, toggle from visible,
  position math, position math at right edge, ESC routing)

## CI

Add a `desktop-test` job to `.github/workflows/ci.yml`:

```yaml
desktop-test:
  runs-on: macos-14
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - uses: Swatinem/rust-cache@v2
      with:
        workspaces: packages/desktop/src-tauri
    - run: cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml
```

`tauri build` is intentionally NOT in CI for this slice — slow, brings in
signing/notarization concerns, and there's no release artifact yet. The release
workflow lands with the v0.1 release slice.

## Error handling

Surface area is tiny in this slice. The errors that matter:

- **Tray icon fails to load** (missing or corrupt `tray-icon-Template.png`) →
  `eprintln!` the error, `app.exit(1)`. Unrecoverable; bad install.
- **Popover window fails to create** → `eprintln!`, attempt one retry after
  100ms, then `app.exit(1)`.
- **`@ohmyc/ui` import fails at build time** → Vite error surfaces during
  `tauri dev` / `tauri build`. No runtime handling needed; this is a developer
  error caught at compile time.

## Data flow

None in this slice. No IPC commands (beyond the built-in tray events), no DB
reads, no sidecar. Frontend renders a static placeholder + one demonstrative
component import. The chart's real data wiring lands in the sidecar slice.

## Dependencies (this slice)

Rust (`packages/desktop/src-tauri/Cargo.toml`):
- `tauri = { version = "2", features = ["tray-icon"] }`
- `tauri-build = "2"`
- `serde`, `serde_json`

Node (`packages/desktop/package.json`):
- `@tauri-apps/cli ^2`
- `@tauri-apps/api ^2`
- `react`, `react-dom` (match versions used by `packages/ui`)
- `@ohmyc/ui: workspace:*`
- `vite`, `@vitejs/plugin-react`, `typescript`

No new repo-level tooling. No changes to root `package.json` other than pnpm
discovering the new package via the existing `pnpm-workspace.yaml`.

## Risks and what we'll learn from this slice

1. **Workspace + subpath exports actually work for cross-package React imports.**
   The first time `import { ContributionGraph } from '@ohmyc/ui/components/...'`
   resolves and renders inside `packages/desktop`, this risk is closed.
2. **Tauri 2 tray + popover behave correctly on macOS Sequoia.** Tray icon
   template inversion, `activationPolicy: accessory` to hide the dock icon,
   popover positioning relative to the tray — all macOS-specific behaviors that
   the Rust unit tests can't fully cover. A manual smoke test at the end of the
   slice confirms.
3. **`pnpm tauri dev` integrates cleanly with the existing dev workflow.** The
   desktop package's Vite server runs on port 1420 (separate from the web
   app's 5173), so the two can run concurrently without collision.

If risk 1 fails (workspace import resolution breaks), the fallback is a small
`@ohmyc/ui-lib` package extracted from packages/ui. This is the Option A path
from brainstorming, deferred unless needed.

## Decisions log

| # | Decision | Why |
|---|----------|-----|
| 1 | Rust unit tests only this slice | "Good tests" without burning a weekend on macOS E2E infra. Vitest joins when React state lands in a later slice. |
| 2 | Standard Tauri+Vite layout (index.html, vite.config.ts, src/ in desktop) | Self-contained build pipeline; `pnpm tauri build` doesn't depend on packages/ui having built first. |
| 3 | Subpath exports on `@ohmyc/ui`, no component refactor | Smallest packages/ui change (4-line package.json addition); no file moves. |
| 4 | Vite port 1420 for desktop | Avoids collision with packages/ui's 5173. |
| 5 | Tray icon `-Template` suffix + `iconAsTemplate: true` | macOS auto-inverts the icon for light/dark menu bars; without this, the icon would be one fixed color. |
| 6 | `activationPolicy: accessory` (no dock icon) | Menu bar apps don't belong in the dock; this is the standard macOS pattern. |
| 7 | Manual positioning math (no `tauri-plugin-positioner`) | ~20 LOC, zero dep cost; positioning math is testable as pure Rust. |

## Success criteria

This slice is done when:

1. `pnpm --filter @ohmyc/desktop tauri dev` launches the app.
2. Tray icon appears in the macOS menu bar (light + dark mode both render
   correctly).
3. Left-click on the tray icon toggles a popover window anchored under it.
4. Popover shows a placeholder page that includes one React component imported
   from `@ohmyc/ui` (verifying workspace wiring).
5. Right-click on the tray icon shows a menu with `Quit`. Quit terminates the
   app cleanly.
6. `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml` passes,
   with ≥3 tests in `tray.rs` and ≥5 tests in `popover.rs`.
7. CI `desktop-test` job passes on macOS.
8. No regressions in existing CI (cli, ui, timeline tests still green).
