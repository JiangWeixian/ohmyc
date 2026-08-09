# Onboarding Setup Gate Design

## Summary

Add a full-app onboarding gate for the main OhMyC window when the local monitor store is not ready. The gate appears before the normal Explorer shell and guides the user to install the OhMyC plugin manually. It is a product unavailable state, not a marketing welcome page.

The first implementation must not install plugins from the app. It only checks readiness, opens the plugin repository, and lets the user retry after setup.

Plugin repository link:

```text
https://github.com/JiangWeixian/ohmyc-plugins
```

## Product Intent

OhMyC is a personal Coding Monitor. If the monitor store is missing, the main app cannot honestly show the user's activity surface. In that state, the product should show a clear setup gate instead of rendering an empty or broken Timeline.

The gate should read as "monitor not connected." It should not use hero marketing copy, a generic welcome flow, or a configuration-admin layout.

## Architecture

Use an independent setup readiness path. Do not reuse Timeline queries or `useTimelineStatus`.

### Rust/Core

Add a lightweight setup probe in a new Rust setup module. The probe should:

- Resolve the expected local monitor store internally.
- Check whether the store file exists.
- Attempt to open the store and validate that the expected timeline schema can be read.
- Return a stable setup state.
- Never return the DB path to the frontend.

Status model:

```rust
Ready
MissingStore
UnreadableStore
InternalError
```

`MissingStore` covers the absent local monitor store. `UnreadableStore` covers an existing but invalid or unreadable store. `Ready` includes an existing readable store with zero sessions; an empty but valid store is a normal Timeline empty state, not an onboarding condition.

Implementation should live in a new core setup module, for example `crates/ohmyc-core/src/setup.rs`. It may call low-level timeline path/open helpers internally, but the public API and Tauri command must expose setup readiness, not timeline status.

### Tauri API

Add a new command such as `setup_status` in `packages/desktop/src-tauri/src/api/setup.rs`, registered in the desktop invoke handler.

The frontend contract should stay small:

```ts
type SetupStatus =
  | { state: 'ready' }
  | { state: 'missing_store' }
  | { state: 'unreadable_store'; reason?: string }
  | { state: 'internal_error'; reason?: string }
```

Detailed paths and raw stack traces stay in logs, not in the UI response. Any `reason` returned to the UI must be sanitized so it cannot include the local database path.

### Frontend Hook

Add `useSetupStatus` in `packages/ui/src/hooks/use-setup-status.ts`.

- Query key: `['setup', 'status']`
- Transport call: `request('setup.status', {})`
- No dependency on `useTimelineStatus`
- Retry is driven by explicit user action from the onboarding gate, not by aggressive background polling

### Dependencies and Source Imports

Add the official Atropos package to `@ohmyc/ui`:

```bash
pnpm --filter @ohmyc/ui add atropos
```

The implementation must use the official React integration from Atropos:

```ts
import Atropos from 'atropos/react'
import 'atropos/css'
```

Do not reimplement pointer tilt by hand. Atropos owns tilt, active offset, highlight, and layer depth behavior.

Use the vendored React Bits LetterGlitch implementation as the source for the onboarding background:

```text
vendor/react-bits/src/ts-default/Backgrounds/LetterGlitch/LetterGlitch.tsx
```

Copy/adapt it into the OhMyC UI source tree as a local component, for example `packages/ui/src/components/onboarding/letter-glitch.tsx`. Productize it for this app:

- Type props according to OhMyC conventions.
- Remove demo-only assumptions and inline colors that conflict with theme tokens.
- Add a disabled/static mode for `prefers-reduced-motion` and calm intensity.
- Use low-contrast frosted-ivory-lamplit-compatible colors.

Do not import directly from `vendor/react-bits` at runtime. The vendor directory is a source reference, not a packaged dependency boundary for the app.

### App Shell and Route Integration

Add an internal onboarding route at `/onboard`.

The route is allowed, but it is not a normal navigation destination. Do not add `/onboard` to `NavigationIsland` or the command palette. Users reach it through setup gating or desktop entry points, not through regular product navigation.

In the main app layout, check setup status before rendering normal product routes.

Flow:

1. Main window mounts.
2. `useSetupStatus` checks readiness.
3. While loading, show a minimal checking state.
4. `ready` renders the requested normal app route.
5. Any non-ready state routes to `/onboard` with replace semantics and renders `OnboardingGate`.
6. If the user is already on `/onboard` and setup becomes `ready`, route back to `/explore/timeline` unless a preserved target route is available.

The onboarding route replaces the normal app shell. It should not render `NavigationIsland`, command palette search content, or route content behind it.

`/menubar` is outside this gate. The menubar remains its own compact surface.

Desktop menubar behavior:

- Clicking the tray/menu "Open OhMyC" action opens or focuses the main window.
- The main window then runs `useSetupStatus` during bootstrap.
- If the monitor store is unavailable, the main window routes to `/onboard` and shows `OnboardingGate`.
- The menubar-triggered main-window path reuses the same `OnboardingGate` component as direct `/onboard` visits.
- The menubar popover route itself may reuse the same component only if it can render responsively without desktop-only layout assumptions. If that is too cramped during implementation, keep the popover on its current compact unavailable state and let "Open OhMyC" show `/onboard` in the main window.

## UI Design

### Copy

Use concise monitor-state language:

- Title: `Monitor not connected`
- Body: `Install the OhMyC plugin to start collecting local coding activity.`
- Primary action: `Open plugin repo`
- Secondary action: `Retry`

For `unreadable_store`, add a compact status line:

```text
Local monitor store exists but could not be opened.
```

For `internal_error`, add:

```text
Setup check failed. Retry after installing the plugin or restarting OhMyC.
```

Do not show the database path.

### Visual Treatment

Use the `frosted-ivory-lamplit-screen-baked` Atropos asset variant from:

```text
/Users/bytedance/Documents/Codex/2026-06-24/atroposjs/outputs/atropos-retro-computer/variants/frosted-ivory-lamplit-screen-baked
```

This is the baked-screen variant: the CRT screen (dark glass, scanlines, cyan terminal glow) is part of the shell image, so no separate screen DOM layer is needed. This was validated during the onboarding spike — the earlier `frosted-ivory-lamplit` (hole) variant required a transparent aperture + screen DOM layer and read as a hollowed-out rectangle once the card background was removed.

Required assets:

- `computer-shell.png` (screen baked in)
- `keyboard.png`

Do not use `rough-composition.png` as the final asset. The scene must be rebuilt from layers so Atropos can create depth.

Create a `RetroComputerAtropos` component using the reference interaction from that variant's `preview.html`. The important requirement is depth after pointer interaction:

| Layer | Atropos offset | Purpose |
|---|---:|---|
| Letter glitch background | `-8` | Deep background signal field |
| Ambient rim light | `-3` | Warm/cyan light spill |
| Shell depth back | `4` | Dark shifted duplicate for body thickness |
| Shell depth mid | `7` | Mid duplicate for body thickness |
| Shell main | `12` | Primary computer shell (screen baked in) |
| Keyboard depth | `18` | Dark shifted duplicate for keyboard thickness |
| Keyboard main | `26` | Primary keyboard |
| Foreground fragments | `34` | Sparse signal shards |

Atropos options should follow the asset manifest:

```ts
{
  activeOffset: 34,
  shadow: false,
  highlight: true,
  rotateXMax: 10,
  rotateYMax: 10,
}
```

Keep rotation restrained so the 2D layer construction still reads as a physical object. The shell must use at least three layers and the keyboard at least two layers; reducing the scene to a single flat image fails the design.

The Atropos scene has no card/frame background — `.atropos-inner` is transparent with `overflow: visible` so the computer floats on the ambient field and the depth duplicates read as thickness against the dark base rather than as ghosting. The dark depth duplicates depend on a dark surround to read correctly.

### Background

Use a React Bits Letter Glitch style for the surrounding field. It should be low-contrast, slow, and ambient. The background is not the main subject; the retro computer and setup actions are.

Avoid bright purple/blue AI-cliche gradients, orbs, bokeh blobs, or marketing hero composition.

### Layout

The gate uses a two-column composition (validated in the onboarding spike):

- Left: `RetroComputerAtropos`, sized to roughly half the centered stage (`min(42vw, 380px)`), shrunk from the 760px reference so it does not dominate.
- Right: the copy (title + body) and the primary/secondary actions, stacked and left-aligned in a `max-width: 26rem` column.

On narrow viewports (`max-width: 860px`) the composition collapses to a single centered column with centered text, and the computer scales back up (`min(70vw, 420px)`).

### Theming

The right column (title, body, actions) is built entirely from theme tokens — `--text-primary`, `--bg-marketing`, `--font-display`, `--border-default`, `--radius-lg` — so it adapts to every theme (monitor, phosphor, amber, retro, cyberpunk) with no hardcoded colors. The primary action inverts to `background: var(--text-primary); color: var(--bg-marketing)` per theme.

The retro computer scene (left) is intentionally a fixed lamplit palette: the warm/cyan gradients and green CRT glow are part of the asset, not theme-driven. The computer is a single consistent object across themes; the surrounding chrome adapts.

### Accessibility and Reduced Motion

The setup screen must work without pointer motion.

- Primary and secondary actions are normal DOM controls.
- The GitHub link uses normal external-link semantics.
- The screen has readable text outside the canvas/WebGL path; this implementation uses DOM/CSS, not WebGL.
- `prefers-reduced-motion: reduce` disables Atropos tilt, glitch animation, parallax, and foreground fragment motion.
- Calm intensity should also avoid ambient glitch motion.
- The static layered computer remains visible in reduced motion.

## State and Error Handling

`Retry` refetches `useSetupStatus`. It does not install anything, run shell commands, write config, or call the CLI.

The plugin inventory is not a hard gate condition. It can be stale or incomplete. The main app becomes available when the local monitor store is readable. This lets a user view historical activity even if plugin registry state is temporarily inaccurate.

Store exists with zero sessions:

- Setup status: `ready`
- UI: normal app
- Timeline: existing empty state

Store missing:

- Setup status: `missing_store`
- UI: onboarding gate

Store unreadable:

- Setup status: `unreadable_store`
- UI: onboarding gate with unreadable-store message

Setup probe failed for unknown reasons:

- Setup status: `internal_error`
- UI: onboarding gate with retry guidance

## File Scope

Expected implementation files:

- `crates/ohmyc-core/src/setup.rs` for setup probe logic
- `packages/desktop/src-tauri/src/api/setup.rs`
- `packages/desktop/src-tauri/src/api/mod.rs`
- `packages/desktop/src-tauri/src/main.rs`
- `packages/ui/package.json` and the workspace lockfile for the `atropos` dependency
- `packages/ui/src/hooks/use-setup-status.ts`
- `packages/ui/src/components/onboarding/onboarding-gate.tsx`
- `packages/ui/src/components/onboarding/retro-computer-atropos.tsx`
- `packages/ui/src/components/onboarding/letter-glitch.tsx`
- UI asset directory for the two `frosted-ivory-lamplit-screen-baked` PNG assets (`computer-shell.png`, `keyboard.png`)
- `packages/ui/src/app.tsx` or a small app-gate wrapper near the route shell, including the hidden `/onboard` route
- `packages/ui/src/globals.css` for scoped onboarding/Atropos/Letter Glitch CSS, if component-local styling is insufficient

Update `DESIGN.md` with a Decisions Log row before implementation.

## Testing

### Rust

Add tests for:

- Missing store returns `MissingStore`.
- Existing readable store with schema and zero sessions returns `Ready`.
- Existing invalid/unreadable store returns `UnreadableStore`.
- The setup status response never includes the DB path.

### Frontend

Add tests or Storybook fixtures for:

- `ready` renders the normal app shell.
- `missing_store` renders the onboarding gate and does not render `NavigationIsland`.
- `unreadable_store` renders the unreadable-store status line.
- Direct `/onboard` visits render `OnboardingGate` when setup is not ready.
- Direct `/onboard` visits redirect to `/explore/timeline` or a preserved target route when setup becomes ready.
- `Retry` calls refetch.
- `Open plugin repo` points to `https://github.com/JiangWeixian/ohmyc-plugins`.
- Reduced motion disables LetterGlitch animation and Atropos interaction.
- `RetroComputerAtropos` renders the required Atropos layer offsets.

### Visual QA

Verify desktop and narrow viewport screenshots:

- The screen DOM aligns inside the transparent monitor aperture.
- Pointer movement reveals shell and keyboard thickness.
- Text does not overflow the screen panel or action area.
- Reduced motion renders a static but complete scene.

## Out of Scope

- In-app plugin installation.
- CLI execution from Tauri.
- Showing DB paths to the user.
- Blocking the app based on `plugins.list`.
- Redesigning Timeline, Monitor, Navigation Island, or Library pages.
