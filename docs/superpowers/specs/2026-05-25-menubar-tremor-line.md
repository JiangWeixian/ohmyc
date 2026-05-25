# Menubar Line Chart — Tremor + Stable-Height Layout (v0.1 Slice 2.7)

**Date:** 2026-05-25
**Branch:** feat/menubar-chart
**Status:** APPROVED (brainstorming phase)

**Upstream references:**
- Wireframe (source of truth for visual + interaction):
  `~/.gstack/projects/JiangWeixian-claudeui/designs/menubar-popover-20260517/index.html`
- DESIGN.md (project design system; this spec maps Tremor's theme slots to its tokens): `DESIGN.md`
- Chart slice spec: `docs/superpowers/specs/2026-05-22-menubar-chart-design.md`
- Heatmap redesign spec: `docs/superpowers/specs/2026-05-24-menubar-heatmap-redesign.md`

**Supersedes** (only the `<DualLineChart>` section of):
- `docs/superpowers/specs/2026-05-22-menubar-chart-design.md` — the
  hand-rolled SVG dual-axis line view is replaced by a Tremor single-line
  chart with a rich hover tooltip. The heatmap, ViewSwitch, MenubarPage
  scaffolding, and Tauri repoint sections of that spec remain in effect.

## Why this slice

Two pain points from the previous slice:

1. **No hover tooltip on the line chart.** The hand-rolled `<DualLineChart>` SVG doesn't expose per-day values on hover — users have no way to read the exact tokens/sessions for a specific day. Adding hover detection + a clamped floating div would work but ~30 LOC of pure-function code we'd then own.
2. **Perceived layout flicker on view toggle.** The popover window is statically sized (`360×300`, `resizable: false`, zero `set_size` calls anywhere) — confirmed by code search — but the *content* height inside the window differs between line and heatmap views by ~10–20px. With `transparent: true` + macOS vibrancy, that internal layout shift triggers a macOS shadow recomposite that reads as window flicker.

This slice fixes both: adopt Tremor `<LineChart>` for tooltip + axis + grid for free; wrap the conditional chart render in a fixed-height container so the footer line is rock-stable across views.

## Out of scope (unchanged from earlier slices)

- True dual-axis line chart (Tremor doesn't support it; deferred — single-line + rich tooltip is the chosen UX)
- Day-detail drill-down on chart-point click (v0.2 with main window)
- Bundle-size optimization (revisit if `@tremor/react` cost becomes painful)
- Sidecar (own slice gated on bun-compile spike)
- Profiles removal (v0.2)
- Release pipeline

## Architecture changes (delta from prior chart specs)

```
packages/ui/
├── package.json                              [MODIFY: add @tremor/react]
├── tailwind.config.mjs                       [MODIFY: register tremor theme slots →
│                                                 DESIGN.md monochrome tokens; extend
│                                                 content array for @tremor/** scan]
└── src/
    ├── components/
    │   └── menubar/
    │       ├── dual-line-chart.tsx           [REWRITE: Tremor single-line + tooltip;
    │       │                                    keep export name and props so
    │       │                                    MenubarPage import is unchanged]
    │       ├── dual-line-chart.test.tsx      [REWRITE: assertion shape changes
    │       │                                    (path elements not polylines)]
    │       └── menubar-page.tsx              [MODIFY: stable-height wrapper around
    │                                            the {line | heatmap} conditional]
    └── components/menubar/menubar-page.test.tsx
                                              [MODIFY: replace polyline assertions
                                                with Recharts-class assertions]
```

The shared `<ContributionGraph>` is **not** touched. `<RecentHeatmap>` is **not** touched. `<ViewSwitch>` is **not** touched. App.tsx is **not** touched. No Rust changes.

## `<DualLineChart>` after the rewrite

**Props (unchanged from current):**
```ts
interface DualLineChartProps {
  tokens: HeatmapPoint[]   // 7 daily points, oldest first
  sessions: HeatmapPoint[] // 7 daily points, used for tooltip enrichment
}
```

**Internals:**
- Renders Tremor `<LineChart>` (`@tremor/react`).
- Data shape transformed inline:
  ```ts
  const chartData = tokens.map(p => ({
    date: p.date,
    tokens: p.value,
  }))
  ```
- Tremor props:
  - `data={chartData}`
  - `index="date"`
  - `categories={['tokens']}` — single visible series
  - `colors={['gray']}` — resolves via Tailwind extension to our monochrome scale (effectively `#f7f8f8` on the line, per the slot mapping below)
  - `showLegend={false}` — categories label is in the popover header instead
  - `showAnimation={false}` — DESIGN.md L115: "No layout animations — instant state changes for clarity"
  - `showGridLines={true}` — horizontal grid only, color picked up from our `border-default` via tremor.border
  - `showXAxis={true}`, `showYAxis={true}` — labels in Berkeley Mono via Tremor's text classes which inherit from our `tremor.content.subtle` mapping
  - `yAxisWidth={36}` — fits 3-tick labels up to "100k"
  - `valueFormatter={formatTokens}` — same `formatTokens` we already have (`100000 → "100k"`, `1500000 → "1.5M"`)
  - `customTooltip={...}` — see below
- Sessions lookup: `const sessionMap = new Map(sessions.map(p => [p.date, p.value]))` for O(1) tooltip enrichment.

**`customTooltip` JSX (matches DESIGN.md L211 heatmap tooltip spec verbatim):**
```tsx
customTooltip={({ payload, label, active }) => {
  if (!active || !payload?.[0]) return null
  const tokensVal = payload[0].value as number
  const sessionsVal = sessionMap.get(label as string) ?? 0
  return (
    <div
      className="rounded border border-[var(--border-default)] bg-[var(--surface-overlay)] px-2 py-1.5 text-[11px] shadow-md"
      style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
    >
      <div className="text-[var(--text-primary)]">
        {sessionsVal} sessions · {formatTokens(tokensVal)} tokens
      </div>
      <div className="text-[10px] text-[var(--text-tertiary)]">
        {longDate(label as string)}
      </div>
    </div>
  )
}}
```

**Container:** the component returns the Tremor chart directly (no extra wrapping card — MenubarPage's stable-height container provides the layout box; the line view inherits the same flush-with-page aesthetic as the heatmap's ghost card).

**Removed (vs prior hand-rolled implementation):**
- `<polyline>` SVG primitives
- Dual-axis math (`niceCeil`, second Y axis)
- Sessions dashed line
- Hover-only legend row
- Manual day-of-week label rendering (Tremor's xAxis handles it)

## Tailwind config extension — Tremor theme → DESIGN.md tokens

Edit `packages/ui/tailwind.config.mjs`:

1. **Content scan** — add Tremor's source so its utility classes get extracted:
   ```js
   content: [
     './index.html',
     './src/**/*.{js,ts,jsx,tsx}',
     './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',  // NEW
   ],
   ```

2. **Theme extend** — map Tremor's color slots to DESIGN.md tokens. Add to `theme.extend.colors`:
   ```js
   tremor: {
     brand: {
       faint:    '#191a1b',   // DESIGN.md L44 — Surface
       muted:    '#28282c',   // L45 — Secondary bg
       subtle:   '#62666d',   // L50 — Quaternary text
       DEFAULT:  '#f7f8f8',   // L47 — Primary text (line color)
       emphasis: '#f7f8f8',
       inverted: '#08090a',   // L42 — Marketing
     },
     background: {
       muted:    '#0f1011',   // L43 — Panel
       subtle:   '#191a1b',   // L44 — Surface
       DEFAULT:  '#08090a',   // L42 — Marketing
       emphasis: '#f7f8f8',
     },
     border: { DEFAULT: 'rgba(255,255,255,0.08)' },  // L53 — border-default
     ring:   { DEFAULT: '#23252a' },                  // L54 — primary solid
     content: {
       subtle:   '#62666d',   // L50 — Quaternary
       DEFAULT:  '#8a8f98',   // L49 — Tertiary
       emphasis: '#d0d6e0',   // L48 — Secondary
       strong:   '#f7f8f8',   // L47 — Primary
       inverted: '#08090a',
     },
   },
   ```

Result: every Tremor primitive (line stroke, grid line, axis tick, tooltip background, etc.) inherits the project's monochrome palette automatically. No chromatic leaks — DESIGN.md L40 ("Pure monochrome — zero chromatic colors") is preserved.

## Stable-height container in `<MenubarPage>`

Wrap the conditional render so both views occupy the same vertical pixel budget:

```tsx
// In MenubarPage, replace the existing conditional block with:
<div className="min-h-[168px]">
  {view === 'line'
    ? <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
    : <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />}
</div>
```

`168px` is the taller of the two views' natural content heights:
- Heatmap: 14px (months row) + 2px gap + 7×16 + 6×3 cells (130px) + ~22px footer = ~168px
- Line chart (Tremor default): ~140px chart + ~24px x-axis labels = ~164px

Setting `min-h-[168px]` means the shorter view (currently the line chart by a few px) gets uniform bottom-padding effect via the parent flex column. The footer line never moves.

## Test changes

**`dual-line-chart.test.tsx`** — Tremor renders Recharts internally; the old hand-rolled assertions (2 polylines, 14 circles, dual-axis ticks, hover-only legend) don't apply. Rewrite to:

```ts
describe('DualLineChart', () => {
  it('renders a Tremor LineChart wrapper', () => {
    const { container } = render(<DualLineChart tokens={mockTokens()} sessions={mockSessions()} />)
    // Recharts injects .recharts-wrapper on its container
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('renders a line path for the tokens series', () => {
    const { container } = render(<DualLineChart tokens={mockTokens()} sessions={mockSessions()} />)
    // Recharts renders the line as a <path class="recharts-curve">
    expect(container.querySelector('path.recharts-curve')).toBeInTheDocument()
  })

  it('handles empty data without crashing', () => {
    const { container } = render(<DualLineChart tokens={[]} sessions={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
```

Tooltip interaction is **not** unit-tested — Recharts mouse events are flaky in jsdom (the SVG positioning calculations rely on `getBBox` which jsdom stubs incompletely). Manual smoke test verifies tooltip behavior.

**`menubar-page.test.tsx`** — two assertion updates. Replace the `polyline`-count checks:

```ts
// BEFORE
expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2)
// AFTER
expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()

// BEFORE
expect(container.querySelectorAll('polyline')).toHaveLength(0)
// AFTER
expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
```

The "renders the DualLineChart in line view" test waits for the `15k` header text (data loaded), then asserts on Recharts wrapper presence — same shape as before, different selector.

## Bundle size impact

Adding `@tremor/react` pulls in:
- `@tremor/react` (~30KB gzipped)
- `recharts` (~45KB gzipped)
- `d3-scale`, `d3-shape`, `d3-array` (~50KB gzipped combined)
- Total: **~125–150KB gzipped**

The desktop bundle today is ~76KB gzipped. New bundle ≈ ~220KB gzipped. Acceptable for a v0.1 menu bar app where the chart is the popover's centerpiece. Tracked as known debt — if perceptible cold-start cost emerges, swap Tremor for direct Recharts (saves ~20–30KB by removing the wrapper layer; Tremor is mostly a styled-component shell over Recharts).

## Decisions log (additions)

| # | Decision | Why |
|---|----------|-----|
| 16 | Adopt Tremor for the line chart | User-requested; Tremor's `customTooltip` + Tailwind-themable styling map cleanly to DESIGN.md; ~30 LOC less than hand-rolled hover tooltip |
| 17 | Single line (tokens only) instead of dual-line | Tremor doesn't support dual-axis (sessions in 1–12 range would render flat against tokens 10k–100k axis). Sessions surfaced per-day via the hover tooltip — simpler visual, no info loss for the hover-able use case |
| 18 | Tailwind theme extension maps Tremor slots → DESIGN.md tokens | Single config touch (~25 LOC) makes every Tremor primitive (line/axis/grid/tooltip) inherit our monochrome palette; no per-chart override boilerplate |
| 19 | Custom tooltip JSX matches Timeline heatmap tooltip spec verbatim | DESIGN.md L211 already specifies the tooltip shape; menubar consistency = both views' tooltips look identical |
| 20 | Stable-height container (`min-h-[168px]`) around conditional view render | Eliminates content-height jitter on view toggle that was triggering macOS shadow recomposite (perceived as window flicker) despite the static Tauri window |
| 21 | Keep `<DualLineChart>` filename and export | MenubarPage's import is unchanged; only the internals swap. Name is misleading post-rewrite (no longer "dual") but renaming = churn in import sites + git history for zero behavioral gain. Rename can happen in a cleanup slice if it bothers anyone |

## Success criteria

1. `pnpm --filter @ohmyc/ui test` — all tests pass (existing 123 + updated dual-line-chart tests + updated menubar-page assertions).
2. `pnpm --filter @ohmyc/ui build` — clean, no type errors.
3. `pnpm --filter @ohmyc/desktop build` — clean.
4. `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml` — clean (no Rust changes).
5. `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml` — 14 tests still pass.
6. `pnpm desktop` boots; clicking the tray icon shows the popover:
   - Line view: monochrome single-line Tremor chart, y-axis ticks Berkeley-Mono-ish (Tremor's default monospace stack), grid lines visible at low contrast
   - Hover any point on the line → 2-line tooltip: `{N} sessions · {tokens}k tokens` / `MMM D, YYYY`
   - Toggle to heatmap → footer line stays at the **exact same y-coordinate** (no shift)
   - Toggle back to line → same
7. Existing Timeline page at `localhost:5173/timeline` renders identically to today (no shared-component changes).
8. No chromatic colors leak into the chart (verify visually: only grays + white on near-black bg).

## File-by-file summary

| File | Action |
|------|--------|
| `packages/ui/package.json` | MODIFY — add `@tremor/react` to dependencies |
| `packages/ui/tailwind.config.mjs` | MODIFY — add `tremor.*` color slots + content path for `@tremor/**` |
| `packages/ui/src/components/menubar/dual-line-chart.tsx` | REWRITE — Tremor `<LineChart>` + customTooltip, single tokens series |
| `packages/ui/src/components/menubar/dual-line-chart.test.tsx` | REWRITE — assert on Recharts wrapper + line path; drop polyline/dot/legend assertions |
| `packages/ui/src/components/menubar/menubar-page.tsx` | MODIFY — wrap conditional render in `<div className="min-h-[168px]">` |
| `packages/ui/src/components/menubar/menubar-page.test.tsx` | MODIFY — swap `polyline` selectors for `.recharts-wrapper` |

No changes to packages/cli, packages/desktop (frontend or Rust), packages/shared, packages/timeline, app.tsx, or any shared `@/components/timeline/*` files.
