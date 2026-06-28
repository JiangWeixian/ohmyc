# Route Flattening Design

## Summary

Flatten the `/explore/:tab` dynamic route parameter into six explicit sibling routes under `/explore/*`, split the monolithic `Explorer` component into per-path page components, and introduce a single source of truth (`nav-items.ts`) that the route table, command palette (⌘K), and `NavigationIsland` all derive from. Delete the two spike routes and the orphaned `LanyardStatsSpikeView` component.

## Problem

Three symptoms, all rooted in the same drift:

1. **`/explore/:tab` hides six pages behind a dynamic param.** The route table looks thin (7 entries) but `Explorer.tsx` actually switches between `timeline` / `monitor` / `agents` / `skills` / `commands` / `plugins` via `activeSection` derived from `useParams().tab`. URL ↔ component mapping is implicit.

2. **Spike routes and a duplicate monitor pollute the route table.** `/explore/monitor-spike` renders the same `MonitorSpikeView` as the `/explore/monitor` tab. `/explore/monitor-lanyard-stats-spike` is the only consumer of `LanyardStatsSpikeView`. Both are experimental leftovers.

3. **Three navigation sources drift independently.** The route table, ⌘K `goToCommands` (5 entries — missing `plugins`), and `NavigationIsland` (6 entries) are three hand-maintained lists. `plugins` is already missing from ⌘K; the next addition will drift further.

## Approach

### Route shape

Keep the `/explore` namespace (no URL migration to bare `/timeline`). Replace the `:tab` dynamic param with six explicit `<Route>` siblings:

```tsx
<Routes>
  <Route path="/explore/monitor"   element={<ExplorerLayout><MonitorPage /></ExplorerLayout>} />
  <Route path="/explore/timeline"  element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
  <Route path="/explore/agents"    element={<ExplorerLayout><AgentsPage /></ExplorerLayout>} />
  <Route path="/explore/skills"    element={<ExplorerLayout><SkillsPage /></ExplorerLayout>} />
  <Route path="/explore/commands"  element={<ExplorerLayout><CommandsPage /></ExplorerLayout>} />
  <Route path="/explore/plugins"   element={<ExplorerLayout><PluginsPage /></ExplorerLayout>} />

  <Route path="/explore"           element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/explore/*"         element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/onboard"           element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/menubar"           element={<MenubarPage />} />
  <Route path="*"                  element={<Navigate to="/explore/timeline" replace />} />
</Routes>
```

**Fallback behavior preserved:** `/explore/hooks`, `/explore/settings`, `/explore/mcp`, `/explore/lsp`, and the deleted `/explore/monitor-spike` / `/explore/monitor-lanyard-stats-spike` all hit `/explore/*` and redirect to `/explore/timeline`. Previously these fell back via `activeSection` defaulting in `Explorer.tsx`; the user-visible outcome is identical.

### `MonitorPage` full-bleed

`MonitorPage` renders `MonitorSpikeView` and must stay full-bleed (no `explorer-content-shell` padding wrapper). `ExplorerLayout` accepts a `padded?: boolean` prop (default `true`); the monitor route passes `padded={false}`:

```tsx
<Route path="/explore/monitor" element={<ExplorerLayout padded={false}><MonitorPage /></ExplorerLayout>} />
```

`ExplorerLayout` always renders `<motion.main>` + `<NavigationIsland />` + the `dimBg` overlay (those are shared across all explorer routes), but skips the `explorer-content-shell` padding div when `padded={false}`. This preserves the contract asserted by `explorer.routes.test.tsx:131` (`queryByTestId('explorer-content-shell')` returns null on `/explore/monitor`).

### `/menubar` stays independent

`/menubar` is a separate full-screen experience (desktop menubar popover preview), not part of the Explore system. It does not enter `NAV_ITEMS` and keeps its top-level `<Route>`.

## Single Source of Truth: `nav-items.ts`

```ts
// packages/ui/src/components/nav-items.ts
import { Activity, Blocks, Bot, Code2, Sparkles, TerminalSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItemId = 'monitor' | 'timeline' | 'agents' | 'skills' | 'commands' | 'plugins'

export interface NavItem {
  id: NavItemId
  path: `/explore/${NavItemId}`
  label: string
  icon: LucideIcon
  keycap: string  // single letter, used by island display + ⌘K `g <key>` shortcut
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'monitor',  path: '/explore/monitor',  label: 'Monitor',  icon: Code2,           keycap: 'M' },
  { id: 'timeline', path: '/explore/timeline', label: 'Timeline', icon: Activity,        keycap: 'T' },
  { id: 'agents',   path: '/explore/agents',   label: 'Agents',   icon: Bot,             keycap: 'A' },
  { id: 'commands', path: '/explore/commands', label: 'Commands', icon: TerminalSquare,  keycap: 'C' },
  { id: 'skills',   path: '/explore/skills',   label: 'Skills',   icon: Sparkles,        keycap: 'S' },
  { id: 'plugins',  path: '/explore/plugins',  label: 'Plugins',  icon: Blocks,          keycap: 'P' },
]
```

### Consumers

| Consumer | Before | After |
|----------|--------|-------|
| **Route table** (`app-shell.tsx`) | `:tab` + 2 spike routes | Six explicit `<Route>` lines. A unit test asserts the route `path` set equals `NAV_ITEMS` path set — catches drift either way. |
| **⌘K `goToCommands`** (`app-shell.tsx`) | Hardcoded 5 entries (missing `plugins`) | `NAV_ITEMS.map(item => ({ id: \`goto-${item.id}\`, label: item.label, shortcut: \`g ${item.keycap.toLowerCase()}\`, icon: <item.icon size={14} />, category: 'Go to', action: () => navigate(item.path) }))` |
| **`NavigationIsland`** | Hardcoded 6-entry array (already matches `NAV_ITEMS` shape) | Imports `NAV_ITEMS` directly |

### Why routes are not generated from `NAV_ITEMS`

`<Route>` needs an `element` prop binding the path to a specific page component. Pushing JSX into a data file (`nav-items.ts`) couples data to rendering. Instead, `app-shell.tsx` keeps six explicit `<Route>` lines and a unit test (`app.routes.test.tsx` new case) asserts the route set and `NAV_ITEMS` set stay in sync.

**Test approach:** render `<AppLayout />` at each `NAV_ITEMS[i].path` via the existing `renderWithProviders` test harness and assert no redirect occurred (each page renders its own testid via the existing mocks). This catches both failure modes — a `NAV_ITEMS` entry with no matching route (redirects to `/explore/timeline`), and a route with no `NAV_ITEMS` entry (won't be exercised by the loop).

## File Structure

```
packages/ui/src/
├── app-shell.tsx                  [MODIFY: route table + ⌘K derived from NAV_ITEMS]
├── routes/                        [NEW directory — one file per path]
│   ├── timeline-page.tsx          [NEW] → /explore/timeline
│   ├── monitor-page.tsx           [NEW] → /explore/monitor
│   ├── plugins-page.tsx           [NEW] → /explore/plugins
│   ├── agents-page.tsx            [NEW] → /explore/agents
│   ├── skills-page.tsx            [NEW] → /explore/skills
│   └── commands-page.tsx          [NEW] → /explore/commands
├── components/
│   ├── explorer-layout.tsx        [NEW] — motion.main shell, blur/scale, dimBg, NavigationIsland mount
│   ├── nav-items.ts               [NEW] — NAV_ITEMS single source of truth
│   ├── entity-list.tsx            [NEW] — shared presentational: EntityCard grid + EntityDetail + empty/error
│   ├── entity-config.ts           [NEW] — ENTITY_CONFIG + SECTION_DESCRIPTIONS (extracted from explorer.tsx)
│   └── ... (existing components unchanged)
├── explorer.tsx                   [DELETE — split into routes/ + components/]
└── components/monitor-spike/
    ├── monitor-spike-view.tsx     [KEEP — MonitorPage still renders it]
    └── lanyard-stats-spike-view.tsx  [DELETE — orphaned after spike route removal]
```

### Rule

- `routes/*.tsx` — files that map 1:1 to a URL path. Each is a leaf rendered by `<Route element={...}>`.
- `components/*` — everything else: layouts, shared presentational components, data configs, navigation source.

## Component Responsibilities

### `ExplorerLayout`

Owns the route-shell rendering:

- `useIslandStore` for `hoverProgress` → `pageFilter` (blur/brightness), `pageScale`, `dimBg` overlay
- `<NavigationIsland />` mount
- `<motion.main>` wrapper
- The `explorer-content-shell` div with `px-10 pb-12 pl-[280px] pt-10 max-lg:pl-[260px] max-md:px-5 max-md:pb-8 max-md:pt-24` and inner `max-w-6xl` container

For the monitor section, `ExplorerLayout` skips the `explorer-content-shell` and renders the child full-bleed inside `<motion.main>` (preserving `explorer.routes.test.tsx:131`).

### Route pages

| Page | Owns | Renders |
|------|------|---------|
| `TimelinePage` | (minimal shell) | `<TimelineView />` |
| `MonitorPage` | (minimal shell) | `<MonitorSpikeView />` |
| `PluginsPage` | `usePlugins()` + `useMarketplaces()`, SectionHeader, plugin cards, error/empty states | plugin card grid |
| `AgentsPage` | `useAgents()` + `useAgent()`, `selectedItem` state, click handlers | `<EntityList section="agents" ... />` |
| `SkillsPage` | `useSkills()` + `useSkill()`, `selectedItem` state | `<EntityList section="skills" ... />` |
| `CommandsPage` | `useCommands()` + `useCommand()`, `selectedItem` state | `<EntityList section="commands" ... />` |

### `EntityList` (shared presentational)

Props: `section`, `data`, `isError`, `selectedEntity`, `onSelectItem`, `onBack`, plus the per-section config from `entity-config.ts`.

Renders: `SectionHeader`, the error / empty / populated card grid, and `EntityDetail` when an item is selected. Currently lives inline as `renderEntityList()` in `explorer.tsx:138-282`; extracted verbatim into a component.

### `entity-config.ts`

Pure data extracted from `explorer.tsx:39-65`:

- `SECTION_DESCRIPTIONS` record
- `ENTITY_CONFIG` record (`iconAccentVar`, `getTitle`, `getDescription` per section)

No JSX, no hooks — safe to import from both route pages and tests.

## Key Benefits

1. **Data loading per page.** `useAgents()` runs only on `/explore/agents`; `usePlugins()` only on `/explore/plugins`. Today `explorer.tsx:93-103` fires all six hooks on every Explorer mount regardless of active section.
2. **`selectedItem` no longer leaks across sections.** Currently keyed by `location.key` as a workaround (`explorer.tsx:90`); post-migration the component unmounts on route change and state clears naturally. `explorer.routes.test.tsx:194` still passes — for a cleaner reason.
3. **⌘K regains `plugins`.** The missing entry is automatic once `goToCommands` derives from `NAV_ITEMS`.
4. **Route table reads as a table of contents.** Six explicit paths instead of a dynamic param that hides six pages.
5. **One place to add a destination.** Append to `NAV_ITEMS` + add one `<Route>` line + create one `routes/*-page.tsx`. A unit test enforces the first two stay in sync.

## Test Migration

### Preserved (behavior contracts)

| Test | Current assertion | After migration |
|------|-------------------|-----------------|
| `explorer.routes.test.tsx:86` Island shows Signal + Explore groups with all 6 items | Text content of `role=navigation` | Unchanged. Mock targets shift from `@/explorer` to the new page components. |
| `:122` Monitor route is full-bleed | `queryByTestId('explorer-content-shell')` is null | Unchanged. `MonitorPage` path through `ExplorerLayout` still skips the shell. |
| `:134` Non-monitor routes use the shell | `shell` has `pl-[280px]` + `max-lg:pl-[260px]` | Unchanged. `ExplorerLayout` provides these classes. |
| `:148` Plugins page shows plugin inventory | Text checks for `review-pack`, `Enabled`, `Agents: 1`, etc. | Unchanged. |
| `:171` opencode agent `permission.*` flattened rows | Text checks for `permission.edit`, `deny`, etc. | Unchanged. |
| `:194` Selection clears on route change | Click agent → navigate to plugins → back to agents; `permission.edit` gone | Unchanged assertion, cleaner mechanism (page unmount). |
| `:220` `/explore/hooks`, `/explore/mcp`, `/explore/lsp` fall back to timeline | Renders timeline content | **Adjusted:** assert redirect to `/explore/timeline` (the fallback now happens via `<Navigate>` in `/explore/*`, not via `activeSection` default). |
| `:241` `/explore/settings` falls back to timeline | Renders timeline content | Same adjustment as above. |
| `:255` Resource page internals preserved across shell change | Text checks for plugin inventory | Unchanged. |
| `:274` Timeline content inside new shell | `main h1` text content | Unchanged. |
| `app.routes.test.tsx:54` Unknown paths redirect to timeline | `explorer-route` testid appears | Unchanged (mock target updates). |
| `app.routes.test.tsx:62` `/explore` routed through Explorer | `explorer-route` testid appears | Unchanged. |
| `app.routes.test.tsx:70` ⌘K → Monitor with `g m` shortcut | Click `Monitor` → URL is `/explore/monitor` | Unchanged — now also validates that ⌘K is derived from `NAV_ITEMS`. |

### Deleted

- `explorer.routes.test.tsx:288-299` — entire `describe('Explorer spike routes')` block (2 tests asserting `/explore/monitor-spike` and `/explore/monitor-lanyard-stats-spike` render their components). Routes are deleted; tests for them go too.
- Mocks of `LanyardStatsSpikeView` in `explorer.routes.test.tsx:81-83` and `app.routes.test.tsx:33-35`.

### Added

- `nav-items.test.ts` — asserts `NAV_ITEMS` shape is stable: ids, paths, labels, keycaps, icon presence. Regression guard for the single source of truth.
- `app.routes.test.tsx` new case — **route table `path` set === `NAV_ITEMS` `path` set**. Prevents the two from drifting if someone adds a nav item without a route or vice versa.

## Cleanup

| Delete | Reason |
|--------|--------|
| `packages/ui/src/explorer.tsx` | Entire file split into `routes/` + `components/`. |
| `packages/ui/src/components/monitor-spike/lanyard-stats-spike-view.tsx` | Sole consumer (`/explore/monitor-lanyard-stats-spike` route) is deleted. Component becomes orphaned. |
| `LanyardStatsSpikeView` import in `app-shell.tsx` | Follows from above. |
| Spike route `<Route>` lines in `app-shell.tsx` | The two deleted experimental routes. |
| `MonitorSpikeView` import in `app-shell.tsx` | No longer used at the route level (still used inside `MonitorPage`). |

### Kept (unchanged)

- `packages/ui/src/components/monitor-spike/monitor-spike-view.tsx` — `MonitorPage` renders it.
- `packages/ui/src/stories/product/MonitorSpikeView.stories.tsx` — Storybook unaffected by routing.
- `packages/ui/tests/components/monitor/monitor-spike-view.test.tsx` — component-level test, unaffected.
- `packages/ui/src/components/menubar/*` — `/menubar` route is untouched.

## Non-Goals

- **No URL migration off `/explore`.** Bare `/timeline`, `/agents`, etc. are out of scope. The `/explore` namespace stays.
- **No `/menubar` integration into `NAV_ITEMS`.** Menubar remains an independent full-screen route with its own entry path.
- **No `/onboard` exposure.** It stays a hidden redirect target, not a user-facing destination.
- **No layout-route refactor.** `<Route path="/explore" element={<ExplorerLayout/>}>` with nested children was considered and rejected; `ExplorerLayout` is rendered explicitly per-route instead.
- **No new destinations.** No new tabs, no new pages. This is purely a structural refactor plus spike cleanup.
