# Route Flattening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten `/explore/:tab` into six explicit sibling routes, split `Explorer` into per-path page components, introduce `nav-items.ts` as the single navigation source, and delete spike routes + orphaned components.

**Architecture:** New `routes/` directory holds one file per URL path. `components/` holds the shared `ExplorerLayout` shell, `EntityList` presentational component, `entity-config.ts` data, and `nav-items.ts` source of truth. `app-shell.tsx` route table becomes six explicit `<Route>` lines; ⌘K `goToCommands` derives from `NAV_ITEMS`.

**Tech Stack:** React, React Router v6, TypeScript, Vitest, @testing-library/react, TanStack Query, framer-motion, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-29-route-flattening-design.md`

---

## File Map

**Create:**
- `packages/ui/src/components/nav-items.ts` — single navigation source (`NAV_ITEMS`)
- `packages/ui/src/components/entity-config.ts` — `ENTITY_CONFIG` + `SECTION_DESCRIPTIONS` extracted from `explorer.tsx`
- `packages/ui/src/components/explorer-layout.tsx` — shared shell (motion.main, island mount, padded vs full-bleed)
- `packages/ui/src/components/entity-list.tsx` — shared presentational (card grid + detail + empty/error)
- `packages/ui/src/routes/timeline-page.tsx` — `/explore/timeline`
- `packages/ui/src/routes/monitor-page.tsx` — `/explore/monitor`
- `packages/ui/src/routes/plugins-page.tsx` — `/explore/plugins`
- `packages/ui/src/routes/agents-page.tsx` — `/explore/agents`
- `packages/ui/src/routes/skills-page.tsx` — `/explore/skills`
- `packages/ui/src/routes/commands-page.tsx` — `/explore/commands`
- `packages/ui/tests/nav-items.test.ts` — shape/drift guard for `NAV_ITEMS`

**Modify:**
- `packages/ui/src/app-shell.tsx` — route table, ⌘K commands, remove spike imports
- `packages/ui/src/components/navigation-island.tsx` — derive items from `NAV_ITEMS`
- `packages/ui/tests/app.routes.test.tsx` — update mocks, add drift-guard test
- `packages/ui/tests/explorer.routes.test.tsx` — update routes/mocks, delete spike block, adjust fallback assertions

**Delete:**
- `packages/ui/src/explorer.tsx` — fully replaced by `routes/` + `components/`
- `packages/ui/src/components/monitor-spike/lanyard-stats-spike-view.tsx` — orphaned after spike route removal

---

## Task 1: Create `nav-items.ts` (single source of truth)

**Files:**
- Create: `packages/ui/src/components/nav-items.ts`
- Test: `packages/ui/tests/nav-items.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/tests/nav-items.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { NAV_ITEMS, type NavItem } from '@/components/nav-items'

describe('NAV_ITEMS', () => {
  it('exports exactly the six first-class explorer destinations', () => {
    const ids = NAV_ITEMS.map(item => item.id)
    expect(ids).toEqual(['monitor', 'timeline', 'agents', 'commands', 'skills', 'plugins'])
  })

  it('maps each id to a /explore/<id> path', () => {
    for (const item of NAV_ITEMS) {
      expect(item.path).toBe(`/explore/${item.id}`)
    }
  })

  it('gives every item a single-letter keycap and a non-empty label', () => {
    for (const item of NAV_ITEMS) {
      expect(item.keycap).toMatch(/^[A-Z]$/)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  it('uses a distinct keycap per item', () => {
    const keycaps = NAV_ITEMS.map(item => item.keycap)
    expect(new Set(keycaps).size).toBe(keycaps.length)
  })

  it('attaches a lucide icon component to every item', () => {
    for (const item of NAV_ITEMS) {
      expect(typeof item.icon).toBe('object')
    }
  })

  it('satisfies the NavItem type for every entry', () => {
    for (const item of NAV_ITEMS) {
      const _check: NavItem = item
      expect(_check).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/nav-items.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/nav-items"`

- [ ] **Step 3: Write `nav-items.ts`**

Create `packages/ui/src/components/nav-items.ts`:

```ts
// Single source of truth for first-class explorer navigation. Consumed by
// the route table (app-shell.tsx), the command palette goToCommands, and
// NavigationIsland. Adding a destination here + a matching <Route> line is
// the only change required; a unit test enforces the two stay in sync.
import { Activity, Blocks, Bot, Code2, Sparkles, TerminalSquare } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export type NavItemId = 'monitor' | 'timeline' | 'agents' | 'skills' | 'commands' | 'plugins'

export interface NavItem {
  id: NavItemId
  path: `/explore/${NavItemId}`
  label: string
  icon: LucideIcon
  /** Single uppercase letter. Shown on the NavigationIsland and used for the `g <key>` ⌘K shortcut. */
  keycap: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'monitor', path: '/explore/monitor', label: 'Monitor', icon: Code2, keycap: 'M' },
  { id: 'timeline', path: '/explore/timeline', label: 'Timeline', icon: Activity, keycap: 'T' },
  { id: 'agents', path: '/explore/agents', label: 'Agents', icon: Bot, keycap: 'A' },
  { id: 'commands', path: '/explore/commands', label: 'Commands', icon: TerminalSquare, keycap: 'C' },
  { id: 'skills', path: '/explore/skills', label: 'Skills', icon: Sparkles, keycap: 'S' },
  { id: 'plugins', path: '/explore/plugins', label: 'Plugins', icon: Blocks, keycap: 'P' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/nav-items.test.ts`
Expected: PASS — 6 tests passing

- [ ] **Step 5: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/nav-items.ts packages/ui/tests/nav-items.test.ts
git commit -m "refactor(ui): add nav-items.ts single navigation source"
```

---

## Task 2: Extract `entity-config.ts`

**Files:**
- Create: `packages/ui/src/components/entity-config.ts`

These are pure data constants currently living at the top of `explorer.tsx` (lines 39–65). Extracted unchanged so `EntityList` (Task 4) and the entity page components (Task 6) can import them.

- [ ] **Step 1: Create the file**

Create `packages/ui/src/components/entity-config.ts`:

```ts
// Per-section configuration for entity list pages (agents, skills, commands).
// Extracted from explorer.tsx so the shared EntityList component and the
// per-section page components can both consume it without circular deps.
import type { Agent, Command, Skill } from '@ohmyc/shared'

export type EntitySection = 'agents' | 'commands' | 'skills'

export const SECTION_DESCRIPTIONS: Record<EntitySection, string> = {
  agents:
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  commands: 'Custom slash commands you can invoke with ',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
}

export const ENTITY_CONFIG = {
  agents: {
    iconAccentVar: '--text-primary',
    getTitle: (entity: Agent) => entity.frontmatter.name,
    getDescription: (entity: Agent) => entity.frontmatter.description,
  },
  skills: {
    iconAccentVar: '--text-secondary',
    getTitle: (entity: Skill) => entity.frontmatter.name,
    getDescription: (entity: Skill) => entity.frontmatter.description,
  },
  commands: {
    iconAccentVar: '--text-tertiary',
    getTitle: (entity: Command) => `/${entity.frontmatter.name}`,
    getDescription: (entity: Command) => entity.frontmatter.description,
  },
} as const
```

- [ ] **Step 2: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/entity-config.ts
git commit -m "refactor(ui): extract entity-config.ts from explorer.tsx"
```

---

## Task 3: Create `ExplorerLayout`

**Files:**
- Create: `packages/ui/src/components/explorer-layout.tsx`
- Test: `packages/ui/tests/components/explorer-layout.test.tsx`

Owns the route shell: `motion.main` with blur/scale, `dimBg` overlay, `<NavigationIsland />` mount, and the padded `explorer-content-shell` div. `padded` prop defaults to `true`; monitor route passes `padded={false}` for full-bleed.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/tests/components/explorer-layout.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExplorerLayout } from '@/components/explorer-layout'

vi.mock('@/components/navigation-island', () => ({
  NavigationIsland: () => <nav data-testid="navigation-island" />,
}))

vi.mock('@/state/island-store', () => ({
  useIslandStore: () => 0,
}))

describe('ExplorerLayout', () => {
  it('renders the padded explorer-content-shell by default', () => {
    const { container } = renderWithProviders(
      <ExplorerLayout>
        <div data-testid="page-content">page</div>
      </ExplorerLayout>,
    )

    const shell = screen.getByTestId('explorer-content-shell')
    expect(shell).toHaveClass('pl-[280px]')
    expect(shell).toHaveClass('max-lg:pl-[260px]')
    expect(shell.querySelector('[data-testid="page-content"]')).not.toBeNull()
  })

  it('omits the explorer-content-shell when padded={false}', () => {
    renderWithProviders(
      <ExplorerLayout padded={false}>
        <div data-testid="page-content">page</div>
      </ExplorerLayout>,
    )

    expect(screen.queryByTestId('explorer-content-shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('always mounts the NavigationIsland', () => {
    renderWithProviders(
      <ExplorerLayout>
        <div />
      </ExplorerLayout>,
    )

    expect(screen.getByTestId('navigation-island')).toBeInTheDocument()
  })
})
```

Add the `renderWithProviders` import at the top of the file (the helper at `packages/ui/tests/test/render-with-providers.tsx` is used by the existing route tests):

```tsx
import { renderWithProviders } from '../test/render-with-providers'
```

Place this import after the `vitest` import, before the `@/components/explorer-layout` import. Also add `import React from 'react'` if your ESLint config requires it for JSX.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/components/explorer-layout.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/explorer-layout"`

- [ ] **Step 3: Write `ExplorerLayout`**

Create `packages/ui/src/components/explorer-layout.tsx`:

```tsx
// Shared shell for every /explore/* route. Renders the motion.main backdrop,
// the NavigationIsland mount point, and (by default) the padded
// explorer-content-shell wrapper. Pass padded={false} for full-bleed pages
// (currently only Monitor).
import { motion, useTransform } from 'framer-motion'

import { NavigationIsland } from './navigation-island'
import { useIslandStore } from '@/state/island-store'

import type { PropsWithChildren } from 'react'

interface ExplorerLayoutProperties {
  /** When true (default), wraps children in the padded explorer-content-shell. */
  padded?: boolean
}

export function ExplorerLayout({ children, padded = true }: PropsWithChildren<ExplorerLayoutProperties>) {
  const hoverProgress = useIslandStore(s => s.hoverProgress)
  const pageFilter = useTransform(hoverProgress, v => `blur(${v * 8}px) brightness(${1 - v * 0.5})`)
  const pageScale = useTransform(hoverProgress, [0, 1], [1, 0.96])
  const dimBg = useTransform(hoverProgress, v => `rgba(0,0,0,${v * 0.3})`)

  return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />

      <motion.div
        style={{ background: dimBg }}
        className="pointer-events-none fixed inset-0 z-30"
      />

      <motion.main
        style={{ filter: pageFilter, scale: pageScale }}
        className="relative h-full min-w-0 origin-center overflow-hidden bg-[var(--bg-marketing)]"
      >
        {padded
          ? (
              <div className="h-full overflow-y-auto">
                <div
                  data-testid="explorer-content-shell"
                  className="min-h-full w-full px-10 pb-12 pl-[280px] pt-10 max-lg:pl-[260px] max-md:px-5 max-md:pb-8 max-md:pt-24"
                >
                  <div className="w-full max-w-6xl">{children}</div>
                </div>
              </div>
            )
          : children}
      </motion.main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/components/explorer-layout.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/explorer-layout.tsx packages/ui/tests/components/explorer-layout.test.tsx
git commit -m "refactor(ui): add ExplorerLayout shell extracted from explorer.tsx"
```

---

## Task 4: Create `EntityList` (shared presentational)

**Files:**
- Create: `packages/ui/src/components/entity-list.tsx`

Extracts the `renderEntityList` inline function from `explorer.tsx:138–282` into a reusable component. Owns: SectionHeader, card grid, EntityDetail panel (including frontmatter → metadata flattening), error and empty states. Does NOT own data hooks or selection state — those live in the route pages.

- [ ] **Step 1: Write `EntityList`**

Create `packages/ui/src/components/entity-list.tsx`:

```tsx
// Shared presentational component for entity list pages (agents, skills,
// commands). Renders the section header, card grid, and detail panel.
// Data hooks and selection state are owned by the consuming route page.
import { Bot, Info, Search, Sparkles, TerminalSquare } from 'lucide-react'

import { EntityCard } from './entity-card'
import { EntityDetail } from './entity-detail'
import { ENTITY_CONFIG, SECTION_DESCRIPTIONS, type EntitySection } from './entity-config'
import { SectionHeader } from './section-header'
import type { ItemLocator } from '@/hooks/use-agents'
import type { Agent, Command, Skill } from '@ohmyc/shared'
import type { ReactNode } from 'react'

interface EntityListProperties {
  section: EntitySection
  data: readonly Agent[] | readonly Skill[] | readonly Command[] | undefined
  isError: boolean
  /** The fully-resolved entity for the currently selected item, or null/undefined when no selection. */
  selectedEntity: Agent | Skill | Command | null | undefined
  /** Called when a card is clicked; the page stores this in its selection state. */
  onSelectItem: (item: ItemLocator) => void
  /** Called when the detail panel's back button is clicked. */
  onBack: () => void
}

const SECTION_ICONS: Record<EntitySection, typeof Bot> = {
  agents: Bot,
  skills: Sparkles,
  commands: TerminalSquare,
}

const SECTION_EMPTY_MESSAGES: Record<EntitySection, { message: string; path: string }> = {
  agents: { message: 'No agents found in ', path: '~/.claude/agents/' },
  skills: { message: 'No skills found in ', path: '~/.claude/skills/' },
  commands: { message: 'No commands found in ', path: '~/.claude/commands/' },
}

/** Builds the metadata rows for the detail panel by flattening frontmatter. */
function buildMeta(entity: Agent | Skill | Command): { label: string; value: string }[] {
  const fm = entity.frontmatter as Record<string, unknown>
  const meta: { label: string; value: string }[] = []

  if (entity.scope) {
    meta.push({ label: 'scope', value: entity.scope })
  }
  if (entity.source) {
    meta.push({ label: 'source', value: entity.source })
  }
  if (typeof fm.model === 'string') {
    meta.push({ label: 'model', value: fm.model })
  }
  if (typeof fm.mode === 'string') {
    meta.push({ label: 'mode', value: fm.mode })
  }
  if (Array.isArray(fm.tools) && fm.tools.length > 0) {
    meta.push({ label: 'tools', value: (fm.tools as string[]).join(', ') })
  }
  // Flatten one-level objects so opencode's permission: { edit, bash } shows
  // as permission.edit / permission.bash rows. Skip hooks/mcpServers — those
  // are nested config blobs the detail panel surfaces elsewhere.
  for (const [key, value] of Object.entries(fm)) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && key !== 'hooks'
      && key !== 'mcpServers'
    ) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'string' || typeof subValue === 'number' || typeof subValue === 'boolean') {
          meta.push({ label: `${key}.${subKey}`, value: String(subValue) })
        }
      }
    }
  }
  if (entity.provenance?.importPath) {
    const date = entity.provenance.importedAt
      ? new Date(entity.provenance.importedAt).toISOString().slice(0, 10)
      : null
    meta.push({
      label: 'imported',
      value: date ? `${date} from ${entity.provenance.importPath}` : entity.provenance.importPath,
    })
  }

  return meta
}

export function EntityList({
  section,
  data,
  isError,
  selectedEntity,
  onSelectItem,
  onBack,
}: EntityListProperties) {
  const entityConfig = ENTITY_CONFIG[section]
  const icon = SECTION_ICONS[section]
  const empty = SECTION_EMPTY_MESSAGES[section]
  const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1)
  const description: ReactNode
    = section === 'commands'
      ? (
          <>
            {SECTION_DESCRIPTIONS.commands}
            <code className="text-[13px] text-[var(--text-secondary)]">/command-name</code>.
          </>
        )
      : SECTION_DESCRIPTIONS[section]

  // Detail panel: a resolved entity is selected.
  if (selectedEntity) {
    const fm = selectedEntity.frontmatter as Record<string, unknown>
    const displayName = (typeof fm.name === 'string' && fm.name) || selectedEntity.id
    const entityDescription = typeof fm.description === 'string' ? fm.description : undefined

    return (
      <EntityDetail
        title={section}
        name={displayName}
        description={entityDescription}
        content={selectedEntity.content}
        meta={buildMeta(selectedEntity)}
        onBack={onBack}
        scope={selectedEntity.scope}
      />
    )
  }

  return (
    <div>
      <SectionHeader title={sectionTitle} description={description} />
      {/* eslint-disable unicorn/no-nested-ternary */}
      {isError
        ? (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Info size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load {section}</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            Something went wrong while fetching your {section}. Try refreshing the page.
          </p>
        </div>
          )
        : data && data.length > 0
          ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {data.map(entity => (
            <EntityCard
              key={entity.id}
              icon={icon}
              iconAccentVar={entityConfig.iconAccentVar}
              title={entityConfig.getTitle(entity as never) || ''}
              description={entityConfig.getDescription(entity as never) || ''}
              origins={entity.origins}
              renderBadges={entity.badges}
              onClick={() =>
                onSelectItem({
                  name: entity.id,
                  source: entity.source,
                  pluginId: entity.pluginId,
                  scope: entity.scope,
                })}
            />
          ))}
        </div>
            )
          : (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Search size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No {section} found</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            {empty.message}<code className="text-[var(--text-secondary)]">{empty.path}</code>
          </p>
        </div>
            )}
      {/* eslint-enable unicorn/no-nested-ternary */}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/entity-list.tsx
git commit -m "refactor(ui): extract EntityList presentational from explorer.tsx"
```

---

## Task 5: Create leaf route pages (timeline, monitor, plugins)

**Files:**
- Create: `packages/ui/src/routes/timeline-page.tsx`
- Create: `packages/ui/src/routes/monitor-page.tsx`
- Create: `packages/ui/src/routes/plugins-page.tsx`

- [ ] **Step 1: Create `timeline-page.tsx`**

Create `packages/ui/src/routes/timeline-page.tsx`:

```tsx
// Route page for /explore/timeline — thin wrapper around TimelineView.
import { TimelineView } from '@/components/timeline/timeline-view'

export function TimelinePage() {
  return <TimelineView />
}
```

- [ ] **Step 2: Create `monitor-page.tsx`**

Create `packages/ui/src/routes/monitor-page.tsx`:

```tsx
// Route page for /explore/monitor — full-bleed personal coding monitor.
// ExplorerLayout receives padded={false} at the route level so this renders
// directly inside <motion.main> without the padding shell.
import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'

export function MonitorPage() {
  return <MonitorSpikeView />
}
```

- [ ] **Step 3: Create `plugins-page.tsx`**

Create `packages/ui/src/routes/plugins-page.tsx`:

```tsx
// Route page for /explore/plugins — plugin inventory grid.
import { Blocks, Info } from 'lucide-react'

import { SectionHeader } from '@/components/section-header'
import { useMarketplaces, usePlugins } from '@/hooks/use-plugins'
import { cn } from '@/lib/utils'

export function PluginsPage() {
  const { data: plugins, isError: pluginsError } = usePlugins()
  const { data: marketplaces } = useMarketplaces()

  return (
    <section>
      <SectionHeader
        title="Plugins"
        description="Inspect installed plugins, enabled state, and bundled component counts for the current environment."
      />
      {/* eslint-disable unicorn/no-nested-ternary */}
      {pluginsError
        ? (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Info size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load plugins</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            Something went wrong while fetching your plugins. Try refreshing the page.
          </p>
        </div>
          )
        : plugins && plugins.length > 0
          ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {plugins.map((plugin) => {
            const installCount = plugin.installs.length
            const marketplace = marketplaces?.find(entry => entry.id === plugin.marketplace)

            return (
              <div
                key={plugin.id}
                className="panel transition-smooth p-7 hover:border-[var(--border-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                      {plugin.name}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
                      {plugin.id}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]',
                      plugin.enabled
                        ? 'bg-[var(--text-primary)] text-[var(--bg-marketing)]'
                        : 'bg-[var(--surface-raised)] text-[var(--text-tertiary)] border border-[var(--border-standard)]',
                    )}
                  >
                    {plugin.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-[13px] text-[var(--text-secondary)]">
                  <div>Agents: {plugin.componentCounts.agents}</div>
                  <div>Skills: {plugin.componentCounts.skills}</div>
                  <div>Commands: {plugin.componentCounts.commands}</div>
                  <div>Installs: {installCount}</div>
                </div>
                {marketplace
                  ? (
                  <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
                    Marketplace: {marketplace.id}
                  </p>
                    )
                  : null}
              </div>
            )
          })}
        </div>
            )
          : (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Blocks size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No plugins installed</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            There are no plugins in the current environment.
          </p>
        </div>
            )}
      {/* eslint-enable unicorn/no-nested-ternary */}
    </section>
  )
}
```

- [ ] **Step 4: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/routes/timeline-page.tsx packages/ui/src/routes/monitor-page.tsx packages/ui/src/routes/plugins-page.tsx
git commit -m "refactor(ui): add timeline, monitor, plugins route pages"
```

---

## Task 6: Create entity route pages (agents, skills, commands)

**Files:**
- Create: `packages/ui/src/routes/agents-page.tsx`
- Create: `packages/ui/src/routes/skills-page.tsx`
- Create: `packages/ui/src/routes/commands-page.tsx`

Each owns its data hook + selection state and renders `<EntityList>`.

- [ ] **Step 1: Create `agents-page.tsx`**

Create `packages/ui/src/routes/agents-page.tsx`:

```tsx
// Route page for /explore/agents — owns the agents data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import { type ItemLocator, useAgent, useAgents } from '@/hooks/use-agents'

export function AgentsPage() {
  const location = useLocation()
  const { data, isError } = useAgents()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useAgent(selectedItem)

  return (
    <EntityList
      section="agents"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
```

- [ ] **Step 2: Create `skills-page.tsx`**

Create `packages/ui/src/routes/skills-page.tsx`:

```tsx
// Route page for /explore/skills — owns the skills data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import { useSkill, useSkills } from '@/hooks/use-skills'
import type { ItemLocator } from '@/hooks/use-agents'

export function SkillsPage() {
  const location = useLocation()
  const { data, isError } = useSkills()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useSkill(selectedItem)

  return (
    <EntityList
      section="skills"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
```

- [ ] **Step 3: Create `commands-page.tsx`**

Create `packages/ui/src/routes/commands-page.tsx`:

```tsx
// Route page for /explore/commands — owns the commands data hook and selection
// state, delegates rendering to the shared EntityList.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { EntityList } from '@/components/entity-list'
import { useCommand, useCommands } from '@/hooks/use-commands'
import type { ItemLocator } from '@/hooks/use-agents'

export function CommandsPage() {
  const location = useLocation()
  const { data, isError } = useCommands()

  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem
    = selectedItemState?.locationKey === location.key ? selectedItemState.item : null
  const { data: selectedEntity } = useCommand(selectedItem)

  return (
    <EntityList
      section="commands"
      data={data}
      isError={isError}
      selectedEntity={selectedEntity}
      onSelectItem={item => setSelectedItemState({ item, locationKey: location.key })}
      onBack={() => setSelectedItemState(null)}
    />
  )
}
```

- [ ] **Step 4: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/routes/agents-page.tsx packages/ui/src/routes/skills-page.tsx packages/ui/src/routes/commands-page.tsx
git commit -m "refactor(ui): add agents, skills, commands route pages"
```

---

## Task 7: Align `NavigationIsland` with `NAV_ITEMS`

**Files:**
- Modify: `packages/ui/src/components/navigation-island.tsx`

The island currently hardcodes two arrays (`SIGNAL_ITEMS`, `EXPLORE_ITEMS`) that duplicate `NAV_ITEMS`. This task replaces both with `NAV_ITEMS`-derived arrays, preserving the Signal/Explore visual grouping.

- [ ] **Step 1: Replace the hardcoded arrays with NAV_ITEMS derivation**

Open `packages/ui/src/components/navigation-island.tsx`. Remove the lucide icon imports that are now redundant (they live in `NAV_ITEMS`):

```tsx
import {
  Activity,
  Blocks,
  Bot,
  Code2,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
```

Replace with:

```tsx
import { Search } from 'lucide-react'
```

(`Search` is used elsewhere in the component for the command-palette trigger — keep it.)

Add the `NAV_ITEMS` import after the existing `@/components/command-palette` import:

```tsx
import { NAV_ITEMS } from '@/components/nav-items'
```

Delete the `IslandItem` interface (lines 24–29), the `SIGNAL_ITEMS` array (lines 31–34), the `EXPLORE_ITEMS` array (lines 36–41), and the `ALL_ITEMS` constant (line 43). Replace them with:

```tsx
const SIGNAL_IDS = new Set(['monitor', 'timeline'])

const SIGNAL_ITEMS = NAV_ITEMS.filter(item => SIGNAL_IDS.has(item.id))
const EXPLORE_ITEMS = NAV_ITEMS.filter(item => !SIGNAL_IDS.has(item.id))
const ALL_ITEMS = NAV_ITEMS
```

- [ ] **Step 2: Update the island rendering to use `item.path` instead of `item.to`**

The `IslandItem` interface used a `to` field; `NavItem` uses `path`. Find every `<NavLink to={item.to}>` in the file and change it to `<NavLink to={item.path}>`. There should be one occurrence in the render body.

- [ ] **Step 3: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run existing island tests**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/explorer.routes.test.tsx`
Expected: PASS — the island still renders all six labels (Monitor, Timeline, Agents, Commands, Skills, Plugins) in the same Signal/Explore grouping. The test at `explorer.routes.test.tsx:86` asserts this text content.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx
git commit -m "refactor(ui): derive NavigationIsland items from NAV_ITEMS"
```

---

## Task 8: Wire up `app-shell.tsx` (route table + ⌘K + remove spikes)

**Files:**
- Modify: `packages/ui/src/app-shell.tsx`

This is the switch: Explorer stops being used, the six explicit routes take over, ⌘K derives from `NAV_ITEMS`, and both spike routes + their imports are removed.

- [ ] **Step 1: Rewrite the imports**

Open `packages/ui/src/app-shell.tsx`. Remove these imports (they will no longer be referenced):

```tsx
import { LanyardStatsSpikeView } from './components/monitor-spike/lanyard-stats-spike-view'
import { MonitorSpikeView } from './components/monitor-spike/monitor-spike-view'
import { Explorer } from './explorer'
```

Remove the now-unused icon imports that were only used in `goToCommands`. Replace the icon import block at the top:

```tsx
import {
  Activity,
  Bot,
  Code2,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
```

with just:

```tsx
import { Search } from 'lucide-react'
```

(The per-section icons now come from `NAV_ITEMS`.)

Add these new imports after the existing `'react-router-dom'` import:

```tsx
import { NAV_ITEMS } from './components/nav-items'
import { ExplorerLayout } from './components/explorer-layout'
import { AgentsPage } from './routes/agents-page'
import { CommandsPage } from './routes/commands-page'
import { MonitorPage } from './routes/monitor-page'
import { PluginsPage } from './routes/plugins-page'
import { SkillsPage } from './routes/skills-page'
import { TimelinePage } from './routes/timeline-page'
```

Remove the now-unused imports of `LanyardStatsSpikeView`, `MonitorSpikeView` (from `./components/monitor-spike/*`), and `Explorer` (from `./explorer`).

- [ ] **Step 2: Rewrite `goToCommands`**

Find the `goToCommands` array (starts around line 40). Replace the entire array with:

```tsx
const goToCommands = NAV_ITEMS.map(item => ({
  id: `goto-${item.id}`,
  label: item.label,
  shortcut: `g ${item.keycap.toLowerCase()}`,
  icon: <item.icon size={14} />,
  category: 'Go to',
  action: () => navigate(item.path),
}))
```

This now includes `plugins` (previously missing) automatically.

- [ ] **Step 3: Rewrite the `AppLayout` route table**

Find the `<Routes>` block inside `AppLayout`. Replace it entirely with:

```tsx
<Routes>
  <Route path="/explore/monitor" element={<ExplorerLayout padded={false}><MonitorPage /></ExplorerLayout>} />
  <Route path="/explore/timeline" element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
  <Route path="/explore/agents" element={<ExplorerLayout><AgentsPage /></ExplorerLayout>} />
  <Route path="/explore/skills" element={<ExplorerLayout><SkillsPage /></ExplorerLayout>} />
  <Route path="/explore/commands" element={<ExplorerLayout><CommandsPage /></ExplorerLayout>} />
  <Route path="/explore/plugins" element={<ExplorerLayout><PluginsPage /></ExplorerLayout>} />

  <Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/explore/*" element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/onboard" element={<Navigate to="/explore/timeline" replace />} />

  <Route path="/menubar" element={<MenubarPage />} />

  <Route path="*" element={<Navigate to="/explore/timeline" replace />} />
</Routes>
```

- [ ] **Step 4: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors. If `Explorer` is still imported anywhere in this file, remove the leftover import.

- [ ] **Step 5: Lint**

Run: `pnpm --filter @ohmyc/ui lint`
Expected: No errors. If unused-import warnings remain, remove them.

- [ ] **Step 6: Do NOT commit yet**

The existing tests will break at this point — they reference `@/explorer` which is about to be deleted, and they assert on the old `:tab` route shape. Tasks 9 and 10 migrate the tests; the commit happens at the end of Task 10.

---

## Task 9: Migrate `app.routes.test.tsx`

**Files:**
- Modify: `packages/ui/tests/app.routes.test.tsx`

- [ ] **Step 1: Update the mocks**

Open `packages/ui/tests/app.routes.test.tsx`. Replace the `vi.mock('@/explorer', ...)` block (lines 18–23) with mocks for the six new route pages. Remove the `vi.mock('@/components/monitor-spike/monitor-spike-view', ...)` and `vi.mock('@/components/monitor-spike/lanyard-stats-spike-view', ...)` blocks entirely (MonitorSpikeView is no longer used at the route level; LanyardStatsSpikeView is being deleted).

The new mock block:

```tsx
vi.mock('@/routes/timeline-page', () => ({
  TimelinePage: () => <div data-testid="explorer-route">timeline</div>,
}))
vi.mock('@/routes/agents-page', () => ({
  AgentsPage: () => {
    const location = useLocation()
    return <div data-testid="explorer-route">{location.pathname}</div>
  },
}))
vi.mock('@/routes/skills-page', () => ({
  SkillsPage: () => <div data-testid="explorer-route">skills</div>,
}))
vi.mock('@/routes/commands-page', () => ({
  CommandsPage: () => <div data-testid="explorer-route">commands</div>,
}))
vi.mock('@/routes/plugins-page', () => ({
  PluginsPage: () => <div data-testid="explorer-route">plugins</div>,
}))
vi.mock('@/routes/monitor-page', () => ({
  MonitorPage: () => <div data-testid="explorer-route">monitor</div>,
}))
```

Keep the `vi.mock('@/components/menubar/menubar-page', ...)` block as-is. Keep the `useLocation` import from `react-router-dom` (add it if missing).

Remove the now-unused hook mocks for `use-agents`, `use-skills`, `use-commands` (lines 37–47) since the page components are stubbed and no longer call those hooks.

- [ ] **Step 2: Verify existing assertions still hold**

The three existing test cases should still pass:
- `'redirects unknown paths to the Explorer timeline fallback'` — still works (the `*` catch-all redirects, and TimelinePage stub renders `explorer-route` testid)
- `'keeps /explore routed through Explorer'` — `/explore` redirects to `/explore/timeline`, which renders the TimelinePage stub. Assertion still holds.
- `'navigates to Monitor from the command palette'` — ⌘K derives from `NAV_ITEMS`, `Monitor` label + `g m` shortcut are present. Click navigates to `/explore/monitor`, which renders the MonitorPage stub. The assertion `expect(screen.getByTestId('explorer-route')).toHaveTextContent('/explore/monitor')` still holds.

- [ ] **Step 3: Add the drift-guard test**

Append a new test case at the end of the `describe('App routes', ...)` block:

```tsx
it('routes every NAV_ITEMS path to its page without falling through to the timeline redirect', () => {
  for (const item of NAV_ITEMS) {
    const { unmount } = renderWithProviders(<App />, { route: item.path })
    expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
    unmount()
  }
})
```

Add the import at the top of the file:

```tsx
import { NAV_ITEMS } from '@/components/nav-items'
```

- [ ] **Step 4: Run the test file**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/app.routes.test.tsx`
Expected: PASS — 4 tests (3 existing + 1 new drift-guard)

- [ ] **Step 5: Do NOT commit yet**

Task 10 also needs to land in the same commit.

---

## Task 10: Migrate `explorer.routes.test.tsx` + delete orphaned files

**Files:**
- Modify: `packages/ui/tests/explorer.routes.test.tsx`
- Delete: `packages/ui/src/explorer.tsx`
- Delete: `packages/ui/src/components/monitor-spike/lanyard-stats-spike-view.tsx`

- [ ] **Step 1: Replace the `Explorer` import and mock with new page + layout imports**

Open `packages/ui/tests/explorer.routes.test.tsx`. Remove:

```tsx
import { App } from '@/app'
import { Explorer } from '@/explorer'
```

Replace with:

```tsx
import { ExplorerLayout } from '@/components/explorer-layout'
import { AgentsPage } from '@/routes/agents-page'
import { CommandsPage } from '@/routes/commands-page'
import { MonitorPage } from '@/routes/monitor-page'
import { PluginsPage } from '@/routes/plugins-page'
import { SkillsPage } from '@/routes/skills-page'
import { TimelinePage } from '@/routes/timeline-page'
```

Remove the `vi.mock('@/components/monitor-spike/monitor-spike-view', ...)` and `vi.mock('@/components/monitor-spike/lanyard-stats-spike-view', ...)` blocks (lines 77–83).

The data-hook mocks (`use-agents`, `use-skills`, `use-commands`, `use-plugins`, `use-setup-status`) stay — the real page components call them.

- [ ] **Step 2: Rewrite the route wrappers in each test case**

Every test currently renders `<Route path="/explore/:tab" element={<Explorer />} />` at some route. Replace each occurrence with the explicit route for that section. The pattern is:

For tests at `/explore/timeline`:
```tsx
renderWithProviders(
  <Routes>
    <Route path="/explore/timeline" element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
  </Routes>,
  { route: '/explore/timeline' },
)
```

For tests at `/explore/plugins`:
```tsx
renderWithProviders(
  <Routes>
    <Route path="/explore/plugins" element={<ExplorerLayout><PluginsPage /></ExplorerLayout>} />
  </Routes>,
  { route: '/explore/plugins' },
)
```

For tests at `/explore/agents` (including the detail-panel and selection-clearing tests):
```tsx
renderWithProviders(
  <Routes>
    <Route path="/explore/agents" element={<ExplorerLayout><AgentsPage /></ExplorerLayout>} />
    <Route path="/explore/plugins" element={<ExplorerLayout><PluginsPage /></ExplorerLayout>} />
  </Routes>,
  { route: '/explore/agents' },
)
```
The selection-clearing test (line 194) needs both `/explore/agents` and `/explore/plugins` in the route set because it navigates between them via the NavigationIsland links.

For the Monitor full-bleed test (line 122):
```tsx
renderWithProviders(
  <Routes>
    <Route path="/explore/monitor" element={<ExplorerLayout padded={false}><MonitorPage /></ExplorerLayout>} />
  </Routes>,
  { route: '/explore/monitor' },
)
```

Update every test case in the file to follow this pattern. Each test's `<Routes>` block should include exactly the routes it exercises.

- [ ] **Step 3: Adjust the fallback tests (lines 220–253)**

The `it.each` test and the `/explore/settings` test currently rely on unknown `:tab` values falling through to `activeSection = 'timeline'` inside Explorer. After migration, the fallback is the `/explore/*` catch-all redirect. Update these tests to assert the redirect:

Replace the `it.each` block (lines 220–239) with:

```tsx
it.each([
  ['/explore/hooks'],
  ['/explore/mcp'],
  ['/explore/lsp'],
])('redirects %s to /explore/timeline', (route) => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/timeline" element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
      <Route path="/explore/*" element={<Navigate to="/explore/timeline" replace />} />
    </Routes>,
    { route },
  )

  expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
})
```

Replace the `/explore/settings` test (lines 241–253) with:

```tsx
it('redirects /explore/settings to /explore/timeline', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/timeline" element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
      <Route path="/explore/*" element={<Navigate to="/explore/timeline" replace />} />
    </Routes>,
    { route: '/explore/settings' },
  )

  expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
})
```

Add `Navigate` to the `react-router-dom` import at the top of the file (it's already imported in some versions; check).

- [ ] **Step 4: Delete the spike routes describe block**

Delete the entire `describe('Explorer spike routes', ...)` block at the bottom of the file (lines 288–299). The routes are deleted, so the tests go with them.

- [ ] **Step 5: Run the test file**

Run: `pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/explorer.routes.test.tsx`
Expected: PASS — all remaining tests green. Two spike-route tests gone.

- [ ] **Step 6: Delete `explorer.tsx`**

```bash
rm packages/ui/src/explorer.tsx
```

- [ ] **Step 7: Delete `lanyard-stats-spike-view.tsx`**

```bash
rm packages/ui/src/components/monitor-spike/lanyard-stats-spike-view.tsx
```

- [ ] **Step 8: Run the full test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: All test files green.

- [ ] **Step 9: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors. If `Explorer` is still referenced anywhere, grep and remove.

- [ ] **Step 10: Lint**

Run: `pnpm --filter @ohmyc/ui lint`
Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(ui): wire explicit /explore routes, delete Explorer + spike routes

- app-shell.tsx route table uses six explicit <Route> lines (no :tab param)
- ⌘K goToCommands derives from NAV_ITEMS (plugins now appears)
- ExplorerLayout wraps each route; monitor uses padded={false}
- explorer.routes.test.tsx renders new page components per path
- app.routes.test.tsx adds drift-guard test (routes match NAV_ITEMS)
- Delete explorer.tsx (fully replaced by routes/ + components/)
- Delete lanyard-stats-spike-view.tsx (orphaned after spike route removal)
- Delete the two /explore/*-spike routes"
```

---

## Verification

After all tasks complete, run the full check:

- [ ] **Step 1: Full test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: All green.

- [ ] **Step 2: Type check**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @ohmyc/ui lint`
Expected: No errors.

- [ ] **Step 4: Manual smoke check (optional)**

Run: `pnpm --filter @ohmyc/ui dev`
Open the app, click through Monitor / Timeline / Agents / Skills / Commands / Plugins in the NavigationIsland. Open ⌘K (cmd+k), verify all six destinations appear with their `g <key>` shortcuts, verify `plugins` is now listed. Verify `/explore/unknown` redirects to timeline.
