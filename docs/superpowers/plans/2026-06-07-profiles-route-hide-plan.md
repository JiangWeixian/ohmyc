# Hide Profiles route + fold Timeline into Explore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every visible UI entry point to `/profiles` (nav, palette, header, sidebar back-links, "+ New Profile" button) and move Timeline from a standalone `/timeline` route into a special "Activity" group inside Explorer at `/explore/timeline`. Default landing changes from `/profiles` to `/explore/timeline`.

**Architecture:** Pure UI surgery. Route + components stay in tree so revert is a single `git revert`. Zero backend changes (Rust core, Tauri commands, hooks untouched). Five files modified, ~80 lines added / ~120 removed.

**Tech Stack:** React + React Router v6, TypeScript. Existing component patterns (Sidebar, Tabs, breadcrumb) are kept; only the configuration changes.

---

## File Structure

**Files modified (5):**
- `packages/ui/src/app.tsx` — route table, ⌘K palette, delete `TimelineRoute` function.
- `packages/ui/src/explorer.tsx` — accept `'timeline'` as a special active section, render `<TimelineView />` for it.
- `packages/ui/src/components/sidebar.tsx` — Timeline button targets `/explore/timeline` + highlights when `activeSection === 'timeline'`.
- `packages/ui/src/components/profiles/profiles-sidebar.tsx` — remove Timeline back-link + "+ New Profile" button.
- `packages/ui/src/components/header.tsx` — remove `<ActiveProfileChip>` + `/timeline` + `/profiles*` breadcrumb branches.

**Files NOT modified (intentional):**
- `packages/ui/src/profiles-view.tsx` — route still resolves to it.
- `packages/ui/src/components/profiles/*` (besides the sidebar) — unchanged.
- `packages/ui/src/components/active-profile-chip.tsx` — left in tree as dead-imports-of-nothing for clean revert.
- `packages/ui/src/components/view-switcher.tsx` — same.
- `packages/ui/src/hooks/use-profiles.ts` — same.
- All Rust + Tauri code — untouched.

---

## Task 1: Add `timeline` as a special section in Explorer

**Files:**
- Modify: `packages/ui/src/explorer.tsx`

Explorer currently validates the `:tab` URL param against the SECTIONS array (line 105) and defaults invalid values to `'agents'`. We need it to also accept `'timeline'` as a valid value and render `<TimelineView />` when active. This task lands first so that subsequent tasks (route changes in Task 2) can safely point at `/explore/timeline` without race conditions.

- [ ] **Step 1: Add the TimelineView import**

Open `packages/ui/src/explorer.tsx`. Near the top, with the other component imports, add:

```ts
import { TimelineView } from './components/timeline/timeline-view'
```

- [ ] **Step 2: Expand the `activeSection` validity check**

Find line 105:

```ts
const activeSection = tab && SECTIONS.some(s => s.id === tab) ? tab : 'agents'
```

Replace with:

```ts
const activeSection = tab === 'timeline' || (tab && SECTIONS.some(s => s.id === tab)) ? tab : 'timeline'
```

This accepts `'timeline'` AND any SECTIONS entry. Default fallback for unknown tabs changes from `'agents'` to `'timeline'` so direct hits to `/explore` (without a tab) land on Timeline.

- [ ] **Step 3: Render `<TimelineView />` when active**

Find the conditional render block around line 514. After `<div className="mx-auto w-full max-w-6xl p-10">` and before `{activeSection === 'agents' && renderEntityList('agents')}`, add:

```tsx
{activeSection === 'timeline' && <TimelineView />}
```

The `max-w-6xl p-10` wrapper is fine for Timeline — its existing layout fits within that constraint.

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors beyond the pre-existing `@tauri-apps/api/core` / `ImportMeta.env` baseline failures.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/explorer.tsx
git commit -m "feat(ui): accept 'timeline' as special Explorer tab + render TimelineView"
```

---

## Task 2: Redirect `/timeline` + change Explorer default + delete TimelineRoute

**Files:**
- Modify: `packages/ui/src/app.tsx`

Now that Explorer handles `/explore/timeline`, point all timeline traffic at it. The standalone `/timeline` route + `TimelineRoute` function disappear; the catch-all redirect moves from `/profiles` to `/explore/timeline`; the `/explore` default redirect targets `/explore/timeline`.

- [ ] **Step 1: Update the route table**

Open `packages/ui/src/app.tsx`. Find the `<Routes>` block (around line 240-247):

```tsx
<Routes>
  <Route path="/timeline" element={<TimelineRoute viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
  <Route path="/profiles/*" element={<ProfilesView viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
  <Route path="/explore/:tab" element={<Explorer viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
  <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
  <Route path="/menubar" element={<MenubarPage />} />
  <Route path="*" element={<Navigate to="/profiles" replace />} />
</Routes>
```

Replace with:

```tsx
<Routes>
  <Route path="/profiles/*" element={<ProfilesView viewSwitcher={null} />} />
  <Route path="/explore/:tab" element={<Explorer viewSwitcher={null} />} />
  <Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
  <Route path="/menubar" element={<MenubarPage />} />
  <Route path="*" element={<Navigate to="/explore/timeline" replace />} />
</Routes>
```

Changes:
- `<Route path="/timeline">` deleted — catch-all handles it (`/timeline` → `/explore/timeline`).
- `<ProfilesView viewSwitcher={null}>` — pass `null` instead of a `<ViewSwitcher>` instance. (Profiles is URL-typed only; the view-switcher chrome doesn't apply.)
- `<Explorer viewSwitcher={null}>` — same.
- `/explore` default redirects to `/explore/timeline` (was `/explore/agents`).
- Catch-all redirects to `/explore/timeline` (was `/profiles`).

- [ ] **Step 2: Delete the `TimelineRoute` function**

Find `function TimelineRoute({ viewSwitcher }: ...)` (line 191-223) — including the docstring above it. Delete the entire function body, the docstring, and the blank line before/after it.

- [ ] **Step 3: Delete the `ViewSwitcher` state**

In the `AppLayout` function (around line 226-234), delete:

```tsx
const active: ViewId = location.pathname.startsWith('/profiles') ? 'profiles' : 'agent-home'

const handleChange = (id: ViewId) => {
  navigate(id === 'profiles' ? '/profiles' : '/explore')
}
```

After this deletion, `location` and `navigate` may become unused. Keep them if other code in AppLayout still uses them; otherwise drop the corresponding `useLocation()`/`useNavigate()` calls + the imports.

- [ ] **Step 4: Drop unused imports**

At the top of `app.tsx`, the following imports were used only by the deleted code:

```ts
import { ProfilesSidebar } from './components/profiles/profiles-sidebar'
import { TimelineView } from './components/timeline/timeline-view'
import { type ViewId, ViewSwitcher } from './components/view-switcher'
```

Remove all three import lines.

Also at the top, the icon-only imports from `lucide-react` (line 2-14) include several icons that were used solely by the deleted ⌘K profile actions (Task 3 deletes those). Don't touch them in this task; Task 3 cleans up the icon imports.

- [ ] **Step 5: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors. (If you see "Cannot find name 'ViewId'" or similar, you missed a usage in AppLayout.)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/app.tsx
git commit -m "feat(ui): redirect /timeline + catch-all to /explore/timeline; delete TimelineRoute"
```

---

## Task 3: Drop profile actions + update Timeline action in ⌘K palette

**Files:**
- Modify: `packages/ui/src/app.tsx`

Remove the four profile-action sources from the command palette + retarget the Timeline action.

- [ ] **Step 1: Delete `profileCommands` and `compareCommands`**

In `app.tsx`, find the `AppCommandPalette` function. Delete these two declarations:

The `profileCommands` block (lines 52-61):

```ts
const profileCommands = profiles
  .filter(p => p.name !== active)
  .map((p, i) => ({
    id: `activate-${p.name}`,
    label: `Activate ${p.name}`,
    shortcut: i < 3 ? `⌘${i + 1}` : undefined,
    icon: <Check size={14} />,
    category: 'Profile',
    action: () => activate.mutate(p.name),
  }))
```

And the `compareCommands` block (lines 63-71):

```ts
const compareCommands = profiles
  .filter(p => p.name !== active)
  .map(p => ({
    id: `compare-${p.name}`,
    label: `Compare ${p.name} with ${active ?? 'active'}`,
    icon: <GitCompare size={14} />,
    category: 'Profile',
    action: () => navigate(`/profiles?compare=${encodeURIComponent(p.name)}`),
  }))
```

- [ ] **Step 2: Delete `activeProfileCommands`**

Find lines 73-90 and delete the entire block:

```ts
const activeProfileCommands = activeProfile
  ? [
      {
        id: 'edit-active',
        label: `Edit ${activeProfile.name}`,
        icon: <Pencil size={14} />,
        category: 'Profile' as const,
        action: () => navigate(`/profiles/${activeProfile.name}`),
      },
      {
        id: 'duplicate-active',
        label: `Duplicate ${activeProfile.name}`,
        icon: <Copy size={14} />,
        category: 'Profile' as const,
        action: () => navigate(`/profiles/new?from=${encodeURIComponent(activeProfile.name)}`),
      },
    ]
  : []
```

- [ ] **Step 3: Delete `goto-profiles` from `goToCommands`**

In `goToCommands` (lines 92-140), find and delete this entry:

```ts
{
  id: 'goto-profiles',
  label: 'Profiles',
  shortcut: 'g p',
  icon: <FolderOpen size={14} />,
  category: 'Go to',
  action: () => navigate('/profiles'),
},
```

- [ ] **Step 4: Retarget the Timeline action**

Still in `goToCommands`, find the `goto-timeline` entry (around line 125-132). Change the action:

```ts
action: () => navigate('/timeline'),
```

to:

```ts
action: () => navigate('/explore/timeline'),
```

Other fields (id, label, shortcut, icon, category) stay the same.

- [ ] **Step 5: Update `allCommands`**

Find the `allCommands` declaration (around line 174-180):

```ts
const allCommands = [
  ...profileCommands,
  ...activeProfileCommands,
  ...compareCommands,
  ...goToCommands,
  ...searchCommands,
]
```

Replace with:

```ts
const allCommands = [
  ...goToCommands,
  ...searchCommands,
]
```

- [ ] **Step 6: Drop unused hook calls + variable bindings**

The deleted code was the only consumer of `activate`, `activeProfile`, `profiles`, and `active`. Find these lines at the top of `AppCommandPalette`:

```ts
const { data } = useProfiles()
const profiles = data?.profiles ?? []
const active = data?.active
const activeProfile = profiles.find(p => p.name === active)
const activate = useActivateProfile()
```

Delete all five.

- [ ] **Step 7: Drop unused imports**

At the top of `app.tsx`:
- The `lucide-react` import (lines 2-14) no longer needs `Check`, `Copy`, `FolderOpen`, `GitCompare`, `Pencil`. Remove those five names from the destructured import.
- The `./hooks/use-profiles` import: delete `useActivateProfile, useProfiles` from `import { useActivateProfile, useProfiles } from './hooks/use-profiles'`. If `useProfiles` is the only remaining named import, delete the whole import line. If only one remains, keep it.

Check whether `useProfiles` is still imported elsewhere in this file — Explorer's `useProfiles` is inside `explorer.tsx`, not here, so the import in `app.tsx` is solely for the deleted code. Drop the whole line.

- [ ] **Step 8: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors. Look specifically for "is declared but never used" warnings on the deleted icons or hooks; clean them up if any remain.

- [ ] **Step 9: Commit**

```bash
git add packages/ui/src/app.tsx
git commit -m "feat(ui): drop profile actions from ⌘K palette; retarget Timeline action"
```

---

## Task 4: Strip Header — remove ActiveProfileChip + profile/timeline breadcrumb branches

**Files:**
- Modify: `packages/ui/src/components/header.tsx`

The Header currently renders `<ActiveProfileChip>` unconditionally and detects `/timeline*` + `/profiles*` paths for breadcrumb labels. Both surfaces go.

- [ ] **Step 1: Strip the `<ActiveProfileChip>` render**

Open `packages/ui/src/components/header.tsx`. Find line 98:

```tsx
<ActiveProfileChip onCompare={onCompare} />
```

Delete this line.

- [ ] **Step 2: Drop the chip + `onCompare` prop**

The `Header` props interface (lines 67-71) declares `onCompare`:

```tsx
interface HeaderProps {
  /** Optional callback to trigger profile comparison. */
  onCompare?: () => void
}
```

Delete the interface entirely (the prop is no longer consumed by anything in the file).

Update the component signature on line 74:

```tsx
export function Header({ onCompare }: HeaderProps) {
```

becomes:

```tsx
export function Header() {
```

- [ ] **Step 3: Drop the breadcrumb branches for `/timeline` and `/profiles`**

Find the `useBreadcrumb` function (lines 9-65). Delete:

The `/timeline` branch (lines 12-14):

```tsx
if (pathname.startsWith('/timeline')) {
  return { root: 'Activity', current: 'Timeline' }
}
```

The `/profiles/new` branch (lines 15-17):

```tsx
if (pathname.startsWith('/profiles/new')) {
  return { root: 'Profiles', current: 'New profile' }
}
```

The `profileComponents` block (lines 18-37):

```tsx
const profileComponents: Record<string, string> = {
  agents: 'Agents',
  skills: 'Skills',
  commands: 'Commands',
  'model-configs': 'Model Configs',
}
for (const [key, label] of Object.entries(profileComponents)) {
  if (pathname.startsWith(`/profiles/${key}`)) {
    // Check if it's an edit route like /profiles/agents/name/edit
    const match = pathname.match(new RegExp(`^/profiles/${key}/(.+)/edit$`))
    if (match) {
      return { root: 'Profiles', current: `Edit ${match[1]}` }
    }
    // Check if it's a new route like /profiles/agents/edit
    if (pathname === `/profiles/${key}/edit`) {
      return { root: 'Profiles', current: `New ${label.slice(0, -1)}` }
    }
    return { root: 'Profiles', current: label }
  }
}
```

The `/profiles/` and `/profiles` branches (lines 38-49):

```tsx
if (pathname.startsWith('/profiles/')) {
  const rest = pathname.slice('/profiles/'.length)
  // Handle profile edit: /profiles/:name/edit
  if (rest.endsWith('/edit')) {
    const name = rest.slice(0, -5)
    return { root: 'Profiles', current: `Edit ${name}` }
  }
  return { root: 'Profiles', current: rest || 'All profiles' }
}
if (pathname.startsWith('/profiles')) {
  return { root: 'Profiles', current: 'All profiles' }
}
```

What remains in `useBreadcrumb`: just the `/explore/` branch (lines 50-63) and the default return (line 64).

After the deletion, add the `timeline` label so `/explore/timeline` shows the right breadcrumb. In the `labels` object (lines 52-61), add a single key at the top:

```ts
const labels: Record<string, string> = {
  timeline: 'Timeline',
  agents: 'Agents',
  // ... rest unchanged
}
```

- [ ] **Step 4: Drop unused imports**

At the top of `header.tsx` (line 4), remove:

```ts
import { ActiveProfileChip } from './active-profile-chip'
```

- [ ] **Step 5: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors. If you see "Header expects no arguments" errors from callsites passing `onCompare`, grep `grep -rn "<Header" packages/ui/src/` and remove the prop from each callsite.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/header.tsx
git commit -m "feat(ui): strip Header — drop ActiveProfileChip + profile/timeline breadcrumbs"
```

---

## Task 5: Update Explorer Sidebar — Timeline button targets `/explore/timeline` + highlights on active

**Files:**
- Modify: `packages/ui/src/components/sidebar.tsx`

The "Activity" group at the top of the Explorer sidebar keeps its Timeline button (per the spec's "special group" requirement), but the click target moves from `/timeline` to `/explore/timeline` and the button highlights when `activeSection === 'timeline'`.

- [ ] **Step 1: Update the click handler**

Open `packages/ui/src/components/sidebar.tsx`. Find line 69:

```tsx
onClick={() => navigate('/timeline')}
```

Replace with:

```tsx
onClick={() => onSectionChange('timeline')}
```

Using `onSectionChange` (instead of `navigate`) keeps the sidebar consistent with how SECTIONS tabs change route — Explorer's `onSectionChange` already does `navigate(/explore/${id})` (see `explorer.tsx:502-505`).

- [ ] **Step 2: Add active-state styling**

Find the entire Timeline button (lines 67-76):

```tsx
<button
  type="button"
  onClick={() => onSectionChange('timeline')}
  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]"
>
  <span className="shrink-0 text-[var(--text-tertiary)]">
    <Activity size={16} />
  </span>
  <span>Timeline</span>
</button>
```

Replace with:

```tsx
<button
  type="button"
  onClick={() => onSectionChange('timeline')}
  className={cn(
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
    activeSection === 'timeline'
      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
      : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
  )}
>
  <span className={cn('shrink-0', activeSection === 'timeline' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
    <Activity size={16} />
  </span>
  <span>Timeline</span>
</button>
```

The `activeSection` variable is already in scope (destructured at line 53-58). The `cn` utility is already imported on line 11.

- [ ] **Step 3: Drop the now-unused `useNavigate`**

After removing the only `navigate('/timeline')` call, check if `useNavigate` has any other consumers in this file:

Run: `grep -n "navigate" packages/ui/src/components/sidebar.tsx`
Expected: only the line `const navigate = useNavigate()` remains as a usage of `navigate`. Delete that line (line 59).

Also drop the import (line 4):

```ts
import { useNavigate } from 'react-router-dom'
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/sidebar.tsx
git commit -m "feat(ui): Explorer sidebar Timeline button targets /explore/timeline + highlights on active"
```

---

## Task 6: Strip ProfilesSidebar — drop Timeline back-link + "+ New Profile" button

**Files:**
- Modify: `packages/ui/src/components/profiles/profiles-sidebar.tsx`
- Modify: `packages/ui/tests/profiles-view.test.tsx` (if it asserts the deleted UI)

URL-typed Profiles users still see a working page, but with no link back to Timeline and no "+ New Profile" affordance.

- [ ] **Step 1: Delete the Timeline section + button**

Open `packages/ui/src/components/profiles/profiles-sidebar.tsx`. Find the Activity section header + Timeline button (lines 113-132):

```tsx
<div className="mb-2 px-2 pt-1 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
  Activity
</div>
<button
  type="button"
  onClick={() => navigate('/timeline')}
  className={cn(
    'mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
    timelineActive
      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
  )}
>
  <span className={cn('shrink-0', timelineActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
    <Activity size={16} />
  </span>
  <span>Timeline</span>
</button>
```

Delete the entire block (the "Activity" header `<div>` + the `<button>`). The "My Profiles" header that follows now becomes the first item rendered in the sidebar body.

In the "My Profiles" header line:

```tsx
<div className="mb-2 mt-5 px-2 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
  My Profiles
</div>
```

Change `mt-5` to `pt-1` (matching what the Activity header used to do — establishes top padding now that it's the first child):

```tsx
<div className="mb-2 pt-1 px-2 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
  My Profiles
</div>
```

- [ ] **Step 2: Drop the `timelineActive` prop**

Find the props interface (lines 32-41):

```ts
interface ProfilesSidebarProperties {
  profiles: Profile[]
  active: string | null
  selection: SidebarSelection | null
  onSelect: (sel: SidebarSelection) => void
  onCompare?: (profileName: string) => void
  onActivate?: (profileName: string) => void
  headerSlot?: React.ReactNode
  timelineActive?: boolean
}
```

Remove the `timelineActive?: boolean` line.

Find the component signature (line 99):

```tsx
export function ProfilesSidebar({ profiles, active, selection, onSelect, onCompare, onActivate, headerSlot, timelineActive }: ProfilesSidebarProperties) {
```

Remove `timelineActive` from the destructuring:

```tsx
export function ProfilesSidebar({ profiles, active, selection, onSelect, onCompare, onActivate, headerSlot }: ProfilesSidebarProperties) {
```

Also remove `, timelineActive` from the docstring above (line 94-98) — the prop list there mentions Activity (timeline). Update the docstring:

```tsx
/**
 * Sidebar navigation with two groups: My Profiles (with inline activate/compare
 * actions) and Components (store categories). Selection state is managed
 * externally via SidebarSelection.
 */
```

- [ ] **Step 3: Delete the "+ New Profile" `TabsTrigger`**

Find the new-profile button (lines 201-214):

```tsx
<TabsTrigger
  value="new-profile"
  className={cn(
    'relative mb-0.5 w-full flex items-center justify-start gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
    currentValue === 'new-profile'
      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
  )}
>
  <span className={cn('relative z-10 shrink-0', currentValue === 'new-profile' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
    <Plus size={16} />
  </span>
  <span className="relative z-10">New Profile</span>
</TabsTrigger>
```

Delete the entire block. The `</TabsList>` immediately follows.

- [ ] **Step 4: Drop unused imports**

At the top (lines 4-13), the `lucide-react` import no longer uses `Activity` (Timeline icon — gone in Step 1) and `Plus` (New Profile icon — gone in Step 3). Remove both from the destructured import.

The `useNavigate` import (line 14) is still used by other handlers in the file (the component-category navigation) — leave it.

Confirm: `grep -n "Activity\|Plus" packages/ui/src/components/profiles/profiles-sidebar.tsx` should return zero usages after this step.

- [ ] **Step 5: Update `profiles-view.test.tsx` if it asserts the deleted UI**

Run: `grep -n "Timeline\|new-profile\|New Profile\|Plus" packages/ui/tests/profiles-view.test.tsx`

For each match:
- If a test queries `getByText('Timeline')` or `getByText('New Profile')` and asserts it's there, that test now describes deleted UI — delete the assertion or the entire `it(...)` block.
- If a test uses `selection: { type: 'new-profile' }` as input (testing that the parent handler routes correctly), keep it. The selection type still exists in the union; only the sidebar UI affordance is gone.

If no matches, this step is a no-op.

- [ ] **Step 6: Verify typecheck + run profiles-view tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no new errors.

Run: `pnpm --filter @ohmyc/ui test tests/profiles-view.test.tsx 2>&1 | tail -15`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/profiles/profiles-sidebar.tsx packages/ui/tests/profiles-view.test.tsx
git commit -m "feat(ui): ProfilesSidebar — drop Timeline back-link + '+ New Profile' button"
```

---

## Task 7: Final verification

**Files:** none modified

The merge-readiness gate.

- [ ] **Step 1: Full UI test sweep**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test 2>&1 | tail -15`
Expected: 4 pre-existing menubar failures (unchanged baseline). No new failures.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: only the pre-existing `@tauri-apps/api/core` + `ImportMeta.env` baseline errors. No new errors.

- [ ] **Step 3: Workspace build**

Run: `pnpm -r build 2>&1 | tail -15`
Expected: success across all packages.

- [ ] **Step 4: Manual smoke test (recommended)**

Build the desktop binary and exercise the change:

```bash
pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin 2>&1 | tail -10
# Then launch the .app from finder or:
open packages/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/OhMyC.app
```

In the launched app:
1. **Landing:** the main window opens at `/explore/timeline`. The Explorer sidebar shows "Activity > Timeline" highlighted at the top.
2. **Sidebar groups:** the "Activity" group has only Timeline; the "Explore" group has Agents, Skills, Commands, Plugins, Hooks, MCP Servers, LSP Servers.
3. **Header:** no profile chip. Breadcrumb shows `Explorer / Timeline`.
4. **⌘K palette:** type `g p` — no "Profiles" entry. Type `g t` — Timeline action navigates to `/explore/timeline` (not `/timeline`).
5. **URL-type `/profiles`:** the Profiles UI renders. Its sidebar has NO Timeline link at the top, and NO "+ New Profile" button at the end of the My Profiles list.
6. **URL-type `/timeline`:** redirects to `/explore/timeline` via the catch-all.

If any of these are wrong, stop and investigate before merging.

- [ ] **Step 5: Open PR (or merge to integration branch, per project convention)**

```bash
git checkout feat/menubar-chart  # or whichever integration branch is active
git merge --no-ff <this-branch> -m "Merge: hide Profiles route + fold Timeline into Explore"
```

Or push the branch + open a PR if your workflow uses one.

---

## Self-review notes

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Default landing → `/explore/timeline` | Task 2 (route table) |
| Standalone `/timeline` deleted | Task 2 |
| Timeline as Explorer special tab | Tasks 1, 5 |
| Explorer sidebar Activity group preserved | Task 5 |
| ProfilesSidebar Timeline back-link removed | Task 6 |
| ProfilesSidebar "+ New Profile" removed | Task 6 |
| ⌘K palette profile actions removed | Task 3 |
| ⌘K Timeline action retargeted | Task 3 |
| Header ActiveProfileChip removed | Task 4 |
| Header `/profiles*` + `/timeline*` breadcrumb branches removed | Task 4 |
| Backend untouched | All tasks (verified by file list) |
| Components stay in tree (clean revert) | All tasks |

No gaps.

**Placeholder scan:** None. Every step contains complete code or an exact command.

**Type consistency:** `ProfilesSidebar` props before/after match what callsites pass (`profiles-view.tsx` doesn't pass `timelineActive`; the prop deletion is safe). `Header` callsites (grep'd in Task 4 Step 5) get the prop removal. `Explorer`'s `activeSection` type stays `string`; the broadened validity check is a runtime concern only.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-profiles-route-hide-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks. Useful here because Tasks 2-3 both touch `app.tsx` — fresh subagents avoid drift between them.

**2. Inline Execution** — `executing-plans` skill in this session.

Which approach?
