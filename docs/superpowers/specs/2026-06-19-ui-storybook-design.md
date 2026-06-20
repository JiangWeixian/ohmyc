# UI Storybook Design

## Goal

Add Storybook to `packages/ui` as a design-system documentation surface and a
local/CI-friendly story test foundation. The first version should document the
core OhMyC UI language, cover product-critical components, and make future
visual regression work easier without introducing Chromatic or any cloud
service.

## Non-Goals

- Do not connect Chromatic in the first version.
- Do not create preview HTML or a separate browser companion artifact.
- Do not move Storybook config to the monorepo root.
- Do not document every page or every component in one pass.
- Do not include `packages/desktop/src/menubar.tsx` directly in Storybook.
- Do not refactor component APIs unless a very small isolation seam is required.

## Architecture

Storybook lives inside `packages/ui`, because that package owns the React,
Vite, Tailwind, globals, and component exports Storybook needs. Keeping it local
also avoids coupling Storybook to the desktop/Tauri runtime.

Planned structure:

```text
packages/ui/
  .storybook/
    main.ts
    preview.tsx
    vitest.setup.ts
  src/
    stories/
      decorators/
      fixtures/
      design-system/
      product/
      menubar/
```

`main.ts` uses the React Vite framework and enables docs, accessibility, and
the Storybook Vitest addon. `preview.tsx` imports `src/globals.css`, sets the
default dark rendering context, and wires shared decorators.

The package scripts should include:

```json
{
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build",
  "test:storybook": "vitest --project storybook"
}
```

Keep these public script names stable. The implementation plan may choose the
exact underlying Vitest addon command required by the installed Storybook
version, but consumers should always have separate dev, build, and story-test
entry points with the names above.

## Addons And Test Scope

Use these Storybook capabilities in the first version:

- `@storybook/react-vite` for React + Vite integration.
- Storybook docs for component documentation.
- Storybook accessibility addon for manual a11y inspection.
- Storybook Vitest addon for story render/play testing.

The first version does not use Chromatic. Stories should still be stable enough
to become visual-regression inputs later: fixed data, deterministic dates,
bounded containers, and no dependency on local machine state.

Existing Vitest tests remain the source of truth for routing, hooks, transport,
and detailed behavior. Storybook tests are a smoke and interaction layer over
documented UI states.

## Decorators

Shared decorators should be small and explicit:

- `OhMyCThemeDecorator`: applies the dark app background, imports global CSS,
  and keeps the preview close to the product surface.
- `QueryClientDecorator`: provides a React Query client with retries disabled
  and stable cache behavior for stories.
- `RouterDecorator`: provides a memory router for navigation-aware components.
- `MockTransportDecorator`: installs deterministic mock handlers for components
  that use app data hooks.
- `MenubarFrameDecorator`: renders menubar stories inside a fixed popover-sized
  frame with the same dark translucent visual context as the desktop popover.

Decorators should live under `src/stories/decorators/` and be composed per
story. Avoid one global decorator that hides dependencies for every story.

## Fixtures

Stories should not call Tauri or read the user's local files. Shared fixtures
live under `src/stories/fixtures/`:

```text
agents.ts
commands.ts
skills.ts
plugins.ts
timeline.ts
menubar.ts
```

Fixtures use fixed dates and representative content:

- Short and long labels.
- Empty states.
- Error states where the component supports them.
- Multiple origins and badges for library entities.
- Timeline days with multiple projects, sessions, token counts, and no-activity
  variants.
- Menubar line and heatmap datasets with a known peak day.

## Story Groups

### Design System

Create stories under `src/stories/design-system/` for:

- `Button`
- `Badge`
- `Input`
- `Tabs`
- `Select`
- `DropdownMenu`
- `NativeDialog`
- `NativeButton`

Each story should show stable, reviewable states such as default, variants,
disabled, long labels, open popovers, and focus/keyboard-relevant states where
practical. These stories document the monochrome visual system, density,
border language, and motion policy without turning Storybook into a playground
for every prop combination.

### Product

Create stories under `src/stories/product/` for:

- `CommandPalette`
  - Open with normal commands.
  - Open with long command labels and shortcuts.
  - Empty state.
- `NavigationIsland`
  - Expanded.
  - Collapsed.
  - Active Signal and Explore routes.
- `EntityCard`
  - Agent, skill, and command variants.
  - Long descriptions.
  - Origin badges.
- `EntityDetail`
  - Metadata strip.
  - Project-scoped read-only state.
- Timeline components
  - `ContributionGraph`
  - `EventList`
  - A fixture-backed `TimelineView` story if it can remain deterministic.
- `MonitorSpikeView`
  - Default state.
  - A reduced-motion note in docs. Do not make story tests depend on WebGL or
    animation timing.

These stories protect the main app surfaces that are most likely to regress
visually: navigation, command search, entity browsing, timeline activity, and
the monitor identity surface.

### Menubar

Create stories under `src/stories/menubar/` for:

- `MenubarPage`
  - Line view.
  - Heatmap view.
  - No-activity state.
- `ViewSwitch`
- `DualLineChart`
- `RecentHeatmap`

Menubar stories render inside `MenubarFrameDecorator`, with a fixed popover
size and translucent dark background. This documents the UI that the desktop
menubar popover displays without importing the desktop wrapper.

`packages/desktop/src/menubar.tsx` remains outside Storybook. Its role is the
integration boundary: provide `QueryClientProvider`, handle Escape by invoking
`hide_popover`, and render `MenubarPage`. That behavior belongs in desktop or
integration tests, not UI stories.

## Data Flow

Components that already accept props should be rendered directly with fixtures.
Components that depend on data hooks should use the existing mock transport
where possible. The Storybook mock setup should mirror the current test
fixtures rather than inventing a second data layer.

If a component imports Tauri APIs directly, the story environment should mock
those calls. For example, the Menubar "Open OhMyC" action can render and be
clicked without opening a window; the invoked commands are mocked.

## Error Handling

Stories should include visible loading, empty, and error states for data-heavy
components when those states are part of the component's UI contract. Mock
handlers should return deterministic failure results instead of letting
requests throw unexpectedly.

If a canvas, WebGL, or chart component is unstable in Storybook tests, the
component should still have a story, but the test should assert only stable DOM
or shell behavior. Do not add brittle pixel or animation-timing assertions in
the first version.

## Testing Plan

Implementation should verify:

```bash
pnpm --filter @ohmyc/ui build-storybook
pnpm --filter @ohmyc/ui test:storybook
pnpm --filter @ohmyc/ui test
pnpm --filter @ohmyc/ui build
```

`pnpm --filter @ohmyc/ui lint` is desirable, but current full-project linting
has an existing `eslint-plugin-tailwindcss` compatibility failure with ESLint
10. The Storybook work should not make that worse. If implementation touches
lint config, it must be called out explicitly in the plan.

## Rollout Order

1. Install Storybook React Vite and selected addons in `packages/ui`.
2. Add scripts and `.storybook` config.
3. Add shared decorators and fixtures.
4. Add design-system stories.
5. Add CommandPalette, NavigationIsland, EntityCard, and EntityDetail stories.
6. Add Timeline stories.
7. Add Menubar stories.
8. Add MonitorSpike story.
9. Run Storybook build/tests and existing UI verification.

## Success Criteria

- `packages/ui` has a working Storybook dev server.
- Storybook build succeeds without requiring Tauri or local user data.
- Storybook Vitest addon can run the documented stories.
- The first story set covers both design-system primitives and product-critical
  surfaces.
- Menubar UI is documented through `packages/ui` components while the desktop
  wrapper remains a separate integration boundary.
- The implementation keeps OhMyC's monochrome, dense, signal-first visual
  language intact.
