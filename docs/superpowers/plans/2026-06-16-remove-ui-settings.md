# Remove UI Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the frontend Settings page, its UI entry points, and its component tests while retaining the lower-level settings hook and transport APIs.

**Architecture:** Treat Settings as a removed Explorer UI section, not as a removed configuration API. Navigation should no longer expose or route to `/explore/settings`; direct visits should follow the existing invalid-tab fallback to Timeline. Keep `useSettings` and `settings.get` / `settings.set` tests intact.

**Tech Stack:** React 19, React Router, Vite, Vitest, Testing Library, TypeScript, pnpm workspace.

---

## File Structure

- Modify `packages/ui/src/app.tsx`
  - Remove the Command Palette Settings command and unused `Settings` icon import.

- Modify `packages/ui/src/hooks/use-keyboard-shortcuts.ts`
  - Make `g` then `s` navigate to `/explore/skills`.
  - Remove the context-aware Settings shortcut.
  - Remove `useLocation` if it becomes unused.

- Modify `packages/ui/src/explorer.tsx`
  - Remove `SettingsLayout` import and render branch.
  - Ensure `settings` is not a valid sidebar section.
  - Remove any current uncommitted Settings sidebar addition from earlier exploration.

- Modify `packages/ui/src/components/header.tsx`
  - Remove the `settings: 'Settings'` breadcrumb label.
  - Normalize unknown `/explore/:tab` labels to `Timeline` so direct `/explore/settings` matches the invalid-tab content fallback.

- Delete `packages/ui/src/components/settings/general-settings.tsx`
- Delete `packages/ui/src/components/settings/settings-content.tsx`
- Delete `packages/ui/src/components/settings/settings-layout.tsx`
- Delete `packages/ui/src/components/settings/settings-sidebar.tsx`

- Delete `packages/ui/tests/components/settings/general-settings.test.tsx`

- Modify `packages/ui/tests/explorer.inventory.test.tsx`
  - Remove the temporary `SettingsLayout` mock.
  - Remove the test that expects Settings route rendering.
  - Add a regression test for `/explore/settings` falling back to Timeline without rendering Settings UI.

- Create `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`
  - Cover `g s` navigation to Skills.
  - Cover ignored shortcuts while focused in an input.

- Keep `packages/ui/src/hooks/use-settings.ts` unchanged.
- Keep `packages/ui/tests/hooks/use-settings.test.tsx` unchanged.

### Current Worktree Note

At plan-writing time, the worktree has two uncommitted changes from the previous investigation:

- `packages/ui/src/explorer.tsx` imports `Settings` and adds `{ id: 'settings', label: 'Settings', icon: Settings }`.
- `packages/ui/tests/explorer.inventory.test.tsx` mocks `SettingsLayout` and expects `/explore/settings` to render it.

Do not preserve those changes. Replace them with the removal behavior described below.

---

### Task 1: Add Failing Regression Tests

**Files:**
- Modify: `packages/ui/tests/explorer.inventory.test.tsx`
- Create: `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`

- [ ] **Step 1: Replace the temporary Settings route test**

In `packages/ui/tests/explorer.inventory.test.tsx`, delete this mock:

```tsx
vi.mock('@/components/settings/settings-layout', () => ({
  SettingsLayout: () => <div>Settings panel</div>,
}))
```

Delete the existing test named:

```tsx
it('shows Settings in the sidebar and renders the settings route', () => {
  renderWithProviders(
    <Routes>
      <Route path="/explore/:tab" element={<Explorer />} />
    </Routes>,
    { route: '/explore/settings' },
  )

  expect(document.body.textContent).toContain('Settings')
  expect(screen.getByText('Settings panel')).toBeInTheDocument()
})
```

Add this replacement test at the end of `describe('Explorer inventory views', () => { ... })`:

```tsx
  it('treats /explore/settings as an invalid tab and falls back to timeline content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/settings' },
    )

    expect(document.body.textContent).toContain('Timeline')
    expect(document.body.textContent).not.toContain('Settings panel')
    expect(document.body.textContent).not.toContain('General')
    expect(document.body.textContent).not.toContain('Configure your general settings')
  })
```

- [ ] **Step 2: Add keyboard shortcut tests**

Create `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx` with this content:

```tsx
import { fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

function ShortcutHarness() {
  useGlobalKeyboardShortcuts()
  const location = useLocation()

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <input aria-label="Search input" />
    </div>
  )
}

describe('useGlobalKeyboardShortcuts', () => {
  it('maps g then s to Skills from Explorer pages', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/explore/lsp' },
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/skills')
  })

  it('maps g then s to Skills outside Explorer pages', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/menubar' },
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/skills')
  })

  it('ignores shortcut sequences while an input is focused', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/explore/lsp' },
    )

    screen.getByLabelText('Search input').focus()
    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/lsp')
  })
})
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest run \
  tests/explorer.inventory.test.tsx \
  tests/hooks/use-keyboard-shortcuts.test.tsx
```

Expected result before implementation:

- `/explore/settings` fallback test fails because Settings route is still renderable or the breadcrumb still says Settings.
- Keyboard shortcut test fails because `g s` still navigates to `/explore/settings` or `/settings`.

Do not commit this failing state.

---

### Task 2: Remove Settings Navigation Entrypoints

**Files:**
- Modify: `packages/ui/src/app.tsx`
- Modify: `packages/ui/src/hooks/use-keyboard-shortcuts.ts`
- Modify: `packages/ui/src/components/header.tsx`
- Test: `packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx`

- [ ] **Step 1: Remove Settings from the app command palette**

In `packages/ui/src/app.tsx`, change the lucide import to remove `Settings`:

```tsx
import {
  Activity,
  Bot,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
```

Remove this object from `goToCommands`:

```tsx
    {
      id: 'goto-settings',
      label: 'Settings',
      icon: <Settings size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/settings'),
    },
```

- [ ] **Step 2: Make `g s` navigate to Skills**

Replace the imports at the top of `packages/ui/src/hooks/use-keyboard-shortcuts.ts` with:

```ts
// Global keyboard shortcut hook — implements `g`-prefixed navigation.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
```

Update the function setup so it no longer reads `location`:

```ts
export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate()
```

Replace the JSDoc with:

```ts
/**
 * Sets up global `g`-prefixed keyboard navigation:
 * - `g` then `e` → Explorer (Agents)
 * - `g` then `s` → Explorer (Skills)
 *
 * Silently ignored when an input, textarea, or contenteditable is focused.
 */
```

Replace the existing `if (e.key === 's') { ... }` block with:

```ts
        if (e.key === 's') {
          e.preventDefault()
          navigate('/explore/skills')
        }
```

Update the effect dependency array:

```ts
  }, [navigate])
```

- [ ] **Step 3: Remove Settings from breadcrumb labels and normalize unknown tabs**

In `packages/ui/src/components/header.tsx`, replace the `labels` object and return block inside `if (pathname.startsWith('/explore/')) { ... }` with:

```tsx
    const labels: Record<string, string> = {
      timeline: 'Timeline',
      agents: 'Agents',
      skills: 'Skills',
      commands: 'Commands',
      plugins: 'Plugins',
      hooks: 'Hooks',
      mcp: 'MCP Servers',
      lsp: 'LSP Servers',
    }
    return { root: 'Explorer', current: labels[tab] ?? 'Timeline' }
```

- [ ] **Step 4: Run navigation tests**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest run \
  tests/hooks/use-keyboard-shortcuts.test.tsx
```

Expected result:

- `tests/hooks/use-keyboard-shortcuts.test.tsx` passes.

- [ ] **Step 5: Commit navigation removal**

Run:

```bash
git add \
  packages/ui/src/app.tsx \
  packages/ui/src/hooks/use-keyboard-shortcuts.ts \
  packages/ui/src/components/header.tsx \
  packages/ui/tests/hooks/use-keyboard-shortcuts.test.tsx

git commit -m ":recycle: refactor(ui): remove settings navigation" \
  -m "Remove Settings from command palette navigation and map g-s to Skills while keeping invalid Explorer tabs aligned with the Timeline fallback."
```

---

### Task 3: Remove Settings Page Components

**Files:**
- Modify: `packages/ui/src/explorer.tsx`
- Modify: `packages/ui/tests/explorer.inventory.test.tsx`
- Delete: `packages/ui/src/components/settings/general-settings.tsx`
- Delete: `packages/ui/src/components/settings/settings-content.tsx`
- Delete: `packages/ui/src/components/settings/settings-layout.tsx`
- Delete: `packages/ui/src/components/settings/settings-sidebar.tsx`
- Delete: `packages/ui/tests/components/settings/general-settings.test.tsx`

- [ ] **Step 1: Remove Settings imports and section entry from Explorer**

In `packages/ui/src/explorer.tsx`, ensure the lucide import does not include `Settings`:

```tsx
import {
  Anchor,
  Blocks,
  Bot,
  Code,
  Info,
  Search,
  Server,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
```

Remove this import:

```tsx
import { SettingsLayout } from './components/settings/settings-layout'
```

Ensure `SECTIONS` has no `settings` entry:

```tsx
const SECTIONS: SidebarSection[] = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'commands', label: 'Commands', icon: TerminalSquare },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'hooks', label: 'Hooks', icon: Anchor },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'lsp', label: 'LSP Servers', icon: Code },
]
```

- [ ] **Step 2: Remove the Settings render branch**

In `packages/ui/src/explorer.tsx`, delete this branch from the main content:

```tsx
            {activeSection === 'settings' && <SettingsLayout />}
```

- [ ] **Step 3: Delete Settings page files**

Run:

```bash
rm packages/ui/src/components/settings/general-settings.tsx
rm packages/ui/src/components/settings/settings-content.tsx
rm packages/ui/src/components/settings/settings-layout.tsx
rm packages/ui/src/components/settings/settings-sidebar.tsx
rmdir packages/ui/src/components/settings
rm packages/ui/tests/components/settings/general-settings.test.tsx
rmdir packages/ui/tests/components/settings
```

If `rmdir` reports the directory is not empty, stop and inspect it with:

```bash
find packages/ui/src/components/settings packages/ui/tests/components/settings -maxdepth 2 -type f -print
```

Only remove files that belong to the Settings page feature listed in the spec.

- [ ] **Step 4: Ensure Explorer inventory test expects removal**

`packages/ui/tests/explorer.inventory.test.tsx` should contain no mock for `@/components/settings/settings-layout`.

It should include this test:

```tsx
  it('treats /explore/settings as an invalid tab and falls back to timeline content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/settings' },
    )

    expect(document.body.textContent).toContain('Timeline')
    expect(document.body.textContent).not.toContain('Settings panel')
    expect(document.body.textContent).not.toContain('General')
    expect(document.body.textContent).not.toContain('Configure your general settings')
  })
```

- [ ] **Step 5: Run Explorer test**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest run tests/explorer.inventory.test.tsx
```

Expected result:

- All Explorer inventory tests pass.
- `/explore/settings` renders Timeline content, not Settings content.

- [ ] **Step 6: Commit component removal**

Run:

```bash
git add -A \
  packages/ui/src/explorer.tsx \
  packages/ui/src/components/settings \
  packages/ui/tests/components/settings \
  packages/ui/tests/explorer.inventory.test.tsx

git commit -m ":fire: refactor(ui): remove settings page" \
  -m "Delete the frontend Settings page components and keep direct settings URLs on the existing Explorer fallback path."
```

---

### Task 4: Verify Retained Settings API And Sweep References

**Files:**
- Test: `packages/ui/tests/hooks/use-settings.test.tsx`
- Inspect: `packages/ui/src/hooks/use-settings.ts`
- Inspect: `packages/ui/src/lib/transport.ts`
- Inspect: `packages/ui/src/lib/transport/mock.ts`

- [ ] **Step 1: Search for removed UI references**

Run:

```bash
rg "explore/settings|SettingsLayout|SettingsContent|SettingsSidebar|GeneralSettingsPanel|components/settings|goto-settings" packages/ui/src packages/ui/tests -n
```

Expected result:

- No matches.

- [ ] **Step 2: Confirm the Command Palette no longer registers Settings**

Run:

```bash
rg "goto-settings|label: 'Settings'|navigate\\('/explore/settings'\\)" packages/ui/src/app.tsx -n
```

Expected result:

- No matches.

- [ ] **Step 3: Confirm retained settings hook references still exist**

Run:

```bash
rg "useSettings|settings\\.get|settings\\.set" packages/ui/src packages/ui/tests -n
```

Expected result includes:

```text
packages/ui/src/hooks/use-settings.ts
packages/ui/tests/hooks/use-settings.test.tsx
```

Matches in generic transport tests are acceptable because `settings.get` and
`settings.set` are retained lower-level transport capabilities.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest run \
  tests/explorer.inventory.test.tsx \
  tests/hooks/use-keyboard-shortcuts.test.tsx \
  tests/hooks/use-settings.test.tsx
```

Expected result:

- All listed test files pass.
- `use-settings.test.tsx` proves retained lower-level settings access still works.

- [ ] **Step 5: Run full coverage**

Run:

```bash
pnpm --filter @ohmyc/ui test:coverage
```

Expected result:

- All tests pass.
- Total coverage remains above 85%.

- [ ] **Step 6: Commit verification cleanup if needed**

If Task 4 required any code or test edits, commit them:

```bash
git add -A
git commit -m ":white_check_mark: test(ui): verify settings removal" \
  -m "Keep retained settings API coverage while asserting the frontend Settings page and entries are gone."
```

If Task 4 required no edits, do not create an empty commit.

---

### Task 5: Final Audit

**Files:**
- Inspect: full worktree

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected result:

- No unstaged or staged changes remain.

- [ ] **Step 2: Confirm recent commits**

Run:

```bash
git log --oneline -5
```

Expected result:

- Includes the navigation removal commit.
- Includes the settings page removal commit.
- Includes the design/spec commit `:memo: docs(ui): design settings removal`.

- [ ] **Step 3: Summarize final behavior**

Final behavior to report:

- Settings no longer appears in the Command Palette.
- `g s` opens Skills.
- `/explore/settings` is not a usable Settings page and falls back to Timeline.
- `useSettings` and `settings.get` / `settings.set` remain covered.
- Full `@ohmyc/ui` coverage remains above 85%.
