# Timeline Chrome Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Timeline's metric switch with the existing Radix/shadcn Tabs primitive, move the navigation island below macOS traffic lights, and make the Timeline heatmap use the widened content area.

**Architecture:** Keep the work inside the existing `packages/ui` surface. Update `DESIGN.md` first because the navigation-island top offset is a visual/layout decision, then make small component changes with focused tests: `NavigationIsland` owns island positioning, `TimelineView` owns metric state, and `ContributionGraph` owns heatmap sizing.

**Tech Stack:** React 19, TypeScript, TailwindCSS utility classes, Radix Tabs via `@/components/ui/tabs`, React Testing Library, Vitest, Vite.

---

## Preflight Notes

The workspace may already contain unrelated Monitor-route changes. Do not stage them while implementing this plan. Use explicit `git add <path>` commands from each task.

Run before starting:

```bash
git status --short
```

Expected: if Monitor files are listed as modified, leave them alone unless the user explicitly asks to include them.

## File Structure

- Modify `DESIGN.md`
  - Responsibility: source of truth for navigation island placement and Timeline chrome decisions.
- Modify `packages/ui/src/components/navigation-island.tsx`
  - Responsibility: expanded and collapsed floating island layout, sizing, focus handoff, route navigation.
- Modify `packages/ui/tests/components/navigation-island.test.tsx`
  - Responsibility: regression coverage for desktop traffic-light-safe positioning and collapsed badge size.
- Modify `packages/ui/src/components/timeline/timeline-view.tsx`
  - Responsibility: Timeline page state, metric/project/year controls, heatmap/event rendering.
- Modify `packages/ui/tests/components/timeline/timeline-view.test.tsx`
  - Responsibility: regression coverage that the metric control is Radix Tabs and still drives `timeline.heatmap`.
- Modify `packages/ui/src/components/timeline/contribution-graph.tsx`
  - Responsibility: year grid construction, heat bucket rendering, tooltip, footer, responsive cell sizing.
- Modify `packages/ui/tests/components/timeline/contribution-graph.test.tsx`
  - Responsibility: regression coverage for heatmap layout math and existing graph behavior.

## Task 1: Update Design Source For Traffic-Light-Safe Navigation

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Patch the Navigation Island spec**

In `DESIGN.md`, update the two bullets in the `### Navigation Island` section that currently mention desktop `top: 18px`, `left: 18px`, `calc(100dvh - 36px)`, and the `52-56px` collapsed badge.

Replace those two full bullets with:

```markdown
- Position: `top: 48px`, `left: 18px` on desktop so the island clears native macOS traffic-light controls. On narrow screens, keep the collapsed island at `top: 14px`, `left: 14px` unless the native window chrome is present at that size.
- Expanded size: `216-224px` wide and `calc(100dvh - 66px)` tall on desktop, preserving roughly 18px bottom breathing room after the traffic-light clearance. Collapsed size: a single `44-48px` square icon badge, not a mini navigation rail. The collapsed badge uses a quiet 16px temporary icon and aligns visually with the route content rhythm rather than the traffic-light row.
```

- [ ] **Step 2: Add the Decisions Log row**

Add this row after the `2026-06-19` motion policy row in `DESIGN.md`:

```markdown
| 2026-06-20 | Move navigation island below native macOS traffic lights | The Tauri window now uses native traffic-light controls. A `top: 18px` island collides with that chrome, so desktop expanded/collapsed island states start around 48px and keep content-aligned rhythm |
```

- [ ] **Step 3: Run a doc diff check**

Run:

```bash
git diff -- DESIGN.md
```

Expected: diff only changes the navigation-island position/size text and adds the Decisions Log row. If existing Monitor-stat edits are already present in the diff, do not revert them; just avoid staging unrelated lines in this task unless they are already intentionally part of the current working tree.

- [ ] **Step 4: Commit the design update**

```bash
git add DESIGN.md
git commit -m "docs: update navigation island chrome placement"
```

Expected: commit succeeds. If `DESIGN.md` also contains unrelated uncommitted Monitor-stat changes from earlier work, stop and ask the user whether to include those lines or split them first.

## Task 2: Move And Resize The Navigation Island

**Files:**
- Modify: `packages/ui/tests/components/navigation-island.test.tsx`
- Modify: `packages/ui/src/components/navigation-island.tsx`

- [ ] **Step 1: Add a failing desktop layout test**

Append this test inside `describe('NavigationIsland', () => { ... })` in `packages/ui/tests/components/navigation-island.test.tsx`:

```tsx
  it('clears native macOS traffic lights in expanded and collapsed desktop states', async () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    const expandedIsland = screen.getByRole('navigation', { name: 'Primary' })
    expect(expandedIsland).toHaveClass('top-[48px]')
    expect(expandedIsland).toHaveClass('h-[calc(100dvh-66px)]')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    let expandButton: HTMLButtonElement | null = null
    await waitFor(() => {
      expandButton = screen.getByRole('button', { name: 'Expand navigation' })
      expect(expandButton).toHaveClass('size-12')
    })

    expect(expandButton?.closest('div')).toHaveClass('top-[48px]')
    expect(expandButton?.querySelector('svg')).toHaveAttribute('width', '16')
    expect(expandButton?.querySelector('svg')).toHaveAttribute('height', '16')
  })
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/navigation-island.test.tsx
```

Expected: FAIL because the expanded island still has `top-[18px]` / `h-[calc(100dvh-36px)]`, the collapsed button still has `size-14`, and the icon is still `20`.

- [ ] **Step 3: Update collapsed island classes and icon**

In `packages/ui/src/components/navigation-island.tsx`, replace the collapsed wrapper class:

```tsx
className="fixed left-[18px] top-[18px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
```

with:

```tsx
className="fixed left-[18px] top-[48px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
```

In the collapsed `Button`, replace:

```tsx
size="icon-lg"
```

with:

```tsx
size="icon"
```

Replace the first class string:

```tsx
'size-14 rounded-[14px] border border-[rgba(255,255,255,0.05)] bg-[rgba(15,16,17,0.72)]',
```

with:

```tsx
'size-12 rounded-[14px] border border-[rgba(255,255,255,0.05)] bg-[rgba(15,16,17,0.72)]',
```

Replace:

```tsx
<Code2 size={20} aria-hidden="true" />
```

with:

```tsx
<Code2 size={16} aria-hidden="true" />
```

- [ ] **Step 4: Update expanded island classes**

In the expanded `motion.nav` class list in `packages/ui/src/components/navigation-island.tsx`, replace:

```tsx
'fixed left-[18px] top-[18px] z-40 flex h-[calc(100dvh-36px)] w-[220px] flex-col overflow-hidden rounded-[14px]',
```

with:

```tsx
'fixed left-[18px] top-[48px] z-40 flex h-[calc(100dvh-66px)] w-[220px] flex-col overflow-hidden rounded-[14px]',
```

Keep the existing small-screen override:

```tsx
'max-sm:left-[14px] max-sm:top-[14px] max-sm:h-[calc(100dvh-28px)] max-sm:w-[216px]',
```

- [ ] **Step 5: Run the focused navigation tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/navigation-island.test.tsx
```

Expected: PASS for all `NavigationIsland` tests.

- [ ] **Step 6: Commit navigation island layout**

```bash
git add packages/ui/src/components/navigation-island.tsx packages/ui/tests/components/navigation-island.test.tsx
git commit -m "fix(ui): move navigation island below traffic lights"
```

Expected: commit includes only the navigation island component and test.

## Task 3: Replace Timeline Metric Buttons With Radix Tabs

**Files:**
- Modify: `packages/ui/tests/components/timeline/timeline-view.test.tsx`
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`

- [ ] **Step 1: Update the metric-control test to require tabs**

In `packages/ui/tests/components/timeline/timeline-view.test.tsx`, inside the test named `switches heatmap metric, project, and year filters through accessible controls`, replace:

```tsx
    const tokensButton = screen.getByText('Tokens').closest('button')
    expect(tokensButton).toBeDefined()
    fireEvent.click(tokensButton!)
```

with:

```tsx
    const activityTab = screen.getByRole('tab', { name: 'Activity' })
    expect(activityTab).toHaveAttribute('aria-selected', 'true')

    const tokensTab = screen.getByRole('tab', { name: 'Tokens' })
    fireEvent.click(tokensTab)
    expect(tokensTab).toHaveAttribute('aria-selected', 'true')
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/timeline/timeline-view.test.tsx
```

Expected: FAIL because the current metric control is plain buttons, not Radix tab triggers with `role="tab"` and `aria-selected`.

- [ ] **Step 3: Import the Tabs primitive**

In `packages/ui/src/components/timeline/timeline-view.tsx`, add:

```tsx
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
```

below the `Select` imports.

Remove this import because `Segmented` will be deleted:

```tsx
import { cn } from '@/lib/utils'
```

- [ ] **Step 4: Replace the `Segmented` call with controlled Tabs**

In the controls bar, replace:

```tsx
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { id: 'activity', label: 'Activity' },
            { id: 'tokens', label: 'Tokens' },
          ]}
        />
```

with:

```tsx
        <Tabs
          value={metric}
          onValueChange={value => setMetric(value as 'activity' | 'tokens')}
          className="flex-row gap-0"
        >
          <TabsList className="h-auto gap-0.5 rounded-md border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] p-[3px]">
            <TabsTrigger
              value="activity"
              className="h-auto flex-none rounded px-3 py-[6px] text-[12px] font-[510] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] data-[state=active]:border-transparent data-[state=active]:bg-[rgba(255,255,255,0.08)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-none"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="tokens"
              className="h-auto flex-none rounded px-3 py-[6px] text-[12px] font-[510] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] data-[state=active]:border-transparent data-[state=active]:bg-[rgba(255,255,255,0.08)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-none"
            >
              Tokens
            </TabsTrigger>
          </TabsList>
        </Tabs>
```

- [ ] **Step 5: Delete the local `Segmented` helper**

Remove this entire function from `packages/ui/src/components/timeline/timeline-view.tsx`:

```tsx
function Segmented<TValue extends string>({
  value,
  onChange,
  options,
}: {
  value: TValue
  onChange: (v: TValue) => void
  options: { id: TValue; label: string }[]
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] p-[3px]">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded px-3 py-[6px] text-[12px] font-[510] transition-colors',
              active
                ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Run the focused TimelineView test**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/timeline/timeline-view.test.tsx
```

Expected: PASS. The test should still observe a `timeline.heatmap` request with `metric: 'tokens'` after clicking the Tokens tab.

- [ ] **Step 7: Commit the Tabs replacement**

```bash
git add packages/ui/src/components/timeline/timeline-view.tsx packages/ui/tests/components/timeline/timeline-view.test.tsx
git commit -m "refactor(ui): use tabs for timeline metric control"
```

Expected: commit includes only TimelineView and its test.

## Task 4: Add Responsive Heatmap Layout Math

**Files:**
- Modify: `packages/ui/tests/components/timeline/contribution-graph.test.tsx`
- Modify: `packages/ui/src/components/timeline/contribution-graph.tsx`

- [ ] **Step 1: Add layout-math tests**

In `packages/ui/tests/components/timeline/contribution-graph.test.tsx`, change the import:

```tsx
import { ContributionGraph } from '@/components/timeline/contribution-graph'
```

to:

```tsx
import {
  computeContributionGraphLayout,
  ContributionGraph,
} from '@/components/timeline/contribution-graph'
```

Then append this `describe` block after the existing tests:

```tsx
describe('computeContributionGraphLayout', () => {
  it('keeps the original compact rhythm when the card is narrow', () => {
    expect(computeContributionGraphLayout(738)).toEqual({
      cellSize: 10,
      cellGap: 4,
      weekPitch: 14,
      gridWidth: 738,
    })
  })

  it('grows cells and gaps to use a wider desktop card without chunky cells', () => {
    expect(computeContributionGraphLayout(1086)).toEqual({
      cellSize: 14,
      cellGap: 6,
      weekPitch: 20,
      gridWidth: 1054,
    })
  })

  it('caps growth on very wide cards so the graph keeps contribution-map rhythm', () => {
    expect(computeContributionGraphLayout(1600)).toEqual({
      cellSize: 16,
      cellGap: 6,
      weekPitch: 22,
      gridWidth: 1160,
    })
  })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/timeline/contribution-graph.test.tsx
```

Expected: FAIL because `computeContributionGraphLayout` is not exported yet.

- [ ] **Step 3: Add sizing constants and exported layout helper**

In `packages/ui/src/components/timeline/contribution-graph.tsx`, replace:

```tsx
import { useMemo, useState } from 'react'
```

with:

```tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
```

Add these constants below `const DOW_LABELS = ...`:

```tsx
const WEEK_COUNT = 53
const DAY_COUNT = 7
const DAY_LABEL_WIDTH = 18
const MIN_CELL_SIZE = 10
const MIN_CELL_GAP = 4
const MAX_CELL_SIZE = 16
const MAX_CELL_GAP = 6
const BASE_GRID_WIDTH = WEEK_COUNT * MIN_CELL_SIZE + (WEEK_COUNT - 1) * MIN_CELL_GAP
```

Add this exported helper below `formatDay`:

```tsx
// eslint-disable-next-line react-refresh/only-export-components
export function computeContributionGraphLayout(availableWidth: number): {
  cellSize: number
  cellGap: number
  weekPitch: number
  gridWidth: number
} {
  if (!Number.isFinite(availableWidth) || availableWidth <= BASE_GRID_WIDTH) {
    return {
      cellSize: MIN_CELL_SIZE,
      cellGap: MIN_CELL_GAP,
      weekPitch: MIN_CELL_SIZE + MIN_CELL_GAP,
      gridWidth: BASE_GRID_WIDTH,
    }
  }

  const extraCellPixels = Math.floor((availableWidth - BASE_GRID_WIDTH) / WEEK_COUNT)
  const cellSize = Math.min(MAX_CELL_SIZE, MIN_CELL_SIZE + extraCellPixels)
  const remaining = availableWidth - WEEK_COUNT * cellSize
  const cellGap = Math.min(
    MAX_CELL_GAP,
    Math.max(MIN_CELL_GAP, Math.floor(remaining / (WEEK_COUNT - 1))),
  )

  return {
    cellSize,
    cellGap,
    weekPitch: cellSize + cellGap,
    gridWidth: WEEK_COUNT * cellSize + (WEEK_COUNT - 1) * cellGap,
  }
}
```

- [ ] **Step 4: Measure the graph column width with ResizeObserver**

Inside `ContributionGraph`, replace:

```tsx
  const CELL_SIZE = 10
  const CELL_GAP = 4
```

with:

```tsx
  const graphFrameRef = useRef<HTMLDivElement | null>(null)
  const [availableGraphWidth, setAvailableGraphWidth] = useState(BASE_GRID_WIDTH)
```

Add this effect after the hover state:

```tsx
  useEffect(() => {
    const node = graphFrameRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const measuredWidth = Math.floor(entry.contentRect.width - DAY_LABEL_WIDTH - MIN_CELL_GAP)
      setAvailableGraphWidth(Math.max(BASE_GRID_WIDTH, measuredWidth))
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])
```

Add this layout value after `max`:

```tsx
  const graphLayout = useMemo(
    () => computeContributionGraphLayout(availableGraphWidth),
    [availableGraphWidth],
  )
```

- [ ] **Step 5: Replace fixed sizing usage in the JSX**

In the card's inner grid wrapper, add the ref:

```tsx
        ref={graphFrameRef}
```

so the opening tag becomes:

```tsx
      <div
        ref={graphFrameRef}
        className="relative"
        style={{
```

In that same wrapper style, replace:

```tsx
          gap: CELL_GAP,
```

with:

```tsx
          gap: graphLayout.cellGap,
```

For month spans, replace:

```tsx
<span key={i} style={{ flex: `0 0 ${s.weeks * 14}px` }}>{s.label}</span>
```

with:

```tsx
<span key={i} style={{ flex: `0 0 ${s.weeks * graphLayout.weekPitch}px` }}>{s.label}</span>
```

For day-of-week labels, replace:

```tsx
gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
gap: CELL_GAP,
```

with:

```tsx
gridTemplateRows: `repeat(${DAY_COUNT}, ${graphLayout.cellSize}px)`,
gap: graphLayout.cellGap,
```

Replace the label span style:

```tsx
<span key={i} style={{ lineHeight: `${CELL_SIZE}px`, height: CELL_SIZE, visibility: label ? 'visible' : 'hidden' }}>
```

with:

```tsx
<span key={i} style={{ lineHeight: `${graphLayout.cellSize}px`, height: graphLayout.cellSize, visibility: label ? 'visible' : 'hidden' }}>
```

For the cells grid, replace:

```tsx
gridTemplateColumns: `repeat(53, ${CELL_SIZE}px)`,
gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
gap: CELL_GAP,
```

with:

```tsx
gridTemplateColumns: `repeat(${WEEK_COUNT}, ${graphLayout.cellSize}px)`,
gridTemplateRows: `repeat(${DAY_COUNT}, ${graphLayout.cellSize}px)`,
gap: graphLayout.cellGap,
width: graphLayout.gridWidth,
```

For each heat cell style, replace:

```tsx
width: CELL_SIZE,
height: CELL_SIZE,
```

with:

```tsx
width: graphLayout.cellSize,
height: graphLayout.cellSize,
```

- [ ] **Step 6: Keep narrow layouts scrollable instead of crushed**

Wrap the graph frame in an overflow container. Replace:

```tsx
      <div
        ref={graphFrameRef}
        className="relative"
```

with:

```tsx
      <div className="overflow-x-auto overflow-y-visible">
        <div
          ref={graphFrameRef}
          className="relative min-w-[760px]"
```

Then add the matching closing `</div>` immediately before the footer `<div className="mt-[14px] ...">`.

The structure should be:

```tsx
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-[22px] py-[18px]">
      <div className="overflow-x-auto overflow-y-visible">
        <div
          ref={graphFrameRef}
          className="relative min-w-[760px]"
          style={{
            display: 'grid',
            gridTemplateColumns: '18px 1fr',
            gridTemplateRows: '16px 1fr',
            gap: graphLayout.cellGap,
          }}
        >
          ...
        </div>
      </div>

      <div className="mt-[14px] flex items-center justify-between ...">
```

- [ ] **Step 7: Run the focused graph tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/timeline/contribution-graph.test.tsx
```

Expected: PASS for existing interaction tests and new layout helper tests.

- [ ] **Step 8: Commit responsive graph sizing**

```bash
git add packages/ui/src/components/timeline/contribution-graph.tsx packages/ui/tests/components/timeline/contribution-graph.test.tsx
git commit -m "fix(ui): make timeline heatmap responsive"
```

Expected: commit includes only the contribution graph component and test.

## Task 5: Final Verification

**Files:**
- Read only: `DESIGN.md`
- Read only: `packages/ui/src/components/navigation-island.tsx`
- Read only: `packages/ui/src/components/timeline/timeline-view.tsx`
- Read only: `packages/ui/src/components/timeline/contribution-graph.tsx`

- [ ] **Step 1: Run the focused tests**

```bash
pnpm --filter @ohmyc/ui test -- --run tests/components/navigation-island.test.tsx tests/components/timeline/timeline-view.test.tsx tests/components/timeline/contribution-graph.test.tsx
```

Expected: PASS for all focused tests.

- [ ] **Step 2: Run the full UI unit suite**

```bash
pnpm --filter @ohmyc/ui test -- --run
```

Expected: PASS. Existing Radix dialog warnings may appear in unrelated store tests; they are not failures.

- [ ] **Step 3: Run the UI build**

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS. Existing Vite large chunk warnings may appear; they are not failures for this plan.

- [ ] **Step 4: Optional desktop visual check**

Run the app:

```bash
pnpm dev
```

Open `/explore/timeline` in the desktop/web surface and check:

- expanded navigation island starts below the red/yellow/green traffic-light row
- collapsed badge starts at the same desktop top rhythm and uses the smaller icon
- `Activity | Tokens` still looks like the same compact monochrome segmented control
- `Activity | Tokens` can be operated by keyboard as tabs
- heatmap grid fills the wider card much more closely while keeping square cells
- narrow windows keep the heatmap usable with horizontal scrolling instead of squeezed cells

- [ ] **Step 5: Commit any final test-only adjustments**

Only run this if Task 5 required small test expectation changes:

```bash
git add packages/ui/tests/components/navigation-island.test.tsx packages/ui/tests/components/timeline/timeline-view.test.tsx packages/ui/tests/components/timeline/contribution-graph.test.tsx
git commit -m "test(ui): cover timeline chrome polish"
```

Expected: skip this step if there are no unstaged test-only changes.

## Self-Review

Spec coverage:

- Tabs replacement: Task 3 updates tests and replaces `Segmented` with `Tabs`, `TabsList`, and `TabsTrigger`.
- Navigation island traffic-light clearance: Task 1 updates `DESIGN.md`; Task 2 changes expanded/collapsed positioning, size, icon, and tests.
- Collapsed badge alignment and quieter size: Task 1 records the decision; Task 2 implements `top-[48px]`, `size-12`, and `Code2 size={16}`.
- Graph width: Task 4 adds layout math, ResizeObserver measurement, responsive cell/gap values, and narrow overflow behavior.
- Data flow: no backend or hook changes are planned.
- Accessibility: Task 3 uses Radix Tabs and verifies `role="tab"` / `aria-selected`; existing focus-visible behavior remains.
- Verification: Task 5 runs focused tests, full UI tests, build, and optional visual inspection.

Incomplete-marker scan:

- No open-ended implementation steps remain.
- Code-changing steps include concrete snippets and exact file paths.

Type consistency:

- `metric` remains `'activity' | 'tokens'`.
- `heatmapMetric` remains `TimelineMetric` and still maps activity to `'turns'`.
- `computeContributionGraphLayout` return keys are consistently `cellSize`, `cellGap`, `weekPitch`, and `gridWidth`.
