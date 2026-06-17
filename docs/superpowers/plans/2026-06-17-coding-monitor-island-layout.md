# Coding Monitor Island Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headerless personal Coding Monitor shell: floating collapsible navigation island, `/explore/monitor` route, animated big stats, and preserved Timeline/resource page internals.

**Architecture:** Keep React Router's `/explore/:tab` surface but move persistent chrome from `Header` + docked `Sidebar` into a floating `NavigationIsland`. Add a Monitor route as route-owned content that reuses timeline data hooks for stats and starts with a DOM/WebGL-ready stage abstraction. Treat React Bits Lanyard/WebGL as a follow-on spike layer behind a stable `MonitorStage` boundary so the app remains usable without 3D dependencies.

**Tech Stack:** React 19, React Router, TanStack Query, Tailwind CSS, lucide-react, framer-motion, Vitest, Testing Library. Future WebGL spike: React Bits Lanyard with React Three Fiber/Drei dependencies after checking the current official React Bits installation page.

---

## Source Of Truth

- `DESIGN.md` is binding. Read it before editing UI.
- Active mockups:
  - `~/.gstack/projects/JiangWeixian-claudeui/designs/coding-monitor-20260617/index.html`
  - `~/.gstack/projects/JiangWeixian-claudeui/designs/headerless-island-20260617/index.html`
- Current design decisions to preserve:
  - No global top header on Monitor, Timeline, Agents, Commands, Skills, or Plugins.
  - Navigation is a floating island; collapsed state is one `52-56px` icon badge, not a mini rail.
  - Non-Monitor routes keep their internal layout and information architecture.
  - Monitor is `/explore/monitor`; Timeline remains default at `/explore/timeline`.
  - Stats are display-scale numbers, not cards.
  - Framer Motion owns DOM chrome and DOM count-up; R3F/Drei owns scene physics and in-Canvas motion.
- Component rule: new interactive controls should prefer existing shadcn-style primitives under `packages/ui/src/components/ui/*` (`Button`, `Select`, `DropdownMenu`, etc.). Use raw elements only when the primitive would be semantically wrong or no local primitive exists; route navigation remains `NavLink`.

## Design Review Amendments

This section captures the `/plan-design-review` decisions that make the plan implementation-ready.

**Initial design score:** 7/10.
**Target design score after amendments:** 8.5/10.

### Information Architecture

- Keep Monitor as the memorable identity route, but do not make it the default redirect in this change. `/explore` and wildcard routes continue to land on `/explore/timeline` because Timeline proves local data is connected.
- The navigation island is the only persistent shell chrome. It groups Monitor and Timeline under `Signal`, and resource pages under `Explore`.
- Resource pages and Timeline keep their current route-owned body layouts. This change moves chrome; it does not redesign inventory cards, detail panels, Timeline controls, or contribution graph behavior.

### Stats Semantics

- The first implementation must label Monitor stats as a **latest timeline window**, not all-time profile totals. Current hooks expose all-time `sessionCount` through `useTimelineStatus()`, but they do not expose an all-time token total. Mixing all-time sessions with window-scoped tokens would make the display-scale stats misleading.
- `sessions` and `tokens` both come from the same `useTimelineEvents({})` result window for this plan. `last sync` comes from `useTimelineStatus()`.
- Add a small scope caption near the stats: `latest timeline window`. The big numbers remain the visual subject; the caption prevents ambiguity.
- Do not add backend timeline APIs in this plan. A future all-time Monitor can add a dedicated aggregate endpoint that returns sessions, tokens, turns, active days, and last sync from one consistent source.

### Mobile And Focus Behavior

- The expanded island may be visible on mobile, but it should behave like a temporary overlay: when a user taps a route link on a narrow viewport, collapse the island back to the single icon badge.
- Collapse and expand controls must use `Button` from `@/components/ui/button`, expose `aria-label`, `aria-expanded`, and `aria-controls`, and restore focus to the newly visible control after toggling.
- Route links remain `NavLink` so active state and `aria-current="page"` are handled by React Router.
- Mobile content must reserve enough top padding for the collapsed badge. Expanded island overlay may cover content temporarily, but the default route view should not start under the badge.

### Monitor States

- Loading: show the Lanyard stage/fallback immediately and mark the stats list `aria-busy="true"`. Keep the surface calm; do not introduce skeleton rows.
- Empty timeline: keep the Lanyard identity surface, render `0 / sessions`, `0 / tokens`, `never / last sync`, and show one quiet helper line: `Run a Claude Code session and your activity will appear here.`
- Timeline error: keep the route usable and show a small `role="status"` message: `Timeline signal unavailable. Monitor will update after the next successful sync.`
- WebGL unavailable or reduced motion: show `LanyardFallback`; do not hide the route or block stats rendering.

### Motion Boundary

- Framer Motion is allowed for island expand/collapse, route entrance, and DOM count-up numbers.
- React Bits/R3F owns Lanyard physics and any in-Canvas stats or orbital signal effects after the spike.
- `prefers-reduced-motion` disables DOM count-up animation, hover scale, particles, parallax, and any nonessential WebGL motion.

### Not In Scope

- Making Monitor the default route: deferred until the Monitor surface proves useful enough to replace Timeline as the first data proof.
- Backend aggregate API for all-time profile stats: deferred; this plan uses existing timeline hooks only.
- Redesigning Timeline/resource internals: explicitly out of scope; this plan changes shell chrome and adds Monitor.
- Final brand icon: deferred; use a lucide placeholder so later brand replacement touches only the island mark.

### What Already Exists

- `DESIGN.md` defines the monochrome visual system, headerless island shell, Monitor composition, motion boundary, and active mockup paths.
- `packages/ui/src/hooks/use-timeline.ts` already exposes `useTimelineEvents({})` and `useTimelineStatus()` for first-pass Monitor stats.
- `packages/ui/src/components/ui/button.tsx` already exposes the shadcn-style `Button` primitive and `icon-lg` size.
- `CommandPaletteProvider` / `useCommandPalette()` already provide the island command trigger behavior.

## File Structure

Create:

- `packages/ui/src/components/navigation-island.tsx`
  - Floating shell navigation component with expanded and collapsed modes.
  - Owns island collapse state and optional command palette trigger.
- `packages/ui/src/components/monitor/monitor-view.tsx`
  - Route-level Monitor composition: stage background, lanyard placeholder, stats area, accessible text.
- `packages/ui/src/components/monitor/monitor-stats.tsx`
  - Stats derivation and animated number rendering for the DOM fallback.
- `packages/ui/tests/components/navigation-island.test.tsx`
  - Unit tests for expanded/collapsed island behavior and route navigation.
- `packages/ui/tests/components/monitor/monitor-view.test.tsx`
  - Unit tests for Monitor stats and fallback states.

Modify:

- `packages/ui/src/explorer.tsx`
  - Remove `Header` and docked `Sidebar`.
  - Render `NavigationIsland`.
  - Add `monitor` to active route handling.
  - Preserve existing Timeline/resource internals and page-body constraints.
- `packages/ui/src/app.tsx`
  - Add Monitor command palette entry.
  - Keep `/explore` and wildcard redirects pointed at `/explore/timeline`.
- `packages/ui/src/hooks/use-keyboard-shortcuts.ts`
  - Add `g m`, `g a`, `g c`, and `g t`; keep `g s`.
- `packages/ui/tests/explorer.routes.test.tsx`
  - Update shell assertions from docked sidebar/header to floating island.
  - Keep removed-route fallback coverage.
- `packages/ui/tests/app.routes.test.tsx`
  - Add Monitor command palette route coverage.
- `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`
  - Add shortcut coverage for Monitor, Agents, Commands, Timeline.

Do not modify in this plan:

- `packages/ui/src/components/timeline/contribution-graph.tsx`
- `packages/ui/src/components/timeline/event-list.tsx`
- `packages/ui/src/components/entity-card.tsx`
- `packages/ui/src/components/entity-detail.tsx`
- Backend timeline APIs

## Task 1: Lock Route And Shell Tests First

**Files:**
- Rename: `packages/ui/tests/explorer.inventory.test.tsx` -> `packages/ui/tests/explorer.routes.test.tsx`
- Modify: `packages/ui/tests/app.routes.test.tsx`
- Modify: `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`

- [ ] **Step 0: Rename Explorer route test file**

Run:

```bash
git mv packages/ui/tests/explorer.inventory.test.tsx packages/ui/tests/explorer.routes.test.tsx
```

Expected: the renamed file keeps the existing tests before edits. Use `explorer.routes.test.tsx` because these assertions now cover route shell behavior, not only inventory cards.

- [ ] **Step 1: Update Explorer shell test expectations**

Replace the first `Explorer inventory views` test with this test. It should fail before implementation because the current shell still renders `aside` and does not include Monitor.

```tsx
it('shows the floating navigation island with Signal and Explore groups', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/plugins' },
  )

  const island = screen.getByRole('navigation', { name: 'Primary' })

  expect(island).toHaveTextContent('OhMyC')
  expect(island).toHaveTextContent('coding monitor')
  expect(island).toHaveTextContent('Signal')
  expect(island).toHaveTextContent('Monitor')
  expect(island).toHaveTextContent('Timeline')
  expect(island).toHaveTextContent('Explore')
  expect(island).toHaveTextContent('Agents')
  expect(island).toHaveTextContent('Commands')
  expect(island).toHaveTextContent('Skills')
  expect(island).toHaveTextContent('Plugins')

  expect(document.querySelector('aside')).not.toBeInTheDocument()
  expect(document.querySelector('main header')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Add collapsed island behavior test**

Append this test to `packages/ui/tests/explorer.routes.test.tsx`.

```tsx
it('collapses the navigation island to a single icon button and expands it again', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/timeline' },
  )

  fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

  expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }))

  expect(screen.getByRole('link', { name: 'Timeline' })).toBeInTheDocument()
})
```

- [ ] **Step 3: Add Monitor route test**

Append this test to `packages/ui/tests/explorer.routes.test.tsx`.

```tsx
it('renders Monitor route as a full-bleed personal coding monitor surface', async () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/monitor' },
  )

  expect(screen.getByRole('heading', { name: 'Coding Monitor' })).toBeInTheDocument()
  expect(screen.getByText('sessions')).toBeInTheDocument()
  expect(screen.getByText('tokens')).toBeInTheDocument()
  expect(screen.getByText('last sync')).toBeInTheDocument()
})
```

- [ ] **Step 4: Update removed-route fallback assertion**

In the removed-route fallback test in `packages/ui/tests/explorer.routes.test.tsx`, delete the breadcrumb assertion and replace it with navigation island assertions.

```tsx
const main = document.querySelector('main')
const timelineHeading = document.querySelector('main h1')

expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveTextContent('Timeline')
expect(timelineHeading?.textContent).toBe('Timeline')
expect(main?.textContent).not.toContain(removedHeading)
expect(screen.queryByText(removedEmptyState)).not.toBeInTheDocument()
```

- [ ] **Step 5: Add keyboard shortcut tests**

In `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`, replace the two existing `g s` navigation tests with this table-driven test. Keep the existing input-focus guard test unchanged.

```tsx
it.each([
  ['m', '/explore/monitor'],
  ['e', '/explore/agents'],
  ['a', '/explore/agents'],
  ['s', '/explore/skills'],
  ['c', '/explore/commands'],
  ['t', '/explore/timeline'],
])('maps g then %s to %s', (key, expectedPath) => {
  renderWithProviders(
    <Routes>
      <Route path="*" element={<ShortcutHarness />} />
    </Routes>,
    { route: '/menubar' },
  )

  fireEvent.keyDown(document, { key: 'g' })
  fireEvent.keyDown(document, { key })

  expect(screen.getByTestId('path')).toHaveTextContent(expectedPath)
})
```

- [ ] **Step 6: Run route and shortcut tests to verify failure**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.routes.test.tsx tests/hooks/use-keyboard-shortcuts.test.tsx
```

Expected: FAIL. Failures should mention missing `navigation` named `Primary`, missing Monitor, and shortcut paths that are not yet mapped.

## Task 2: Build The Floating Navigation Island

**Files:**
- Create: `packages/ui/src/components/navigation-island.tsx`
- Test: `packages/ui/tests/components/navigation-island.test.tsx`

Primitive requirement: all island buttons must use `Button` from `@/components/ui/button`; do not introduce raw `<button>` elements for collapse, expand, or command palette actions. Navigation items remain `NavLink` because they are route links, not buttons.

- [ ] **Step 1: Create NavigationIsland component**

Create `packages/ui/src/components/navigation-island.tsx` with this implementation.

```tsx
import { Activity, Atom, Blocks, Bot, PanelLeftClose, Search, Sparkles, TerminalSquare } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'

interface IslandItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
}

const SIGNAL_ITEMS: IslandItem[] = [
  { id: 'monitor', label: 'Monitor', to: '/explore/monitor', icon: Atom },
  { id: 'timeline', label: 'Timeline', to: '/explore/timeline', icon: Activity },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { id: 'agents', label: 'Agents', to: '/explore/agents', icon: Bot },
  { id: 'commands', label: 'Commands', to: '/explore/commands', icon: TerminalSquare },
  { id: 'skills', label: 'Skills', to: '/explore/skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', to: '/explore/plugins', icon: Blocks },
]

export function NavigationIsland() {
  const [collapsed, setCollapsed] = useState(false)
  const reduceMotion = useReducedMotion()
  const { open } = useCommandPalette()
  const hasToggledRef = useRef(false)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const collapseButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!hasToggledRef.current) {
      return
    }

    if (collapsed) {
      expandButtonRef.current?.focus()
    } else {
      collapseButtonRef.current?.focus()
    }
  }, [collapsed])

  function updateCollapsed(nextCollapsed: boolean) {
    hasToggledRef.current = true
    setCollapsed(nextCollapsed)
  }

  function handleNavigate() {
    if (
      typeof window !== 'undefined'
      && 'matchMedia' in window
      && window.matchMedia('(max-width: 767px)').matches
    ) {
      updateCollapsed(true)
    }
  }

  if (collapsed) {
    return (
      <motion.div
        className="fixed left-[18px] top-[18px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        transition={{ duration: 0.18 }}
      >
        <Button
          ref={expandButtonRef}
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Expand navigation"
          aria-controls="primary-navigation-island"
          aria-expanded={false}
          onClick={() => updateCollapsed(false)}
          className={cn(
            'size-14 rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.72)]',
            'text-[var(--text-primary)] shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl',
            'hover:bg-[rgba(255,255,255,0.04)]',
          )}
        >
          <Atom size={20} aria-hidden="true" />
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.nav
      id="primary-navigation-island"
      aria-label="Primary"
      className={cn(
        'fixed left-[18px] top-[18px] z-40 w-[220px] overflow-hidden rounded-[14px]',
        'border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.72)]',
        'p-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl',
        'max-sm:left-[14px] max-sm:top-[14px] max-sm:w-[216px]',
      )}
      initial={reduceMotion ? false : { opacity: 0.92, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
            <Atom size={17} className="text-[var(--text-secondary)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-[590] text-[var(--text-primary)]">OhMyC</div>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              coding monitor
            </div>
          </div>
        </div>
        <Button
          ref={collapseButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse navigation"
          aria-controls="primary-navigation-island"
          aria-expanded={true}
          onClick={() => updateCollapsed(true)}
          className="size-8 shrink-0 rounded-lg text-[var(--text-tertiary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]"
        >
          <PanelLeftClose size={15} aria-hidden="true" />
        </Button>
      </div>

      <IslandGroup label="Signal" items={SIGNAL_ITEMS} onNavigate={handleNavigate} />
      <IslandGroup label="Explore" items={EXPLORE_ITEMS} className="mt-4" onNavigate={handleNavigate} />

      <Button
        type="button"
        variant="ghost"
        onClick={open}
        className={cn(
          'mt-4 flex h-9 w-full items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)]',
          'bg-[rgba(255,255,255,0.02)] px-2.5 text-[12px] text-[var(--text-tertiary)]',
          'transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-secondary)]',
        )}
      >
        <span className="flex items-center gap-2">
          <Search size={13} aria-hidden="true" />
          Command
        </span>
        <kbd className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-[var(--text-quaternary)]">
          Cmd K
        </kbd>
      </Button>
    </motion.nav>
  )
}

function IslandGroup({
  label,
  items,
  className,
  onNavigate,
}: {
  label: string
  items: IslandItem[]
  className?: string
  onNavigate: () => void
}) {
  return (
    <div className={className}>
      <div className="mb-2 px-2 text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.id}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-[510] transition-colors',
                isActive
                  ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
              )}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create NavigationIsland component tests**

Create `packages/ui/tests/components/navigation-island.test.tsx`.

```tsx
import { fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { CommandPaletteProvider } from '@/components/command-palette'
import { NavigationIsland } from '@/components/navigation-island'

function Harness() {
  const location = useLocation()
  return (
    <CommandPaletteProvider>
      <NavigationIsland />
      <div data-testid="path">{location.pathname}</div>
    </CommandPaletteProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NavigationIsland', () => {
  it('navigates to Monitor from the Signal group', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('link', { name: 'Monitor' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/monitor')
  })

  it('collapses to one icon badge and expands back to full navigation', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }))

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveFocus()
  })

  it('collapses after route navigation on narrow screens', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('link', { name: 'Monitor' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/monitor')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run component test to verify pass**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/navigation-island.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx packages/ui/tests/components/navigation-island.test.tsx
git commit -m "feat(ui): add floating navigation island"
```

## Task 3: Migrate Explorer To Headerless Island Shell

**Files:**
- Modify: `packages/ui/src/explorer.tsx`
- Modify: `packages/ui/tests/explorer.routes.test.tsx`

This task and Task 4 are one compile checkpoint. Do not run the Task 3 test/commit checkpoint until Task 4 has created `MonitorView`; otherwise `explorer.tsx` imports a file that does not exist yet.

- [ ] **Step 1: Replace sidebar section definitions**

In `packages/ui/src/explorer.tsx`, remove imports for `Header`, `Sidebar`, and `SidebarSection`. Add:

```tsx
import { NavigationIsland } from './components/navigation-island'
import { MonitorView } from './components/monitor/monitor-view'
```

Replace the current `SECTIONS` type annotation with:

```tsx
const RESOURCE_SECTIONS = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'commands', label: 'Commands', icon: TerminalSquare },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
] as const
```

- [ ] **Step 2: Update active section calculation**

Replace the current `activeSection` line with:

```tsx
type ResourceSectionId = typeof RESOURCE_SECTIONS[number]['id']
type ExplorerTab = 'monitor' | 'timeline' | ResourceSectionId

const VALID_TABS = new Set<ExplorerTab>(['monitor', 'timeline', 'agents', 'commands', 'skills', 'plugins'])
const activeSection: ExplorerTab = tab && VALID_TABS.has(tab as ExplorerTab) ? (tab as ExplorerTab) : 'timeline'
```

Expected behavior:

- `/explore/monitor` renders Monitor.
- `/explore/timeline` renders Timeline.
- `/explore/hooks`, `/explore/mcp`, `/explore/lsp`, `/explore/settings`, and unknown tabs fall back to Timeline content.

- [ ] **Step 3: Update resource section references**

Replace all `SECTIONS` references in `Explorer` with `RESOURCE_SECTIONS`.

The selected entity hooks remain gated by the resource sections only:

```tsx
const { data: selectedAgent } = useAgent(activeSection === 'agents' ? selectedItem : null)
const { data: selectedSkill } = useSkill(activeSection === 'skills' ? selectedItem : null)
const { data: selectedCommand } = useCommand(activeSection === 'commands' ? selectedItem : null)
```

- [ ] **Step 4: Delete unreachable placeholder code**

Delete the `renderPlaceholder` helper from `packages/ui/src/explorer.tsx`. The only branch that referenced it was `claude-md`, which is not a valid Explorer tab and should not ship as hidden dead code.

- [ ] **Step 5: Replace the returned shell**

Replace the final `return` block in `Explorer` with:

```tsx
return (
  <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
    <NavigationIsland />

    <main className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-marketing)]">
      {activeSection === 'monitor'
        ? (
            <MonitorView />
          )
        : (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto w-full max-w-6xl p-10 pl-[280px] max-lg:pl-[260px] max-md:px-5 max-md:pt-24">
                {activeSection === 'timeline' && <TimelineView />}
                {activeSection === 'agents' && renderEntityList('agents')}
                {activeSection === 'skills' && renderEntityList('skills')}
                {activeSection === 'commands' && renderEntityList('commands')}
                {activeSection === 'plugins' && renderPlugins()}
              </div>
            </div>
          )}
    </main>
  </div>
)
```

The left padding protects non-Monitor content from sitting under the island on desktop. On mobile, `pt-24` protects the top of page content from the collapsed island.

- [ ] **Step 6: Remove unused `viewSwitcher` behavior**

Keep the `ExplorerProperties` interface for compatibility, but do not pass `viewSwitcher` into any component.

```tsx
export function Explorer({ viewSwitcher: _viewSwitcher }: ExplorerProperties) {
```

This avoids a breaking signature change for `App`.

- [ ] **Step 7: Run shell tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.routes.test.tsx tests/components/navigation-island.test.tsx
```

Expected: do not run yet unless Task 4 is complete. After Task 4, this command should PASS.

- [ ] **Step 8: Commit**

Run this only after Task 4 passes too:

```bash
git add packages/ui/src/explorer.tsx packages/ui/src/components/monitor packages/ui/tests/explorer.routes.test.tsx packages/ui/tests/components/monitor
git commit -m "feat(ui): add coding monitor island shell"
```

## Task 4: Add Monitor Route DOM Fallback And Stats

**Files:**
- Create: `packages/ui/src/components/monitor/monitor-stats.tsx`
- Create: `packages/ui/src/components/monitor/monitor-view.tsx`
- Create: `packages/ui/tests/components/monitor/monitor-view.test.tsx`

- [ ] **Step 1: Create monitor stats helpers**

Create `packages/ui/src/components/monitor/monitor-stats.tsx`.

Stats window for this first implementation: `sessions` and `tokens` both come from the same `useTimelineEvents({})` result window. `last sync` comes from `useTimelineStatus()`. Do not mix all-time `TimelineStatus.sessionCount` with event-window tokens until the backend exposes matching all-time token totals. The UI must show a small `latest timeline window` scope caption near the display stats.

```tsx
import { animate, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import {
  type EventsResult,
  useTimelineEvents,
  useTimelineStatus,
} from '@/hooks/use-timeline'

export interface MonitorStats {
  sessions: number
  tokens: number
  lastSyncLabel: string
  scopeLabel: string
}

export function useMonitorStats(): {
  stats: MonitorStats
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
} {
  const { data: status, isLoading: statusLoading, isError: statusError } = useTimelineStatus()
  const { data: events, isLoading: eventsLoading, isError: eventsError } = useTimelineEvents({})

  const stats = useMemo(
    () => deriveMonitorStats(status, events),
    [status, events],
  )
  const isLoading = statusLoading || eventsLoading
  const isError = statusError || eventsError
  const isEmpty = !isLoading
    && !isError
    && (status?.sessionCount ?? 0) === 0
    && (events?.days ?? []).length === 0

  return {
    stats,
    isLoading,
    isError,
    isEmpty,
  }
}

export function deriveMonitorStats(status?: { lastSyncAt: number | null }, events?: EventsResult): MonitorStats {
  const days = events?.days ?? []
  const sessions = days.reduce((sum, day) => sum + day.session_count, 0)
  const tokens = days.reduce((sum, day) => sum + day.token_count, 0)

  return {
    sessions,
    tokens,
    lastSyncLabel: formatLastSync(status?.lastSyncAt ?? null),
    scopeLabel: 'latest timeline window',
  }
}

export function formatLastSync(lastSyncAt: number | null): string {
  if (!lastSyncAt) {
    return 'never'
  }

  const diffMs = Math.max(0, Date.now() - lastSyncAt)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) {
    return 'now'
  }
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return String(value)
}

export function AnimatedNumber({
  value,
  formatter = formatCompactNumber,
}: {
  value: number
  formatter?: (value: number) => string
}) {
  const reducedMotion = typeof window !== 'undefined'
    && 'matchMedia' in window
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const motionValue = useMotionValue(reducedMotion ? value : 0)
  const rounded = useTransform(motionValue, latest => Math.round(latest))
  const [display, setDisplay] = useState(formatter(value))

  useEffect(() => {
    const unsubscribe = rounded.on('change', latest => setDisplay(formatter(latest)))
    const controls = animate(motionValue, value, {
      duration: reducedMotion ? 0 : 0.55,
      ease: 'easeOut',
    })

    return () => {
      unsubscribe()
      controls.stop()
    }
  }, [formatter, motionValue, reducedMotion, rounded, value])

  return <span>{display}</span>
}
```

- [ ] **Step 2: Create MonitorView**

Create `packages/ui/src/components/monitor/monitor-view.tsx`.

```tsx
import { Atom } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import { AnimatedNumber, useMonitorStats } from './monitor-stats'

const statsClassName = 'font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]'

export function MonitorView() {
  const reduceMotion = useReducedMotion()
  const { stats, isLoading, isError, isEmpty } = useMonitorStats()

  return (
    <section
      aria-labelledby="monitor-title"
      className="relative h-full min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] text-[var(--text-primary)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_36%_42%,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_76%_54%,rgba(255,255,255,0.05),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative grid h-full min-h-[720px] grid-cols-[minmax(420px,1fr)_minmax(360px,520px)] items-center gap-10 px-20 py-16 pl-[300px] max-xl:grid-cols-1 max-xl:items-end max-xl:pl-[280px] max-lg:px-8 max-lg:pl-[260px] max-md:min-h-[780px] max-md:px-5 max-md:pb-12 max-md:pl-5 max-md:pt-28">
        <motion.div
          className="relative flex min-h-[520px] items-center justify-center max-md:min-h-[420px]"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute inset-x-8 top-1/2 h-px bg-[rgba(255,255,255,0.08)]" />
          <div className="absolute size-[420px] rounded-full border border-[rgba(255,255,255,0.08)] max-md:size-[300px]" />
          <div className="absolute size-[620px] rounded-full border border-[rgba(255,255,255,0.04)] max-md:size-[420px]" />

          <div className="relative flex aspect-[0.72] h-[360px] flex-col items-center justify-center rounded-[22px] border border-[rgba(255,255,255,0.16)] bg-[#f7f8f8] text-[#08090a] shadow-[0_30px_100px_rgba(0,0,0,0.5)] max-md:h-[280px]">
            <Atom size={138} strokeWidth={1.7} aria-hidden="true" />
            <p className="sr-only">React Bits Lanyard placeholder. The WebGL lanyard replaces this surface in the R3F spike.</p>
          </div>
        </motion.div>

        <motion.div
          className="relative z-10 max-w-[520px]"
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.34, delay: 0.05 }}
        >
          <p className={statsClassName}>Personal signal</p>
          <h1 id="monitor-title" className="mt-3 text-[52px] font-[510] leading-none tracking-[-0.8px] text-[var(--text-primary)] max-md:text-[40px]">
            Coding Monitor
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
            {stats.scopeLabel}
          </p>

          <dl className="mt-10 space-y-8" aria-busy={isLoading}>
            <MonitorStat label="sessions" value={<AnimatedNumber value={stats.sessions} />} />
            <MonitorStat label="tokens" value={<AnimatedNumber value={stats.tokens} />} />
            <MonitorStat label="last sync" value={stats.lastSyncLabel} />
          </dl>

          {isLoading ? (
            <p role="status" className="mt-8 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-quaternary)]">
              Loading monitor signal
            </p>
          ) : null}
          {isEmpty ? (
            <p className="mt-8 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
              Run a Claude Code session and your activity will appear here.
            </p>
          ) : null}
          {isError ? (
            <p role="status" className="mt-8 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
              Timeline signal unavailable. Monitor will update after the next successful sync.
            </p>
          ) : null}
        </motion.div>
      </div>
    </section>
  )
}

function MonitorStat({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div>
      <dt className={statsClassName}>{label}</dt>
      <dd className="mt-1 text-[64px] font-[510] leading-none tracking-[-0.8px] text-[var(--text-primary)] max-md:text-[46px]">
        {value}
      </dd>
    </div>
  )
}
```

- [ ] **Step 3: Create MonitorView tests**

Create `packages/ui/tests/components/monitor/monitor-view.test.tsx`.

```tsx
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { MonitorView } from '@/components/monitor/monitor-view'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

beforeEach(() => {
  __setTransportForTests('mock')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetMock()
  resetTransportForTests()
})

describe('MonitorView', () => {
  it('renders display stats from one timeline events window plus status sync time', async () => {
    const now = Date.now()
    setMockHandler('timeline.status', async () => ({ sessionCount: 842, lastSyncAt: now - 180_000 }))
    setMockHandler('timeline.events', async () => ({
      days: [
        { day: '2026-06-17', session_count: 2, turn_count: 10, token_count: 18_400_000, project_groups: [] },
      ],
    }))

    const { container } = renderWithProviders(<MonitorView />)

    await waitFor(() => {
      expect(container.textContent).toContain('Coding Monitor')
      expect(container.textContent).toContain('sessions')
      expect(container.textContent).toContain('tokens')
      expect(container.textContent).toContain('last sync')
      expect(container.textContent).toContain('latest timeline window')
      expect(container.textContent).toContain('2')
      expect(container.textContent).toContain('18.4M')
      expect(container.textContent).toContain('3m')
    })
  })

  it('keeps the identity surface usable when timeline has no sessions', async () => {
    setMockHandler('timeline.status', async () => ({ sessionCount: 0, lastSyncAt: null }))
    setMockHandler('timeline.events', async () => ({ days: [] }))

    renderWithProviders(<MonitorView />)

    expect(await screen.findByText('Run a Claude Code session and your activity will appear here.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Coding Monitor' })).toBeInTheDocument()
    expect(screen.getByText('never')).toBeInTheDocument()
  })

  it('shows a quiet status message when timeline data is unavailable', async () => {
    setMockHandler('timeline.status', async () => {
      throw new Error('timeline unavailable')
    })
    setMockHandler('timeline.events', async () => ({ days: [] }))

    renderWithProviders(<MonitorView />)

    expect(
      await screen.findByText('Timeline signal unavailable. Monitor will update after the next successful sync.'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run Monitor tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/monitor/monitor-view.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Do not create a separate Task 4 commit. Task 3 imports `MonitorView`, so Task 3 and Task 4 land together in the combined shell commit after both test sets pass.

## Task 5: Wire Monitor Into Commands And Global Shortcuts

**Files:**
- Modify: `packages/ui/src/app.tsx`
- Modify: `packages/ui/src/hooks/use-keyboard-shortcuts.ts`
- Modify: `packages/ui/tests/app.routes.test.tsx`
- Modify: `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`

- [ ] **Step 1: Add Monitor to App command palette**

In `packages/ui/src/app.tsx`, add `Atom` to the lucide import:

```tsx
import {
  Activity,
  Atom,
  Bot,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
```

Insert this command at the top of `goToCommands`:

```tsx
{
  id: 'goto-monitor',
  label: 'Monitor',
  shortcut: 'g m',
  icon: <Atom size={14} />,
  category: 'Go to',
  action: () => navigate('/explore/monitor'),
},
```

The existing Timeline command already uses `g t`; no change is needed there. Verify it remains:

```tsx
shortcut: 'g t',
```

- [ ] **Step 2: Update global keyboard shortcuts**

Replace the second-key handling block in `packages/ui/src/hooks/use-keyboard-shortcuts.ts` with:

```tsx
const routes: Record<string, string> = {
  m: '/explore/monitor',
  e: '/explore/agents',
  a: '/explore/agents',
  s: '/explore/skills',
  c: '/explore/commands',
  t: '/explore/timeline',
}

const route = routes[e.key]
if (route) {
  e.preventDefault()
  navigate(route)
}
```

Also update the hook comment to:

```tsx
/**
 * Sets up global `g`-prefixed keyboard navigation:
 * - `g` then `m` -> Monitor
 * - `g` then `e` -> Agents (legacy alias)
 * - `g` then `a` -> Agents
 * - `g` then `s` -> Skills
 * - `g` then `c` -> Commands
 * - `g` then `t` -> Timeline
 *
 * Silently ignored when an input, textarea, or contenteditable is focused.
 */
```

- [ ] **Step 3: Add command palette route test**

Update the import in `packages/ui/tests/app.routes.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
```

Append this test. It proves the command palette entry exists and navigates, not just that `/explore/:tab` renders `Explorer`.

```tsx
it('navigates to Monitor from the command palette', async () => {
  renderWithProviders(<App />, { route: '/menubar' })

  fireEvent.keyDown(document, { key: 'k', metaKey: true })

  const monitorItem = await screen.findByText('Monitor')
  expect(screen.getByText('g m')).toBeInTheDocument()

  fireEvent.click(monitorItem)

  await waitFor(() => {
    expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run command and shortcut tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/app.routes.test.tsx tests/hooks/use-keyboard-shortcuts.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/app.tsx packages/ui/src/hooks/use-keyboard-shortcuts.ts packages/ui/tests/app.routes.test.tsx packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx
git commit -m "feat(ui): add monitor navigation shortcuts"
```

## Task 6: Validate Non-Monitor Route Preservation

**Files:**
- Modify: `packages/ui/tests/explorer.routes.test.tsx`
- Test only: `packages/ui/tests/components/timeline/timeline-view.test.tsx`

- [ ] **Step 1: Add assertions that resource internals are unchanged**

Update the test import in `packages/ui/tests/explorer.routes.test.tsx`:

```tsx
import { fireEvent, screen, within } from '@testing-library/react'
```

Append this test to `packages/ui/tests/explorer.routes.test.tsx`.

```tsx
it('keeps resource page internals while changing only the shell', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/plugins' },
  )

  const main = within(screen.getByRole('main'))

  expect(main.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument()
  expect(main.getByText('Inspect installed plugins, enabled state, and bundled component counts for the current environment.')).toBeInTheDocument()
  expect(main.getByText('review-pack')).toBeInTheDocument()
  expect(main.getByText('Enabled')).toBeInTheDocument()
  expect(main.getByText('Agents: 1')).toBeInTheDocument()
  expect(main.getByText('Skills: 1')).toBeInTheDocument()
  expect(main.getByText('Commands: 1')).toBeInTheDocument()
})
```

- [ ] **Step 2: Add Timeline preservation assertion**

Append this test to `packages/ui/tests/explorer.routes.test.tsx`.

```tsx
it('keeps Timeline route owned content inside the new shell', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/timeline' },
  )

  expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveTextContent('Timeline')
  expect(document.querySelector('main h1')?.textContent).toBe('Timeline')
  expect(document.body.textContent).toContain('Every Claude Code session')
})
```

- [ ] **Step 3: Run preservation tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.routes.test.tsx tests/components/timeline/timeline-view.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/tests/explorer.routes.test.tsx
git commit -m "test(ui): cover island shell route preservation"
```

## Task 7: React Bits Lanyard Spike Boundary

**Files:**
- Modify: `packages/ui/src/components/monitor/monitor-view.tsx`
- Create: `packages/ui/src/components/monitor/lanyard-stage.tsx`
- Optional modify after official docs check: `packages/ui/package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Check current React Bits install instructions**

Read the official React Bits setup pages before adding dependencies:

Official references:

- `https://reactbits.dev/get-started/installation`
- `https://reactbits.dev/components/lanyard`

Use an agent-readable fetch/browser tool, not macOS `open`, so the command is visible in the implementation log. If using Codex, browse those URLs. If using a terminal-only worker, use the project-approved docs lookup or a normal fetch command that prints the relevant installation text.

Expected: the implementer records the exact React Bits setup command, dependency command, and Lanyard add/copy command in the implementation PR description before changing `package.json`. Do not guess package names from memory.

- [ ] **Step 2: Create a stable LanyardStage boundary**

Create `packages/ui/src/components/monitor/lanyard-stage.tsx` with the DOM fallback first. This keeps Task 4 stable while the WebGL spike is in progress.

```tsx
import { Atom } from 'lucide-react'

export function LanyardStage() {
  return (
    <div className="relative flex min-h-[520px] items-center justify-center max-md:min-h-[420px]">
      <div className="absolute inset-x-8 top-1/2 h-px bg-[rgba(255,255,255,0.08)]" />
      <div className="absolute size-[420px] rounded-full border border-[rgba(255,255,255,0.08)] max-md:size-[300px]" />
      <div className="absolute size-[620px] rounded-full border border-[rgba(255,255,255,0.04)] max-md:size-[420px]" />

      <div className="relative flex aspect-[0.72] h-[360px] flex-col items-center justify-center rounded-[22px] border border-[rgba(255,255,255,0.16)] bg-[#f7f8f8] text-[#08090a] shadow-[0_30px_100px_rgba(0,0,0,0.5)] max-md:h-[280px]">
        <Atom size={138} strokeWidth={1.7} aria-hidden="true" />
        <p className="sr-only">Lanyard stage fallback. WebGL lanyard replaces this layer after the React Bits spike is verified.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace inline placeholder in MonitorView**

In `packages/ui/src/components/monitor/monitor-view.tsx`, remove the `Atom` import and add:

```tsx
import { LanyardStage } from './lanyard-stage'
```

Replace the left-side `motion.div` contents with:

```tsx
<motion.div
  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  <LanyardStage />
</motion.div>
```

- [ ] **Step 4: Integrate React Bits only after the docs check**

If the official React Bits page provides a copy/add command for Lanyard, run that command and place the generated component under:

```text
packages/ui/src/components/monitor/react-bits-lanyard.tsx
```

Then replace `packages/ui/src/components/monitor/lanyard-stage.tsx` with this guarded version. This keeps jsdom and browsers without WebGL on the fallback path.

```tsx
import { Atom } from 'lucide-react'
import { Component, Suspense, lazy } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

const ReactBitsLanyard = lazy(() =>
  import('./react-bits-lanyard').then(module => ({ default: module.ReactBitsLanyard })),
)

export function LanyardStage() {
  const reduced = typeof window !== 'undefined'
    && 'matchMedia' in window
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced || !supportsWebGL()) {
    return <LanyardFallback />
  }

  return (
    <LanyardErrorBoundary>
      <Suspense fallback={<LanyardFallback />}>
        <ReactBitsLanyard />
      </Suspense>
    </LanyardErrorBoundary>
  )
}

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const canvas = document.createElement('canvas')
  return Boolean(
    canvas.getContext('webgl2')
    || canvas.getContext('webgl')
    || canvas.getContext('experimental-webgl'),
  )
}

function LanyardFallback() {
  return (
    <div className="relative flex min-h-[520px] items-center justify-center max-md:min-h-[420px]">
      <div className="absolute inset-x-8 top-1/2 h-px bg-[rgba(255,255,255,0.08)]" />
      <div className="absolute size-[420px] rounded-full border border-[rgba(255,255,255,0.08)] max-md:size-[300px]" />
      <div className="absolute size-[620px] rounded-full border border-[rgba(255,255,255,0.04)] max-md:size-[420px]" />

      <div className="relative flex aspect-[0.72] h-[360px] flex-col items-center justify-center rounded-[22px] border border-[rgba(255,255,255,0.16)] bg-[#f7f8f8] text-[#08090a] shadow-[0_30px_100px_rgba(0,0,0,0.5)] max-md:h-[280px]">
        <Atom size={138} strokeWidth={1.7} aria-hidden="true" />
        <p className="sr-only">Lanyard stage fallback. WebGL lanyard is disabled for this environment.</p>
      </div>
    </div>
  )
}

class LanyardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // The fallback keeps the Monitor route usable when WebGL initialization fails.
  }

  render() {
    if (this.state.failed) {
      return <LanyardFallback />
    }

    return this.props.children
  }
}
```

- [ ] **Step 5: Run Monitor tests after the spike**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/monitor/monitor-view.test.tsx
```

Expected: PASS. Tests should not require WebGL support in jsdom because `supportsWebGL()`, `lazy`, `Suspense`, and `LanyardErrorBoundary` keep the route renderable through `LanyardFallback`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/monitor packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): add lanyard stage boundary"
```

If no dependencies changed, omit `packages/ui/package.json pnpm-lock.yaml` from `git add`.

## Task 8: Final Verification

**Files:**
- All files touched above

- [ ] **Step 1: Run focused UI tests**

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.routes.test.tsx tests/app.routes.test.tsx tests/hooks/use-keyboard-shortcuts.test.tsx tests/components/navigation-island.test.tsx tests/components/monitor/monitor-view.test.tsx tests/components/timeline/timeline-view.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full UI test suite**

```bash
pnpm --filter @ohmyc/ui test
```

Expected: PASS.

- [ ] **Step 3: Run UI build**

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS. No TypeScript errors, no Vite build errors.

- [ ] **Step 4: Visual smoke check**

Start the relevant app/dev surface used by this repo.

```bash
pnpm dev
```

Open these routes:

```text
/explore/monitor
/explore/timeline
/explore/agents
/explore/commands
/explore/skills
/explore/plugins
```

Expected visual results:

- Monitor has no top header and no docked sidebar.
- Monitor shows floating island, Lanyard stage, and three display-scale stats.
- Monitor stats include a quiet `latest timeline window` scope caption so the display numbers do not read as all-time totals.
- Collapsed island is a single icon badge.
- Collapsing the island moves focus to the expand badge; expanding it moves focus back to the collapse control.
- On mobile width, tapping a route link from the expanded island navigates and returns the island to the single icon badge.
- Timeline internal layout still reads as Timeline: title, controls, heatmap, activity list.
- Resource pages still show SectionHeader, two-column cards, and detail panels.
- Global Cmd+K still opens the command palette.
- `g m`, `g t`, `g a`, `g c`, `g s` navigate correctly when focus is not in an input.
- With `prefers-reduced-motion: reduce`, stats render without count-up animation and WebGL/Lanyard motion falls back.
- Empty timeline and timeline-error mocks keep the Monitor route usable and show the quiet helper/status copy specified in Task 4.

- [ ] **Step 5: Final commit**

If Task 8 fixed any issues, commit those changes:

```bash
git add packages/ui/src packages/ui/tests packages/ui/package.json pnpm-lock.yaml
git commit -m "fix(ui): polish coding monitor island shell"
```

If Task 8 produced no new changes, skip this commit.

## Self-Review

**Spec coverage:**

- Header removal is covered by Task 3 and Task 6.
- Floating collapsible navigation island is covered by Task 2.
- Collapsed single-icon badge is covered by Task 2 tests.
- Monitor route is covered by Task 4.
- Big animated stats are covered by Task 4.
- React Bits Lanyard integration is isolated behind Task 7.
- Timeline route remaining default is preserved by Task 3 and Task 5.
- Non-Monitor route internals staying unchanged is covered by Task 6.
- Framer Motion boundary is covered by Task 2 and Task 4.
- Reduced motion is covered in component logic; a future visual QA pass should verify it in browser.

**Placeholder scan:**

- No task relies on undefined components except files created earlier in this same plan.
- No task says to add generic error handling without specifying behavior.
- The only external-doc step is React Bits Lanyard installation, because the official command is versioned outside this repo and must be checked at implementation time.

**Type consistency:**

- `MonitorStats` uses `TimelineStatus` and `EventsResult` from `use-timeline`.
- `NavigationIsland` uses route strings already supported by React Router.
- Tests use existing `renderWithProviders` and mock transport patterns.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-coding-monitor-island-layout.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

`/plan-design-review` is complete. Recommended next step before implementation: run `/plan-eng-review` on this plan.

## Plan Design Review Result

Review date: 2026-06-17.

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md aligned; UI shell scope confirmed |
| Step 0               | initial rating 7/10; full text review       |
| Pass 1  (Info Arch)  | 7/10 -> 8.5/10 after amendments             |
| Pass 2  (States)     | 6.5/10 -> 8.5/10 after states added         |
| Pass 3  (Journey)    | 7/10 -> 8/10 after mobile/focus rules       |
| Pass 4  (AI Slop)    | 7.5/10 -> 8.5/10 after stats semantics      |
| Pass 5  (Design Sys) | 8/10 -> 8.5/10 after primitive rules        |
| Pass 6  (Responsive) | 6.5/10 -> 8/10 after mobile behavior        |
| Pass 7  (Decisions)  | 4 resolved, 4 deferred                      |
+--------------------------------------------------------------------+
| NOT in scope         | written (4 items)                           |
| What already exists  | written                                     |
| TODOS.md updates     | 0 items proposed                            |
| Approved Mockups     | 0 generated in this review                  |
| Decisions made       | 4 added to plan                             |
| Decisions deferred   | 4 listed in Not In Scope                    |
| Overall design score | 7/10 -> 8.5/10                              |
+====================================================================+
```

Plan is design-complete enough to implement. Run `/plan-eng-review` next to validate architecture, test sequencing, and dependency boundaries before coding.

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P2, human: ~45min / CC: ~8min)** — Monitor stats — Preserve latest-window data semantics
  - Surfaced by: Stats Semantics — Display-scale stats must not mix all-time sessions with window-scoped tokens.
  - Files: `packages/ui/src/components/monitor/monitor-stats.tsx`, `packages/ui/src/components/monitor/monitor-view.tsx`, `packages/ui/tests/components/monitor/monitor-view.test.tsx`
  - Verify: `pnpm --filter @ohmyc/ui test -- tests/components/monitor/monitor-view.test.tsx`

- [ ] **T2 (P2, human: ~45min / CC: ~8min)** — Navigation island — Add mobile collapse and focus restoration
  - Surfaced by: Mobile And Focus Behavior — The island needs deterministic mobile overlay behavior and accessible toggle focus.
  - Files: `packages/ui/src/components/navigation-island.tsx`, `packages/ui/tests/components/navigation-island.test.tsx`
  - Verify: `pnpm --filter @ohmyc/ui test -- tests/components/navigation-island.test.tsx`

- [ ] **T3 (P2, human: ~30min / CC: ~5min)** — Monitor states — Render loading, empty, error, and reduced-motion fallbacks
  - Surfaced by: Monitor States — The Monitor route must remain usable when timeline data or WebGL is unavailable.
  - Files: `packages/ui/src/components/monitor/monitor-view.tsx`, `packages/ui/src/components/monitor/lanyard-stage.tsx`, `packages/ui/tests/components/monitor/monitor-view.test.tsx`
  - Verify: `pnpm --filter @ohmyc/ui test -- tests/components/monitor/monitor-view.test.tsx`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | Not run for this plan |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | - | Not run for this plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | REQUIRED | Recommended next; implementation plan changed interaction and test scope |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 7/10 -> 8.5/10, 4 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | Not run for this plan |

- **UNRESOLVED:** 0 design decisions.
- **VERDICT:** DESIGN CLEARED — run eng review before implementation.
