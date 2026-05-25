# Menubar Tremor Line Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the hand-rolled `<DualLineChart>` for a Tremor `<LineChart>` with hover tooltip, mapped to DESIGN.md monochrome tokens via Tailwind config; wrap the conditional chart render in a stable-height container so the popover layout no longer shifts on view toggle.

**Architecture:** Add `@tremor/react` + extend `packages/ui/tailwind.config.mjs` to map Tremor's theme slots to project tokens. Rewrite `dual-line-chart.tsx` to render a Tremor single-line chart (tokens) with a `customTooltip` that surfaces both metrics + date on hover. Wrap MenubarPage's `{line | heatmap}` conditional in `<div className="min-h-[168px]">`. Update tests to assert on Recharts wrapper presence (Tremor uses Recharts internally) instead of hand-rolled `<polyline>`.

**Tech Stack:** React 19, TypeScript, Tailwind, `@tremor/react`, Recharts (transitive), Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-25-menubar-tremor-line.md`

---

## File Structure

**Modify:**
- `packages/ui/package.json` — add `@tremor/react`
- `packages/ui/tailwind.config.mjs` — register Tremor theme slots; extend content scan for `@tremor/**`
- `packages/ui/src/components/menubar/dual-line-chart.tsx` — rewrite using Tremor
- `packages/ui/src/components/menubar/dual-line-chart.test.tsx` — assertion shape changes
- `packages/ui/src/components/menubar/menubar-page.tsx` — stable-height wrapper
- `packages/ui/src/components/menubar/menubar-page.test.tsx` — `polyline` → `.recharts-wrapper`

**No other files touched.** No Rust changes. No changes to `<ContributionGraph>`, `<RecentHeatmap>`, `<ViewSwitch>`, or `app.tsx`.

---

## Task 1: Add Tremor dep + map Tailwind theme slots

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/tailwind.config.mjs`

These are coupled — Tremor's components need both the package and the theme mapping to render correctly in monochrome.

- [ ] **Step 1: Add `@tremor/react` to packages/ui dependencies**

Open `packages/ui/package.json`. In the `"dependencies"` object (alphabetically near `@radix-ui/*` entries), add:

```json
"@tremor/react": "^3.18.7",
```

Use `^3.18.7` — current stable. Tremor 3.x peer-deps say React 18; pnpm may emit a peer-dep warning under React 19. The warning is acceptable — Tremor's API surface used here (LineChart + customTooltip) works fine under React 19; if a runtime error surfaces during build/test, pin to a Tremor version that explicitly supports React 19 (3.20+) and document in DONE_WITH_CONCERNS.

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: pnpm adds `@tremor/react` and its transitive deps (recharts, d3-*). Peer-dep warnings about React 19 are OK; an actual `ERR_PNPM_*` failure is not.

- [ ] **Step 3: Extend `tailwind.config.mjs`**

Open `packages/ui/tailwind.config.mjs`. Two changes:

a. **Content scan** — add Tremor's source path so its utility classes get extracted:

```js
// BEFORE
content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
],

// AFTER
content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
  './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
],
```

b. **Theme extension** — inside `theme.extend.colors`, append the `tremor` slot mapping. After the existing `destructive`/`border`/`input`/`ring` entries (but still inside `extend.colors`), add:

```js
tremor: {
  brand: {
    faint: '#191a1b',
    muted: '#28282c',
    subtle: '#62666d',
    DEFAULT: '#f7f8f8',
    emphasis: '#f7f8f8',
    inverted: '#08090a',
  },
  background: {
    muted: '#0f1011',
    subtle: '#191a1b',
    DEFAULT: '#08090a',
    emphasis: '#f7f8f8',
  },
  border: { DEFAULT: 'rgba(255,255,255,0.08)' },
  ring: { DEFAULT: '#23252a' },
  content: {
    subtle: '#62666d',
    DEFAULT: '#8a8f98',
    emphasis: '#d0d6e0',
    strong: '#f7f8f8',
    inverted: '#08090a',
  },
},
```

These hex values come from DESIGN.md L42–L54 (Marketing/Panel/Surface bg, Primary/Secondary/Tertiary/Quaternary text, border-default).

- [ ] **Step 4: Verify UI build still passes**

Run: `pnpm --filter @ohmyc/ui build`
Expected: `tsc && vite build` succeed. The bundle grows by roughly +125–150KB gzipped (Tremor + Recharts + d3 transitive); existing modules unchanged.

- [ ] **Step 5: Verify the existing UI tests still pass**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all 123 tests pass. (Tremor is installed but not imported anywhere yet, so no behavior change.)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/tailwind.config.mjs pnpm-lock.yaml
git commit -m "feat(ui): add @tremor/react + map theme slots to DESIGN.md tokens"
```

---

## Task 2: Rewrite `<DualLineChart>` with Tremor + customTooltip

**Files:**
- Modify: `packages/ui/src/components/menubar/dual-line-chart.tsx` (full rewrite)
- Modify: `packages/ui/src/components/menubar/dual-line-chart.test.tsx` (full rewrite)

The component keeps its name + props so `<MenubarPage>`'s import stays unchanged. Internals swap to Tremor; assertions swap to Recharts wrapper presence.

- [ ] **Step 1: Rewrite the test file first**

Replace `packages/ui/src/components/menubar/dual-line-chart.test.tsx` entirely with:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DualLineChart } from './dual-line-chart'

import type { HeatmapPoint } from '@/hooks/use-timeline'

function mockTokens(): HeatmapPoint[] {
  return [
    { date: '2026-05-16', value: 12_000 },
    { date: '2026-05-17', value: 30_000 },
    { date: '2026-05-18', value: 22_000 },
    { date: '2026-05-19', value: 70_000 },
    { date: '2026-05-20', value: 55_000 },
    { date: '2026-05-21', value: 98_000 },
    { date: '2026-05-22', value: 40_000 },
  ]
}

function mockSessions(): HeatmapPoint[] {
  return [
    { date: '2026-05-16', value: 2 },
    { date: '2026-05-17', value: 4 },
    { date: '2026-05-18', value: 3 },
    { date: '2026-05-19', value: 8 },
    { date: '2026-05-20', value: 6 },
    { date: '2026-05-21', value: 11 },
    { date: '2026-05-22', value: 5 },
  ]
}

describe('DualLineChart', () => {
  it('renders a Recharts wrapper (Tremor internals)', () => {
    const { container } = render(
      <DualLineChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('renders a line path for the tokens series', () => {
    const { container } = render(
      <DualLineChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    // Recharts renders the line as <path class="recharts-curve" /> inside
    // an svg group. There is exactly one series ('tokens'), so one curve.
    expect(container.querySelector('path.recharts-curve')).toBeInTheDocument()
  })

  it('handles empty data without crashing', () => {
    const { container } = render(<DualLineChart tokens={[]} sessions={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests — expect them to fail against the current hand-rolled impl**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/dual-line-chart.test.tsx`
Expected: tests FAIL — the existing hand-rolled component renders `<polyline>` and `<circle>` SVG primitives, not Recharts' `.recharts-wrapper` / `path.recharts-curve`.

- [ ] **Step 3: Replace `dual-line-chart.tsx` entirely**

Replace the contents of `packages/ui/src/components/menubar/dual-line-chart.tsx` with:

```tsx
// Menubar line chart — Tremor LineChart wrapping Recharts.
// Renders a single monochrome line (tokens). Sessions are surfaced
// per-day via the customTooltip on hover.

import { LineChart } from '@tremor/react'
import { useMemo } from 'react'

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface DualLineChartProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const MONO = '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace'
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${Math.round(n / 100_000) / 10}M`
  }
  if (n >= 1000) {
    return `${Math.round(n / 100) / 10}k`
  }
  return String(n)
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

interface TremorTooltipProps {
  payload?: Array<{ value: number; payload: { date: string; tokens: number } }>
  label?: string
  active?: boolean
}

export function DualLineChart({ tokens, sessions }: DualLineChartProps) {
  const chartData = useMemo(
    () => tokens.map(p => ({ date: p.date, tokens: p.value })),
    [tokens],
  )
  const sessionMap = useMemo(
    () => new Map(sessions.map(p => [p.date, p.value])),
    [sessions],
  )

  function Tooltip({ payload, label, active }: TremorTooltipProps) {
    if (!active || !payload?.[0] || !label) {
      return null
    }
    const tokensVal = payload[0].value
    const sessionsVal = sessionMap.get(label) ?? 0
    return (
      <div
        className="rounded border border-[var(--border-default)] bg-[var(--surface-overlay)] px-2 py-1.5 text-[11px] shadow-md"
        style={{ fontFamily: MONO }}
      >
        <div className="text-[var(--text-primary)]">
          {sessionsVal} sessions · {formatTokens(tokensVal)} tokens
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          {longDate(label)}
        </div>
      </div>
    )
  }

  return (
    <LineChart
      data={chartData}
      index="date"
      categories={['tokens']}
      colors={['gray']}
      showLegend={false}
      showAnimation={false}
      showGridLines={true}
      showXAxis={true}
      showYAxis={true}
      yAxisWidth={36}
      valueFormatter={formatTokens}
      customTooltip={Tooltip}
      className="h-[140px]"
    />
  )
}
```

- [ ] **Step 4: Run the tests — expect them to pass**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/dual-line-chart.test.tsx`
Expected: 3 tests PASS.

If the `.recharts-wrapper` selector doesn't match (Tremor might use a different wrapper class in v3.18 — e.g., `tremor-LineChart-root`), inspect the rendered DOM via `screen.debug()` and update the selector to match the actual class hierarchy. The intent of the test is "this renders a Recharts chart"; the exact selector adapts to Tremor's actual emission.

- [ ] **Step 5: Run the full UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: existing 123 tests still pass + 3 new pass. Note: `menubar-page.test.tsx` will likely FAIL on the `polyline` assertion (the wrapped component no longer renders polylines) — that's fixed in Task 3.

- [ ] **Step 6: Verify the UI build**

Run: `pnpm --filter @ohmyc/ui build`
Expected: tsc + vite both succeed. Bundle size grows (~+125KB gzip).

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/menubar/dual-line-chart.tsx packages/ui/src/components/menubar/dual-line-chart.test.tsx
git commit -m "feat(ui): swap DualLineChart to Tremor LineChart with hover tooltip"
```

---

## Task 3: Stable-height wrapper in `<MenubarPage>` + fix its test assertions

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-page.test.tsx`

- [ ] **Step 1: Add stable-height wrapper to MenubarPage**

In `packages/ui/src/components/menubar/menubar-page.tsx`, find the conditional render block (the `{view === 'line' ? <DualLineChart .../> : <RecentHeatmap .../>}` block). Wrap it in a `<div>` with `min-h-[168px]`:

```tsx
// BEFORE
{view === 'line'
  ? (
  <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
    )
  : (
  <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
    )}

// AFTER
<div className="min-h-[168px]">
  {view === 'line'
    ? (
    <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
      )
    : (
    <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
      )}
</div>
```

168px is the taller of the two views' natural content heights (heatmap = ~168px; Tremor LineChart at `h-[140px]` = ~164px including x-axis ticks). Setting `min-h` means the shorter view inherits a few px of bottom-padding effect; the popover footer below this wrapper never moves on view toggle.

- [ ] **Step 2: Update the menubar-page test assertions**

In `packages/ui/src/components/menubar/menubar-page.test.tsx`, replace the two `polyline` assertions:

```ts
// Test: 'renders the DualLineChart in line view (polyline elements present)'
// BEFORE
expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2)
// AFTER
expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
```

```ts
// Test: 'does not render polylines in heatmap view'
// BEFORE
expect(container.querySelectorAll('polyline')).toHaveLength(0)
// AFTER
expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
```

The test names mention "polyline" — rename for accuracy:

```ts
// BEFORE
it('renders the DualLineChart in line view (polyline elements present)', async () => {
it('does not render polylines in heatmap view', async () => {

// AFTER
it('renders the DualLineChart in line view (Recharts wrapper present)', async () => {
it('does not render the Recharts wrapper in heatmap view', async () => {
```

- [ ] **Step 3: Run the menubar-page tests**

Run: `pnpm --filter @ohmyc/ui exec vitest run src/components/menubar/menubar-page.test.tsx`
Expected: 6 PASS (5 existing + the footer-meta test from prior slice).

Again, if `.recharts-wrapper` isn't the exact class Tremor emits in v3.18, swap to whatever Task 2 Step 4 confirmed.

- [ ] **Step 4: Run the full UI test suite**

Run: `pnpm --filter @ohmyc/ui test`
Expected: ALL tests pass.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @ohmyc/ui build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-page.test.tsx
git commit -m "feat(ui): stable-height container around chart; swap menubar-page Recharts assertions"
```

---

## Task 4: Manual smoke test

Not a code change. Human-in-the-loop verification of the visual + interaction behavior the unit tests can't cover (monochrome chart rendering, hover tooltip, no layout flicker, no chromatic leaks).

- [ ] **Step 1: Boot the dev stack**

From repo root:

```bash
# Free ports if needed
lsof -ti :1420,3000 | xargs kill 2>/dev/null
pnpm desktop
```

Wait for both `cli` (port 3000) and `desktop` (port 1420 + Tauri shell) to start.

- [ ] **Step 2: Browser pre-flight at `localhost:1420/menubar`**

Open `http://localhost:1420/menubar`. Verify:

- Line view (default): single white line on dark bg, no chromatic colors anywhere
- Y-axis ticks visible on the left (gray Berkeley Mono-ish text)
- Horizontal grid lines visible at low contrast
- X-axis: 7 date labels along the bottom
- Hover over any point on the line → 2-line tooltip floats above:
  - Line 1: `{N} sessions · {tokens}k tokens` (Primary white text)
  - Line 2: `MMM D, YYYY` (Tertiary gray text, 10px)
  - Tooltip background `#191a1b`, border `rgba(255,255,255,0.08)`, monospace font

- [ ] **Step 3: Verify no chromatic leaks**

Visually scan the chart. Tremor's default theme uses chromatic colors (blue line, blue tooltip). After the Tailwind theme extension, the line should be GRAY/WHITE only. If you see any blue/green/red, the theme mapping didn't take effect — re-check Task 1 Step 3 and verify `colors={['gray']}` on the LineChart in Task 2.

- [ ] **Step 4: Verify layout stability across view toggle**

Open the popover (browser at `localhost:1420/menubar` or click the tray icon in the Tauri app). Locate the footer meta line at the bottom (`peak {DOW MMM D} · Xk · N sessions`). Toggle between line and heatmap views using the icon switcher. The footer's y-coordinate should not shift visibly — it stays pinned at the same vertical position regardless of which view is active.

- [ ] **Step 5: Verify in the actual menu bar app (Tauri)**

Click the tray icon. The popover should now show:
- Real monochrome line chart on initial open
- Hover any point → tooltip floats above
- Toggle to heatmap → footer stays put
- Toggle back to line → footer stays put
- No window flicker on toggle (the static-window guarantee from prior slice still holds; this slice further eliminates the perceived flicker by stabilizing content height)

- [ ] **Step 6: Verify no regression on the Timeline page**

Open `http://localhost:5173/timeline` (the packages/ui Vite server — different port from desktop). The contribution graph there should look identical to before this slice (no shared-component changes in this slice).

- [ ] **Step 7: Document any issues**

For each problem found:
- Write a one-line reproduction
- Investigate root cause (don't paper over)
- Fix in a follow-up commit OR flag for a separate slice

Likely candidates:
- Tooltip positioning off (Recharts default tooltip placement may not exactly mirror our heatmap tooltip) → adjust via Tremor's tooltip positioning props or wrap the tooltip with custom positioning logic
- Chart line color isn't exactly DESIGN.md `#f7f8f8` → verify the `colors={['gray']}` resolves correctly through `tremor.brand.DEFAULT`; if not, swap to a custom slot name and map it explicitly
- Grid lines too dark / too light → adjust `tremor.border.DEFAULT` alpha
- Y-axis text wrong color → verify `tremor.content.subtle` mapping in Task 1

- [ ] **Step 8: Commit any fixes**

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
| Add `@tremor/react` dependency | Task 1 |
| Tailwind config extension (theme slots + content scan) | Task 1 |
| `<DualLineChart>` rewrite (Tremor LineChart + customTooltip + props) | Task 2 |
| Custom tooltip JSX matching DESIGN.md L211 spec | Task 2 (full code in Step 3) |
| MenubarPage stable-height wrapper | Task 3 |
| Test rewrites (DualLineChart + MenubarPage assertions) | Tasks 2, 3 |
| Bundle size acknowledgement | Task 1 Step 4 (verification step notes the growth) |
| Success criteria 1 (`pnpm --filter @ohmyc/ui test`) | Task 2 Step 5, Task 3 Step 4 |
| Success criteria 2 (`pnpm --filter @ohmyc/ui build`) | Task 1 Step 4, Task 2 Step 6, Task 3 Step 5 |
| Success criteria 3 (`pnpm --filter @ohmyc/desktop build`) | (implicit via Task 4 Step 1 — `pnpm desktop` triggers the desktop build) |
| Success criteria 4 (Rust build) | (no Rust changes; covered by absence of failure) |
| Success criteria 5 (Rust tests) | (no Rust changes) |
| Success criteria 6 (`pnpm desktop` manual smoke) | Task 4 Steps 1–5 |
| Success criteria 7 (Timeline page unchanged) | Task 4 Step 6 |
| Success criteria 8 (no chromatic colors) | Task 4 Step 3 |
| Decisions 16–21 from the spec | (documented in spec, not tasked) |

**Placeholder scan:** No TBD/TODO/"implement later" in any task. Every code-changing step includes the exact code. Exact commands with expected output.

**Type consistency:**
- `DualLineChart` props (`tokens: HeatmapPoint[]`, `sessions: HeatmapPoint[]`) unchanged between current and rewritten — MenubarPage import is unaffected.
- `formatTokens` and `longDate` helpers defined inline in Task 2; same signatures as elsewhere in the codebase (menubar-page.tsx already has its own `formatTokens` with identical math).
- `TremorTooltipProps` interface defined in Task 2; consumer-only.
- `useMemo` dependencies on `tokens` and `sessions` arrays — referential equality matters (React Query data is stable across re-renders unless refetched).
