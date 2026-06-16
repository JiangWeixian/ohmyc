# Sidebar Core Tabs Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Timeline in the sidebar while limiting Explorer resource tabs to Agents, Commands, Skills, and Plugins, and remove the Plugins Environment summary.

**Architecture:** This is a focused UI information-architecture cleanup. The Explorer shell remains the single routing surface, Timeline remains the default fallback, and lower-level config APIs/hooks remain available for non-page consumers. The implementation updates `DESIGN.md` first, then uses focused Explorer tests to drive the visible navigation, legacy URL fallback behavior, and simplified Plugins page.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, Testing Library, TailwindCSS, lucide-react.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-06-16-sidebar-core-tabs-design.md`
- Design source of truth: `DESIGN.md`

## File Structure

- Modify: `DESIGN.md`
  - Records the active layout decision before implementation, per repository rules.
- Modify: `packages/ui/tests/explorer.inventory.test.tsx`
  - Owns focused Explorer UI coverage for sidebar inventory, plugin inventory, and legacy tab fallback.
- Modify: `packages/ui/src/explorer.tsx`
  - Owns Explorer section definitions, active tab fallback, resource-tab rendering, plugin inventory rendering, and removed config-page branches.
- Modify: `packages/ui/src/components/header.tsx`
  - Owns breadcrumb labels derived from the URL. Remove stale labels for removed Explorer tabs so legacy URLs read as the Timeline fallback.

Do not modify backend/core config APIs, `packages/ui/src/hooks/use-configs.ts`, or desktop Tauri config commands. This cleanup removes UI entry points only.

---

### Task 1: Update the Design Source of Truth

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Update the Layout & Interaction master thesis**

In `DESIGN.md`, replace the current master thesis paragraph:

```markdown
**Master thesis:** Explorer is the product shell. Timeline is the default activity surface; Agents, Skills, Commands, Plugins, Hooks, MCP, and LSP sit behind the same left navigation. Settings UI was removed on 2026-06-16; lower-level settings read/write APIs remain available for configuration flows that need them. Profiles were archived on 2026-06-16 behind the Git tag `archive/profiles-before-removal-20260616` and are no longer part of the active product.
```

with:

```markdown
**Master thesis:** Explorer is the product shell. Timeline remains the default activity surface; the active Explorer resource tabs are Agents, Commands, Skills, and Plugins. Hooks, MCP, and LSP no longer have top-level UI entries, though lower-level config APIs remain available for configuration flows that need them. Settings UI was removed on 2026-06-16; lower-level settings read/write APIs remain available for configuration flows that need them. Profiles were archived on 2026-06-16 behind the Git tag `archive/profiles-before-removal-20260616` and are no longer part of the active product.
```

- [ ] **Step 2: Replace the Environment Summary Explorer rule**

In `DESIGN.md`, replace:

```markdown
- **Environment Summary:** rendered **only on the Plugins tab**. It is plugin-specific; on Hooks / MCP / LSP it was decorative noise.
```

with:

```markdown
- **Plugins page:** starts directly with the Plugins section header and inventory cards. The former Environment summary was removed because workspace-level Hooks/MCP/LSP counts are no longer part of the top-level Explorer IA.
```

- [ ] **Step 3: Add a Decisions Log row**

In the Decisions Log table, after the existing `2026-06-16 | Settings UI removed...` row, add:

```markdown
| 2026-06-16 | Sidebar Explorer tabs reduced to Agents, Commands, Skills, Plugins; Plugins Environment summary removed | The management surface now centers on the four core resource inventories while Timeline remains the activity entry. Hooks/MCP/LSP remain lower-level config capabilities without top-level UI chrome |
```

- [ ] **Step 4: Review the doc diff**

Run:

```bash
git diff -- DESIGN.md
```

Expected: the diff only changes the master thesis, the Plugins page rule, and the Decisions Log row.

- [ ] **Step 5: Commit the design update**

```bash
git add DESIGN.md
git commit -m "docs(ui): record sidebar core tabs decision"
```

---

### Task 2: Drive the Explorer Cleanup with Focused Tests

**Files:**
- Modify: `packages/ui/tests/explorer.inventory.test.tsx`
- Modify: `packages/ui/src/explorer.tsx`
- Modify: `packages/ui/src/components/header.tsx`

- [ ] **Step 1: Keep the Testing Library imports unchanged**

In `packages/ui/tests/explorer.inventory.test.tsx`, keep the existing import:

```tsx
import { fireEvent, screen } from '@testing-library/react'
```

- [ ] **Step 2: Delete the obsolete config hook mock**

In `packages/ui/tests/explorer.inventory.test.tsx`, delete this block:

```tsx
vi.mock('@/hooks/use-configs', () => ({
  useMcpServers: () => ({
    data: [
      { name: 'filesystem', config: {}, source: 'local' },
      { name: 'github', config: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
  useHooks: () => ({
    data: [
      { event: 'PreToolUse', name: 'PreToolUse [0]', data: {}, source: 'local' },
      { event: 'PostToolUse', name: 'PostToolUse [0]', data: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
  useLspServers: () => ({
    data: [
      { name: 'typescript', config: {}, source: 'local' },
      { name: 'eslint', config: {}, source: 'local' },
      { name: 'rust', config: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
}))
```

- [ ] **Step 3: Replace obsolete Environment-summary tests with the new sidebar and plugin assertions**

In `packages/ui/tests/explorer.inventory.test.tsx`, inside `describe('Explorer inventory views', () => {`, replace the first two tests:

```tsx
  it('shows current environment summary and plugin inventory details', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.getByText('Environment')).toBeInTheDocument()
    expect(screen.getAllByText('Hooks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('MCP servers')).toBeInTheDocument()
    expect(screen.getByText('LSP servers')).toBeInTheDocument()
    expect(screen.getByText('review-pack')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Agents: 1')).toBeInTheDocument()
    expect(screen.getByText('Skills: 1')).toBeInTheDocument()
    expect(screen.getByText('Commands: 1')).toBeInTheDocument()
  })

  it('shows the current environment summary only on plugins tab', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.getByText('Environment')).toBeInTheDocument()
    expect(screen.getAllByText('Hooks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MCP servers').length).toBeGreaterThan(0)
    expect(screen.getAllByText('LSP servers').length).toBeGreaterThan(0)
  })
```

with these tests:

```tsx
  it('shows Timeline plus only the four core Explorer resource tabs in the sidebar', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    const tabs = [...document.querySelectorAll('[role="tab"]')]
    const timelineButton = document.querySelector('aside button')

    expect(timelineButton?.textContent).toBe('Timeline')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Agents',
      'Commands',
      'Skills',
      'Plugins',
    ])
    expect(tabs.map(tab => tab.textContent)).not.toContain('Hooks')
    expect(tabs.map(tab => tab.textContent)).not.toContain('MCP Servers')
    expect(tabs.map(tab => tab.textContent)).not.toContain('LSP Servers')
  })

  it('shows plugin inventory details without the Environment summary', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
    expect(screen.queryByText('Current workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Hooks')).not.toBeInTheDocument()
    expect(screen.queryByText('MCP servers')).not.toBeInTheDocument()
    expect(screen.queryByText('LSP servers')).not.toBeInTheDocument()

    expect(screen.getByText('review-pack')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Agents: 1')).toBeInTheDocument()
    expect(screen.getByText('Skills: 1')).toBeInTheDocument()
    expect(screen.getByText('Commands: 1')).toBeInTheDocument()
    expect(screen.getByText('Installs: 1')).toBeInTheDocument()
    expect(screen.getByText('Marketplace: market')).toBeInTheDocument()
  })
```

- [ ] **Step 4: Replace the obsolete Hooks-tab assertion with scoped legacy URL fallback coverage**

In the same file, replace this test:

```tsx
  it('does not show environment summary on hooks tab', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/hooks' },
    )

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })
```

with this table-driven test:

```tsx
  it.each([
    ['/explore/hooks', 'Hooks', 'No hooks configured in settings.json'],
    ['/explore/mcp', 'MCP Servers', 'No MCP servers configured in .mcp.json'],
    ['/explore/lsp', 'LSP Servers', 'No LSP servers configured in .lsp.json'],
  ])('treats %s as a removed Explorer tab and falls back to Timeline content', (route, removedHeading, removedEmptyState) => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route },
    )

    const main = document.querySelector('main')
    const timelineHeading = document.querySelector('main h1')
    const breadcrumb = document.querySelector('main header nav')

    expect(timelineHeading?.textContent).toBe('Timeline')
    expect(breadcrumb?.textContent).toContain('Timeline')
    expect(breadcrumb?.textContent).not.toContain(removedHeading)
    expect(main?.textContent).not.toContain(removedHeading)
    expect(screen.queryByText(removedEmptyState)).not.toBeInTheDocument()
  })
```

- [ ] **Step 5: Run the focused test file and verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.inventory.test.tsx
```

Expected: FAIL. The failure should show that `Hooks`, `MCP Servers`, `LSP Servers`, or `Environment` still render, that tab order is still `Agents`, `Skills`, `Commands`, `Plugins`, or that removed legacy URLs still render their config pages/breadcrumbs.

- [ ] **Step 6: Simplify Explorer imports and the file comment**

In `packages/ui/src/explorer.tsx`, replace the top comment and import block:

```tsx
// Explorer view — browse agents, skills, commands, plugins, hooks, MCP/LSP configs via sidebar tabs.
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
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ConfigSection } from './components/config-section'
```

with:

```tsx
// Explorer view — browse timeline activity plus agents, commands, skills, and plugins.
import {
  Blocks,
  Bot,
  Info,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

```

Then remove this import block entirely:

```tsx
import {
  type ConfigEntry,
  type HookEntry,
  useHooks,
  useLspServers,
  useMcpServers,
} from './hooks/use-configs'
```

- [ ] **Step 7: Limit `SECTIONS` to the four core resource tabs**

In `packages/ui/src/explorer.tsx`, replace:

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

with:

```tsx
const SECTIONS: SidebarSection[] = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'commands', label: 'Commands', icon: TerminalSquare },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
]
```

- [ ] **Step 8: Remove config-only section descriptions**

In `packages/ui/src/explorer.tsx`, replace:

```tsx
const SECTION_DESCRIPTIONS: Record<string, string> = {
  agents:
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
  commands: 'Custom slash commands you can invoke with ',
  'mcp-servers': 'Model Context Protocol servers providing external tools and services.',
  hooks: 'Event handlers that respond to Claude Code lifecycle events.',
  'lsp-servers': 'Language Server Protocol servers providing code intelligence.',
}
```

with:

```tsx
const SECTION_DESCRIPTIONS: Record<'agents' | 'commands' | 'skills', string> = {
  agents:
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  commands: 'Custom slash commands you can invoke with ',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
}
```

- [ ] **Step 9: Update the Explorer JSDoc**

In `packages/ui/src/explorer.tsx`, replace:

```tsx
/**
 * Main explorer view — renders a sidebar with section tabs and a detail panel
 * for the selected agent, skill, command, plugin, hook, MCP server, or LSP server.
 */
```

with:

```tsx
/**
 * Main explorer view — renders Timeline plus the core resource tabs:
 * agents, commands, skills, and plugins.
 */
```

- [ ] **Step 10: Remove Hooks/MCP/LSP data reads and Environment summary code**

In `packages/ui/src/explorer.tsx`, delete this block:

```tsx
  const { data: mcpServers, isError: mcpError } = useMcpServers()
  const { data: hooks, isError: hooksError } = useHooks()
  const { data: lspServers, isError: lspError } = useLspServers()
```

Delete this block:

```tsx
  const hookCount = (hooks ?? []).length
  const mcpCount = (mcpServers ?? []).length
  const lspCount = (lspServers ?? []).length

  const renderEnvironmentSummary = () => (
    <section className="panel p-7">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Environment</h2>
        <span className="text-[12px] text-[var(--text-tertiary)]">Current workspace</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">Hooks</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{hookCount}</div>
        </div>
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">MCP servers</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{mcpCount}</div>
        </div>
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">LSP servers</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{lspCount}</div>
        </div>
      </div>
    </section>
  )
```

- [ ] **Step 11: Remove the Environment summary from `renderPlugins`**

In `packages/ui/src/explorer.tsx`, replace:

```tsx
  const renderPlugins = () => {
    return (
    <div className="space-y-6">
      {renderEnvironmentSummary()}

      <section>
```

with:

```tsx
  const renderPlugins = () => {
    return (
    <section>
```

Then replace the closing lines of `renderPlugins`:

```tsx
      </section>
    </div>
    )
  }
```

with:

```tsx
    </section>
    )
  }
```

- [ ] **Step 12: Remove config-page rendering helper and branches**

In `packages/ui/src/explorer.tsx`, delete this helper:

```tsx
  const renderConfigSection = (
    _id: 'hooks' | 'lsp' | 'mcp',
    config: {
      title: string
      description: string
      data: ConfigEntry[] | undefined
      isError: boolean
      icon: typeof Server
      iconColor: string
      emptyMessage: string
    },
  ) => <ConfigSection {...config} />
```

Then delete these render branches:

```tsx
            {activeSection === 'mcp' && (
              renderConfigSection('mcp', {
                title: 'MCP Servers',
                description: SECTION_DESCRIPTIONS['mcp-servers'],
                data: mcpServers,
                isError: mcpError,
                icon: Server,
                iconColor: 'text-[var(--text-primary)]',
                emptyMessage: 'No MCP servers configured in .mcp.json',
              })
            )}
            {activeSection === 'hooks' && (
              renderConfigSection('hooks', {
                title: 'Hooks',
                description: SECTION_DESCRIPTIONS.hooks,
                data: hooks?.map((h: HookEntry) => ({ ...h, config: h.data })),
                isError: hooksError,
                icon: Anchor,
                iconColor: 'text-[var(--text-secondary)]',
                emptyMessage: 'No hooks configured in settings.json',
              })
            )}
            {activeSection === 'lsp' && (
              renderConfigSection('lsp', {
                title: 'LSP Servers',
                description: SECTION_DESCRIPTIONS['lsp-servers'],
                data: lspServers,
                isError: lspError,
                icon: Code,
                iconColor: 'text-[var(--text-tertiary)]',
                emptyMessage: 'No LSP servers configured in .lsp.json',
              })
            )}
```

- [ ] **Step 13: Remove stale breadcrumb labels for removed tabs**

In `packages/ui/src/components/header.tsx`, replace:

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
```

with:

```tsx
    const labels: Record<string, string> = {
      timeline: 'Timeline',
      agents: 'Agents',
      commands: 'Commands',
      skills: 'Skills',
      plugins: 'Plugins',
    }
```

- [ ] **Step 14: Run focused tests and verify they pass**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/explorer.inventory.test.tsx
```

Expected: PASS. The sidebar and plugin inventory tests pass, and removed legacy tabs render Timeline content instead of config pages.

- [ ] **Step 15: Run TypeScript/lint verification for the UI package**

Run:

```bash
pnpm --filter @ohmyc/ui lint
pnpm --filter @ohmyc/ui build
```

Expected: both commands exit 0. Lint should report no unused imports from `lucide-react`, `use-configs`, or `ConfigSection`.

- [ ] **Step 16: Commit the implementation and tests**

```bash
git add packages/ui/src/explorer.tsx packages/ui/src/components/header.tsx packages/ui/tests/explorer.inventory.test.tsx
git commit -m "refactor(ui): reduce explorer sidebar tabs"
```

---

### Task 3: Final Verification

**Files:**
- Verify: `DESIGN.md`
- Verify: `packages/ui/src/explorer.tsx`
- Verify: `packages/ui/src/components/header.tsx`
- Verify: `packages/ui/tests/explorer.inventory.test.tsx`

- [ ] **Step 1: Run the full UI test suite**

Run:

```bash
pnpm --filter @ohmyc/ui test
```

Expected: PASS. Existing config hook/API tests may still run because lower-level config capability remains present.

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff --stat HEAD~2..HEAD
git diff HEAD~2..HEAD -- DESIGN.md packages/ui/src/explorer.tsx packages/ui/src/components/header.tsx packages/ui/tests/explorer.inventory.test.tsx
```

Expected:

- `DESIGN.md` records the new active sidebar model and Plugins summary removal.
- `packages/ui/src/explorer.tsx` has no `Anchor`, `Code`, `Server`, `ConfigSection`, `useHooks`, `useMcpServers`, or `useLspServers` imports.
- `SECTIONS` contains only `agents`, `commands`, `skills`, and `plugins`.
- `renderPlugins` starts directly with `<section>`.
- Removed tab branches for `mcp`, `hooks`, and `lsp` are gone.
- `packages/ui/src/components/header.tsx` no longer maps `hooks`, `mcp`, or `lsp` breadcrumb labels.

- [ ] **Step 3: Check working tree status**

Run:

```bash
git status --short
```

Expected: no output. If lint-staged reformatted files during a commit, stage and commit those exact formatting changes with the task that produced them.
