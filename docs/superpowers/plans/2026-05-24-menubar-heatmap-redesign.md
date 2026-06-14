# Menubar Heatmap Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `<ContributionGraph compact>` in the menubar popover with a dedicated `<RecentHeatmap>` (16-week rolling, fixed 16×16 cells with ghost card, four-element chrome, 2-line hover tooltip), revert the shared component to its pre-slice state, and add the footer meta line in MenubarPage.

**Architecture:** New self-contained `<RecentHeatmap>` in `packages/ui/src/components/menubar/` renders its own ghost card + grid + chrome + tooltip. `<MenubarPage>` swaps it in for the heatmap branch and updates the data fetch to a rolling 16-week window. The shared `<ContributionGraph>` returns to its untouched pre-slice state.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest, React Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-24-menubar-heatmap-redesign.md`

---

## File Structure

**Create:**
- `packages/ui/src/components/menubar/recent-heatmap.tsx`
- `packages/ui/src/components/menubar/recent-heatmap.test.tsx`

**Modify:**
- `packages/ui/src/components/menubar/menubar-page.tsx` — swap body render, rolling-16-week fetch, footer meta line, header label
- `packages/ui/src/components/menubar/menubar-page.test.tsx` — update `Last 365 days` assertion to `Last 16 weeks`

**Revert (back to pre-Task-2 state):**
- `packages/ui/src/components/timeline/contribution-graph.tsx` — drop `compact` prop + conditionals, restore `CELL_SIZE=10`/`CELL_GAP=4`, drop test attributes

**Delete:**
- `packages/ui/src/components/timeline/contribution-graph.test.tsx`

---

## Task 1: Revert `<ContributionGraph>` to pre-slice state

**Files:**
- Modify: `packages/ui/src/components/timeline/contribution-graph.tsx`
- Delete: `packages/ui/src/components/timeline/contribution-graph.test.tsx`

This removes shared-component coupling. The Timeline page must look visually identical to its pre-slice state.

- [ ] **Step 1: Confirm pre-slice state by inspecting git history**

Run: `git log --oneline -- packages/ui/src/components/timeline/contribution-graph.tsx | head -5`
Look for commits `e5ecc8e` (added compact prop) and `7ddebc2` (cell size adjustment). The pre-slice state is what existed before `e5ecc8e`. Run:

```
git show e5ecc8e~1:packages/ui/src/components/timeline/contribution-graph.tsx > /tmp/contribution-graph-pre-slice.tsx
diff /tmp/contribution-graph-pre-slice.tsx packages/ui/src/components/timeline/contribution-graph.tsx | head -80
```

The diff shows what to undo. Use this output as a reference for the manual edits in Step 2.

- [ ] **Step 2: Edit `contribution-graph.tsx` — remove the `compact` prop**

Open `packages/ui/src/components/timeline/contribution-graph.tsx` and apply these specific changes:

a. **Props interface** (around line 51) — remove the `compact?: boolean` field:

```ts
// BEFORE
export interface ContributionGraphProps {
  year: number
  metric: TimelineMetric
  data: HeatmapPoint[]
  onSelectDay?: (date: string) => void
  /** Compact mode for the menubar popover: hides month/day-of-week labels and the legend; shrinks cells. */
  compact?: boolean
}

// AFTER
export interface ContributionGraphProps {
  year: number
  metric: TimelineMetric
  data: HeatmapPoint[]
  onSelectDay?: (date: string) => void
}
```

b. **Function signature** (around line 65) — remove `compact = false`:

```ts
// BEFORE
export function ContributionGraph({ year, metric, data, onSelectDay, compact = false }: ContributionGraphProps) {

// AFTER
export function ContributionGraph({ year, metric, data, onSelectDay }: ContributionGraphProps) {
```

c. **Cell size constants** (around lines 68-69) — restore unconditional values:

```ts
// BEFORE
const CELL_SIZE = compact ? 4 : 10
const CELL_GAP = compact ? 1 : 4

// AFTER
const CELL_SIZE = 10
const CELL_GAP = 4
```

d. **Conditional wrappers** — find all `{!compact && (...)}` wrappers (use grep `grep -n "!compact" packages/ui/src/components/timeline/contribution-graph.tsx`) and remove each `{!compact && (` opening and the matching `)}` closing, so the wrapped JSX always renders. The blocks live around lines 159 (months row), 179 (DOW column), 284 (Less/More legend). Inspect each block to ensure you only remove the wrapper, not the inner content.

e. **Test-hook attributes** — remove `data-heat-cell` (around line 221) and `data-month-label` (around line 173). Search and remove:
```
grep -n "data-heat-cell\|data-month-label" packages/ui/src/components/timeline/contribution-graph.tsx
```
Each match: delete just the attribute (and its leading whitespace if it's on its own line), preserving the rest of the JSX.

- [ ] **Step 3: Delete the compact-mode test file**

Run: `rm packages/ui/src/components/timeline/contribution-graph.test.tsx`

- [ ] **Step 4: Verify build passes**

Run: `pnpm --filter @ohmyc/ui build`
Expected: `tsc && vite build` succeeds. The `compact` prop being removed means callers that pass `compact` would error — `<MenubarPage>` still does for now, so this build will FAIL on a type error in `menubar-page.tsx`. That's expected; Task 3 fixes it.

If the build fails ONLY on `menubar-page.tsx` referencing `compact`, proceed. Any other failure → investigate.

- [ ] **Step 5: Verify ContributionGraph tests are gone**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/timeline/`
Expected: no test files found in that directory; reports `No test files found`.

- [ ] **Step 6: Visually check the Timeline page**

Run: `pnpm --filter @ohmyc/ui dev`
Open `http://localhost:5173/timeline` in a browser. The contribution graph should look visually identical to before this slice — month labels at top, DOW labels (M/W/F) on the left, 10×10 cells with 4px gap, "Less / More" legend at the bottom.

Stop the dev server (Ctrl-C) when done.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/timeline/contribution-graph.tsx packages/ui/src/components/timeline/contribution-graph.test.tsx
git commit -m "revert: drop ContributionGraph.compact prop (menubar uses dedicated RecentHeatmap)"
```

The `git add` includes the deleted test file as a deletion stage.

---

## Task 2: Build `<RecentHeatmap>` with TDD

**Files:**
- Create: `packages/ui/src/components/menubar/recent-heatmap.tsx`
- Test: `packages/ui/src/components/menubar/recent-heatmap.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/components/menubar/recent-heatmap.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecentHeatmap } from './recent-heatmap'

// 16 weeks × 7 days = 112 daily points
function makeTokenData(): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = []
  const start = new Date('2026-01-31T00:00:00Z')
  for (let i = 0; i < 112; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    // Vary values for bucket testing: every 4th day is high, others low
    points.push({ date: d.toISOString().slice(0, 10), value: i % 4 === 0 ? 100_000 : 1_000 })
  }
  return points
}

function makeSessionData(): { date: string; value: number }[] {
  return makeTokenData().map(p => ({ ...p, value: Math.round(p.value / 10_000) }))
}

describe('RecentHeatmap', () => {
  it('renders exactly 112 cells (16 weeks × 7 days)', () => {
    const { container } = render(<RecentHeatmap tokens={makeTokenData()} sessions={makeSessionData()} />)
    expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(16 * 7)
  })

  it('renders all four chrome elements', () => {
    const { container } = render(<RecentHeatmap tokens={makeTokenData()} sessions={makeSessionData()} />)
    expect(container.querySelector('[data-heatmap-months]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-dow]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-range]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-legend]')).toBeInTheDocument()
  })

  it('applies the highest-intensity bucket to peak cells and zero bucket to empty cells', () => {
    const tokens = makeTokenData() // peaks at 100_000, lows at 1_000
    const { container } = render(<RecentHeatmap tokens={tokens} sessions={makeSessionData()} />)
    const cells = container.querySelectorAll('[data-heat-cell]')
    // First cell (i=0) has value 100_000 → bucket 4 (max ratio = 1.0)
    expect(cells[0].getAttribute('data-bucket')).toBe('4')
    // Second cell (i=1) has value 1_000 → ratio 0.01 → bucket 1
    expect(cells[1].getAttribute('data-bucket')).toBe('1')
  })

  it('handles empty data without crashing', () => {
    const { container } = render(<RecentHeatmap tokens={[]} sessions={[]} />)
    // 112 cells still render (all at bucket 0)
    const cells = container.querySelectorAll('[data-heat-cell]')
    expect(cells).toHaveLength(112)
    cells.forEach(cell => {
      expect(cell.getAttribute('data-bucket')).toBe('0')
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/recent-heatmap.test.tsx`
Expected: FAIL with "Cannot find module ./recent-heatmap".

- [ ] **Step 3: Implement the component**

Create `packages/ui/src/components/menubar/recent-heatmap.tsx`:

```tsx
// Menubar heatmap — 16 weeks × 7 days, fixed 16×16 cells with 3px gap.
// Ghost variant (no card chrome). Four labelling elements (month row, DOW
// column, range label, Less/More legend) and a 2-line hover tooltip.

import { useState } from 'react'

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface RecentHeatmapProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const WEEKS = 16
const DAYS = 7
const CELL_SIZE = 16
const CELL_GAP = 3
const DOW_COL_WIDTH = 14
const COL_GAP = 4

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const
const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const

const BUCKET_COLORS = [
  'rgba(255,255,255,0.04)', // 0
  'rgba(255,255,255,0.10)', // 1
  'rgba(255,255,255,0.22)', // 2
  'rgba(255,255,255,0.45)', // 3
  'rgba(255,255,255,0.72)', // 4
] as const

// Sixth swatch only appears in the legend's "More" end
const LEGEND_COLORS = [...BUCKET_COLORS, 'rgba(255,255,255,0.92)']

const MONO = '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace'

function bucketFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0
  const ratio = value / max
  if (ratio <= 0.15) return 1
  if (ratio <= 0.4) return 2
  if (ratio <= 0.7) return 3
  return 4
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`
  return String(n)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() - n)
  return copy
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${DOW_NAMES[d.getUTCDay()]} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

interface HoverState {
  date: string
  tokens: number
  sessions: number
  x: number
  y: number
}

export function RecentHeatmap({ tokens, sessions }: RecentHeatmapProps) {
  const [hover, setHover] = useState<HoverState | null>(null)

  // 16-week rolling window: oldest = today - (16*7 - 1) days
  const today = new Date()
  const start = subDays(today, WEEKS * DAYS - 1)

  // Build a map of date → value for fast lookup (data may be sparse or out of order)
  const tokenMap = new Map(tokens.map(p => [p.date, p.value]))
  const sessionMap = new Map(sessions.map(p => [p.date, p.value]))

  // Max for bucket scaling
  const maxToken = Math.max(0, ...tokens.map(p => p.value))

  // Compute cells in column-major order (each column = one week)
  type Cell = { iso: string; value: number; bucket: 0 | 1 | 2 | 3 | 4; col: number; row: number }
  const cells: Cell[] = []
  for (let col = 0; col < WEEKS; col++) {
    for (let row = 0; row < DAYS; row++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + col * DAYS + row)
      const iso = isoDate(d)
      const value = tokenMap.get(iso) ?? 0
      cells.push({ iso, value, bucket: bucketFor(value, maxToken), col, row })
    }
  }

  // Month labels: one per unique month for the first week containing it
  const seenMonths = new Set<number>()
  type MonthLabel = { col: number; name: string }
  const monthLabels: MonthLabel[] = []
  for (let col = 0; col < WEEKS; col++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + col * DAYS)
    const m = d.getUTCMonth()
    if (!seenMonths.has(m)) {
      seenMonths.add(m)
      monthLabels.push({ col, name: MONTH_NAMES[m].toUpperCase() })
    }
  }

  // Range label: "MMM D → MMM D, YYYY"
  const rangeText = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()} → ${MONTH_NAMES[today.getUTCMonth()]} ${today.getUTCDate()}, ${today.getUTCFullYear()}`

  // DOW column: 7 slots, label only Mon/Wed/Fri
  const dowVisible = ['', 'M', '', 'W', '', 'F', '']

  function onCellEnter(cell: Cell, e: React.MouseEvent<HTMLDivElement>) {
    const target = e.currentTarget
    const wrapRect = target.closest('[data-heatmap-wrap]')!.getBoundingClientRect()
    const cellRect = target.getBoundingClientRect()
    setHover({
      date: cell.iso,
      tokens: cell.value,
      sessions: sessionMap.get(cell.iso) ?? 0,
      x: cellRect.left - wrapRect.left + cellRect.width / 2,
      y: cellRect.top - wrapRect.top,
    })
  }

  return (
    <div data-heatmap-wrap className="pt-1 relative">
      {/* Heatmap body: 2×2 grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${DOW_COL_WIDTH}px auto`,
          gridTemplateRows: '14px auto',
          columnGap: `${COL_GAP}px`,
          rowGap: '2px',
        }}
      >
        {/* corner */}
        <div />

        {/* month labels row */}
        <div
          data-heatmap-months
          className="grid overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            columnGap: `${CELL_GAP}px`,
          }}
        >
          {monthLabels.map((label, i) => {
            const span = Math.min(2, WEEKS - label.col)
            return (
              <span
                key={i}
                className="text-[9px] uppercase whitespace-nowrap text-[var(--text-quaternary)]"
                style={{
                  gridColumn: `${label.col + 1} / span ${span}`,
                  fontFamily: MONO,
                  letterSpacing: '0.04em',
                  alignSelf: 'center',
                }}
              >
                {label.name}
              </span>
            )
          })}
        </div>

        {/* DOW column */}
        <div
          data-heatmap-dow
          className="grid items-center"
          style={{
            gridTemplateRows: `repeat(${DAYS}, ${CELL_SIZE}px)`,
            rowGap: `${CELL_GAP}px`,
            justifyItems: 'start',
          }}
        >
          {dowVisible.map((letter, i) => (
            <span
              key={i}
              className="text-[9px] text-[var(--text-quaternary)]"
              style={{
                fontFamily: MONO,
                lineHeight: `${CELL_SIZE}px`,
                height: CELL_SIZE,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* cells grid */}
        <div
          data-heatmap-grid
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${DAYS}, ${CELL_SIZE}px)`,
            gap: `${CELL_GAP}px`,
          }}
        >
          {cells.map((cell, i) => (
            <div
              key={i}
              data-heat-cell
              data-bucket={cell.bucket}
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
                background: BUCKET_COLORS[cell.bucket],
                borderRadius: 2,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => onCellEnter(cell, e)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>

      {/* footer: range left, Less/More right */}
      <div
        className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--text-quaternary)]"
        style={{ fontFamily: MONO }}
      >
        <span data-heatmap-range>{rangeText}</span>
        <span data-heatmap-legend className="inline-flex items-center gap-1.5">
          Less
          <span className="inline-flex items-center gap-[3px] mx-1.5">
            {LEGEND_COLORS.map((c, i) => (
              <span
                key={i}
                style={{ width: 9, height: 9, borderRadius: 1, display: 'inline-block', background: c }}
              />
            ))}
          </span>
          More
        </span>
      </div>

      {/* hover tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1.5 rounded text-[11px] text-[var(--text-primary)] shadow-lg"
          style={{
            left: hover.x,
            top: hover.y - 8,
            transform: 'translate(-50%, -100%)',
            background: '#08090a',
            border: '1px solid var(--border-default)',
            fontFamily: MONO,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-[var(--text-primary)]">{hover.sessions} sessions · {formatTokens(hover.tokens)} tokens</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">{longDate(hover.date)}</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/recent-heatmap.test.tsx`
Expected: 4 PASS.

If a test fails because `data-bucket` attribute is computed slightly differently (e.g., a bucket boundary edge case in the sample data), inspect the actual bucket values via `container.querySelectorAll('[data-heat-cell]')` and reconcile the test expectations to what the spec's `bucketFor` math produces. The spec is authoritative; tests adapt.

- [ ] **Step 5: Run the full UI test suite (no regression)**

Run: `pnpm --filter @ohmyc/ui test`
Expected: existing tests still pass + 4 new pass. Note: `menubar-page.test.tsx` may still fail because `<MenubarPage>` still references `ContributionGraph` (Task 3 fixes this). Acceptable for now.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/recent-heatmap.tsx packages/ui/src/components/menubar/recent-heatmap.test.tsx
git commit -m "feat(ui): add RecentHeatmap (16-week rolling, ghost card, 4-element chrome, hover tooltip)"
```

---

## Task 3: Wire `<RecentHeatmap>` into `<MenubarPage>`

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-page.test.tsx`

- [ ] **Step 1: Update imports + replace heatmap data fetch**

Open `packages/ui/src/components/menubar/menubar-page.tsx`. Apply these specific changes:

a. **Imports** — swap `ContributionGraph` import for `RecentHeatmap`:

```ts
// BEFORE
import { ContributionGraph } from '@/components/timeline/contribution-graph'
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'

// AFTER
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'

import { RecentHeatmap } from './recent-heatmap'
```

(Drop `ContributionGraph`; keep `useTimelineHeatmapRange`; add `RecentHeatmap`.)

b. **Constant + data fetch** — replace year-scoped vars with rolling-16-week vars. Find lines around 36-50 (the data-fetch block). Replace:

```tsx
// BEFORE
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
```

with:

```tsx
// AFTER
const fourMonthAgoIso = isoDate(subDays(today, 16 * 7 - 1))

const tokensWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'tokens' })
const sessionsWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'sessions' })
const tokensRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'tokens' })
const sessionsRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'sessions' })

const tokensWeekTotal = (tokensWeek.data ?? []).reduce((s, p) => s + p.value, 0)
const sessionsWeekTotal = (sessionsWeek.data ?? []).reduce((s, p) => s + p.value, 0)
const tokensRecentTotal = (tokensRecent.data ?? []).reduce((s, p) => s + p.value, 0)
const sessionsRecentTotal = (sessionsRecent.data ?? []).reduce((s, p) => s + p.value, 0)

const headerTokens = view === 'line' ? tokensWeekTotal : tokensRecentTotal
const headerSessions = view === 'line' ? sessionsWeekTotal : sessionsRecentTotal
const rangeLabel = view === 'line' ? 'Last 7 days' : 'Last 16 weeks'
```

`CURRENT_YEAR` is no longer used in this file — delete its declaration too (look near top of the file for `const CURRENT_YEAR = new Date().getUTCFullYear()`).

c. **Body render** — swap `<ContributionGraph>` for `<RecentHeatmap>`. Find the block around line 84:

```tsx
// BEFORE
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

// AFTER
{view === 'line' ? (
  <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
) : (
  <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
)}
```

- [ ] **Step 2: Update the menubar-page test assertion**

Open `packages/ui/src/components/menubar/menubar-page.test.tsx`. Two assertions reference `/Last 365 days/i` (lines around 69 and 85). Replace both with `/Last 16 weeks/i`:

```ts
// BEFORE (two occurrences)
expect(await screen.findByText(/Last 365 days/i)).toBeInTheDocument()
// ...
await screen.findByText(/Last 365 days/i)

// AFTER (two occurrences)
expect(await screen.findByText(/Last 16 weeks/i)).toBeInTheDocument()
// ...
await screen.findByText(/Last 16 weeks/i)
```

- [ ] **Step 3: Run the menubar-page tests**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: 5 PASS.

- [ ] **Step 4: Run the full UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: ALL tests pass. Including the existing line-view tests, view-switch tests, recent-heatmap tests from Task 2, and updated menubar-page tests.

- [ ] **Step 5: Verify the UI build**

Run: `pnpm --filter @ohmyc/ui build`
Expected: clean. The previously-broken build (Task 1 Step 4) is now fixed.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-page.test.tsx
git commit -m "feat(ui): swap heatmap branch to RecentHeatmap with rolling 16-week range"
```

---

## Task 4: Add the footer meta line to `<MenubarPage>`

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-page.test.tsx`

The spec's "footer meta line" gives the popover a small insight beat below the chart card — and balances the visual weight between the line view (~140px chart) and heatmap view (~150px grid + chrome). Render different text per view.

- [ ] **Step 1: Write the failing test**

In `packages/ui/src/components/menubar/menubar-page.test.tsx`, after the existing tests but inside the `describe` block, append:

```tsx
  it('renders the footer meta line with peak day for line view', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    // 10_000 (May 22) is the peak; 5_000 (May 21) is secondary
    expect(await screen.findByText(/peak/i)).toBeInTheDocument()
    expect(await screen.findByText(/10k/i)).toBeInTheDocument()
  })
```

This asserts the footer renders and shows the peak token value formatted (10_000 → `10k`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: the new test FAILS (no `/peak/i` text yet); existing 5 tests still PASS.

- [ ] **Step 3: Implement the footer meta line in MenubarPage**

In `packages/ui/src/components/menubar/menubar-page.tsx`:

a. Add a helper near the other module-level helpers (near the top of the file, alongside `subDays`/`isoDate`/`formatTokens`):

```ts
function findPeak(points: { date: string; value: number }[]): { date: string; value: number } | null {
  if (points.length === 0) return null
  let peak = points[0]
  for (const p of points) {
    if (p.value > peak.value) peak = p
  }
  return peak
}

function shortDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`
}
```

b. Inside the `MenubarPage` function, after computing `headerTokens`/`headerSessions` and before the return, compute the footer text:

```tsx
const peakSource = view === 'line' ? tokensWeek.data : tokensRecent.data
const peak = findPeak(peakSource ?? [])
const peakSessionsLookup = (view === 'line' ? sessionsWeek.data : sessionsRecent.data) ?? []
const peakSessionCount = peak
  ? peakSessionsLookup.find(p => p.date === peak.date)?.value ?? 0
  : 0
const footerMeta = peak
  ? `peak ${shortDayLabel(peak.date)} · ${formatTokens(peak.value)} · ${peakSessionCount} sessions`
  : 'no activity yet'
```

c. In the JSX `return`, after the chart card branch (the line/heatmap conditional), add the footer:

```tsx
<div
  className="mt-2.5 pt-2 border-t border-[var(--border-soft)] text-[11px] text-[var(--text-tertiary)]"
  style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
>
  {footerMeta}
</div>
```

`--border-soft` is defined globally; if it's not in this codebase, use `var(--border-default)` instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-page.test.tsx
git commit -m "feat(ui): add footer meta line with peak-day summary to MenubarPage"
```

---

## Task 5: Manual smoke test

Not a code change. Human-in-the-loop verification that the redesign is correct end-to-end.

- [ ] **Step 1: Start the dev stack**

In a terminal at the repo root:

```bash
pnpm desktop
```

Wait for both the CLI (port 3000) and Tauri (port 1420 + tray app) to start.

- [ ] **Step 2: Browser pre-flight at `localhost:1420/menubar`**

Open `http://localhost:1420/menubar` in a browser (this is the desktop package's Vite dev server). Verify the chart renders with real data:

- Header: `<tokens-total>` tokens · `<sessions-count>` sessions, range label `Last 7 days`
- Body: dual-axis line chart (last 7 days), 2 polylines, 14 dots
- Hover the chart → legend fades in below
- Click the heatmap icon (top-right) → swaps to heatmap view:
  - Range label: `Last 16 weeks`
  - Header totals update to the 16-week range
  - Body: ghost card (no border/background), 16×16 cells in a 16-column grid
  - Four chrome elements visible: month labels (top), DOW labels (M/W/F left), range label (bottom-left, e.g. `Feb 2 → May 24, 2026`), Less/More legend (bottom-right)
  - DOW labels and range label align flush with the popover's left edge (same x as the header text above)
- Hover any cell → 2-line tooltip appears: line 1 `N sessions · Xk tokens`, line 2 long-form date
- Footer meta line below the chart card: `peak {DOW MMM D} · {tokens} · {sessions} sessions`

- [ ] **Step 3: Verify in the actual menu bar app**

Click the tray icon in the macOS menu bar. The popover should show the same content as the browser test. Toggle the view, hover cells, verify the same behaviors.

- [ ] **Step 4: Verify the Timeline page hasn't regressed**

In a browser, open `http://localhost:5173/timeline` (the packages/ui dev server — different port from desktop's). The contribution graph should look visually identical to before this slice: month labels, M/W/F labels, 10×10 cells with 4px gap, Less/More legend.

If the Vite for packages/ui isn't running, start it: `pnpm --filter @ohmyc/ui dev` in another terminal.

- [ ] **Step 5: Verify on-quit cleanliness**

Quit the Tauri app (tray right-click → Quit OhMyC). Check that no zombie processes remain:

```bash
ps aux | grep -E "tauri|ohmyc" | grep -v grep
```

Expected: no Tauri or ohmyc processes left running (concurrently with -k should kill the sidecar + Vite).

- [ ] **Step 6: Document any issues**

For each problem found:
- Write a one-line reproduction
- Investigate root cause (don't paper over)
- Either fix in a follow-up commit OR file in the spec's "known issues" if out of scope

Common likely issues:
- Hover tooltip positioning off (jsdom-relative positioning may differ from real DOM) → adjust the math in `onCellEnter`
- Footer text wraps awkwardly with long peak labels → reduce label verbosity or wrap with `whitespace-nowrap`
- Cells too dim to distinguish bucket levels on certain monitors → bump the lowest bucket from `0.04` to `0.06`

- [ ] **Step 7: Commit any fixes**

If no fixes needed, skip. If fixes applied:

```bash
git add packages/
git commit -m "fix(menubar): <one-line description>"
```

---

## Self-review notes

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| `<RecentHeatmap>` component spec (grid, cells, chrome, tooltip) | Task 2 |
| `<MenubarPage>` data fetch change (rolling 16-week) | Task 3 Step 1 |
| `<MenubarPage>` body swap (ContributionGraph → RecentHeatmap) | Task 3 Step 1 |
| `<MenubarPage>` header range label change | Task 3 Step 1 |
| `<MenubarPage>` footer meta line | Task 4 |
| `<ContributionGraph>` revert | Task 1 |
| `contribution-graph.test.tsx` deletion | Task 1 |
| Decisions 7-15 (architectural justifications) | (documented in spec, not tasked) |
| Success criterion 1 (UI tests pass) | Tasks 2, 3, 4 |
| Success criterion 2 (UI build) | Task 3 Step 5 |
| Success criterion 3 (Rust build) | Task 5 (no Rust change in this slice; covered by absence of failure) |
| Success criterion 4 (menu bar smoke test) | Task 5 |
| Success criterion 5 (Timeline page unchanged) | Task 1 Step 6 + Task 5 Step 4 |
| Success criterion 6 (no Rust regression) | Task 5 implicit (no Rust touched) |

**Placeholder scan:** No TBD/TODO/"implement later" in any task. Every code-changing step includes the exact code. Exact line numbers and grep commands where needed to locate edits.

**Type consistency:**
- `RecentHeatmap` props (`tokens: HeatmapPoint[]`, `sessions: HeatmapPoint[]`) defined in Task 2, consumed in Task 3 with matching shape.
- `findPeak` / `shortDayLabel` helpers defined in Task 4 only, used only in Task 4's MenubarPage edit.
- `useTimelineHeatmapRange` signature (existing) unchanged; new call sites use the same shape.
- `BUCKET_COLORS` / `LEGEND_COLORS` constants in Task 2 — consistent counts (5 cell buckets + 1 extra legend swatch).
