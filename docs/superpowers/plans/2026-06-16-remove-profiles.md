# Remove Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Profiles feature from OhMyC's frontend, shared schemas, Tauri command surface, and Rust core domain while preserving a Git tag restore point.

**Architecture:** Treat Profiles as an archived product domain, not a hidden feature. Keep `/explore/timeline` as the app front door, remove all runtime profile reads/writes, and leave existing `$OHMYC_HOME/profiles` files untouched on disk. Store management becomes ordinary component CRUD with no profile reference scan or "Used by profiles" UI.

**Tech Stack:** React 19, React Router, TanStack Query, Vitest, TypeScript/Zod shared schemas, Tauri v2 Rust commands, ohmyc-core Rust domain modules, Cargo tests.

---

## Scope Check

This plan covers one product removal across coordinated layers: frontend route/UI, shared schemas, Tauri commands, Rust core, docs, and tests. These layers are coupled by the same profiles API surface, so one plan is appropriate. The plan commits after each coherent layer so the work can be reviewed or reverted in small pieces.

## File Structure

**Create**

- `packages/ui/tests/app.routes.test.tsx` — route-level regression test that `/profiles/*` falls through to `/explore/timeline`.

**Modify**

- `DESIGN.md` — remove active profiles product guidance and document `/explore/timeline` as the front door.
- `packages/ui/src/app.tsx` — remove `/profiles/*` route and `ProfilesView` import.
- `packages/ui/src/explorer.tsx` — remove `useProfiles`, plugin profile reference map, and plugin "Profiles" display block.
- `packages/ui/src/hooks/use-store.ts` — remove `['profiles']` invalidations.
- `packages/ui/src/hooks/use-fs-changed.ts` — remove `['profiles']` invalidation.
- `packages/ui/src/components/store/store-component-list.tsx` — remove profile reverse-index, "Used by" display, referenced/unused counters, and force-delete flow.
- `packages/ui/src/components/store/delete-confirm-dialog.tsx` — simplify delete confirmation to ordinary destructive confirmation.
- `packages/ui/src/components/store/model-config-editor.tsx` — remove profile-reference comments/copy.
- `packages/ui/src/components/source-badge.tsx` — remove `profile` source type and rendering branch.
- `packages/ui/src/components/ui/keyboard-shortcuts.tsx` — remove "Go to Profiles".
- `packages/ui/tests/components/store/store-component-list.test.tsx` — update assertions for no profiles reference UI.
- `packages/ui/tests/components/store/store-component-editor.test.tsx` — keep delete confirmation expectation aligned with simplified dialog.
- `packages/ui/tests/components/source-badge.test.tsx` — remove profile-source test.
- `packages/ui/tests/explorer.inventory.test.tsx` — remove `useProfiles` mock and profile reference assertions.
- `packages/ui/tests/hooks/use-store.test.tsx` — remove `ReferencedBy` profile path test.
- `packages/ui/tests/lib/transport/transport.test.ts` — use surviving wire names in transport examples.
- `packages/ui/tests/hooks/use-plugins.test.tsx` — remove comments that describe profiles as a future consumer.
- `packages/shared/src/agent-schema.ts` — remove `profile` from source enum.
- `packages/shared/src/skill-schema.ts` — remove `profile` from source enum.
- `packages/shared/src/command-schema.ts` — remove `profile` from source enum.
- `packages/shared/src/index.ts` — remove profile schema export.
- `packages/desktop/src-tauri/src/api/mod.rs` — remove profiles API module.
- `packages/desktop/src-tauri/src/main.rs` — remove `profiles_*` Tauri command registrations.
- `packages/desktop/src-tauri/src/api/store.rs` — remove profile reference checks from delete commands.
- `crates/ohmyc-core/src/lib.rs` — remove `pub mod profiles`.
- `crates/ohmyc-core/src/error.rs` — remove profile-only error variants and tests.
- `crates/ohmyc-core/src/store/mod.rs` — remove profile path helper and profile reference wording.
- `crates/ohmyc-core/src/plugins.rs` — remove stale profile slice comment.

**Delete**

- `packages/ui/src/profiles-view.tsx`
- `packages/ui/src/hooks/use-profiles.ts`
- `packages/ui/src/components/active-profile-chip.tsx`
- `packages/ui/src/components/compare-panel.tsx`
- `packages/ui/src/components/view-switcher.tsx`
- `packages/ui/src/components/profiles/activate-confirm-dialog.tsx`
- `packages/ui/src/components/profiles/activation-blocked-dialog.tsx`
- `packages/ui/src/components/profiles/component-picker.tsx`
- `packages/ui/src/components/profiles/confirm-switch-dialog.tsx`
- `packages/ui/src/components/profiles/model-config-change-list.tsx`
- `packages/ui/src/components/profiles/plugin-picker.tsx`
- `packages/ui/src/components/profiles/profile-card.tsx`
- `packages/ui/src/components/profiles/profile-editor.tsx`
- `packages/ui/src/components/profiles/profiles-sidebar.tsx`
- `packages/ui/tests/profiles-view.test.tsx`
- `packages/ui/tests/hooks/use-profiles.test.tsx`
- `packages/ui/tests/components/profiles/profile-card.test.tsx`
- `packages/ui/tests/components/profiles/profile-editor.test.tsx`
- `packages/shared/src/profile-schema.ts`
- `packages/desktop/src-tauri/src/api/profiles.rs`
- `crates/ohmyc-core/src/profiles/activation.rs`
- `crates/ohmyc-core/src/profiles/crud.rs`
- `crates/ohmyc-core/src/profiles/lock.rs`
- `crates/ohmyc-core/src/profiles/marketplace.rs`
- `crates/ohmyc-core/src/profiles/mod.rs`
- `crates/ohmyc-core/src/profiles/preflight.rs`
- `crates/ohmyc-core/src/profiles/symlink.rs`
- `crates/ohmyc-core/src/store/references.rs`

## Task 1: Archive Tag and Design Source of Truth

**Files:**

- Modify: `DESIGN.md`

- [ ] **Step 1: Verify the working tree is clean before tagging**

Run:

```bash
git status --short
```

Expected: no output. If there is output, inspect it and do not tag until unrelated changes are either committed by their owner or intentionally included.

- [ ] **Step 2: Create the archive tag**

Run:

```bash
git tag archive/profiles-before-removal-20260616
git show --stat --oneline archive/profiles-before-removal-20260616
```

Expected: `git show` prints the current commit summary. This tag is the restore point for the profiles feature.

- [ ] **Step 3: Run a design-doc failing check**

Run:

```bash
rg -n "Profiles are the killer flow|Landing route is `/profiles`|Active-profile chip|Compare side panel|Profile editor|Profiles → Components|Used by N profiles" DESIGN.md
```

Expected before editing: matches are printed. These are the active design claims that must be removed or rewritten.

- [ ] **Step 4: Update `DESIGN.md` product context and layout rules**

Apply these content changes:

```markdown
## Product Context
- **What this is:** CLI tool with WebUI for managing Claude Code and opencode configuration files (agents, skills, commands, plugins, hooks, MCP/LSP, settings, and activity)
```

Replace the beginning of `## Layout & Interaction` through the end of `### Header chrome propagation` with:

```markdown
## Layout & Interaction

The visual system above is settled. This section governs **how the app is laid out and operated** — what lives where on the page, what the keyboard does, and which surfaces are the canonical entry points. Visual changes go in the sections above; placement / behavior changes go here.

**Master thesis:** Explorer is the product shell. Timeline is the default activity surface; Agents, Skills, Commands, Plugins, Hooks, MCP, LSP, and Settings sit behind the same left navigation. Profiles were archived on 2026-06-16 behind the Git tag `archive/profiles-before-removal-20260616` and are no longer part of the active product.

### Default route
- Landing route is `/explore/timeline`.
- The wildcard fallback (`*`) also redirects to `/explore/timeline`.
- Rationale: Timeline gives immediate evidence that OhMyC is connected to the user's local activity, while Explorer remains the canonical management shell for configuration surfaces.

### Command palette (primary action surface)
- **Placement:** A pill button sits in the header. It replaces inert search inputs.
- **Pill anatomy:** `[search icon 14] Search... [⌘K]`
  - Width: `w-60` (240px)
  - Height: `h-9` (36px)
  - Border-radius: `rounded-md` (6px)
  - Background: `rgba(255,255,255,0.02)`
  - Border: `1px solid rgba(255,255,255,0.08)`
  - Right-aligned `⌘K` keycap: `11px / weight 510 / text-quaternary`, `1px solid rgba(255,255,255,0.08)` border, `rounded-sm`
  - **Visually a search input; behaviorally a button** — clicking opens the palette.
- **Open behavior:** ⌘K (or Ctrl+K) anywhere, or click the pill. Opens a centered dialog at Level 4 elevation (`#191a1b` + dialog shadow stack), 640px wide, max-height 480px, with backdrop dim `rgba(0,0,0,0.6)`.
- **Command groups (in order):**
  1. **Go to** — `Agents`, `Skills`, `Commands`, `Timeline`, `Settings`
  2. **Search** — typed-in token searches across agents, skills, and commands
- **Keyboard map (inside palette):** ↑/↓ navigate, ↵ run, Esc close.
- **Global keyboard map (when palette is closed):**
  - `g a` — go to Agents
  - `g s` — go to Skills or Settings according to the existing route context
  - `g c` — go to Commands
  - These bindings are silent when focus is in a text input.

### Header chrome
The header renders the breadcrumb, Explorer-only source switcher, and command palette trigger. Profiles chrome is not rendered. If a route needs a contextual action, it goes in the page body, not the header.
```

Remove the sections titled:

```text
### Profile row interactions (sidebar)
### Profiles → Components (store library views)
### Profile editor (`/profiles/new`, `/profiles/:name/edit`)
```

In the Decisions Log, append:

```markdown
| 2026-06-16 | Profiles archived and removed from product/backend surfaces | The restore point is Git tag `archive/profiles-before-removal-20260616`; user `$OHMYC_HOME/profiles` data is left untouched but no longer read or maintained |
```

- [ ] **Step 5: Verify the design-doc check passes**

Run:

```bash
rg -n "Profiles are the killer flow|Landing route is `/profiles`|Active-profile chip|Compare side panel|Profile editor|Profiles → Components|Used by N profiles" DESIGN.md
```

Expected: no output.

- [ ] **Step 6: Commit the archive/design update**

Run:

```bash
git add DESIGN.md
git commit -m "docs: archive profiles design guidance"
```

Expected: commit succeeds.

## Task 2: Frontend Route Removal and Route Regression Test

**Files:**

- Create: `packages/ui/tests/app.routes.test.tsx`
- Modify: `packages/ui/src/app.tsx`
- Delete later in this task: `packages/ui/src/profiles-view.tsx`

- [ ] **Step 1: Write the failing route test**

Create `packages/ui/tests/app.routes.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from './test/render-with-providers'
import { App } from '@/app'

vi.mock('@/explorer', () => ({
  Explorer: () => <div data-testid="explorer-route">Explorer route</div>,
}))

vi.mock('@/components/menubar/menubar-page', () => ({
  MenubarPage: () => <div data-testid="menubar-route">Menubar route</div>,
}))

vi.mock('@/hooks/use-agents', () => ({
  useAgents: () => ({ data: [] }),
}))

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({ data: [] }),
}))

vi.mock('@/hooks/use-commands', () => ({
  useCommands: () => ({ data: [] }),
}))

describe('App routes', () => {
  it('redirects /profiles paths to the Explorer timeline fallback', async () => {
    renderWithProviders(<App />, { route: '/profiles/daily' })

    await waitFor(() => {
      expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Profiles/i)).not.toBeInTheDocument()
  })

  it('keeps /explore routed through Explorer', async () => {
    renderWithProviders(<App />, { route: '/explore' })

    await waitFor(() => {
      expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- app.routes.test.tsx
```

Expected before implementation: failure or compile error because `packages/ui/src/app.tsx` still imports `ProfilesView` and registers `/profiles/*`.

- [ ] **Step 3: Remove the profiles route from `app.tsx`**

In `packages/ui/src/app.tsx`, delete this import:

```ts
import { ProfilesView } from './profiles-view'
```

Delete this route:

```tsx
<Route path="/profiles/*" element={<ProfilesView viewSwitcher={null} />} />
```

Keep this fallback behavior:

```tsx
<Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
<Route path="*" element={<Navigate to="/explore/timeline" replace />} />
```

- [ ] **Step 4: Delete the profiles view file**

Run:

```bash
git rm packages/ui/src/profiles-view.tsx
```

Expected: file is staged for deletion.

- [ ] **Step 5: Run the route test and verify it passes**

Run:

```bash
pnpm --filter @ohmyc/ui test -- app.routes.test.tsx
```

Expected: both tests pass.

- [ ] **Step 6: Commit the route removal**

Run:

```bash
git add packages/ui/src/app.tsx packages/ui/tests/app.routes.test.tsx
git add -u packages/ui/src/profiles-view.tsx
git commit -m "refactor(ui): remove profiles route"
```

Expected: commit succeeds.

## Task 3: Explorer and Plugin Inventory Cleanup

**Files:**

- Modify: `packages/ui/src/explorer.tsx`
- Modify: `packages/ui/tests/explorer.inventory.test.tsx`

- [ ] **Step 1: Run a failing grep check for Explorer profile dependencies**

Run:

```bash
rg -n "useProfiles|profileReferenceMap|Profiles|profiles" packages/ui/src/explorer.tsx packages/ui/tests/explorer.inventory.test.tsx
```

Expected before editing: matches in both files.

- [ ] **Step 2: Remove the profiles hook mock from `explorer.inventory.test.tsx`**

Delete this mock block from `packages/ui/tests/explorer.inventory.test.tsx`:

```tsx
vi.mock('@/hooks/use-profiles', () => ({
  useProfiles: () => ({
    data: {
      profiles: [
        { name: 'default', plugins: ['review-pack@market'], agents: [], skills: [], commands: [] },
      ],
      active: null,
    },
    isLoading: false,
    isError: false,
  }),
  useActivateProfile: () => ({ mutate: vi.fn() }),
  useDeactivateProfile: () => ({ mutate: vi.fn() }),
  useDeleteProfile: () => ({ mutate: vi.fn() }),
}))
```

- [ ] **Step 3: Remove profile reference state from `explorer.tsx`**

In `packages/ui/src/explorer.tsx`, delete:

```ts
import { useProfiles } from './hooks/use-profiles'
```

Delete:

```ts
const { data: profilesData } = useProfiles()
```

Delete the entire `pluginReferenceMap` memo:

```ts
// Reverse-lookup from plugin ID to profile names — powers the "used by N profiles" display.
const pluginReferenceMap = useMemo(() => {
  const allProfiles = profilesData?.profiles ?? []
  const map = new Map<string, string[]>()
  for (const p of allProfiles) {
    for (const pluginId of p.plugins) {
      const existing = map.get(pluginId) ?? []
      existing.push(p.name)
      map.set(pluginId, existing)
    }
  }
  return map
}, [profilesData])
```

If `useMemo` becomes unused after this edit, remove it from the React import:

```ts
import { useState } from 'react'
```

- [ ] **Step 4: Remove the plugin card Profiles block**

In `packages/ui/src/explorer.tsx`, inside `plugins.map`, delete:

```ts
const referenceNames = pluginReferenceMap.get(plugin.id) ?? []
const referenceCount = referenceNames.length
```

Delete the JSX block that starts with:

```tsx
{/* Compact display: inline badges for 1-2 profiles, count summary for 3+. */}
<div className="mt-5">
  <div className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">Profiles</div>
```

and ends at the matching `</div>` for that Profiles display block.

- [ ] **Step 5: Run the Explorer grep check**

Run:

```bash
rg -n "useProfiles|profileReferenceMap|Used by .*profiles|Profiles" packages/ui/src/explorer.tsx packages/ui/tests/explorer.inventory.test.tsx
```

Expected: no output.

- [ ] **Step 6: Run Explorer tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- explorer.inventory.test.tsx
```

Expected: tests pass.

- [ ] **Step 7: Commit Explorer cleanup**

Run:

```bash
git add packages/ui/src/explorer.tsx packages/ui/tests/explorer.inventory.test.tsx
git commit -m "refactor(ui): remove profile references from explorer"
```

Expected: commit succeeds.

## Task 4: Store UI No Longer Tracks Profile References

**Files:**

- Modify: `packages/ui/src/hooks/use-store.ts`
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`
- Modify: `packages/ui/src/components/store/store-component-list.tsx`
- Modify: `packages/ui/src/components/store/delete-confirm-dialog.tsx`
- Modify: `packages/ui/src/components/store/model-config-editor.tsx`
- Modify: `packages/ui/tests/components/store/store-component-list.test.tsx`
- Modify: `packages/ui/tests/components/store/store-component-editor.test.tsx`
- Modify: `packages/ui/tests/hooks/use-store.test.tsx`

- [ ] **Step 1: Run a failing grep check for store profile references**

Run:

```bash
rg -n "profiles|Profiles|profile|ReferencedBy|referencedBy|force:true|Used by|Unused|referenced" packages/ui/src/hooks/use-store.ts packages/ui/src/hooks/use-fs-changed.ts packages/ui/src/components/store packages/ui/tests/components/store packages/ui/tests/hooks/use-store.test.tsx
```

Expected before editing: multiple matches in store list, delete dialog, hooks, and tests.

- [ ] **Step 2: Simplify the delete dialog API**

Replace `packages/ui/src/components/store/delete-confirm-dialog.tsx` with:

```tsx
// Delete confirmation dialog for store components.
import { Button } from '@/components/ui/button'
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogFooter,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

interface DeleteConfirmDialogProperties {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation dialog for deleting a store component. */
export function DeleteConfirmDialog({ name, onConfirm, onCancel }: DeleteConfirmDialogProperties) {
  return (
    <NativeDialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <NativeDialogContent className="max-w-md bg-[var(--surface-raised)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
        <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
          Delete this store component?
        </NativeDialogTitle>
        <p className="text-[13px] text-[var(--text-secondary)]">{name}</p>
        <p className="text-[var(--text-secondary)] text-[13px]">This action cannot be undone.</p>
        <NativeDialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </NativeDialogFooter>
      </NativeDialogContent>
    </NativeDialog>
  )
}
```

- [ ] **Step 3: Remove profile invalidations from store hooks**

In `packages/ui/src/hooks/use-store.ts`, change the model-config mutation success handlers from:

```ts
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
  qc.invalidateQueries({ queryKey: ['profiles'] })
},
```

to:

```ts
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
},
```

Do this for `useCreateStoreModelConfig`, `useUpdateStoreModelConfig`, and `useDeleteStoreModelConfig`.

- [ ] **Step 4: Remove profile invalidation from filesystem events**

In `packages/ui/src/hooks/use-fs-changed.ts`, delete:

```ts
void qc.invalidateQueries({ queryKey: ['profiles'] })
```

- [ ] **Step 5: Simplify store component list state and copy**

In `packages/ui/src/components/store/store-component-list.tsx`, delete:

```ts
import { useProfiles } from '../../hooks/use-profiles'
```

Change the heading descriptions to:

```ts
const CATEGORY_HEADING: Record<Category, { title: string; description: string }> = {
  agents: {
    title: 'Agents',
    description: 'Canonical library of agent components.',
  },
  skills: {
    title: 'Skills',
    description: 'Canonical library of skill components.',
  },
  commands: {
    title: 'Commands',
    description: 'Canonical library of slash commands.',
  },
  'model-configs': {
    title: 'Model configs',
    description: 'Canonical library of API connection presets.',
  },
}
```

Delete the `UsedBy` function and the `useProfiles` query/memo:

```ts
const { data: profilesData } = useProfiles()
const referencedByMap = useMemo(() => {
  const allProfiles = profilesData?.profiles ?? []
  const m = new Map<string, string[]>()
  for (const p of allProfiles) {
    for (const r of p.agents) {
      const k = `agents:${r}`
      m.set(k, [...(m.get(k) ?? []), p.name])
    }
    for (const r of p.skills) {
      const k = `skills:${r}`
      m.set(k, [...(m.get(k) ?? []), p.name])
    }
    for (const r of p.commands) {
      const k = `commands:${r}`
      m.set(k, [...(m.get(k) ?? []), p.name])
    }
    if (p.modelConfig) {
      const k = `model-configs:${p.modelConfig}`
      m.set(k, [...(m.get(k) ?? []), p.name])
    }
  }
  return m
}, [profilesData])
```

Change delete target state to:

```ts
const [deleteTarget, setDeleteTarget] = useState<{ category: Category; name: string } | null>(null)
```

Replace `handleDelete` and `handleForceDelete` with:

```ts
const handleDelete = (name: string) => {
  setDeleteTarget({ category, name })
}

const handleConfirmDelete = () => {
  if (!deleteTarget) {
    return
  }
  const mut = getDeleteMutation(deleteTarget.category)
  mut.mutate({ name: deleteTarget.name }, {
    onSuccess: () => setDeleteTarget(null),
  })
}
```

Change the counter line from:

```tsx
{totalCount} {labels.plural}
<span className="mx-1.5 text-[var(--text-quaternary)]">·</span>
{referencedCount} referenced
<span className="mx-1.5 text-[var(--text-quaternary)]">·</span>
{unusedCount} unused
```

to:

```tsx
{totalCount} {labels.plural}
```

Inside `filteredItems.map`, delete:

```ts
const refs = referencedByMap.get(`${category}:${item.id}`) ?? []
const isUnused = refs.length === 0
```

Replace the avatar/title color conditions with stable colors:

```tsx
<div
  className={cn(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
    'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]',
    'font-mono text-[11px] font-[510] text-[var(--text-secondary)]',
  )}
>
  {makeInitials(item.name)}
</div>
```

and:

```tsx
<div className="truncate text-[14px] font-[510] text-[var(--text-primary)]">
  {item.name}
</div>
```

Delete the JSX that renders:

```tsx
<UsedBy names={refs} />
```

Change the delete dialog call to:

```tsx
{deleteTarget && (
  <DeleteConfirmDialog
    name={deleteTarget.name}
    onConfirm={handleConfirmDelete}
    onCancel={() => setDeleteTarget(null)}
  />
)}
```

- [ ] **Step 6: Update the store list test**

In `packages/ui/tests/components/store/store-component-list.test.tsx`, delete:

```ts
const mockUseProfiles = vi.fn()
```

Delete:

```ts
vi.mock('@/hooks/use-profiles', () => ({
  useProfiles: () => mockUseProfiles(),
}))
```

Delete this setup block:

```ts
mockUseProfiles.mockReturnValue({
  data: {
    profiles: [{ name: 'daily', agents: ['alpha-agent'], skills: [], commands: [], modelConfig: null }],
  },
})
```

Rename the first test to:

```ts
it('renders heading, counter line, and store rows without profile reference status', () => {
```

Use these assertions:

```tsx
renderWithProviders(<StoreComponentList category="agents" />)

expect(screen.getByRole('heading', { name: 'Agents', level: 1 })).toBeInTheDocument()
expect(screen.getByText(/2 agents/)).toBeInTheDocument()
expect(screen.queryByText(/referenced/)).not.toBeInTheDocument()
expect(screen.queryByText(/unused/)).not.toBeInTheDocument()

expect(screen.getByText('Alpha Agent')).toBeInTheDocument()
expect(screen.getByText('Lonely Agent')).toBeInTheDocument()
expect(screen.queryByText('daily')).not.toBeInTheDocument()
expect(screen.queryByText('Unused')).not.toBeInTheDocument()
```

- [ ] **Step 7: Remove the profile reference test from `use-store.test.tsx`**

Delete the whole test named:

```ts
it('delete surfaces ReferencedBy with profile names (the killer "Used by N profiles" path)', async () => {
```

through its closing `})`.

- [ ] **Step 8: Remove profile-reference comments in model config editor**

In `packages/ui/src/components/store/model-config-editor.tsx`, rewrite profile comments to generic delete comments. The file must not contain:

```text
profiles
referencing profiles
```

- [ ] **Step 9: Run store tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- store-component-list.test.tsx store-component-editor.test.tsx use-store.test.tsx
```

Expected: tests pass.

- [ ] **Step 10: Run the store grep check**

Run:

```bash
rg -n "profiles|Profiles|profile|ReferencedBy|referencedBy|Used by|Unused" packages/ui/src/hooks/use-store.ts packages/ui/src/hooks/use-fs-changed.ts packages/ui/src/components/store packages/ui/tests/components/store packages/ui/tests/hooks/use-store.test.tsx
```

Expected: no output.

- [ ] **Step 11: Commit store cleanup**

Run:

```bash
git add packages/ui/src/hooks/use-store.ts packages/ui/src/hooks/use-fs-changed.ts packages/ui/src/components/store packages/ui/tests/components/store packages/ui/tests/hooks/use-store.test.tsx
git commit -m "refactor(ui): remove profile reference tracking from store"
```

Expected: commit succeeds.

## Task 5: Shared Schemas and Generic UI Source Cleanup

**Files:**

- Modify: `packages/shared/src/agent-schema.ts`
- Modify: `packages/shared/src/skill-schema.ts`
- Modify: `packages/shared/src/command-schema.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/ui/src/components/source-badge.tsx`
- Modify: `packages/ui/tests/components/source-badge.test.tsx`
- Modify: `packages/ui/src/components/ui/keyboard-shortcuts.tsx`
- Modify: `packages/ui/tests/lib/transport/transport.test.ts`
- Modify: `packages/ui/tests/hooks/use-plugins.test.tsx`
- Delete: `packages/shared/src/profile-schema.ts`

- [ ] **Step 1: Run a failing grep check for profile schema/source references**

Run:

```bash
rg -n "profile-schema|'profile'|\"profile\"|Go to Profiles|profiles\\.list|profiles\\.get|slice 7|profiles" packages/shared/src packages/ui/src/components/source-badge.tsx packages/ui/tests/components/source-badge.test.tsx packages/ui/src/components/ui/keyboard-shortcuts.tsx packages/ui/tests/lib/transport/transport.test.ts packages/ui/tests/hooks/use-plugins.test.tsx
```

Expected before editing: matches are printed.

- [ ] **Step 2: Remove `profile` from entity source enums**

In `packages/shared/src/agent-schema.ts`, change:

```ts
source: z.enum(['local', 'profile', 'plugin', 'project']),
```

to:

```ts
source: z.enum(['local', 'plugin', 'project']),
```

Make the same replacement in:

```text
packages/shared/src/skill-schema.ts
packages/shared/src/command-schema.ts
```

- [ ] **Step 3: Remove profile schema export and file**

In `packages/shared/src/index.ts`, delete:

```ts
export * from './profile-schema'
```

Then run:

```bash
git rm packages/shared/src/profile-schema.ts
```

- [ ] **Step 4: Remove profile source badge support**

Replace the source type and description in `packages/ui/src/components/source-badge.tsx`:

```ts
// Badge indicating where an entity originates — local, plugin, or project.
```

```ts
type InventorySource = 'local' | 'plugin' | 'project'
```

```ts
/** Renders a small colored badge indicating the origin of an entity
 *  (local file, installed plugin, or project directory). */
```

Delete the entire branch:

```tsx
if (source === 'profile') {
  return (
    <Badge
      variant="outline"
      className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-blue)]"
    >
      profile
    </Badge>
  )
}
```

- [ ] **Step 5: Remove the profile source badge test**

In `packages/ui/tests/components/source-badge.test.tsx`, delete:

```tsx
it('renders a profile source label', () => {
  renderWithProviders(<SourceBadge source="profile" />)

  expect(screen.getByText('profile')).toBeInTheDocument()
})
```

- [ ] **Step 6: Remove profile shortcut metadata**

In `packages/ui/src/components/ui/keyboard-shortcuts.tsx`, delete:

```ts
{ key: 'g then p', label: 'Go to Profiles', category: 'Navigation', action: () => {} },
```

- [ ] **Step 7: Update transport tests to use surviving wire names**

In `packages/ui/tests/lib/transport/transport.test.ts`, replace profile wire examples with settings wire examples:

```ts
setMockHandler('settings.get', async () => ({ settings: { theme: 'dark' } }))
const result = await request<{ settings: { theme: string } }>('settings.get', {})
expect(result.settings.theme).toBe('dark')
```

For the error-path test, use:

```ts
setMockHandler('settings.get', async () => {
  throw Object.assign(new Error('missing'), {
    code: 'NotFound',
    detail: { kind: 'settings', name: 'settings.json' },
  })
})

await expect(request('settings.get', {})).rejects.toMatchObject({
  code: 'NotFound',
  detail: { kind: 'settings', name: 'settings.json' },
})
```

- [ ] **Step 8: Remove stale profile comments from plugin hook tests**

In `packages/ui/tests/hooks/use-plugins.test.tsx`, replace:

```ts
// Wire contract for get-by-id routes. No UI hook calls plugins.get or
// marketplaces.get today, but the Tauri commands are registered and slice 7
// (profiles) is the likely first consumer. Asserting the envelope shape +
```

with:

```ts
// Wire contract for get-by-id routes. No UI hook calls plugins.get or
// marketplaces.get today, but the Tauri commands are registered. Asserting the envelope shape +
```

- [ ] **Step 9: Run schema/source tests and builds**

Run:

```bash
pnpm --filter @ohmyc/ui test -- source-badge.test.tsx transport.test.ts use-plugins.test.tsx
pnpm --filter @ohmyc/shared build
```

Expected: tests and shared build pass.

- [ ] **Step 10: Run profile schema/source grep check**

Run:

```bash
rg -n "profile-schema|'profile'|\"profile\"|Go to Profiles|profiles\\.list|profiles\\.get|slice 7|profiles" packages/shared/src packages/ui/src/components/source-badge.tsx packages/ui/tests/components/source-badge.test.tsx packages/ui/src/components/ui/keyboard-shortcuts.tsx packages/ui/tests/lib/transport/transport.test.ts packages/ui/tests/hooks/use-plugins.test.tsx
```

Expected: no output.

- [ ] **Step 11: Commit schema/source cleanup**

Run:

```bash
git add packages/shared/src packages/ui/src/components/source-badge.tsx packages/ui/tests/components/source-badge.test.tsx packages/ui/src/components/ui/keyboard-shortcuts.tsx packages/ui/tests/lib/transport/transport.test.ts packages/ui/tests/hooks/use-plugins.test.tsx
git add -u packages/shared/src/profile-schema.ts
git commit -m "refactor(shared): remove profile schema and source"
```

Expected: commit succeeds.

## Task 6: Delete Profiles UI Components, Hooks, and Tests

**Files:**

- Delete: all files listed in this task commands.

- [ ] **Step 1: Run a failing grep check for profiles UI files**

Run:

```bash
rg -n "use-profiles|components/profiles|ProfilesView|ActiveProfileChip|ComparePanel|ViewSwitcher" packages/ui/src packages/ui/tests
```

Expected before deletion: matches are printed.

- [ ] **Step 2: Delete profiles UI source files**

Run:

```bash
git rm \
  packages/ui/src/hooks/use-profiles.ts \
  packages/ui/src/components/active-profile-chip.tsx \
  packages/ui/src/components/compare-panel.tsx \
  packages/ui/src/components/view-switcher.tsx \
  packages/ui/src/components/profiles/activate-confirm-dialog.tsx \
  packages/ui/src/components/profiles/activation-blocked-dialog.tsx \
  packages/ui/src/components/profiles/component-picker.tsx \
  packages/ui/src/components/profiles/confirm-switch-dialog.tsx \
  packages/ui/src/components/profiles/model-config-change-list.tsx \
  packages/ui/src/components/profiles/plugin-picker.tsx \
  packages/ui/src/components/profiles/profile-card.tsx \
  packages/ui/src/components/profiles/profile-editor.tsx \
  packages/ui/src/components/profiles/profiles-sidebar.tsx
```

Expected: files are staged for deletion.

- [ ] **Step 3: Delete profiles UI tests**

Run:

```bash
git rm \
  packages/ui/tests/profiles-view.test.tsx \
  packages/ui/tests/hooks/use-profiles.test.tsx \
  packages/ui/tests/components/profiles/profile-card.test.tsx \
  packages/ui/tests/components/profiles/profile-editor.test.tsx
```

Expected: files are staged for deletion.

- [ ] **Step 4: Remove empty profiles test/source directories**

Run:

```bash
rmdir packages/ui/src/components/profiles packages/ui/tests/components/profiles
```

Expected: both directories are removed. If `rmdir` reports a directory is not empty, run `find packages/ui/src/components/profiles packages/ui/tests/components/profiles -type f` and remove the listed profiles-only files with `git rm`.

- [ ] **Step 5: Run profiles UI grep check**

Run:

```bash
rg -n "use-profiles|components/profiles|ProfilesView|ActiveProfileChip|ComparePanel|ViewSwitcher" packages/ui/src packages/ui/tests
```

Expected: no output.

- [ ] **Step 6: Run UI type check through build**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: build succeeds. A failure here usually means a dangling import from a deleted profiles file remains.

- [ ] **Step 7: Commit deleted UI surface**

Run:

```bash
git add -u packages/ui/src packages/ui/tests
git commit -m "refactor(ui): delete profiles components and hooks"
```

Expected: commit succeeds.

## Task 7: Remove Tauri Profiles Commands

**Files:**

- Modify: `packages/desktop/src-tauri/src/api/mod.rs`
- Modify: `packages/desktop/src-tauri/src/main.rs`
- Delete: `packages/desktop/src-tauri/src/api/profiles.rs`

- [ ] **Step 1: Run a failing grep check for Tauri profiles commands**

Run:

```bash
rg -n "api::profiles|profiles_|pub mod profiles" packages/desktop/src-tauri/src
```

Expected before editing: matches in `api/mod.rs`, `main.rs`, and `api/profiles.rs`.

- [ ] **Step 2: Remove the profiles API module export**

In `packages/desktop/src-tauri/src/api/mod.rs`, delete:

```rust
pub mod profiles;
```

- [ ] **Step 3: Remove command registrations**

In `packages/desktop/src-tauri/src/main.rs`, delete these entries from `tauri::generate_handler!`:

```rust
ohmyc_desktop_lib::api::profiles::profiles_list,
ohmyc_desktop_lib::api::profiles::profiles_get,
ohmyc_desktop_lib::api::profiles::profiles_create,
ohmyc_desktop_lib::api::profiles::profiles_update,
ohmyc_desktop_lib::api::profiles::profiles_delete,
ohmyc_desktop_lib::api::profiles::profiles_preflight,
ohmyc_desktop_lib::api::profiles::profiles_activate,
ohmyc_desktop_lib::api::profiles::profiles_deactivate,
```

- [ ] **Step 4: Delete the Tauri profiles API file**

Run:

```bash
git rm packages/desktop/src-tauri/src/api/profiles.rs
```

Expected: file is staged for deletion.

- [ ] **Step 5: Run Tauri command grep check**

Run:

```bash
rg -n "api::profiles|profiles_|pub mod profiles" packages/desktop/src-tauri/src
```

Expected: no output.

- [ ] **Step 6: Run a Rust compile/test check for the desktop crate**

Run:

```bash
cargo test -p ohmyc-desktop
```

Expected: tests pass. A failure here usually means a dangling `api::profiles` import or command registration remains.

- [ ] **Step 7: Commit Tauri command removal**

Run:

```bash
git add packages/desktop/src-tauri/src/api/mod.rs packages/desktop/src-tauri/src/main.rs
git add -u packages/desktop/src-tauri/src/api/profiles.rs
git commit -m "refactor(desktop): remove profiles commands"
```

Expected: commit succeeds.

## Task 8: Remove Rust Profiles Core and Store Reference Scans

**Files:**

- Modify: `crates/ohmyc-core/src/lib.rs`
- Modify: `crates/ohmyc-core/src/error.rs`
- Modify: `crates/ohmyc-core/src/store/mod.rs`
- Modify: `crates/ohmyc-core/src/plugins.rs`
- Modify: `packages/desktop/src-tauri/src/api/store.rs`
- Delete: `crates/ohmyc-core/src/profiles/*`
- Delete: `crates/ohmyc-core/src/store/references.rs`

- [ ] **Step 1: Run a failing grep check for Rust profile domain references**

Run:

```bash
rg -n "pub mod profiles|store_profiles_dir|ReferencedBy|ActivationBlocked|referencing_profiles|store::references|profile reference|profiles" crates/ohmyc-core/src packages/desktop/src-tauri/src/api/store.rs --glob '!crates/ohmyc-core/src/claude_home.rs' --glob '!crates/ohmyc-core/src/watcher.rs'
```

Expected before editing: matches are printed. `claude_home.rs` and `watcher.rs` are excluded because those mention Claude Code's native `~/.claude/profiles` path shape, not OhMyC's removed product feature.

- [ ] **Step 2: Remove `ohmyc_core::profiles` export**

In `crates/ohmyc-core/src/lib.rs`, delete:

```rust
pub mod profiles;
```

- [ ] **Step 3: Remove store reference module and profile path helper**

In `crates/ohmyc-core/src/store/mod.rs`, change the module doc from:

```rust
//! provenance metadata (where each component was imported from) and the
//! reference-check that gates delete-safety against active profiles.
```

to:

```rust
//! provenance metadata (where each component was imported from).
```

Delete:

```rust
pub mod references;
```

Delete:

```rust
pub fn store_profiles_dir() -> Result<PathBuf, ApiError> {
    Ok(base_dir()?.join("profiles"))
}
```

In the `store_paths_compose_under_base` test, delete:

```rust
assert_eq!(store_profiles_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/profiles"));
```

- [ ] **Step 4: Remove profile-only errors**

In `crates/ohmyc-core/src/error.rs`, delete the `ReferencedBy` and `ActivationBlocked` variants:

```rust
#[error("{kind} '{name}' is referenced by {} profile(s)", profiles.len())]
ReferencedBy {
    kind: &'static str,
    name: String,
    #[serde(rename = "referencedBy")]
    profiles: Vec<String>,
},

#[error("activation blocked: {} missing component(s)", missing.len())]
ActivationBlocked { missing: Vec<String> },
```

Delete the tests:

```rust
fn activation_blocked_serializes_with_missing_array()
fn referenced_by_serializes_with_structured_detail()
```

In `not_found_serializes_with_code_and_detail`, change:

```rust
kind: "profile",
```

to:

```rust
kind: "agent",
```

and:

```rust
assert_eq!(json["detail"]["kind"], "profile");
```

to:

```rust
assert_eq!(json["detail"]["kind"], "agent");
```

- [ ] **Step 5: Simplify store delete commands**

In `packages/desktop/src-tauri/src/api/store.rs`, change the module doc from:

```rust
//! Tauri command wrappers for ohmyc-core::store CRUD. 4 entity types ×
//! 5 ops (list/get/create/update/delete). Delete commands honor a
//! `force` flag — when false, refuse if any profile references the
//! component and return Conflict with the referencing profile names.
```

to:

```rust
//! Tauri command wrappers for ohmyc-core::store CRUD. 4 entity types ×
//! 5 ops (list/get/create/update/delete).
```

Change the store import from:

```rust
use ohmyc_core::store::{
    self,
    model_configs::{self, ModelConfig},
    provenance::{self, ComponentKind, Provenance},
    references,
};
```

to:

```rust
use ohmyc_core::store::{
    self,
    model_configs::{self, ModelConfig},
    provenance::{self, ComponentKind, Provenance},
};
```

For each delete command, change the signature and body.

Agents:

```rust
#[tauri::command]
pub fn store_agents_delete(name: String, _force: Option<bool>) -> Result<DeleteOk, ApiError> {
    let dir = store::store_agents_dir()?;
    let removed = agents::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "agent", name });
    }
    Ok(DeleteOk { success: true })
}
```

Skills:

```rust
#[tauri::command]
pub fn store_skills_delete(name: String, _force: Option<bool>) -> Result<DeleteOk, ApiError> {
    let dir = store::store_skills_dir()?;
    let removed = skills::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "skill", name });
    }
    Ok(DeleteOk { success: true })
}
```

Commands:

```rust
#[tauri::command]
pub fn store_commands_delete(name: String, _force: Option<bool>) -> Result<DeleteOk, ApiError> {
    let dir = store::store_commands_dir()?;
    let removed = commands::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "command", name });
    }
    Ok(DeleteOk { success: true })
}
```

Model configs:

```rust
#[tauri::command]
pub fn store_model_configs_delete(name: String, _force: Option<bool>) -> Result<DeleteOk, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let removed = model_configs::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound {
            kind: "model-config",
            name,
        });
    }
    Ok(DeleteOk { success: true })
}
```

The `_force` parameter remains to keep the current frontend wire shape harmless during this change; it is ignored.

- [ ] **Step 6: Remove stale plugin comment**

In `crates/ohmyc-core/src/plugins.rs`, rewrite the profile slice comment so the file has no `profiles` mention. Replace:

```rust
//! project-local) lands with slice 7 (profiles), where per-project
```

with:

```rust
//! project-local) lands in a future project-scope slice, where per-project
```

- [ ] **Step 7: Delete Rust profile modules and reference helper**

Run:

```bash
git rm \
  crates/ohmyc-core/src/profiles/activation.rs \
  crates/ohmyc-core/src/profiles/crud.rs \
  crates/ohmyc-core/src/profiles/lock.rs \
  crates/ohmyc-core/src/profiles/marketplace.rs \
  crates/ohmyc-core/src/profiles/mod.rs \
  crates/ohmyc-core/src/profiles/preflight.rs \
  crates/ohmyc-core/src/profiles/symlink.rs \
  crates/ohmyc-core/src/store/references.rs
rmdir crates/ohmyc-core/src/profiles
```

Expected: files are staged for deletion and the empty profiles directory is removed.

- [ ] **Step 8: Run Rust profile domain grep check**

Run:

```bash
rg -n "pub mod profiles|store_profiles_dir|ReferencedBy|ActivationBlocked|referencing_profiles|store::references|profile reference|profiles" crates/ohmyc-core/src packages/desktop/src-tauri/src/api/store.rs --glob '!crates/ohmyc-core/src/claude_home.rs' --glob '!crates/ohmyc-core/src/watcher.rs'
```

Expected: no output.

- [ ] **Step 9: Run Rust tests**

Run:

```bash
cargo test
```

Expected: tests pass.

- [ ] **Step 10: Commit Rust core cleanup**

Run:

```bash
git add crates/ohmyc-core/src packages/desktop/src-tauri/src/api/store.rs
git add -u crates/ohmyc-core/src/profiles crates/ohmyc-core/src/store/references.rs
git commit -m "refactor(core): remove profiles domain"
```

Expected: commit succeeds.

## Task 9: Global Profiles Residue Sweep

**Files:**

- Modify only files reported by the checks in this task when the match is active product guidance or runtime code.

- [ ] **Step 1: Confirm there are no Storybook stories to delete**

Run:

```bash
rg --files | rg "(\\.stories\\.|stories/)"
```

Expected: no output in the current repo. If future stories appear in this branch, delete profiles-only stories and remove profile scenarios from shared component stories.

- [ ] **Step 2: Search active code for removed profiles API names**

Run:

```bash
rg -n "profiles\\.list|profiles\\.get|profiles\\.create|profiles\\.update|profiles\\.delete|profiles\\.activate|profiles\\.deactivate|profiles\\.preflight|useProfiles|useProfile|ProfileSchema|CreateProfileBody|UpdateProfileBody|ProfileCard|ProfileEditor|ProfilesView|ActiveProfileChip|ComparePanel" packages crates --glob '!**/target/**'
```

Expected: no output.

- [ ] **Step 3: Search active code for profile source values**

Run:

```bash
rg -n "'profile'|\"profile\"" packages/shared/src packages/ui/src packages/ui/tests --glob '!**/node_modules/**'
```

Expected: no output from active schemas/components/tests. If this reports natural language in historical docs, do not edit docs from this command.

- [ ] **Step 4: Search active docs and runtime files for old product guidance**

Run:

```bash
rg -n "Profiles are the killer flow|Landing route is `/profiles`|Active-profile chip|Compare side panel|Used by N profiles|Go to Profiles|/profiles" DESIGN.md packages/ui/src packages/ui/tests packages/shared/src packages/desktop/src-tauri/src crates/ohmyc-core/src
```

Expected: no output, except `claude_home.rs` or `watcher.rs` may still mention Claude Code's native `profiles` path in tests/comments. Those mentions are not OhMyC product profiles and should remain if their tests still describe filesystem watching.

- [ ] **Step 5: Run full verification**

Run:

```bash
pnpm test
pnpm --filter @ohmyc/shared build
pnpm --filter @ohmyc/ui build
pnpm --filter @ohmyc/desktop build
cargo test
```

Expected: all commands pass. If a command fails, fix the reported file and rerun the same command until it passes.

- [ ] **Step 6: Commit residue cleanup**

Run:

```bash
git status --short
git add DESIGN.md packages crates
git commit -m "chore: remove profiles residue"
```

Expected: commit succeeds if Step 2-5 required fixes. If `git status --short` is empty, skip this commit.

## Final Verification

- [ ] **Step 1: Verify the archive tag still points to the pre-removal commit**

Run:

```bash
git show --stat --oneline archive/profiles-before-removal-20260616
```

Expected: the tag exists and shows the state before removal commits.

- [ ] **Step 2: Verify no user data migration code was added**

Run:

```bash
rg -n "\\$OHMYC_HOME/profiles|\\.active|settings\\.backup|archive/profiles|remove_dir_all\\(.*profiles|rename\\(.*profiles|copy.*profiles" packages crates --glob '!**/target/**'
```

Expected: no runtime migration/deletion/copy code. The archive tag string may appear in docs only.

- [ ] **Step 3: Verify branch history is reviewable**

Run:

```bash
git log --oneline --decorate -8
```

Expected: recent commits show the design/doc update, route removal, UI cleanup, schema cleanup, desktop command removal, core removal, and final residue cleanup if one was needed.
