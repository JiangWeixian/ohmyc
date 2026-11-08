# Menu Bar View Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Popover's temporary Area/Heatmap switch with three persistent, real-data layout presets selected through an Apple-widget-style Settings gallery.

**Architecture:** Extend the existing sparse settings contract with `menubar.view`, then extract one shared Popover presentation used by both `/menubar` and Settings. A Settings-only gallery owns browsing, Apply, carousel behavior, and pointer effects; Quota polling and data mutations remain outside it.

**Tech Stack:** Rust/Serde, Tauri commands/events, React 19, TypeScript, TanStack Query, Tailwind/CSS, Vitest, Storybook.

**Spec:** `docs/superpowers/specs/2026-11-08-menubar-view-picker-design.md`

## Global Constraints

- Storage values are exactly `area | heatmap | quota`; default `area`; env variable `OHMYC_MENUBAR_VIEW`.
- Raw file input uses `Option<String>` and field-local validation so a bad view cannot invalidate unrelated settings.
- Preview and actual Popover share real chart/Quota components and data; no static replica or fabricated values.
- Browsing never writes. Only Apply writes, once per successful submission; polling switches are independent.
- Desktop/Tauri only; plain web retains Appearance-only Settings.
- No pointer tilt/glow in the actual Popover. Fine-pointer preview hover uses spring response `0.3`, scale `1.02`, and a stable outer slide with `12px` hover allowance.
- Reduced motion disables pointer tracking, scale interpolation, and glow. Keyboard and touch navigation remain available.
- Update `DESIGN.md` before product code. Do not add dependencies or commit `.superpowers/` artifacts.

## Review Focus

- A malformed `menubar.view` beside valid Quota/icon/theme fields must not reset those fields or leak into a later sparse write — Task 1, Steps 2 and 5.
- An invalid env value must fall through to a valid file value rather than forcing `area` — Task 1, Steps 2 and 5.
- An over-height Quota Focus list must keep every provider row reachable by keyboard in both preview and Popover — Task 3, Step 4 and Task 4, Step 5.
- A rejected Apply must leave the last resolved selection truthful, retain the browsed preset, and offer a working retry — Task 4, Steps 2 and 5.
- Upper-right pointer entry, coarse pointers, and reduced motion must not silently disable or accidentally trigger the preview effect — Task 5, Steps 2 and 4.

---

### Task 1: Document the decision and add the persistent settings contract

**Files:**
- Modify: `DESIGN.md` (Menubar Popover, Settings scope, Decisions Log)
- Modify: `crates/ohmyc-core/src/settings.rs`
- Modify: `packages/desktop/src-tauri/src/api/settings.rs`

**Interfaces:**
- Produces: `MenubarSettings.view: Option<String>` in the sparse file/patch.
- Produces: `ResolvedSettings.menubarView: ResolvedSetting<String>` with values `area | heatmap | quota`.
- Produces: `pub fn is_valid_menubar_view(value: &str) -> bool` for field-local resolve and Tauri patch validation.

- [ ] **Step 1: Update `DESIGN.md` before product code**

Document the three presets, removal of the Popover `ViewSwitch`, the new Settings `Menu bar` section, real shared previews, persistent `menubar.view`, independent Quota polling, and approved pointer/reduced-motion behavior. Add a dated Decisions Log row and remove the old view-switch anatomy from the active design contract.

- [ ] **Step 2: Write failing Rust tests**

Add tests to `crates/ohmyc-core/src/settings.rs` and `packages/desktop/src-tauri/src/api/settings.rs` with these assertions:

```rust
assert_eq!(resolve_with(&AppSettingsFile::default(), &no_env).menubar_view.value, "area");
assert_eq!(resolve_with(&file_with_view("heatmap"), &no_env).menubar_view.value, "heatmap");
assert_eq!(resolve_with(&file_with_view("quota"), &env_with_view("invalid")).menubar_view.value, "quota");
assert_eq!(resolve_with(&file_with_view("invalid"), &no_env).menubar_view.value, "area");
assert!(validate_patch(&patch_with_view("area")).is_ok());
assert!(validate_patch(&patch_with_view("invalid")).is_err());
```

Add a field-isolation test whose raw JSON contains `menubar.view: "unknown"` plus valid Quota, icon, and theme values. Resolve must retain those valid values while view becomes `area`; after an unrelated sparse write, the valid Quota/icon/theme values must still be present and correctly resolved.

- [ ] **Step 3: Run the tests and verify the contract is missing**

Run:

```bash
cargo test -p ohmyc-core settings::tests
cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml api::settings::tests
```

Expected: FAIL because `menubar_view`, `MenubarSettings.view`, and view validation do not exist.

- [ ] **Step 4: Implement the sparse field and resolver**

Add `view: Option<String>` beside `icon_visible`, merge it independently, and expose `menubar_view` from `ResolvedSettings`. Implement `is_valid_menubar_view` using an exact match on `area | heatmap | quota`.

Resolution order: valid env → valid file → `area`. Invalid env is ignored so valid file wins; invalid file falls back to `area` without deserializing the whole file into a view enum or discarding unrelated fields. Reject invalid patches before any write or side effect. Keep schema version 1 and the documented downgrade behavior.

- [ ] **Step 5: Run Rust tests and verify they pass**

Run the commands from Step 3. Expected: all settings tests PASS, including field isolation and sparse-write preservation.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md crates/ohmyc-core/src/settings.rs packages/desktop/src-tauri/src/api/settings.rs
git commit -m "feat(settings): persist menu bar view preference"
```

### Task 2: Extend the frontend settings contract and mock transport

**Files:**
- Modify: `packages/ui/src/hooks/use-app-settings.ts`
- Modify: `packages/ui/src/lib/mock-settings.ts`
- Modify: `packages/ui/src/tests/use-app-settings.test.tsx`

**Interfaces:**
- Consumes: Task 1's resolved JSON field `menubarView`.
- Produces: `export type MenubarView = 'area' | 'heatmap' | 'quota'`.
- Produces: `ResolvedSettings.menubarView: ResolvedSetting<MenubarView>` and `SettingsPatch.menubar.view?: MenubarView`.

- [ ] **Step 1: Write failing frontend contract tests**

Extend the defaults test and patch test with:

```tsx
expect(result.current.data?.menubarView.value).toBe('area')
// after update({ menubar: { view: 'heatmap' } })
expect(screen.getByTestId('menubar-view')).toHaveTextContent('heatmap')
expect(screen.getByTestId('menubar-view-source')).toHaveTextContent('settings')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @ohmyc/ui test -- src/tests/use-app-settings.test.tsx`
Expected: FAIL/TypeScript error because `menubarView` and the patch field are absent.

- [ ] **Step 3: Implement the contract and mock merge**

Add `MenubarView`, the resolved field, and the patch field. Return `area/default` from `defaultResolvedSettings()` and update `mergeSettingsPatch()` so `menubar: { view }` sets `{ value, source: 'settings', envVar: null }` without changing `iconVisible`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the command from Step 2. Expected: both defaults and patch-merge tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-app-settings.ts packages/ui/src/lib/mock-settings.ts packages/ui/src/tests/use-app-settings.test.tsx
git commit -m "feat(ui): add menu bar view settings contract"
```

### Task 3: Share real Popover presentation and remove the temporary switch

**Files:**
- Create: `packages/ui/src/components/menubar/menubar-preset-content.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/quota-section.tsx`
- Modify: `packages/ui/src/components/menubar/styles.ts`
- Modify: `packages/ui/src/stories/menubar/MenubarPage.stories.tsx`
- Modify: `packages/ui/tests/components/menubar/quota-section.test.tsx`
- Modify: `packages/ui/tests/storybook-surface.test.ts`
- Delete: `packages/ui/src/components/menubar/view-switch.tsx`
- Delete: `packages/ui/src/stories/menubar/ViewSwitch.stories.tsx`
- Delete: `packages/ui/tests/components/menubar/view-switch.test.tsx`

**Interfaces:**
- Consumes: `MenubarView` and `ResolvedSettings.menubarView` from Task 2.
- Produces: `MenubarPresetContent({ view, today, onOpen, preview }: { view: MenubarView; today: Date; onOpen?: () => void; preview?: boolean })`.
- Produces: `MenubarQuotaFocus({ nowMs }: { nowMs: number })` using the same ranking, account-window, pressure, and stale-data helpers as `MenubarQuotaSection`.

- [ ] **Step 1: Rewrite Menubar stories around resolved settings**

Register mock settings in populated handlers. `AreaView` uses the default. `HeatmapView` sets `menubarView` to `heatmap` and asserts heat cells render without clicking a switch. Add `QuotaFocusView` with `menubarView = 'quota'` and assert pressure/provider content. Keep the event-tooltip story but drive Heatmap through settings and assert `Area chart view` / `Heatmap view` tabs are absent.

Add Quota Focus tests for `Loading quota…`, `No quota data yet`, `Quota unavailable`, partial average/peak data, four-provider ranking, and a named scroll region `Quota providers, scrollable` whose over-height rows remain Tab-focusable and keyboard-scrollable.

- [ ] **Step 2: Run the focused tests and verify the old implementation cannot satisfy them**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/menubar/quota-section.test.tsx
pnpm --filter @ohmyc/ui test:storybook -- MenubarPage
```

Expected: FAIL because there is no settings-driven `quota` composition or named accessible scroll region.

- [ ] **Step 3: Implement shared presets and settings-driven `/menubar`**

Extract Activity/KPI/footer rendering into `MenubarPresetContent`. Keep setup gating, the 30-second date timer, `useFsChanged`, and `usePopoverAutosize` in `MenubarActivity`; preview never receives those shell behaviors. `onOpen` is optional so preview cannot open/hide windows. `preview` disables chart tooltip interaction but leaves the named Quota Focus scroll region interactive.

Use `useAppSettings` in `MenubarActivity`, with `area` only as the unresolved-settings fallback. Render `MenubarPresetContent` using the resolved view and remove local view state. Implement Quota Focus with independent loading/empty/error labels, partial pressure values, top-four ranking, `+N more`, and bounded keyboard-accessible overflow. Delete the switch component, tests, Story, and obsolete switch CSS/references.

- [ ] **Step 4: Run Menubar unit and Storybook tests**

Run the commands from Step 2. Expected: all three resolved layouts render, tooltips retain current semantics, no switch remains, and overflow rows are keyboard reachable.

- [ ] **Step 5: Check for obsolete references**

Run: `pnpm --filter @ohmyc/ui test -- tests/storybook-surface.test.ts`
Expected: PASS with `ViewSwitch.stories.tsx` removed from the curated surface test and no active `ViewSwitch` imports remaining.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar packages/ui/src/stories/menubar packages/ui/tests/components/menubar packages/ui/tests/storybook-surface.test.ts
git commit -m "refactor(ui): drive menubar layouts from settings"
```

### Task 4: Add the real-data Settings gallery and Apply flow

**Files:**
- Create: `packages/ui/src/components/settings/menu-bar-view-gallery.tsx`
- Create: `packages/ui/src/components/settings/menu-bar-section.tsx`
- Modify: `packages/ui/src/routes/settings-page.tsx`
- Modify: `packages/ui/src/components/settings/appearance-section.tsx`
- Modify: `packages/ui/src/stories/product/SettingsPage.stories.tsx`

**Interfaces:**
- Consumes: `MenubarPresetContent` from Task 3 and `ResolvedSettings` / `MenubarView` from Task 2.
- Produces: `MenuBarViewGallery({ settings }: { settings: ResolvedSettings })`.
- Produces: `MenuBarSection()` containing the gallery and the existing icon-visibility/hide-confirmation controls.

- [ ] **Step 1: Update Settings stories with gallery fixtures**

Install the existing Timeline and Quota fixtures alongside `registerMockSettings()` so previews use real shared components. Add stories for default gallery, env override, rejected Apply, and no backend.

- [ ] **Step 2: Write failing interaction tests**

Cover these exact behaviors:

```tsx
// Next/arrow/dot/LeftRight browsing causes zero settings.set calls.
// Apply on Bricks sends { menubar: { view: 'heatmap' } } exactly once.
// Rapid repeat clicks while pending still produce only one request.
// Env override: arrows/dots/keyboard/touch browsing still work; only Apply is disabled.
// Rejected Apply retains browsed Heatmap, applied Area, and shows
// "Couldn't save menu bar view. Try again."; retry succeeds with the same patch.
// NoBackend renders Appearance but neither the gallery nor provider controls.
```

Also assert the Quota Focus preview's named provider region can receive Tab focus and keyboard scrolling while preview chart/window actions remain inert.

- [ ] **Step 3: Run Settings Storybook tests and verify they fail**

Run: `pnpm --filter @ohmyc/ui test:storybook -- SettingsPage`
Expected: FAIL because the Menu bar section and gallery do not exist.

- [ ] **Step 4: Implement the gallery and section**

Render `area`, `heatmap`, and `quota` through `MenubarPresetContent` with `preview: true`. Keep all three previews available to the horizontal scroll-snap carousel; implement arrow buttons, pagination dots, touch/trackpad scrolling, and Left/Right navigation. Show preset name/description and the bottom `Use …` button with the currently applied state.

Use local browsed state plus `useUpdateSettings()` for Apply. Prevent duplicate writes; never optimistically change the applied selection. On failure, retain browsed state, restore control availability, show the specified inline error, and let the same Apply button retry. Env override disables only Apply, not preview navigation.

Move the icon-visibility row and hide confirmation from Appearance into `MenuBarSection`; render the new section between Quota and Appearance only when a settings backend is available.

- [ ] **Step 5: Run Settings tests and verify they pass**

Run the command from Step 3. Expected: real previews, Apply, failure recovery, keyboard access, env behavior, and no-backend fallback all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/settings packages/ui/src/routes/settings-page.tsx packages/ui/src/stories/product/SettingsPage.stories.tsx
git commit -m "feat(ui): add menu bar view gallery"
```

### Task 5: Add the approved pointer tilt, glow, and hover scale

**Files:**
- Create: `packages/ui/src/components/settings/use-menu-bar-preview-tilt.ts`
- Create: `packages/ui/src/components/settings/menu-bar-view-gallery.css`
- Modify: `packages/ui/src/components/settings/menu-bar-view-gallery.tsx`
- Create: `packages/ui/tests/components/settings/menu-bar-view-gallery.test.tsx`

**Interfaces:**
- Consumes: Task 4's stable outer slide and preview frame.
- Produces: `useMenuBarPreviewTilt({ active, position }: { active: boolean; position: 'before' | 'after' | 'active' })` returning the outer-slide and preview refs used by the gallery.

- [ ] **Step 1: Write failing pointer tests**

Use a controllable `matchMedia` and `requestAnimationFrame` harness. Cover:

```tsx
// fine pointer + active slide + upper-right pointer entry:
expect(preview).toHaveAttribute('data-tilting', 'true')
// after frames: transform contains rotateX/rotateY and scale(1.02)
// pointer leave: targets base angle/scale and glow opacity 0
// coarse pointer or reduced motion: no data-tilting and no glow
// switching slides: old inline transform/glow is cleared before the new active slide
```

- [ ] **Step 2: Run pointer tests and verify they fail**

Run: `pnpm --filter @ohmyc/ui test -- tests/components/settings/menu-bar-view-gallery.test.tsx`
Expected: FAIL because the pointer hook and frame styles do not exist.

- [ ] **Step 3: Implement the approved effect**

Port the approved v6 behavior, not the rejected direct-1:1 experiment. Use a critically damped spring with response `0.3`, derived from `angularFrequency = 2π / response` and `damping = 2 * angularFrequency`. Keep base perspective by slide position, small pointer-follow X/Y tilt, local monochrome glow, and `scale(1.02)`.

Attach listeners to the outer slide and add a `12px` pseudo-element hover allowance so transformed corners do not lose events. Animate only transform/opacity-driven effects; reset on leave and clear stale effects on slide changes. Gate on `(hover: hover) and (pointer: fine)` and `prefers-reduced-motion`; do not run any ambient animation.

- [ ] **Step 4: Run pointer and gallery tests**

Run the command from Step 2 and `pnpm --filter @ohmyc/ui test:storybook -- SettingsPage`.
Expected: upper-right activation, scale, reset, slide cleanup, coarse-pointer/reduced-motion gating, and existing gallery behavior PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/settings packages/ui/tests/components/settings/menu-bar-view-gallery.test.tsx
git commit -m "feat(ui): add interactive menu bar preview motion"
```

### Task 6: Add the release note and run full project verification

**Files:**
- Create: `.changeset/menu-bar-view-picker.md`
- Modify: any stale comments/docstrings found in the changed Menubar/Settings files

**Interfaces:**
- Consumes: all preceding tasks; no new runtime API.

- [ ] **Step 1: Add a minor changeset**

Use:

```md
---
"@ohmyc/desktop": minor
"@ohmyc/ui": minor
---

Add a real-data menu bar layout gallery with Trend, Bricks, and Quota Focus presets. Persist the selected Popover layout, synchronize it across windows, and remove the temporary chart switch. Add accessible carousel controls and reduced-motion-safe pointer previews.
```

Sweep changed files for comments that still describe temporary view switching, static previews, or the old Settings section placement and align them with the implementation.

- [ ] **Step 2: Run the exact CI-equivalent checks**

```bash
rustup show active-toolchain
cargo clippy --all-targets --all-features -- -D warnings
pnpm build
pnpm --filter @ohmyc/ui test:storybook
```

Expected: active toolchain matches `rust-toolchain.toml`; every command exits 0.

- [ ] **Step 3: Exercise the final user scenario in the real desktop shell**

Verify with real calls, not only imports: browse all three previews without writes; Apply each preset; confirm the actual Popover updates without a switch; restart and confirm persistence; confirm Quota polling does not change; test a second window, env override, empty/error Quota states, upper-right hover, keyboard-only scrolling, and reduced motion.

- [ ] **Step 4: Inspect the final diff and commit the release note**

Run `git status --short` and `git diff --check`. Ensure no `.superpowers/` demo or unrelated `.omo/` content is staged.

```bash
git add .changeset/menu-bar-view-picker.md
git commit -m "chore: release menu bar view picker"
```
