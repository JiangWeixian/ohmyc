# Source Switcher + Origin Chips (UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Explorer-only Source dropdown, origin chips on entity cards, provider-driven badge rendering, and detail-panel flattening of opencode `permission`, wired against the already-implemented backend providers + `?origins=` query.

**Architecture:**
- A `useSources()` Zustand store persists the selected origins to `localStorage` (`ohmyc.sources`) and exposes `toggle`/`set` with a last-on guard.
- A `<SourceSwitcher>` dropdown is mounted only on Explorer routes in `Header`, between `CommandPaletteTrigger` and `ActiveProfileChip`.
- `useAgents` / `useSkills` / `useCommands` accept the current `origins` selection, append a sorted `?origins=...` (omitted when the selection equals the full registered set), and include it in their React Query keys.
- The backend route handlers return per-entity `badges: RenderBadge[]` by calling each provider's `agentBadges` / `commandBadges` (skills have none in v1). `EntityCard` accepts a `badges` array — `explorer.tsx` stops branching on entity type and just passes them through; it also adds an origin chip ("claude", "claude · opencode", etc.) in the card header.
- The detail panel's frontmatter harvest is extended to flatten one-level objects so opencode's `permission: { edit: deny }` lands as a `permission.edit` row.

**Tech Stack:** React 19 + TypeScript, Zustand (new dependency), React Query, Vitest + React Testing Library, Tailwind, Radix DropdownMenu (already in deps).

**Wireframe reference:** `~/.gstack/projects/JiangWeixian-claudeui/designs/layout-interaction-20260426/04-explorer.html` (Source pill open state) + `~/.gstack/projects/JiangWeixian-claudeui/designs/source-switcher-20260510/approved.json`.

---

## Task 1: Add `origins` + `badges` fields to shared entity schemas

Backend routes already attach `origins` to each entity, but the shared Zod schemas don't model that yet, so the UI sees them as `unknown`. We also need `badges` to flow end-to-end. Extend the schemas; backend route changes that emit `badges` happen in Task 2.

**Files:**
- Modify: `packages/shared/src/agent-schema.ts:27-37`
- Modify: `packages/shared/src/skill-schema.ts`
- Modify: `packages/shared/src/command-schema.ts`

- [ ] **Step 1: Add RenderBadge schema to `provider.ts`**

`packages/shared/src/provider.ts` already exports a `RenderBadge` interface — add a matching Zod schema so the entity schemas can reference it. Append to that file:

```ts
import { z } from 'zod'

export const RenderBadgeSchema = z.object({
  kind: z.enum(['mono', 'pill']),
  label: z.string(),
  tone: z.enum(['neutral', 'warn']).optional(),
})

export const OriginEnum = z.enum(['agents', 'claude', 'opencode'])
```

- [ ] **Step 2: Extend `AgentSchema` with `origins` and `badges`**

In `packages/shared/src/agent-schema.ts`, update the import and schema:

```ts
import { OriginEnum, RenderBadgeSchema } from './provider'

export const AgentSchema = z.object({
  id: z.string(),
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  filename: z.string(),
  source: z.enum(['local', 'profile', 'plugin', 'project']),
  scope: ScopeEnum.optional(),
  pluginId: z.string().optional(),
  provenance: StoreComponentProvenanceSchema.optional(),
  origins: z.array(OriginEnum).optional(),
  badges: z.array(RenderBadgeSchema).optional(),
})
```

- [ ] **Step 3: Apply the same `origins` + `badges` fields to `SkillSchema` and `CommandSchema`**

Mirror the additions from Step 2 in `packages/shared/src/skill-schema.ts` and `packages/shared/src/command-schema.ts` on their respective `*Schema` definitions. Add the same import line.

- [ ] **Step 4: Build shared and verify types**

Run: `pnpm --filter @ohmyc/shared build`
Expected: success, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add origins and badges fields to entity schemas"
```

---

## Task 2: Emit provider-supplied `badges` from API routes

The routes currently spread `entry.data` and add `origins`, `scope`, `source` — but not `badges`. Wire each route to call the registered provider's badge function for the entry's primary origin and include the result on the response. Skills have no badge function, so they get `[]`.

**Files:**
- Modify: `packages/cli/src/server/routes/agents.ts:29-47`
- Modify: `packages/cli/src/server/routes/commands.ts` (matching block)
- Modify: `packages/cli/src/server/routes/skills.ts` (matching block)
- Modify: `packages/cli/src/server/services/provider-registry.ts` — ensure registry exposes provider lookup by origin
- Test: `packages/cli/tests/server/routes/agents.test.ts`

- [ ] **Step 1: Confirm registry exposes provider-by-origin**

Read `packages/cli/src/server/services/provider-registry.ts`. If there is no `getProvider(origin: Origin): ConfigProvider | undefined`, add one:

```ts
getProvider(origin: Origin): ConfigProvider | undefined {
  return this.providers.find(p => p.id === origin)
}
```

- [ ] **Step 2: Write failing test — `/api/agents` returns badges**

Add to `packages/cli/tests/server/routes/agents.test.ts` (mirror an existing test's setup):

```ts
it('attaches provider badges to each agent in the response', async () => {
  // ...build a fastify instance with a registry that yields one opencode agent
  // with frontmatter.mode = 'primary' (opencode provider emits a `mode` badge)
  const response = await app.inject({ method: 'GET', url: '/api/agents' })
  const body = response.json() as { agents: Array<{ id: string; badges: Array<{ kind: string; label: string }> }> }
  const agent = body.agents.find(a => a.id === 'fixture-opencode')!
  expect(agent.badges).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'mono', label: 'primary' }),
  ]))
})
```

- [ ] **Step 3: Run failing test**

Run: `pnpm --filter @ohmyc/cli test -- tests/server/routes/agents.test.ts`
Expected: FAIL — `badges` undefined on the response object.

- [ ] **Step 4: Wire badges into the agents route**

In `packages/cli/src/server/routes/agents.ts`, replace the registry branch (lines ~29-47):

```ts
if (options.registry) {
  const entries = await options.registry.listAgents(origins ? { origins } : undefined)
  for (const entry of entries) {
    const primary = entry.origins[0]
    const provider = options.registry.getProvider(primary)
    const badges = provider ? provider.agentBadges(entry.data as ParsedAgent) : []
    let source: string
    if (primary === 'claude' && entry.scope === 'global') {
      source = await resolveInventorySource(entry.sourceFile, options.baseDir)
    } else if (primary === 'claude' && entry.scope === 'project') {
      source = 'project'
    } else {
      source = primary
    }
    agents.push({
      ...entry.data,
      origins: entry.origins,
      scope: entry.scope,
      source,
      badges,
    })
  }
}
```

Add the `ParsedAgent` import from `@ohmyc/shared` at the top if missing.

- [ ] **Step 5: Mirror the change in `commands.ts`**

Same edit pattern — call `provider.commandBadges(entry.data as ParsedCommand)` and include `badges` on the response object.

- [ ] **Step 6: Mirror in `skills.ts`**

Skills providers don't expose a badge function in v1; emit an empty array so the field exists:

```ts
badges: [],
```

(Add this alongside `origins`, `scope`, `source` in the registry branch.)

- [ ] **Step 7: Run agents test again to verify pass**

Run: `pnpm --filter @ohmyc/cli test -- tests/server/routes/agents.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full cli test suite**

Run: `pnpm --filter @ohmyc/cli test`
Expected: all existing tests still PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/server packages/cli/tests/server
git commit -m "feat(cli): emit provider badges on /api/{agents,skills,commands}"
```

---

## Task 3: Add Zustand dependency and `useSources` store

The spec calls for a Zustand store. Zustand isn't yet a dependency of `@ohmyc/ui`, so add it; then implement the store with a last-on guard and localStorage persistence.

**Files:**
- Modify: `packages/ui/package.json` (add `zustand`)
- Create: `packages/ui/src/state/sources.ts`
- Test: `packages/ui/src/state/sources.test.ts`

- [ ] **Step 1: Add zustand to `packages/ui/package.json`**

In `packages/ui/package.json` dependencies block, add:

```json
"zustand": "^5.0.2",
```

Then run: `pnpm install`
Expected: zustand installed in `packages/ui/node_modules/zustand`.

- [ ] **Step 2: Write the failing test**

Create `packages/ui/src/state/sources.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { REGISTERED_ORIGINS, useSources } from './sources'

describe('useSources', () => {
  beforeEach(() => {
    localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
  })

  it('defaults to all registered origins', () => {
    const { selected } = useSources.getState()
    expect([...selected].sort()).toEqual([...REGISTERED_ORIGINS].sort())
  })

  it('toggle removes an origin and persists', () => {
    useSources.getState().toggle('opencode')
    expect(useSources.getState().selected.has('opencode')).toBe(false)
    expect(JSON.parse(localStorage.getItem('ohmyc.sources')!)).toEqual(['claude'])
  })

  it('last-on guard: cannot uncheck the final origin', () => {
    useSources.setState({ selected: new Set(['claude']) })
    useSources.getState().toggle('claude')
    expect(useSources.getState().selected.has('claude')).toBe(true)
  })

  it('hydrates from localStorage on creation', () => {
    localStorage.setItem('ohmyc.sources', JSON.stringify(['opencode']))
    // Force reload by calling the exported hydrate helper:
    useSources.getState().hydrate()
    expect([...useSources.getState().selected]).toEqual(['opencode'])
  })

  it('ignores unknown origins in stored value', () => {
    localStorage.setItem('ohmyc.sources', JSON.stringify(['claude', 'bogus']))
    useSources.getState().hydrate()
    expect([...useSources.getState().selected]).toEqual(['claude'])
  })

  it('falls back to defaults if stored value parses to empty after filtering', () => {
    localStorage.setItem('ohmyc.sources', JSON.stringify(['bogus']))
    useSources.getState().hydrate()
    expect([...useSources.getState().selected].sort()).toEqual([...REGISTERED_ORIGINS].sort())
  })
})
```

- [ ] **Step 3: Run failing test**

Run: `pnpm --filter @ohmyc/ui test -- src/state/sources.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the store**

Create `packages/ui/src/state/sources.ts`:

```ts
// Zustand store for which provider origins (claude/opencode) the Explorer is filtered to.
// Persisted to localStorage under `ohmyc.sources`. Last-on guard prevents zero-state.
import { create } from 'zustand'

import type { Origin } from '@ohmyc/shared'

const STORAGE_KEY = 'ohmyc.sources'

// `agents` is a property of skills, not a top-level user-facing source — see spec §SourceSwitcher.
export const REGISTERED_ORIGINS: readonly Origin[] = ['claude', 'opencode']

interface SourcesStore {
  selected: Set<Origin>
  toggle: (origin: Origin) => void
  set: (origins: Origin[]) => void
  hydrate: () => void
}

function readStored(): Set<Origin> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const filtered = parsed.filter((p): p is Origin =>
      (REGISTERED_ORIGINS as readonly string[]).includes(p),
    )
    if (filtered.length === 0) return null
    return new Set(filtered)
  } catch {
    return null
  }
}

function persist(selected: Set<Origin>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].sort()))
  } catch {
    // localStorage write failure is non-fatal — selection still works in-memory.
  }
}

export const useSources = create<SourcesStore>((set, get) => ({
  selected: readStored() ?? new Set(REGISTERED_ORIGINS),
  toggle: (origin) => {
    const current = new Set(get().selected)
    if (current.has(origin)) {
      if (current.size <= 1) return // last-on guard
      current.delete(origin)
    } else {
      current.add(origin)
    }
    persist(current)
    set({ selected: current })
  },
  set: (origins) => {
    const next = new Set(origins.filter((o): o is Origin =>
      (REGISTERED_ORIGINS as readonly string[]).includes(o),
    ))
    if (next.size === 0) return
    persist(next)
    set({ selected: next })
  },
  hydrate: () => {
    set({ selected: readStored() ?? new Set(REGISTERED_ORIGINS) })
  },
}))
```

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm --filter @ohmyc/ui test -- src/state/sources.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/src/state pnpm-lock.yaml
git commit -m "feat(ui): add useSources zustand store with localStorage persistence"
```

---

## Task 4: Build the `<SourceSwitcher>` component

Header dropdown that matches the wireframe (`04-explorer.html` lines 92-113) and the approved layout JSON.

**Files:**
- Create: `packages/ui/src/components/source-switcher.tsx`
- Test: `packages/ui/src/components/source-switcher.test.tsx`

- [ ] **Step 1: Write failing test**

Create `packages/ui/src/components/source-switcher.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { SourceSwitcher } from './source-switcher'

describe('SourceSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
  })

  it('renders "Source: All" when all origins are selected', () => {
    render(<SourceSwitcher />)
    expect(screen.getByRole('button')).toHaveTextContent(/Source:\s*All/i)
  })

  it('renders "Source: Claude" when only claude is selected', () => {
    useSources.setState({ selected: new Set(['claude']) })
    render(<SourceSwitcher />)
    expect(screen.getByRole('button')).toHaveTextContent(/Source:\s*Claude/i)
  })

  it('toggles an origin off when its checkbox is clicked', () => {
    render(<SourceSwitcher />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /opencode/i }))
    expect(useSources.getState().selected.has('opencode')).toBe(false)
  })

  it('honors last-on guard — clicking the last remaining checkbox is a no-op', () => {
    useSources.setState({ selected: new Set(['claude']) })
    render(<SourceSwitcher />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /claude/i }))
    expect(useSources.getState().selected.has('claude')).toBe(true)
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @ohmyc/ui test -- src/components/source-switcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SourceSwitcher`**

Create `packages/ui/src/components/source-switcher.tsx`:

```tsx
// Explorer-only header dropdown for filtering inventory by provider origin.
// See spec §SourceSwitcher and wireframe 04-explorer.html lines 92-113.
import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Origin } from '@ohmyc/shared'

const ORIGIN_LABELS: Record<Origin, string> = {
  claude: 'Claude',
  opencode: 'Opencode',
  agents: 'Agents',
}

function buttonLabel(selected: Set<Origin>): string {
  if (selected.size === REGISTERED_ORIGINS.length) return 'All'
  if (selected.size === 1) {
    const [only] = selected
    return ORIGIN_LABELS[only]
  }
  return [...selected].map(o => ORIGIN_LABELS[o]).join(', ')
}

export function SourceSwitcher() {
  const selected = useSources(state => state.selected)
  const toggle = useSources(state => state.toggle)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={[
          'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5',
          'text-[13px] text-[var(--text-secondary)]',
          'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)]',
          'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]',
          'transition-colors duration-150',
        ].join(' ')}
      >
        <span className="text-[var(--text-tertiary)]">Source:</span>
        <span>{buttonLabel(selected)}</span>
        <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191a1b] p-2"
      >
        {REGISTERED_ORIGINS.map((origin) => {
          const isOnly = selected.size === 1 && selected.has(origin)
          return (
            <DropdownMenuCheckboxItem
              key={origin}
              checked={selected.has(origin)}
              disabled={isOnly}
              onSelect={(event) => {
                event.preventDefault() // keep menu open while toggling
                toggle(origin)
              }}
            >
              {ORIGIN_LABELS[origin]}
            </DropdownMenuCheckboxItem>
          )
        })}
        <div className="px-2 pt-1.5 text-[11px] text-[var(--text-quaternary)]">
          At least one must stay on.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

> Note: if `DropdownMenuCheckboxItem` isn't already exported from `./ui/dropdown-menu`, add it there following the existing Radix wrapping pattern. Re-read the file first.

- [ ] **Step 4: Confirm checkbox item is exported**

Run: `grep -n "CheckboxItem" packages/ui/src/components/ui/dropdown-menu.tsx`
If empty, add a wrapped `DropdownMenuCheckboxItem` that forwards to `DropdownMenuPrimitive.CheckboxItem` with classnames matching existing items in that file (use the existing `DropdownMenuItem` block as the template; substitute `CheckboxItem` and add a leading 14px check indicator via `DropdownMenuPrimitive.ItemIndicator` + `Check` icon from `lucide-react`).

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm --filter @ohmyc/ui test -- src/components/source-switcher.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/source-switcher.tsx packages/ui/src/components/source-switcher.test.tsx packages/ui/src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): SourceSwitcher header dropdown"
```

---

## Task 5: Mount `<SourceSwitcher>` in the Explorer header

The header should render the switcher only on `/explore/*` routes, positioned between `CommandPaletteTrigger` and `ActiveProfileChip` (matches wireframe and DESIGN.md "header chrome propagation" rule — Explorer-specific contextual chrome is allowed because the spec calls it out explicitly).

**Files:**
- Modify: `packages/ui/src/components/header.tsx:92-95`

- [ ] **Step 1: Add Explorer-only Source switcher**

Edit `packages/ui/src/components/header.tsx`. Add at top:

```ts
import { useLocation } from 'react-router-dom'
import { SourceSwitcher } from './source-switcher'
```

(`useLocation` is already imported — keep one import.) Inside the component, after `const breadcrumb = useBreadcrumb()`:

```ts
const { pathname } = useLocation()
const showSourceSwitcher = pathname.startsWith('/explore/')
```

Then update the right-cluster `<div className="flex items-center gap-3">` to:

```tsx
<div className="flex items-center gap-3">
  {showSourceSwitcher && <SourceSwitcher />}
  <CommandPaletteTrigger />
  <ActiveProfileChip onCompare={onCompare} />
</div>
```

- [ ] **Step 2: Manual verification — start the dev server**

Run: `pnpm --filter @ohmyc/ui dev`
Expected: visit `http://localhost:5173/explore/agents`; SourceSwitcher visible between ⌘K pill and active chip. Visit `/profiles`; switcher hidden.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/header.tsx
git commit -m "feat(ui): mount SourceSwitcher on Explorer header"
```

---

## Task 6: Wire `?origins=` into data hooks

`useAgents`, `useSkills`, `useCommands` need to read the selected sources, append a sorted comma-joined `origins` query param (omitted when the selection covers the full registered set), and include the stringified set in the React Query key so toggling the switcher invalidates the cache.

**Files:**
- Modify: `packages/ui/src/hooks/use-agents.ts`
- Modify: `packages/ui/src/hooks/use-skills.ts`
- Modify: `packages/ui/src/hooks/use-commands.ts`
- Test: `packages/ui/src/hooks/use-agents.test.ts` (new)

- [ ] **Step 1: Write failing test for hook URL behavior**

Create `packages/ui/src/hooks/use-agents.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { useAgents } from './use-agents'

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useAgents origins query wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
    vi.restoreAllMocks()
  })

  it('omits ?origins= when all sources are selected', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), { status: 200 }),
    )
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/agents')
  })

  it('appends sorted ?origins= when a subset is selected', async () => {
    useSources.setState({ selected: new Set(['claude']) })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), { status: 200 }),
    )
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/agents?origins=claude')
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @ohmyc/ui test -- src/hooks/use-agents.test.ts`
Expected: FAIL — current `useAgents` calls `/api/agents` unconditionally and doesn't subscribe to `useSources`.

- [ ] **Step 3: Update `use-agents.ts`**

Edit `packages/ui/src/hooks/use-agents.ts`. Replace the `fetchAgents` and `useAgents` block:

```ts
import { useQuery } from '@tanstack/react-query'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Agent, Origin } from '@ohmyc/shared'

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) return null
  return [...selected].sort().join(',')
}

async function fetchAgents(origins: string | null): Promise<Agent[]> {
  const url = origins ? `/api/agents?origins=${origins}` : '/api/agents'
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch agents')
  const data: AgentsListResponse = await response.json()
  return data.agents
}

export function useAgents() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['agents', originsKey ?? 'all'],
    queryFn: () => fetchAgents(originsKey),
  })
}
```

Keep `useAgent` (single-item) unchanged — it locates by name and doesn't need `?origins`.

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @ohmyc/ui test -- src/hooks/use-agents.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the same change to `use-skills.ts`**

Mirror Step 3 in `packages/ui/src/hooks/use-skills.ts` — import `useSources` + `REGISTERED_ORIGINS`, build `originsKey`, append to URL, include in query key (`['skills', originsKey ?? 'all']`).

- [ ] **Step 6: Apply the same change to `use-commands.ts`**

Mirror in `packages/ui/src/hooks/use-commands.ts` with `['commands', originsKey ?? 'all']`.

- [ ] **Step 7: Run the full ui test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: PASS. If the existing `explorer.inventory.test.tsx` breaks because the query key changed, update its `queryClient.setQueryData(['agents'], ...)` calls to `['agents', 'all']`.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/hooks
git commit -m "feat(ui): thread origins selection into agents/skills/commands queries"
```

---

## Task 7: Extend `EntityCard` with origin chip + provider-supplied badges

Drop the per-type badge `getBadges` switch in `explorer.tsx` (lines 78-114). Pass the backend-supplied `entity.badges` to `EntityCard` and render a leading origin chip in the card header.

**Files:**
- Modify: `packages/ui/src/components/entity-card.tsx`
- Modify: `packages/ui/src/explorer.tsx:75-114, 309-326`
- Create: `packages/ui/src/components/render-badge.tsx`
- Test: `packages/ui/src/components/entity-card.test.tsx` (new)

- [ ] **Step 1: Write failing test for EntityCard**

Create `packages/ui/src/components/entity-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Bot } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { EntityCard } from './entity-card'

describe('EntityCard', () => {
  it('renders origin chip from origins prop', () => {
    render(
      <EntityCard
        icon={Bot}
        iconAccentVar="--text-primary"
        title="reviewer"
        description="desc"
        origins={['claude', 'opencode']}
        renderBadges={[]}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('claude · opencode')).toBeInTheDocument()
  })

  it('renders provider badges verbatim', () => {
    render(
      <EntityCard
        icon={Bot}
        iconAccentVar="--text-primary"
        title="x"
        description=""
        origins={['opencode']}
        renderBadges={[{ kind: 'mono', label: 'primary' }]}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('primary')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @ohmyc/ui test -- src/components/entity-card.test.tsx`
Expected: FAIL — `origins` and `renderBadges` props don't exist.

- [ ] **Step 3: Create `RenderBadgeView`**

Create `packages/ui/src/components/render-badge.tsx`:

```tsx
// Renders a backend-supplied RenderBadge (provider-driven, no schema branching in the card).
import { Badge, MonoBadge } from './badge'

import type { RenderBadge } from '@ohmyc/shared'

export function RenderBadgeView({ badge }: { badge: RenderBadge }) {
  if (badge.kind === 'mono') return <MonoBadge>{badge.label}</MonoBadge>
  return <Badge variant={badge.tone === 'warn' ? 'destructive' : 'default'}>{badge.label}</Badge>
}
```

(If `destructive` is not a valid variant on the existing `Badge`, omit the `tone` branch and pass `variant="default"` unconditionally — `tone` is informational only in v1.)

- [ ] **Step 4: Extend `EntityCard`**

Edit `packages/ui/src/components/entity-card.tsx`:

```tsx
import React from 'react'

import { MonoBadge } from './badge'
import { RenderBadgeView } from './render-badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { IconType } from './icons'
import type { Origin, RenderBadge } from '@ohmyc/shared'

interface EntityCardProperties {
  icon: IconType
  iconAccentVar: string
  title: string
  description: string
  origins?: Origin[]
  renderBadges?: RenderBadge[]
  onClick: () => void
}

export function EntityCard({
  icon: Icon,
  title,
  description,
  origins,
  renderBadges,
  onClick,
}: EntityCardProperties) {
  const originLabel = origins && origins.length > 0 ? origins.join(' · ') : null
  const hasBadges = originLabel || (renderBadges && renderBadges.length > 0)

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer text-left p-7',
        'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-lg',
        'hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]',
        'transition-colors duration-150',
      )}
    >
      <div className="mb-3.5 flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--text-primary)]">
          <Icon size={18} className="text-[var(--bg-marketing)]" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[15px] font-[590] text-[var(--text-primary)] truncate">{title}</div>
          {hasBadges && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {originLabel && <MonoBadge>{originLabel}</MonoBadge>}
              {renderBadges?.map((b, idx) => <RenderBadgeView key={`${b.kind}-${b.label}-${idx}`} badge={b} />)}
            </div>
          )}
        </div>
      </div>
      <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)] line-clamp-3">
        {description}
      </p>
    </Card>
  )
}

export { Badge, MonoBadge } from './badge'
```

- [ ] **Step 5: Run EntityCard test to verify pass**

Run: `pnpm --filter @ohmyc/ui test -- src/components/entity-card.test.tsx`
Expected: PASS.

- [ ] **Step 6: Replace per-type badge switch in `explorer.tsx`**

Edit `packages/ui/src/explorer.tsx`. Delete the `ENTITY_CONFIG` `getBadges` functions (lines ~80-113) and replace with a config that only carries `iconAccentVar`, `getTitle`, `getDescription`. Update the card render (lines ~309-326) to:

```tsx
{config.data.map(entity => (
  <EntityCard
    key={entity.id}
    icon={config.icon}
    iconAccentVar={entityConfig.iconAccentVar}
    title={entityConfig.getTitle(entity as never) || ''}
    description={entityConfig.getDescription(entity as never) || ''}
    origins={(entity as { origins?: Origin[] }).origins}
    renderBadges={(entity as { badges?: RenderBadge[] }).badges}
    onClick={() =>
      setSelectedItem({
        name: entity.id,
        source: entity.source,
        pluginId: entity.pluginId,
        scope: entity.scope,
      })}
  />
))}
```

Add the imports at top:

```ts
import type { Origin, RenderBadge } from '@ohmyc/shared'
```

Remove the now-unused `SourceBadge`, `Badge`, `MonoBadge` imports from `explorer.tsx` if they no longer have call sites in that file (grep first to confirm).

- [ ] **Step 7: Run UI tests**

Run: `pnpm --filter @ohmyc/ui test`
Expected: PASS. Fix any `explorer.inventory.test.tsx` expectations that asserted on the removed in-card model badges by switching them to expect the new origin chip / provider badge.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/entity-card.tsx packages/ui/src/components/entity-card.test.tsx packages/ui/src/components/render-badge.tsx packages/ui/src/explorer.tsx
git commit -m "feat(ui): origin chip + provider-driven badges on EntityCard"
```

---

## Task 8: Detail panel — flatten one-level frontmatter objects

`explorer.tsx:250-275` harvests known frontmatter fields into the detail-panel metadata list. Extend it so any one-level object (`permission: { edit: 'deny', bash: 'ask' }`) becomes flattened rows (`permission.edit: deny`, `permission.bash: ask`), and surface `mode` for opencode.

**Files:**
- Modify: `packages/ui/src/explorer.tsx:250-275`
- Test: extend `packages/ui/src/explorer.inventory.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `packages/ui/src/explorer.inventory.test.tsx` (mirror existing detail-panel test setup):

```ts
it('renders flattened permission.* rows in the detail panel for opencode agents', async () => {
  // Seed the query cache with an opencode agent whose frontmatter includes
  // mode: 'primary' and permission: { edit: 'deny', bash: 'ask' }.
  // Click into the card, then assert:
  expect(await screen.findByText('permission.edit')).toBeInTheDocument()
  expect(screen.getByText('deny')).toBeInTheDocument()
  expect(screen.getByText('permission.bash')).toBeInTheDocument()
  expect(screen.getByText('ask')).toBeInTheDocument()
  expect(screen.getByText('mode')).toBeInTheDocument()
  expect(screen.getByText('primary')).toBeInTheDocument()
})
```

(Use the file's existing fixture-construction helper. If none exists, create the agent object inline and `queryClient.setQueryData(['agents', 'all'], { /* ... */ })` to seed it before render.)

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @ohmyc/ui test -- src/explorer.inventory.test.tsx`
Expected: FAIL — current harvest doesn't surface `permission` or `mode`.

- [ ] **Step 3: Update the harvest block**

In `packages/ui/src/explorer.tsx`, replace the meta harvest (lines ~250-275 in the `if (selectedItem && selectedEntity)` branch):

```ts
const fm = selectedEntity.frontmatter as Record<string, unknown>
const meta: { label: string; value: string }[] = []
if (selectedEntity.scope) meta.push({ label: 'scope', value: selectedEntity.scope })
if (selectedEntity.source) meta.push({ label: 'source', value: selectedEntity.source })
if (typeof fm.model === 'string') meta.push({ label: 'model', value: fm.model })
if (typeof fm.mode === 'string') meta.push({ label: 'mode', value: fm.mode })
if (Array.isArray(fm.tools) && fm.tools.length > 0) {
  meta.push({ label: 'tools', value: (fm.tools as string[]).join(', ') })
}
// Flatten one-level objects so opencode's permission: { edit, bash } shows
// as permission.edit / permission.bash rows.
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
if (selectedEntity.provenance?.importPath) {
  const date = selectedEntity.provenance.importedAt
    ? new Date(selectedEntity.provenance.importedAt).toISOString().slice(0, 10)
    : null
  meta.push({
    label: 'imported',
    value: date ? `${date} from ${selectedEntity.provenance.importPath}` : selectedEntity.provenance.importPath,
  })
}
```

The `hooks` / `mcpServers` skip is deliberate: those are nested config blobs that the detail panel surfaces elsewhere; flattening them would explode the meta list.

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @ohmyc/ui test -- src/explorer.inventory.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/explorer.tsx packages/ui/src/explorer.inventory.test.tsx
git commit -m "feat(ui): surface opencode mode and flatten permission.* in detail panel"
```

---

## Task 9: Manual end-to-end check + screenshot

The spec's success criteria require a live walkthrough.

**Files:** none (manual)

- [ ] **Step 1: Seed fixtures**

Ensure these exist on disk (create empty stubs if needed for the demo):
- `~/.claude/agents/foo.md` (Claude agent, frontmatter `name: foo`)
- `~/.config/opencode/agents/bar.md` (opencode agent, frontmatter `name: bar`, `mode: primary`, `permission: { edit: deny, bash: ask }`)
- `~/.agents/skills/shared/SKILL.md` (frontmatter `name: shared-skill`)

- [ ] **Step 2: Start dev server**

Run: `pnpm dev`
Open `http://localhost:5173/explore/agents`.

- [ ] **Step 3: Verify each success criterion**

- [ ] Source: All shows both `foo` and `bar` cards with origin chips `claude` and `opencode` respectively.
- [ ] Skills tab shows `shared-skill` once with chip text `claude · opencode · agents`.
- [ ] Toggling Source → Claude (untick Opencode) removes `bar` within 100ms (no network round-trip needed if cached).
- [ ] Try unchecking the last remaining source — checkbox stays checked, no zero-state.
- [ ] Click `bar` → detail panel shows rows `mode: primary`, `permission.edit: deny`, `permission.bash: ask`.
- [ ] Reload the page — selection persists from `localStorage`.

- [ ] **Step 4: Capture a screenshot for the PR**

Save as `docs/screenshots/source-switcher-explorer.png` (create directory if missing) so it can be referenced in the PR body.

- [ ] **Step 5: Commit screenshot**

```bash
git add docs/screenshots/source-switcher-explorer.png
git commit -m "docs: add Explorer SourceSwitcher screenshot for PR"
```

---

## Task 10: Update DESIGN.md decisions log

**Files:**
- Modify: `DESIGN.md` (Decisions Log section, end of table)

- [ ] **Step 1: Append decisions-log row**

Add to the table at the end of the Decisions Log in `DESIGN.md`:

```markdown
| 2026-05-13 | Header gains Explorer-only Source switcher between ⌘K pill and active-profile chip | Default = all sources, persisted to `localStorage` as `ohmyc.sources`. Last-on guard prevents zero-state. Exception to header-chrome-uniformity rule because filter is Explorer-specific |
| 2026-05-13 | EntityCard takes provider-supplied `badges`; per-entity-type switch removed | Schema branching belonged in the provider, not the card. Origin chip on the card header is `entity.origins.join(' · ')` so shared skills (claude · opencode · agents) read at a glance |
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs(design): record Source switcher + provider badges decisions"
```

---

## Final verification

- [ ] **Step 1: Run the full test suites**

```
pnpm --filter @ohmyc/shared build
pnpm --filter @ohmyc/cli test
pnpm --filter @ohmyc/ui test
```

Expected: all PASS.

- [ ] **Step 2: Run lint**

```
pnpm --filter @ohmyc/ui lint
pnpm --filter @ohmyc/cli lint
```

Expected: no warnings.

- [ ] **Step 3: Type-check**

```
pnpm --filter @ohmyc/ui build
```

Expected: success.
