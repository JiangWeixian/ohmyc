# UI Storybook Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the obsolete `NativeButton` surface, migrate Timeline Project/Year controls to the shared Select primitive, and trim internal-only Menubar stories while preserving product-level Storybook coverage.

**Architecture:** Keep this cleanup inside `packages/ui` and follow the current Storybook/Vitest patterns. The Timeline route keeps its private control wrapper, but that wrapper delegates behavior to `components/ui/select.tsx` instead of a hidden native `<select>`. Storybook remains curated around public product/design-system surfaces, not every internal chart component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Radix Select via `@/components/ui/select`, Vitest unit projects, Storybook 10 with addon-vitest.

---

## File Structure

- Delete: `packages/ui/src/components/uitripled/native-button.tsx`
  - Removes the unused wrapper around `Button`; no product code imports it.
- Delete: `packages/ui/src/stories/design-system/NativeButton.stories.tsx`
  - Removes `Design System/NativeButton` from Storybook so `Design System/Button` is canonical.
- Modify: `packages/ui/tests/motion-policy.test.ts`
  - Removes the policy test that reads the deleted `native-button.tsx` file.
  - Adds a guard that the obsolete NativeButton component and story do not reappear.
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`
  - Replaces private `CtrlSelect` with a private wrapper around `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem`.
- Modify: `packages/ui/tests/components/timeline/timeline-view.test.tsx`
  - Updates filter tests from hidden native `<select>` mutation to role-based Radix Select interaction.
- Delete: `packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx`
  - Removes internal-only heatmap story.
- Delete: `packages/ui/src/stories/menubar/DualLineChart.stories.tsx`
  - Removes internal-only line chart story.
- Create: `packages/ui/tests/storybook-surface.test.ts`
  - Guards the curated Storybook surface: keep `MenubarPage` and `ViewSwitch`, remove the two internal Menubar chart stories.
- Keep unchanged: `packages/ui/src/stories/design-system/Button.stories.tsx`
  - Canonical Button Storybook entry.
- Keep unchanged: `packages/ui/src/stories/menubar/MenubarPage.stories.tsx`
  - Product-level menubar coverage.
- Keep unchanged: `packages/ui/src/stories/menubar/ViewSwitch.stories.tsx`
  - Direct reusable control story.
- Keep unchanged: `packages/ui/src/components/menubar/recent-heatmap.tsx`
  - Still used by `MenubarPage`.
- Keep unchanged: `packages/ui/src/components/menubar/dual-line-chart.tsx`
  - Still used by `MenubarPage`.

---

### Task 1: Remove NativeButton Surface

**Files:**
- Delete: `packages/ui/src/components/uitripled/native-button.tsx`
- Delete: `packages/ui/src/stories/design-system/NativeButton.stories.tsx`
- Modify: `packages/ui/tests/motion-policy.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/ui/tests/motion-policy.test.ts`, change the filesystem import and replace the NativeButton motion assertion.

Change the import at the top from:

```ts
import { readFileSync } from 'node:fs'
```

to:

```ts
import {
  existsSync,
  readFileSync,
} from 'node:fs'
```

Then replace the final test:

```ts
  it('keeps NativeButton free of Framer hover and glow motion', () => {
    const source = readSource('../src/components/uitripled/native-button.tsx')

    expect(source).not.toContain('whileHover')
    expect(source).not.toContain('whileTap')
    expect(source).not.toContain('blur-xl')
    expect(source).toContain('active:scale-[0.97]')
  })
```

with:

```ts
  it('does not keep the obsolete NativeButton component surface', () => {
    expect(existsSync(new URL('../src/components/uitripled/native-button.tsx', import.meta.url))).toBe(false)
    expect(existsSync(new URL('../src/stories/design-system/NativeButton.stories.tsx', import.meta.url))).toBe(false)
  })
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/motion-policy.test.ts
```

Expected: FAIL in `does not keep the obsolete NativeButton component surface` because both files still exist.

- [ ] **Step 3: Delete NativeButton and its Storybook entry**

Delete these files:

```bash
rm packages/ui/src/components/uitripled/native-button.tsx
rm packages/ui/src/stories/design-system/NativeButton.stories.tsx
```

Do not delete `packages/ui/src/components/uitripled/native-dialog.tsx`; `motion-policy.test.ts` still reads it.

- [ ] **Step 4: Confirm no stale references remain**

Run:

```bash
rg -n "NativeButton|native-button|Design System/NativeButton" packages/ui
```

Expected: no output.

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/motion-policy.test.ts
```

Expected: PASS, including `does not keep the obsolete NativeButton component surface`.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/ui/tests/motion-policy.test.ts
git add -u packages/ui/src/components/uitripled/native-button.tsx packages/ui/src/stories/design-system/NativeButton.stories.tsx
git commit -m "chore: remove native button surface"
```

Expected: commit succeeds. The only staged files are the deleted NativeButton files and `motion-policy.test.ts`.

---

### Task 2: Migrate Timeline Filters To Shared Select

**Files:**
- Modify: `packages/ui/tests/components/timeline/timeline-view.test.tsx`
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`

- [ ] **Step 1: Write the failing Timeline Select interaction test**

In `packages/ui/tests/components/timeline/timeline-view.test.tsx`, replace the first import:

```ts
import { fireEvent, waitFor } from '@testing-library/react'
```

with:

```ts
import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
```

Then replace the second test body:

```ts
  it('switches heatmap metric and project filters through the controls', async () => {
    const { capturedHeatmapArgs } = installTimelineHandlers()

    const { container } = renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(container.textContent).toContain('Timeline work')
    })

    const tokensButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent === 'Tokens')
    expect(tokensButton).toBeDefined()
    fireEvent.click(tokensButton!)
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { metric?: string }).metric === 'tokens')).toBe(true)
    })

    const selects = container.querySelectorAll('select')
    expect(selects).toHaveLength(2)
    fireEvent.change(selects[0], { target: { value: 'beta' } })
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { project?: string }).project === 'beta')).toBe(true)
    })
  })
```

with:

```ts
  it('switches heatmap metric, project, and year filters through accessible controls', async () => {
    const user = userEvent.setup()
    const { capturedHeatmapArgs, currentYear } = installTimelineHandlers()

    renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(screen.getByText('Timeline work')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tokens' }))
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { metric?: string }).metric === 'tokens')).toBe(true)
    })

    await user.click(screen.getByRole('combobox', { name: 'Project' }))
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'beta' }))
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { project?: string }).project === 'beta')).toBe(true)
    })

    await user.click(screen.getByRole('combobox', { name: 'Year' }))
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: String(currentYear - 1) }))
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { year?: number }).year === currentYear - 1)).toBe(true)
    })
  })
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/components/timeline/timeline-view.test.tsx
```

Expected: FAIL because the current controls are hidden native `<select>` elements and do not expose Radix-style `combobox` triggers named `Project` and `Year`.

- [ ] **Step 3: Replace the Timeline imports**

In `packages/ui/src/components/timeline/timeline-view.tsx`, delete this import:

```ts
import { ChevronDown } from 'lucide-react'
```

Add the shared Select imports after the local component imports:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
```

Keep the existing `cn` import because `Segmented` still uses it.

- [ ] **Step 4: Replace the two `CtrlSelect` usages**

In `packages/ui/src/components/timeline/timeline-view.tsx`, replace both `<CtrlSelect ... />` call sites with `<TimelineSelect ... />` call sites:

```tsx
        <TimelineSelect
          label="Project"
          value={project ?? '__all__'}
          onChange={v => setProject(v === '__all__' ? undefined : v)}
          options={[
            { value: '__all__', label: 'All projects' },
            ...(projects ?? []).map(p => ({ value: p, label: p })),
          ]}
        />
        <TimelineSelect
          label="Year"
          value={String(year)}
          onChange={v => setYear(Number(v))}
          options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
        />
```

- [ ] **Step 5: Replace `CtrlSelect` with a private shared-Select wrapper**

In `packages/ui/src/components/timeline/timeline-view.tsx`, replace the entire `function CtrlSelect(...)` helper with:

```tsx
function TimelineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className="rounded-md border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-3 py-[7px] text-[12px] font-[510] text-[var(--text-secondary)] hover:border-[var(--border-hover)] data-[state=open]:border-[var(--border-hover)] focus-visible:ring-0 [&_svg]:size-3"
      >
        <span className="text-[var(--text-tertiary)]">{label}</span>
        <span className="text-[var(--text-primary)]">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className="border border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] shadow-none ring-0"
      >
        {options.map(o => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="text-[12px] text-[var(--text-secondary)] focus:bg-white/[0.06] focus:text-[var(--text-primary)]"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 6: Run the focused Timeline test**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/components/timeline/timeline-view.test.tsx
```

Expected: PASS. The test should prove:
- `Tokens` still changes heatmap metric to `tokens`.
- `Project` Select maps `beta` into the heatmap request.
- `Year` Select maps the string option back to a number.

- [ ] **Step 7: Run a Storybook-focused smoke check for Timeline**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=storybook --run src/stories/product/TimelineView.stories.tsx
```

Expected: PASS. If the Storybook Vitest project does not accept a direct file filter in this repo, run the full Storybook test command instead:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/ui/src/components/timeline/timeline-view.tsx packages/ui/tests/components/timeline/timeline-view.test.tsx
git commit -m "refactor: use shared select in timeline filters"
```

Expected: commit succeeds with only the Timeline component and Timeline test staged.

---

### Task 3: Remove Internal Menubar Stories

**Files:**
- Create: `packages/ui/tests/storybook-surface.test.ts`
- Delete: `packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx`
- Delete: `packages/ui/src/stories/menubar/DualLineChart.stories.tsx`

- [ ] **Step 1: Write the failing Storybook surface test**

Create `packages/ui/tests/storybook-surface.test.ts` with:

```ts
import { existsSync } from 'node:fs'

import {
  describe,
  expect,
  it,
} from 'vitest'

function uiFile(path: string): URL {
  return new URL(`../${path}`, import.meta.url)
}

describe('Storybook public surface', () => {
  it('keeps Button as the canonical button story', () => {
    expect(existsSync(uiFile('src/stories/design-system/Button.stories.tsx'))).toBe(true)
    expect(existsSync(uiFile('src/stories/design-system/NativeButton.stories.tsx'))).toBe(false)
  })

  it('documents Menubar through composed and reusable surfaces only', () => {
    expect(existsSync(uiFile('src/stories/menubar/MenubarPage.stories.tsx'))).toBe(true)
    expect(existsSync(uiFile('src/stories/menubar/ViewSwitch.stories.tsx'))).toBe(true)
    expect(existsSync(uiFile('src/stories/menubar/RecentHeatmap.stories.tsx'))).toBe(false)
    expect(existsSync(uiFile('src/stories/menubar/DualLineChart.stories.tsx'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/storybook-surface.test.ts
```

Expected: FAIL in `documents Menubar through composed and reusable surfaces only` because `RecentHeatmap.stories.tsx` and `DualLineChart.stories.tsx` still exist.

- [ ] **Step 3: Delete the internal-only Menubar stories**

Run:

```bash
rm packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx
rm packages/ui/src/stories/menubar/DualLineChart.stories.tsx
```

Do not delete:

```text
packages/ui/src/components/menubar/recent-heatmap.tsx
packages/ui/src/components/menubar/dual-line-chart.tsx
packages/ui/src/stories/menubar/MenubarPage.stories.tsx
packages/ui/src/stories/menubar/ViewSwitch.stories.tsx
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest --project=unit --run tests/storybook-surface.test.ts
```

Expected: PASS.

- [ ] **Step 5: Confirm Storybook titles are gone from source**

Run:

```bash
rg -n "Menubar/RecentHeatmap|Menubar/DualLineChart|RecentHeatmap\\.stories|DualLineChart\\.stories" packages/ui/src packages/ui/tests
```

Expected: no output.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/ui/tests/storybook-surface.test.ts
git add -u packages/ui/src/stories/menubar/RecentHeatmap.stories.tsx packages/ui/src/stories/menubar/DualLineChart.stories.tsx
git commit -m "chore: trim internal menubar stories"
```

Expected: commit succeeds with the new surface test and the two story deletions staged.

---

### Task 4: Full Verification And Cleanup

**Files:**
- No intended source changes.
- Generated `packages/ui/storybook-static/` should not remain in the working tree after `build-storybook`.

- [ ] **Step 1: Verify no removed Storybook entries remain**

Run:

```bash
rg -n "Design System/NativeButton|Menubar/RecentHeatmap|Menubar/DualLineChart|NativeButton|native-button" packages/ui
```

Expected: no output.

- [ ] **Step 2: Run unit tests**

Run:

```bash
pnpm --filter @ohmyc/ui test
```

Expected: PASS.

- [ ] **Step 3: Run Storybook Vitest tests**

Run:

```bash
pnpm --filter @ohmyc/ui test:storybook
```

Expected: PASS with fewer story files/tests than before because `NativeButton`, `RecentHeatmap`, and `DualLineChart` stories are gone.

- [ ] **Step 4: Build the UI package**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS. Existing bundle-size warnings are acceptable if they match current repo behavior.

- [ ] **Step 5: Build Storybook**

Run:

```bash
pnpm --filter @ohmyc/ui build-storybook
```

Expected: PASS.

- [ ] **Step 6: Remove generated Storybook output**

Run:

```bash
rm -rf packages/ui/storybook-static
```

Expected: `packages/ui/storybook-static/` is absent from `git status --short`.

- [ ] **Step 7: Run lint and classify the known environment issue**

Run:

```bash
pnpm --filter @ohmyc/ui lint
```

Expected:
- PASS if the local ESLint stack is healthy.
- If it fails with `context.getSourceCode is not a function` from `eslint-plugin-tailwindcss` under ESLint 10, record it as the known existing lint tooling crash. Any normal source-file lint error introduced by this plan must be fixed before continuing.

- [ ] **Step 8: Confirm only intended files changed**

Run:

```bash
git status --short
```

Expected after the three task commits:

```text
?? docs/request-plan-review/2026-06-19-ui-storybook.html
?? docs/request-plan-review/2026-06-19-ui-storybook.reviews.md
?? docs/superpowers/plans/2026-06-19-ui-storybook.md
?? docs/superpowers/plans/2026-06-19-ui-storybook-cleanup.md
```

If this plan file has already been committed or staged by the caller, it may not appear as untracked. Do not stage the two `docs/request-plan-review/*` files unless the user explicitly asks.

- [ ] **Step 9: Commit this plan file if requested**

Run only if the user wants the plan committed:

```bash
git add docs/superpowers/plans/2026-06-19-ui-storybook-cleanup.md
git commit -m "docs: add ui storybook cleanup plan"
```

Expected: commit succeeds with only this plan file staged.

---

## Self-Review

- Spec coverage:
  - NativeButton removal is covered by Task 1.
  - Timeline Project and Year controls using shared Select are covered by Task 2.
  - Removing standalone `RecentHeatmap` and `DualLineChart` stories while keeping `MenubarPage` and `ViewSwitch` is covered by Task 3.
  - Verification expectations are covered by Task 4.
- Placeholder scan:
  - No unresolved placeholders, no deferred implementation notes, and no unnamed tests remain.
- Type consistency:
  - `TimelineSelect` accepts string `value` and string `onChange`, matching Radix Select.
  - Project keeps `__all__` as the all-project sentinel and maps it back to `undefined`.
  - Year still stores a number in React state and maps Select string values through `Number(v)`.
- Scope check:
  - The plan does not redesign Timeline, Menubar, Button, Select, or Storybook theme.
  - The underlying Menubar chart components remain intact because `MenubarPage` still composes them.
