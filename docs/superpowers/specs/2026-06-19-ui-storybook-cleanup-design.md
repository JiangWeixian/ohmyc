# UI Storybook Cleanup Design

## Goal

Tighten `packages/ui` after the initial Storybook addition by removing one unused wrapper component, aligning Timeline controls with the shared design-system Select, and trimming Storybook entries that document isolated menubar internals instead of real product surfaces.

## Scope

This cleanup includes three changes:

1. Remove `NativeButton` as a component surface.
2. Replace Timeline route Project and Year controls with `packages/ui/src/components/ui/select.tsx`.
3. Remove standalone `Menubar/RecentHeatmap` and `Menubar/DualLineChart` stories while keeping `Menubar/MenubarPage` stories.

This does not redesign Timeline, Menubar, Button, Select, or the Storybook theme. The visual system remains the monochrome, signal-first OhMyC system described in `PRODUCT.md` and `DESIGN.md`.

## NativeButton Removal

`NativeButton` currently exists as a thin wrapper around `Button` with loading and glow props, but it has no product usage. Its remaining references are its own Storybook story and a motion-policy test. Keeping it creates an unnecessary second button surface beside `components/ui/button.tsx`.

The implementation should:

- Delete `packages/ui/src/components/uitripled/native-button.tsx`.
- Delete `packages/ui/src/stories/design-system/NativeButton.stories.tsx`.
- Remove or narrow the motion-policy test that only exists to assert `NativeButton` behavior.
- Keep `Button.stories.tsx` as the canonical button Storybook entry.

If a loading button is needed later, it should be added deliberately to `Button` or composed at the call site after a real product need appears.

## Timeline Select Migration

`TimelineView` currently uses a local `CtrlSelect` helper backed by a native invisible `<select>`. Project and Year should instead use the shared Radix Select wrapper from `packages/ui/src/components/ui/select.tsx` so the Timeline route uses the same interactive primitives documented in Storybook.

The implementation should:

- Import `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, and `SelectValue` in `packages/ui/src/components/timeline/timeline-view.tsx`.
- Replace `CtrlSelect` with a small Timeline-specific wrapper around the shared Select primitive.
- Preserve existing values and state transitions:
  - Project uses `__all__` for all projects and maps it back to `undefined`.
  - Year stores a string in Select and maps back to `number`.
- Preserve the compact Timeline controls-bar density and monochrome chrome.
- Keep controls keyboard accessible through Radix Select behavior.

The wrapper can remain private to `timeline-view.tsx`; there is no need to create a new shared abstraction unless a second route needs the same labeled compact select.

## Menubar Storybook Cleanup

The independent `Menubar/RecentHeatmap` and `Menubar/DualLineChart` stories expose implementation details that are less useful than the composed menubar experience. `Menubar/MenubarPage` already exercises both views through the real switcher and shared data flow.

The implementation should:

- Delete `packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx`.
- Delete `packages/ui/src/stories/menubar/DualLineChart.stories.tsx`.
- Keep `packages/ui/src/stories/menubar/MenubarPage.stories.tsx`.
- Keep `packages/ui/src/stories/menubar/ViewSwitch.stories.tsx`, because it documents a direct reusable control surface.
- Keep the underlying `recent-heatmap.tsx` and `dual-line-chart.tsx` component files, because `MenubarPage` still uses them and they remain useful internal component boundaries.

## Storybook And Test Expectations

After cleanup, Storybook should no longer show:

- `Design System/NativeButton`
- `Menubar/RecentHeatmap`
- `Menubar/DualLineChart`

Storybook should still show:

- `Design System/Button`
- `Menubar/MenubarPage`
- `Menubar/ViewSwitch`
- Timeline product stories, including `TimelineView`

Expected verification:

- `pnpm --filter @ohmyc/ui test:storybook` passes with fewer story files/tests than before.
- `pnpm --filter @ohmyc/ui build-storybook` passes.
- `pnpm --filter @ohmyc/ui test` passes.
- `pnpm --filter @ohmyc/ui build` passes.
- `pnpm --filter @ohmyc/ui lint` may still hit the existing ESLint 10 / `eslint-plugin-tailwindcss` crash; new source-file lint issues should be fixed.

## Risks

- Radix Select portals may need stable Storybook/Vitest behavior. Existing Storybook Vitest config already pre-optimizes `@radix-ui/react-select`.
- Timeline tests that query native `<select>` elements may need to switch to role-based Radix Select interactions.
- Removing `NativeButton` requires checking exports and imports to avoid leaving a stale dead file or broken test.

## Self-Review

- Placeholder scan: no `TBD`, `TODO`, or unresolved placeholders remain.
- Scope check: this is a focused cleanup of three UI/Storybook surfaces, not a broader design-system rewrite.
- Consistency check: the plan keeps product-facing Menubar coverage through `MenubarPage` while removing isolated implementation stories.
- Ambiguity check: `NativeButton` removal means deleting the component file, not only hiding it from Storybook.
