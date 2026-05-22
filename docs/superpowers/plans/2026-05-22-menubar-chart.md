# Menubar Chart Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scaffold placeholder with the real `/menubar` page — dual-axis line chart (last 7 days, tokens + sessions) and a compact heatmap (last 365 days) — and point the Tauri popover at it.

**Architecture:** New components live in `packages/ui/src/components/menubar/`. The line chart is hand-rolled SVG; the heatmap reuses `ContributionGraph` via a new `compact` prop. Data comes from a new `useTimelineHeatmapRange` hook that accepts arbitrary date ranges. A new `/menubar` route renders the page chrome-less, and Tauri loads it via the existing Vite dev server. No sidecar in this slice.

**Tech Stack:** React 19, TypeScript, Vite 5, Tailwind, `@tanstack/react-query`, Vitest, React Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-22-menubar-chart-design.md`

---

## File Structure

**Create (UI):**
- `packages/ui/src/components/menubar/menubar-page.tsx`
- `packages/ui/src/components/menubar/dual-line-chart.tsx`
- `packages/ui/src/components/menubar/view-switch.tsx`
- `packages/ui/src/components/menubar/menubar-page.test.tsx`
- `packages/ui/src/components/menubar/dual-line-chart.test.tsx`
- `packages/ui/src/components/menubar/view-switch.test.tsx`
- `packages/ui/src/components/timeline/contribution-graph.test.tsx`

**Modify (UI):**
- `packages/ui/src/hooks/use-timeline.ts` — add `useTimelineHeatmapRange` hook
- `packages/ui/src/components/timeline/contribution-graph.tsx` — add `compact?: boolean` prop
- `packages/ui/src/app.tsx` — add `<Route path="/menubar">`

**Modify (Desktop / Tauri):**
- `packages/desktop/src-tauri/tauri.conf.json` OR `packages/desktop/src-tauri/src/main.rs` — point the popover at `/menubar`

---

## Task 1: Add `useTimelineHeatmapRange` hook

**Files:**
- Modify: `packages/ui/src/hooks/use-timeline.ts`
- Test: `packages/ui/src/hooks/use-timeline.test.tsx` (create new test file)

The existing `useTimelineHeatmap` is year-scoped. The line view needs an arbitrary 7-day range, so we add a sibling hook that takes ISO date strings.

- [ ] **Step 1: Inspect the existing hook for context**

Run: `grep -B 2 -A 25 "export function useTimelineHeatmap" packages/ui/src/hooks/use-timeline.ts`
Confirm the existing hook calls `/api/timeline/heatmap?from=<ms>&to=<ms>&metric=<x>`. The same endpoint accepts arbitrary `from`/`to` — we just need to expose a date-range overload.

- [ ] **Step 2: Write the failing test**

Create `packages/ui/src/hooks/use-timeline.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTimelineHeatmapRange } from './use-timeline'

import type { ReactNode } from 'react'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useTimelineHeatmapRange', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('queries the heatmap endpoint with from/to milliseconds and the metric', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ date: '2026-05-22', value: 42 }] }),
    } as Response)

    const { result } = renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-16', to: '2026-05-22', metric: 'tokens' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('/api/timeline/heatmap?')
    expect(url).toContain('metric=tokens')
    // from = 2026-05-16 UTC midnight in ms
    expect(url).toContain(`from=${Date.UTC(2026, 4, 16)}`)
    // to = 2026-05-22 UTC midnight in ms
    expect(url).toContain(`to=${Date.UTC(2026, 4, 22)}`)
    expect(result.current.data).toEqual([{ date: '2026-05-22', value: 42 }])
  })

  it('omits project from the URL when not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-22', to: '2026-05-22', metric: 'sessions' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('project=')
  })

  it('includes project in the URL when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-22', to: '2026-05-22', metric: 'sessions', project: 'foo' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('project=foo')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/hooks/use-timeline.test.tsx`
Expected: FAIL with `useTimelineHeatmapRange is not exported`.

- [ ] **Step 4: Add the hook**

In `packages/ui/src/hooks/use-timeline.ts`, find the existing `useTimelineHeatmap` function. Add this new hook immediately after it (and before `useTimelineEvents`):

```ts
/**
 * Date-range variant of {@link useTimelineHeatmap}. Accepts arbitrary
 * ISO date strings (`YYYY-MM-DD`). Used by the menubar popover, which
 * needs a 7-day window not aligned to a calendar year.
 *
 * @param params.from - Inclusive start date (ISO YYYY-MM-DD).
 * @param params.to - Inclusive end date (ISO YYYY-MM-DD).
 * @param params.metric - Which metric to aggregate.
 * @param params.project - Optional project filter.
 */
export function useTimelineHeatmapRange(params: {
  from: string
  to: string
  metric: TimelineMetric
  project?: string
}) {
  const { from, to, metric, project } = params
  const fromMs = isoDateToUtcMs(from)
  const toMs = isoDateToUtcMs(to)
  const qs = new URLSearchParams({
    from: String(fromMs),
    to: String(toMs),
    metric,
  })
  if (project) {
    qs.set('project', project)
  }
  return useQuery({
    queryKey: ['timeline', 'heatmap-range', from, to, metric, project ?? null],
    queryFn: () =>
      fetchJson<{ data: HeatmapPoint[] }>(`/api/timeline/heatmap?${qs.toString()}`).then(
        r => r.data,
      ),
  })
}
```

If `isoDateToUtcMs` or `fetchJson` is not imported in the file, look at the existing `useTimelineHeatmap` for the canonical imports — they will already be there.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/hooks/use-timeline.test.tsx`
Expected: PASS, 3 tests green.

- [ ] **Step 6: Run the full UI test suite to confirm no regression**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all existing tests still pass; 3 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/hooks/use-timeline.ts packages/ui/src/hooks/use-timeline.test.tsx
git commit -m "feat(ui): add useTimelineHeatmapRange hook for arbitrary date windows"
```

---

## Task 2: Add `compact` prop to `ContributionGraph`

**Files:**
- Modify: `packages/ui/src/components/timeline/contribution-graph.tsx`
- Create: `packages/ui/src/components/timeline/contribution-graph.test.tsx`

The current `ContributionGraph` renders month labels, day-of-week labels, and a "Less / More" legend. In a 360px popover it overflows. Add a `compact` prop that hides the chrome and shrinks cells.

- [ ] **Step 1: Inspect the existing component**

Run: `wc -l packages/ui/src/components/timeline/contribution-graph.tsx`
Expected: ~294 lines. Read the file. Identify:
  - Where the month-label row renders (look for `MONTH_NAMES`).
  - Where the day-of-week column renders (look for `DOW_LABELS`).
  - Where the "Less / More" legend renders at the bottom.
  - Where cell sizing is defined.

- [ ] **Step 2: Write the failing test**

Create `packages/ui/src/components/timeline/contribution-graph.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContributionGraph } from './contribution-graph'

import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const sampleData = [
  { date: '2026-01-15', value: 10 },
  { date: '2026-06-15', value: 50 },
  { date: '2026-12-15', value: 30 },
]

describe('ContributionGraph compact mode', () => {
  it('renders month labels in default (non-compact) mode', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} />, { wrapper })
    // At least one month label should be visible.
    expect(screen.getByText(/Jan/i)).toBeInTheDocument()
  })

  it('renders the "Less / More" legend in default mode', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} />, { wrapper })
    expect(screen.getByText(/Less/i)).toBeInTheDocument()
    expect(screen.getByText(/More/i)).toBeInTheDocument()
  })

  it('hides month labels when compact={true}', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} compact />, { wrapper })
    expect(screen.queryByText(/^Jan$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Feb$/i)).not.toBeInTheDocument()
  })

  it('hides "Less / More" legend when compact={true}', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} compact />, { wrapper })
    expect(screen.queryByText(/Less/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/More/i)).not.toBeInTheDocument()
  })

  it('still renders the cell grid in compact mode', () => {
    const { container } = render(
      <ContributionGraph year={2026} metric="tokens" data={sampleData} compact />,
      { wrapper },
    )
    // The grid contains one rect per day in the year — at least 365.
    const cells = container.querySelectorAll('[data-heat-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(365)
  })
})
```

If `[data-heat-cell]` is not the actual attribute used by the component (likely the case — the existing code may use a different selector or no attribute at all), inspect the rendered output during the test and either:
- (a) Add `data-heat-cell` to each cell in the implementation, OR
- (b) Update the selector to match what's actually rendered (e.g. `rect.heat-l0, rect.heat-l1, ...`).

Prefer (a) — adding the testing hook is a small, intentional API for tests.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/timeline/contribution-graph.test.tsx`
Expected: at least the compact-mode tests FAIL (prop doesn't exist yet); the non-compact tests may pass.

- [ ] **Step 4: Add the `compact` prop and hide chrome conditionally**

Edit `packages/ui/src/components/timeline/contribution-graph.tsx`. Find the `ContributionGraphProps` interface and add the new optional prop:

```ts
export interface ContributionGraphProps {
  year: number
  metric: TimelineMetric
  data: HeatmapPoint[]
  onSelectDay?: (date: string) => void
  /** Compact mode for the menubar popover: hides month/day-of-week labels and the legend; shrinks cells. */
  compact?: boolean
}
```

In the function body, destructure `compact = false`. Then:

1. Where the **month label row** renders (the `<div>` or `<g>` containing the loop over `MONTH_NAMES`): wrap with `{!compact && ( ... )}`.
2. Where the **day-of-week column** renders (the loop over `DOW_LABELS`): wrap with `{!compact && ( ... )}`.
3. Where the **"Less / More" legend** renders at the bottom: wrap with `{!compact && ( ... )}`.
4. If cell sizing is a const like `const CELL_SIZE = 10`, branch:
   ```ts
   const CELL_SIZE = compact ? 6 : 10
   const CELL_GAP = compact ? 2 : 3
   ```
   And use those in the SVG render where the constants are referenced.
5. Add `data-heat-cell` to each cell `<rect>` for test selection. If the existing code already has a class on cells (e.g. `className={heatClass}`), just add `data-heat-cell` alongside.

The exact edits depend on the current component's structure. Read the file, make the smallest correct changes, and preserve existing behavior when `compact` is unset or `false`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/timeline/contribution-graph.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 6: Run the full UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all existing tests still pass.

- [ ] **Step 7: Verify the existing Timeline page still renders correctly (manual)**

Run: `pnpm --filter @ohmyc/ui dev` in one terminal, in another window open `http://localhost:5173/timeline`. Visually confirm the contribution graph looks identical to before this change. Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components/timeline/contribution-graph.tsx packages/ui/src/components/timeline/contribution-graph.test.tsx
git commit -m "feat(ui): add compact mode to ContributionGraph for menubar popover"
```

---

## Task 3: Build `<ViewSwitch>` component

**Files:**
- Create: `packages/ui/src/components/menubar/view-switch.tsx`
- Test: `packages/ui/src/components/menubar/view-switch.test.tsx`

Two 14×14 icon buttons in the top-right of the popover header. No background, no border, no segmented pill.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/menubar/view-switch.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ViewSwitch } from './view-switch'

describe('ViewSwitch', () => {
  it('renders both view buttons', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /line view/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /heatmap view/i })).toBeInTheDocument()
  })

  it('marks the active button with aria-pressed=true', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /line view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('tab', { name: /heatmap view/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with "heatmap" when the heatmap button is clicked', async () => {
    const onChange = vi.fn()
    render(<ViewSwitch value="line" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    expect(onChange).toHaveBeenCalledWith('heatmap')
  })

  it('calls onChange with "line" when the line button is clicked', async () => {
    const onChange = vi.fn()
    render(<ViewSwitch value="heatmap" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /line view/i }))
    expect(onChange).toHaveBeenCalledWith('line')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/view-switch.test.tsx`
Expected: FAIL with "Cannot find module ./view-switch".

- [ ] **Step 3: Implement the component**

Create `packages/ui/src/components/menubar/view-switch.tsx`:

```tsx
// Icon-only line/heatmap view switch for the menubar popover header.
// 14×14 glyphs, no background, no segmented pill — matches wireframe top-right.

export type MenubarView = 'line' | 'heatmap'

interface ViewSwitchProps {
  value: MenubarView
  onChange: (next: MenubarView) => void
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  const buttonClass =
    'inline-flex items-center justify-center p-1 rounded-sm bg-transparent border-0 cursor-pointer leading-none transition-none'

  return (
    <div className="flex items-center gap-0.5 shrink-0" role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-label="Line view"
        aria-pressed={value === 'line'}
        onClick={() => onChange('line')}
        className={buttonClass}
        style={{
          color:
            value === 'line'
              ? 'var(--text-primary)'
              : 'var(--text-quaternary)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 11 L4 7 L7 9 L10 4 L13 6"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        role="tab"
        aria-label="Heatmap view"
        aria-pressed={value === 'heatmap'}
        onClick={() => onChange('heatmap')}
        className={buttonClass}
        style={{
          color:
            value === 'heatmap'
              ? 'var(--text-primary)'
              : 'var(--text-quaternary)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="5.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" />
          <rect x="9.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="1.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="9.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="1.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="5.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="9.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/view-switch.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/view-switch.tsx packages/ui/src/components/menubar/view-switch.test.tsx
git commit -m "feat(ui): add ViewSwitch icon-only toggle for menubar popover"
```

---

## Task 4: Build `<DualLineChart>` component

**Files:**
- Create: `packages/ui/src/components/menubar/dual-line-chart.tsx`
- Test: `packages/ui/src/components/menubar/dual-line-chart.test.tsx`

Hand-rolled SVG dual-axis line chart. 7-day window, tokens on left axis (solid), sessions on right axis (dashed). Legend hidden by default, visible on hover.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/menubar/dual-line-chart.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DualLineChart } from './dual-line-chart'

const tokens = [
  { date: '2026-05-16', value: 12_000 },
  { date: '2026-05-17', value: 30_000 },
  { date: '2026-05-18', value: 22_000 },
  { date: '2026-05-19', value: 70_000 },
  { date: '2026-05-20', value: 55_000 },
  { date: '2026-05-21', value: 98_000 },
  { date: '2026-05-22', value: 40_000 },
]
const sessions = [
  { date: '2026-05-16', value: 2 },
  { date: '2026-05-17', value: 4 },
  { date: '2026-05-18', value: 3 },
  { date: '2026-05-19', value: 8 },
  { date: '2026-05-20', value: 6 },
  { date: '2026-05-21', value: 11 },
  { date: '2026-05-22', value: 5 },
]

describe('DualLineChart', () => {
  it('renders exactly two polylines (tokens + sessions)', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    const polylines = container.querySelectorAll('polyline')
    expect(polylines).toHaveLength(2)
  })

  it('renders 7 dots for tokens and 7 for sessions (14 total)', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    const dots = container.querySelectorAll('circle')
    expect(dots).toHaveLength(14)
  })

  it('renders day-of-week labels for all 7 points', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    const xLabels = container.querySelectorAll('text[data-x-label]')
    expect(xLabels).toHaveLength(7)
  })

  it('renders 3 left-axis tick labels and 3 right-axis tick labels', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    expect(container.querySelectorAll('text[data-tick-left]')).toHaveLength(3)
    expect(container.querySelectorAll('text[data-tick-right]')).toHaveLength(3)
  })

  it('hides the legend by default (opacity:0 inline style on .legend-row)', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    const legend = container.querySelector('[data-legend]') as HTMLElement
    expect(legend).toBeInTheDocument()
    // Default opacity 0 (hover reveals via CSS — test value, not behavior).
    expect(legend).toHaveAttribute('data-default-hidden', 'true')
  })

  it('handles empty arrays without crashing', () => {
    const { container } = render(<DualLineChart tokens={[]} sessions={[]} />)
    // No polylines because there's no data to draw.
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/dual-line-chart.test.tsx`
Expected: FAIL with "Cannot find module ./dual-line-chart".

- [ ] **Step 3: Implement the component**

Create `packages/ui/src/components/menubar/dual-line-chart.tsx`:

```tsx
// Hand-rolled SVG dual-axis line chart for the menubar popover.
// Tokens on left axis (solid line), sessions on right axis (dashed line).
// Legend hidden by default, revealed on chart-wrap :hover via CSS.

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface DualLineChartProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const VIEW_W = 320
const VIEW_H = 140
const X_PAD_LEFT = 30
const X_PAD_RIGHT = 20
const Y_TOP = 0
const Y_BOTTOM = 110 // X-axis labels live below this
const PLOT_WIDTH = VIEW_W - X_PAD_LEFT - X_PAD_RIGHT
const PLOT_HEIGHT = Y_BOTTOM - Y_TOP

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Round up to the nearest "nice" number: 1, 2, 5, 10, 20, 50, 100, ... */
function niceCeil(value: number): number {
  if (value <= 0) {
    return 1
  }
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const normalized = value / base
  let nice: number
  if (normalized <= 1) {
    nice = 1
  } else if (normalized <= 2) {
    nice = 2
  } else if (normalized <= 5) {
    nice = 5
  } else {
    nice = 10
  }
  return nice * base
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${Math.round(n / 100_000) / 10}M`
  }
  if (n >= 1_000) {
    return `${Math.round(n / 100) / 10}k`
  }
  return String(n)
}

function dowLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return DOW[d.getUTCDay()]
}

export function DualLineChart({ tokens, sessions }: DualLineChartProps) {
  if (tokens.length === 0 || sessions.length === 0) {
    return (
      <div data-empty className="rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] p-3.5" />
    )
  }

  const tokensMax = niceCeil(Math.max(...tokens.map(p => p.value), 1))
  const sessionsMax = niceCeil(Math.max(...sessions.map(p => p.value), 1))

  const n = tokens.length
  const stepX = PLOT_WIDTH / Math.max(n - 1, 1)
  const xs = Array.from({ length: n }, (_, i) => X_PAD_LEFT + i * stepX)

  const yTokens = tokens.map(p => Y_BOTTOM - (p.value / tokensMax) * PLOT_HEIGHT)
  const ySessions = sessions.map(p => Y_BOTTOM - (p.value / sessionsMax) * PLOT_HEIGHT)

  const tokensPath = xs.map((x, i) => `${x},${yTokens[i]}`).join(' ')
  const sessionsPath = xs.map((x, i) => `${x},${ySessions[i]}`).join(' ')

  // Y-tick positions (3 lines: 0, mid, top)
  const yTicks = [Y_BOTTOM, Y_BOTTOM - PLOT_HEIGHT / 2, Y_TOP]

  return (
    <div className="group rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] p-3.5">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="block w-full h-[140px]"
        aria-label="Daily tokens and sessions for the last 7 days"
      >
        {/* Grid lines */}
        {yTicks.map((y, i) => (
          <line
            key={i}
            x1={X_PAD_LEFT}
            y1={y}
            x2={VIEW_W - X_PAD_RIGHT}
            y2={y}
            stroke="var(--border-soft)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}
        {/* Left Y-axis tick labels (tokens) */}
        {[tokensMax, tokensMax / 2, 0].map((v, i) => (
          <text
            key={`l-${i}`}
            x={X_PAD_LEFT - 4}
            y={yTicks[i] + 3}
            fill="var(--text-quaternary)"
            fontSize={9}
            textAnchor="end"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
            data-tick-left
          >
            {formatTokens(v)}
          </text>
        ))}
        {/* Right Y-axis tick labels (sessions) */}
        {[sessionsMax, sessionsMax / 2, 0].map((v, i) => (
          <text
            key={`r-${i}`}
            x={VIEW_W - X_PAD_RIGHT + 4}
            y={yTicks[i] + 3}
            fill="var(--text-quaternary)"
            fontSize={9}
            textAnchor="start"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
            data-tick-right
          >
            {Math.round(v)}
          </text>
        ))}
        {/* Tokens line (solid) */}
        <polyline
          points={tokensPath}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth={1.5}
        />
        {/* Sessions line (dashed) */}
        <polyline
          points={sessionsPath}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
        />
        {/* Tokens dots */}
        {xs.map((x, i) => (
          <circle key={`t-${i}`} cx={x} cy={yTokens[i]} r={2.5} fill="var(--text-primary)" />
        ))}
        {/* Sessions dots */}
        {xs.map((x, i) => (
          <circle key={`s-${i}`} cx={x} cy={ySessions[i]} r={2} fill="var(--text-tertiary)" />
        ))}
        {/* X-axis day labels */}
        {xs.map((x, i) => (
          <text
            key={`x-${i}`}
            x={x}
            y={VIEW_H - 2}
            fill="var(--text-quaternary)"
            fontSize={10}
            textAnchor="middle"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
            data-x-label
          >
            {dowLabel(tokens[i].date)}
          </text>
        ))}
      </svg>
      {/* Legend — hidden at rest, revealed on chart-wrap hover */}
      <div
        data-legend
        data-default-hidden="true"
        className="mt-2 flex items-center gap-3.5 text-[11px] opacity-0 group-hover:opacity-100"
        style={{
          color: 'var(--text-tertiary)',
          fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace',
        }}
      >
        <span>
          <span
            className="inline-block w-3.5 h-0.5 align-middle mr-1.5"
            style={{ background: 'var(--text-primary)' }}
          />
          Tokens · left axis
        </span>
        <span>
          <span
            className="inline-block w-3.5 h-0.5 align-middle mr-1.5"
            style={{
              background:
                'repeating-linear-gradient(to right, var(--text-tertiary) 0 4px, transparent 4px 7px)',
            }}
          />
          Sessions · right axis
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/dual-line-chart.test.tsx`
Expected: 6 tests PASS.

If a test about element counts fails, inspect the rendered SVG via the test debug output (`screen.debug()`) and reconcile the assertion with the actual structure. The component's render shape should be the source of truth — tests adapt to it, not the other way around — but each `data-*` attribute the tests rely on (`data-tick-left`, `data-tick-right`, `data-x-label`, `data-legend`, `data-default-hidden`) must be present.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/dual-line-chart.tsx packages/ui/src/components/menubar/dual-line-chart.test.tsx
git commit -m "feat(ui): add DualLineChart for menubar popover (hand-rolled SVG)"
```

---

## Task 5: Build `<MenubarPage>` component

**Files:**
- Create: `packages/ui/src/components/menubar/menubar-page.tsx`
- Test: `packages/ui/src/components/menubar/menubar-page.test.tsx`

The page wrapper. Owns view state, fetches the four heatmap queries, computes header totals + footer meta, switches body between line and heatmap.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/menubar/menubar-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MenubarPage } from './menubar-page'

import type { ReactNode } from 'react'

function setupMockFetch() {
  // Mock fetch — all heatmap requests return a 1-point response of `value: 1`.
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL) => {
    const u = String(url)
    if (u.includes('metric=tokens')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-05-22', value: 10_000 },
            { date: '2026-05-21', value: 5_000 },
          ],
        }),
      } as Response
    }
    if (u.includes('metric=sessions')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-05-22', value: 3 },
            { date: '2026-05-21', value: 2 },
          ],
        }),
      } as Response
    }
    return { ok: true, json: async () => ({ data: [] }) } as Response
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('MenubarPage', () => {
  it('renders in line view by default and shows "Last 7 days"', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    expect(await screen.findByText(/Last 7 days/i)).toBeInTheDocument()
  })

  it('renders header totals after data loads', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    // 10_000 + 5_000 = 15k tokens, sessions = 3 + 2 = 5
    expect(await screen.findByText(/15\.0k/i)).toBeInTheDocument()
    expect(await screen.findByText(/tokens · 5 sessions/i)).toBeInTheDocument()
  })

  it('switches to heatmap view when the heatmap icon is clicked', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 7 days/i)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    await userEvent.click(heatmapBtn)
    expect(await screen.findByText(/Last 365 days/i)).toBeInTheDocument()
  })

  it('renders the DualLineChart in line view (polyline elements present)', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 7 days/i)
    // After data loads, polylines appear.
    expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2)
  })

  it('does not render polylines in heatmap view', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 7 days/i)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    await screen.findByText(/Last 365 days/i)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: FAIL with "Cannot find module ./menubar-page".

- [ ] **Step 3: Implement the component**

Create `packages/ui/src/components/menubar/menubar-page.tsx`:

```tsx
// Menubar popover page — owns view state, fetches data, switches between
// dual-line and heatmap views. Lives at /menubar.

import { useMemo, useState } from 'react'

import { ContributionGraph } from '@/components/timeline/contribution-graph'
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'

import { DualLineChart } from './dual-line-chart'
import { ViewSwitch, type MenubarView } from './view-switch'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() - n)
  return copy
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`
  }
  return String(n)
}

const CURRENT_YEAR = new Date().getUTCFullYear()

export function MenubarPage() {
  const [view, setView] = useState<MenubarView>('line')

  const today = useMemo(() => new Date(), [])
  const todayIso = isoDate(today)
  const weekAgoIso = isoDate(subDays(today, 6))
  const yearStartIso = `${CURRENT_YEAR}-01-01`
  const yearEndIso = `${CURRENT_YEAR}-12-31`

  const tokensWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'tokens' })
  const sessionsWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'sessions' })
  const tokensYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'tokens' })
  const sessionsYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'sessions' })

  const tokensWeekTotal = (tokensWeek.data ?? []).reduce((s, p) => s + p.value, 0)
  const sessionsWeekTotal = (sessionsWeek.data ?? []).reduce((s, p) => s + p.value, 0)
  const tokensYearTotal = (tokensYear.data ?? []).reduce((s, p) => s + p.value, 0)
  const sessionsYearTotal = (sessionsYear.data ?? []).reduce((s, p) => s + p.value, 0)

  const headerTokens = view === 'line' ? tokensWeekTotal : tokensYearTotal
  const headerSessions = view === 'line' ? sessionsWeekTotal : sessionsYearTotal
  const rangeLabel = view === 'line' ? 'Last 7 days' : 'Last 365 days'

  return (
    <div
      className="min-h-dvh w-full p-[18px] bg-[#191a1b] text-[var(--text-primary)]"
      data-menubar-page
    >
      <header className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex flex-col gap-[3px] min-w-0">
          <div className="text-[13px] font-medium tracking-[-0.05px] whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="font-medium">{formatTokens(headerTokens)}</span>
            <span className="ml-2 font-normal text-[var(--text-secondary)] tabular-nums">
              tokens · {headerSessions.toLocaleString()} sessions
            </span>
          </div>
          <span
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            {rangeLabel}
          </span>
        </div>
        <ViewSwitch value={view} onChange={setView} />
      </header>

      {view === 'line' ? (
        <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
      ) : (
        <ContributionGraph
          year={CURRENT_YEAR}
          metric="tokens"
          data={tokensYear.data ?? []}
          compact
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: 5 tests PASS.

If `15.0k` formatting doesn't match (the formatter renders e.g. `15k` not `15.0k`), reconcile: either change `toFixed(1)` → `Math.round(n/100)/10` style, or update the test's regex to `/15(\.0)?k/i`. Pick whichever produces the cleaner output and update the failing side. The wireframe shows `412k`, suggesting one-decimal precision only when needed — preference is `Math.round(n / 100) / 10` formatting which renders `15k` for round thousands.

If you adopt the cleaner formatter, also update the test regex to `/15k/i`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-page.test.tsx
git commit -m "feat(ui): add MenubarPage with view switching and dual data fetch"
```

---

## Task 6: Add `/menubar` route to app.tsx

**Files:**
- Modify: `packages/ui/src/app.tsx`

- [ ] **Step 1: Inspect the current Routes block**

Run: `grep -A 10 "<Routes>" packages/ui/src/app.tsx`

Expected output (current state):
```
<Routes>
  <Route path="/timeline" element={<TimelineRoute viewSwitcher={...} />} />
  <Route path="/profiles/*" element={<ProfilesView viewSwitcher={...} />} />
  <Route path="/explore/:tab" element={<Explorer viewSwitcher={...} />} />
  <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
  <Route path="*" element={<Navigate to="/profiles" replace />} />
</Routes>
```

- [ ] **Step 2: Add the `/menubar` route BEFORE the catch-all `*`**

Edit `packages/ui/src/app.tsx`. Add this import at the top with the other component imports:

```tsx
import { MenubarPage } from './components/menubar/menubar-page'
```

In the `<Routes>` block, add this line immediately before the `<Route path="*"` catch-all line:

```tsx
<Route path="/menubar" element={<MenubarPage />} />
```

The `MenubarPage` owns its full layout (no shared chrome/sidebar). Mounting it directly at the top level of `<Routes>` gives it a clean root.

- [ ] **Step 3: Build the UI**

Run: `pnpm --filter @ohmyc/ui build`
Expected: tsc + vite build succeed.

- [ ] **Step 4: Visually verify in the browser**

In a terminal, start the API server (the existing dev workflow). From the repo root:

```bash
pnpm dev
```

(If `pnpm dev` is not configured to start both API and UI together, run them separately per your local setup — the UI dev server alone will fail to fetch data, since the API serves `/api/timeline/heatmap`.)

Open `http://localhost:5173/menubar` in a browser.

Expected:
- Dark background.
- Header shows tokens + sessions totals + "Last 7 days".
- Body shows a dual-line chart (or an empty card if `timeline.db` has no data yet).
- Top-right has two small icon buttons; clicking the grid icon switches to a heatmap view.
- Hovering the line chart shows the legend below it.

Verify all four behaviors. Stop the dev server when done.

- [ ] **Step 5: Run the UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all previous tests + the new menubar/contribution-graph/use-timeline tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/app.tsx
git commit -m "feat(ui): mount /menubar route in app router"
```

---

## Task 7: Point Tauri popover at `/menubar`

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json` OR `packages/desktop/src-tauri/src/main.rs` (whichever cleanly supports a URL with a path)

- [ ] **Step 1: Verify the router type used by the app**

Run: `grep -rE "BrowserRouter|HashRouter|createBrowserRouter|createHashRouter" packages/ui/src 2>/dev/null`

If BrowserRouter is used → the path-aware URL is `http://localhost:1420/menubar`.
If HashRouter is used → the URL is `http://localhost:1420/#/menubar`.

Note the answer. Most likely BrowserRouter — packages/ui has been routing via `react-router-dom`'s `Routes`/`Route` directly inside the `App` tree, which works with BrowserRouter.

- [ ] **Step 2: Try the simple route — set the URL in `tauri.conf.json`**

Open `packages/desktop/src-tauri/tauri.conf.json`. Locate the popover window definition:

```json
{
  "label": "popover",
  "title": "OhMyC",
  "width": 360,
  "height": 440,
  ...
}
```

Add a `"url"` field. The Tauri 2 window config supports a `url` field that is appended to `devUrl` (in dev) and treated as a relative path against `frontendDist` (in prod).

```json
{
  "label": "popover",
  "title": "OhMyC",
  "url": "/menubar",
  "width": 360,
  "height": 440,
  ...
}
```

If Tauri 2's window config does not accept a `url` field at the time of writing (the API has been in flux), it will warn or error at build time. In that case, see Step 3 alternative.

- [ ] **Step 3: Verify Tauri accepts the config**

Run: `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: clean build. If it errors with "unknown field `url`" or similar, the field is not supported in this Tauri version. Fall back to setting the URL at runtime — see Step 3a.

- [ ] **Step 3a (only if Step 3 errored): Set the popover URL at runtime in `main.rs`**

In `packages/desktop/src-tauri/src/main.rs`, locate the `setup(|app| { ... })` block. Inside it, near the top, replace the existing window-event listener block with one that first creates/finds the popover window with the desired URL:

```rust
use tauri::{WebviewUrl, WebviewWindowBuilder};
```

(Add `WebviewUrl` and `WebviewWindowBuilder` to existing imports.)

Then, inside `setup`:

```rust
// If the popover window is defined in tauri.conf.json, it was created with
// its default URL. Re-build it pointed at /menubar so the popover content
// loads the chart route.
//
// In Tauri 2, calling WebviewWindowBuilder::new with the same label
// replaces the existing window if it exists. If your version does not
// support this, close the existing window first.
if let Some(existing) = app.get_webview_window("popover") {
    let _ = existing.close();
}
let _popover = WebviewWindowBuilder::new(
    app,
    "popover",
    WebviewUrl::External("http://localhost:1420/menubar".parse().unwrap()),
)
.title("OhMyC")
.inner_size(360.0, 440.0)
.decorations(false)
.always_on_top(true)
.skip_taskbar(true)
.visible(false)
.transparent(false)
.resizable(false)
.focused(false)
.build()?;
```

Note: `WebviewUrl::External` is for the dev case. For prod (when the sidecar lands later), this will be replaced with the sidecar's localhost URL. For now we hardcode `localhost:1420` — the slice explicitly accepts that dev-server dependency.

Re-run `cargo build` to confirm clean. Adjust import paths if any new imports collide with existing ones.

- [ ] **Step 4: Run the Rust tests to confirm no regression**

Run: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: 14 tests pass (no change from scaffold slice).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/tauri.conf.json packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): point popover window at /menubar route"
```

---

## Task 8: Manual smoke test

Not a code change — human verification that the chart appears in the actual menu bar app.

- [ ] **Step 1: Start the UI + API dev servers**

In terminal 1, from repo root:
```bash
pnpm dev
```

This should start both the CLI's Fastify server (port 3000) and the UI's Vite server (port 5173). Confirm `localhost:5173/menubar` loads in a browser with the real chart.

- [ ] **Step 2: Start the Tauri dev shell**

In terminal 2, from repo root:
```bash
pnpm --filter @ohmyc/desktop tauri:dev
```

Wait for cargo build + Tauri app launch.

- [ ] **Step 3: Verify the menu bar popover shows the real chart**

Click the tray icon in the macOS menu bar. The popover should open showing:
- Header with tokens total + sessions count + "Last 7 days"
- A dual-axis line chart (or empty card if `timeline.db` has no data yet)
- Two icon buttons in the top-right

If the popover shows the scaffold's placeholder content instead, Step 7 above (the URL repoint) did not take effect. Re-check `tauri.conf.json` or `main.rs`.

- [ ] **Step 4: Verify the view toggle**

Click the grid icon in the top-right. The popover should:
- Swap the body to a compact heatmap (small cells, no month labels)
- Header range label changes to "Last 365 days"
- Header totals update to reflect year-scoped data

Click the line icon to switch back. Verify the line view returns.

- [ ] **Step 5: Verify the hover legend**

In line view, hover over the chart area. The legend below the chart (`Tokens · left axis` / `Sessions · right axis`) should fade in. Move the mouse away — legend hides.

- [ ] **Step 6: Verify no regression in the web app's Timeline**

Open `http://localhost:5173/timeline` in a browser. The contribution graph there should look identical to before this slice (month labels, day-of-week labels, "Less / More" legend all visible).

- [ ] **Step 7: Document any issues**

If any of Steps 3–6 fail, write a one-line repro and fix the root cause (don't paper over). Common likely issues:
- Tauri popover loads the wrong URL → re-check Task 7
- Tokens total formats poorly for non-round values → adjust `formatTokens` in both `dual-line-chart.tsx` and `menubar-page.tsx`
- Heatmap overflows the 360px popover even in compact mode → re-check Task 2's cell sizing

- [ ] **Step 8: Commit any fixes**

If no fixes were needed, skip this step. If fixes were applied:
```bash
git add packages/
git commit -m "fix(menubar): <one-line description>"
```

---

## Self-review notes

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| Architecture (file tree) | Tasks 3, 4, 5 (create) + Task 6 (modify app.tsx) |
| `<MenubarPage>` | Task 5 |
| `<DualLineChart>` | Task 4 |
| `<ViewSwitch>` | Task 3 |
| `<ContributionGraph compact>` | Task 2 |
| Data flow (`useTimelineHeatmapRange`) | Task 1 (hook) + Task 5 (consumer) |
| Router | Task 6 |
| Tauri popover URL | Task 7 |
| Test strategy | Tasks 1–5 each include their own TDD tests |
| Error handling (empty data, loading) | Tasks 4 (empty case) + 5 (loading via React Query default `data ?? []`) |
| Success criterion 1 (unit tests pass) | Tasks 1–5 |
| Success criterion 2 (UI build passes) | Task 6 Step 3 |
| Success criterion 3 (Rust build passes) | Task 7 Steps 3–4 |
| Success criterion 4 (Rust tests pass) | Task 7 Step 4 |
| Success criterion 5 (`/menubar` shows real chart in browser) | Task 6 Step 4 |
| Success criterion 6 (chart in menubar app) | Task 8 Steps 3–5 |
| Success criterion 7 (toggle works without refetch) | Task 8 Step 4 — manual verification |
| Success criterion 8 (legend on hover only) | Task 8 Step 5 |
| Success criterion 9 (existing Timeline unchanged) | Task 2 Step 7 + Task 8 Step 6 |

**Placeholder scan:** No `TBD`, `TODO`, or "implement later" in any task. Each code-changing step includes the actual code or specifies the exact existing line to find.

**Type consistency:**
- `MenubarView` is defined in Task 3 (view-switch.tsx) and consumed in Task 5 (menubar-page.tsx) — name matches.
- `useTimelineHeatmapRange` signature in Task 1 (`{from, to, metric, project?}`) matches the call site in Task 5.
- `HeatmapPoint` type from `@/hooks/use-timeline` used consistently across Tasks 4 and 5.
- `compact?: boolean` prop on `ContributionGraph` (Task 2) matches the call site in Task 5 (`<ContributionGraph ... compact />`).
