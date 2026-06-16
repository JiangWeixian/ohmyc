# Automated Review Findings

Source: `docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md`

Reviewers detected: `claude` (/opt/homebrew/bin/claude), `codex` (/opt/homebrew/bin/codex), `opencode` (/Users/bytedance/.opencode/bin/opencode)

## Reviewer: claude

**Status:** FAILURE

`claude -p ...` exited before producing findings.

Error output:

```
FAILURE: Failed to authenticate. API Error: 401 Invalid authentication credentials
```

No findings were returned. Re-run `/request-plan-review` after fixing the
`claude` CLI credentials (e.g. `claude /login`) to populate this section.

## Reviewer: codex

**Status:** OK — 3 findings

### Finding: Legacy fallback test can pass on blank content
Severity: medium
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:218
Quote:
> expect(document.body.textContent).toContain('Timeline')

Comment:
This assertion is satisfied by the always-visible sidebar Timeline button, so it does not prove the legacy URL rendered Timeline content. A worker could remove the old config branches and accidentally leave the main panel blank, and this test could still pass. Change it to assert the main Timeline page, e.g. `screen.getByRole('heading', { name: 'Timeline' })`, preferably scoped to `main`.

### Finding: Sidebar tab order is not verified
Severity: low
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:143-159
Quote:
> shows Timeline plus only the four core Explorer resource tabs in the sidebar

Comment:
The plan requires the order `Agents, Commands, Skills, Plugins`, but the proposed test only checks presence/absence. An implementation that keeps the old surviving order `Agents, Skills, Commands, Plugins` would pass. Add an order assertion over the rendered tabs, e.g. compare `screen.getAllByRole('tab').map(tab => tab.textContent)` to `['Agents', 'Commands', 'Skills', 'Plugins']`.

### Finding: Breadcrumb behavior has no automated coverage
Severity: medium
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:497-524
Quote:
> Remove stale breadcrumb labels for removed tabs

Comment:
Step 11 is a visible behavior change, but the proposed tests never assert the header breadcrumb for `/explore/hooks`, `/explore/mcp`, or `/explore/lsp`. The legacy URL tests could pass while the header still says `Hooks`, `MCP Servers`, or `LSP Servers`. Add a test assertion that removed legacy URLs show the Timeline breadcrumb/current label and do not show the removed breadcrumb label.

## Reviewer: opencode

**Status:** OK — 4 findings

### Finding: Legacy-URL fallback test never positively verifies Timeline content
Severity: medium
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:210-221
Quote:
> `expect(document.body.textContent).toContain('Timeline')`

Comment:
The assertion `document.body.textContent.toContain('Timeline')` is a tautology here: the `Sidebar` component always renders a `<button>` labeled "Timeline" (sidebar.tsx:69-83) on every Explorer route, so this passes regardless of whether `TimelineView` actually renders as the fallback. The test is named "falls back to Timeline content" but only verifies the *absence* of removed config headings/empty-states — it never confirms Timeline content appears. If the fallback logic broke and rendered nothing for `/explore/hooks`, this test would still pass. Fix: add a positive assertion for an element unique to `TimelineView` (e.g., the heatmap container or a `data-testid`) so the test actually verifies the fallback target renders.

### Finding: header.tsx breadcrumb change (Step 11) has no test coverage
Severity: medium
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:497-524
Quote:
> **Step 11: Remove stale breadcrumb labels for removed tabs**

Comment:
Step 11 modifies `packages/ui/src/components/header.tsx` so legacy URLs (e.g. `/explore/hooks`) resolve their breadcrumb to `'Timeline'` via the `labels[tab] ?? 'Timeline'` fallback (header.tsx:23). The focused test file renders `<Explorer />` (which includes `<Header />`) at `/explore/hooks` in Step 2, but no assertion checks the breadcrumb text. None of the new tests verify the breadcrumb reflects the removed-tab fallback, so an error in Step 11 would not be caught. Fix: in the Step 2 fallback test, assert the breadcrumb renders `Timeline` for at least one removed route (e.g., `screen.getAllByText('Timeline')` length increases, or scope a query to the header `nav`).

### Finding: Vestigial `use-configs` mock left in the test file
Severity: low
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:100-101
Quote:
> **Step 1: Replace obsolete Environment-summary tests with the new sidebar and plugin assertions**

Comment:
Step 1 replaces the two obsolete tests but does not remove the `vi.mock('@/hooks/use-configs', ...)` block (explorer.inventory.test.tsx:46-72) that mocks `useMcpServers`/`useHooks`/`useLspServers`. After Steps 4 and 8, `Explorer` no longer imports anything from `use-configs`, so this mock is dead setup. This contradicts the plan's stated goal of replacing obsolete Environment-summary scaffolding and will confuse future maintainers who assume the mock is needed. Fix: add a sub-step to delete the `vi.mock('@/hooks/use-configs', ...)` block, or explicitly note it is intentionally retained.

### Finding: Step 4 import replacement drops the blank line separating external from internal imports
Severity: low
Location: docs/superpowers/plans/2026-06-16-sidebar-core-tabs-cleanup.md:257-271
Quote:
> ```tsx
> // Explorer view — browse timeline activity plus agents, commands, skills, and plugins.
> import {
>   Blocks,
>   ...
> } from 'lucide-react'
> import { useState } from 'react'
> import { useNavigate, useParams } from 'react-router-dom'
> ```

Comment:
The matched "current" block (plan lines 239-255) includes the blank line at explorer.tsx:15 that separated the external imports (`react-router-dom`) from the internal imports (`./components/config-section`). The replacement block ends at `import { useNavigate, useParams } from 'react-router-dom'` with no trailing blank, so after the edit `react-router-dom` is immediately followed by `import { EntityCard } from './components/entity-card'`. If the project's ESLint config uses `import/order` with `newlines-between: 'always'`, the Step 13 `pnpm --filter @ohmyc/ui lint` command could fail, contradicting the "both commands exit 0" expectation (unless lint runs with `--fix`). Fix: end the replacement block with a trailing blank line to preserve the external/internal separation.
