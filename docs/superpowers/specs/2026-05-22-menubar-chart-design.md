# Menubar Chart Route — Real Line + Heatmap, v0.1 Slice 2

**Date:** 2026-05-22
**Branch:** feat/menubar-chart
**Status:** APPROVED (brainstorming phase)

**Upstream references:**
- Office-hours design (full v0.1 vision):
  `~/.gstack/projects/JiangWeixian-claudeui/jiangwei-develop-design-20260517-201139.md`
- Pixel-level wireframe (the source of truth for visual + interaction):
  `~/.gstack/projects/JiangWeixian-claudeui/designs/menubar-popover-20260517/index.html`
- Previous slice (scaffold): `docs/superpowers/specs/2026-05-18-desktop-scaffold-design.md`

## Purpose

Replace the placeholder `<ContributionGraph>` + zero-data stub in the scaffold
with the real hero chart described in the wireframe: dual-axis line view (last
7 days, tokens + sessions) and a compact heatmap view (last 365 days), connected
by an icon-only view switch in the popover header. Wire the Tauri popover to
load `/menubar` so clicking the tray icon shows the real chart on real data.

This slice implements **Implementation #3** from the office-hours design doc and
a one-line piece of **Implementation #4** (point the Tauri popover at the new
route). Sidecar (#2), onboarding fallback (#6), release pipeline, and v0.2
deferrals remain out of scope.

## Out of scope (later slices)

- Bun-compile sidecar; gated on the bun-compile spike (own slice)
- Quit kills sidecar (lands with the sidecar slice)
- Day-detail drill-down on click (v0.2, requires the main window)
- Empty / onboarding state when `~/.config/ohmyc/timeline.db` is missing
- File-watch live updates (v0.2)
- Profiles removal from the web app (v0.2)
- Release pipeline (`.dmg`, updater, code signing)

## Architecture

```
packages/ui/src/
├── components/
│   ├── menubar/                          [NEW]
│   │   ├── menubar-page.tsx              ← page wrapper, header, view switch, fetch
│   │   ├── dual-line-chart.tsx           ← custom SVG dual-axis line chart
│   │   ├── view-switch.tsx               ← 14×14 icon-only line/heatmap switcher
│   │   ├── menubar-page.test.tsx
│   │   ├── dual-line-chart.test.tsx
│   │   └── view-switch.test.tsx
│   └── timeline/
│       ├── contribution-graph.tsx        [MODIFY: add `compact?: boolean` prop]
│       └── contribution-graph.test.tsx   [ADD or MODIFY: tests for both modes]
└── app.tsx                               [MODIFY: add <Route path="/menubar">]

packages/desktop/src-tauri/
└── tauri.conf.json                       [MODIFY: popover window URL → /menubar]
```

The slice does not touch packages/cli, packages/timeline, or packages/shared.
The CLI's existing Fastify routes (`/api/timeline/heatmap` and friends) and the
existing React Query hooks under `packages/ui/src/hooks/use-timeline.ts` are
sufficient.

## Components

### `<MenubarPage>` — popover content

The page component that lives at `/menubar`. Owns the view state and the data
fetches. Sized to fill the 360×440 popover with no scrollbars.

- View state: `useState<'line' | 'heatmap'>('line')`. Default is line.
- Header layout (top of popover):
  - Left column:
    - **Title row:** `<strong>{tokens.toLocaleString()}k</strong>` plus `· {sessions} sessions` in secondary color. Tokens are formatted with `k` / `M` suffix; sessions are an integer with thousands separator.
    - **Meta row:** monospace caption — `Last 7 days` for line view, `Last 365 days` for heatmap view. Uppercase, `--text-quaternary`.
  - Right column: `<ViewSwitch>` (two 14×14 icon buttons, no background).
- Body: conditional render based on view state:
  - `'line'` → `<DualLineChart tokens={...} sessions={...} />`
  - `'heatmap'` → `<ContributionGraph compact data={tokensYear} year={CURRENT_YEAR} metric="tokens" />`
- Footer meta line (border-top, 11px mono, `--text-tertiary`):
  - Line view: `peak {dayLabel} · {peakValue}k · {peakSessions} sessions`
  - Heatmap view: `{activeDays} active days this month`

The footer is a small "earned moment" of insight — kept minimal and
informational. Both forms compute their values client-side from the same arrays
that feed the charts.

### `<DualLineChart>` — new, hand-rolled SVG

Inputs:
- `tokens: HeatmapPoint[]` — exactly 7 elements, oldest first.
- `sessions: HeatmapPoint[]` — exactly 7 elements, oldest first.

Render:
- 320×140 viewBox, `preserveAspectRatio="none"`, occupies the full chart-wrap.
- Two Y axes (computed from the data on each render):
  - **Left axis (tokens):** ticks at 0, ceil(max/2 to nearest 10k), ceil(max to nearest 10k). Labels rendered as `0`, `50k`, `100k` etc.
  - **Right axis (sessions):** ticks at 0, ceil(max/2 to nearest 2), ceil(max to nearest 2). Labels rendered as integers.
- 3 horizontal dashed grid lines at y = 35 / 70 / 105 (the tick rows).
- Tokens line: `<polyline>` with `stroke=var(--text-primary)`, `stroke-width=1.5`, `fill=none`.
- Sessions line: same polyline shape but `stroke=var(--text-tertiary)`, `stroke-width=1.25`, `stroke-dasharray="3 3"`.
- Tokens dots: 7 `<circle r=2.5 fill=var(--text-primary)>`.
- Sessions dots: 7 `<circle r=2 fill=var(--text-tertiary)>`.
- X-axis labels: 7 day-of-week strings (`Sat Sun Mon Tue Wed Thu Fri` relative to today, e.g. if today is Friday: `Sat Sun Mon Tue Wed Thu Fri`). Rendered as `<text>` at the bottom, 10px Berkeley Mono, `--text-quaternary`, `text-anchor=middle`.

Legend (below the chart, hidden by default per wireframe):
- `<div class="legend-row" style="opacity:0">` containing two spans:
  - `<span class="swatch solid"></span> Tokens · left axis`
  - `<span class="swatch dashed"></span> Sessions · right axis`
- Parent `.chart-wrap` has `:hover .legend-row { opacity: 1 }`. No transition (per DESIGN.md — instant state changes).

Y-axis tick labels are **always visible** (revised from the wireframe's
hover-only y-tick experiment; the final wireframe state keeps ticks on, only
the legend hides).

### `<ViewSwitch>` — new, icon-only two-button switch

Props: `value: 'line' | 'heatmap'`, `onChange: (v) => void`.

Render:
- Two `<button>` elements in a flex row, 2px gap.
- Each button: 22×22 click target, padding 4px, transparent background, no border, border-radius 3px, line-height 0.
- Each contains a 14×14 inline SVG glyph:
  - **Line glyph:** `<path d="M1 11 L4 7 L7 9 L10 4 L13 6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
  - **Grid glyph:** 3×3 grid of 3×3px `<rect>` elements with varying opacity (0.3 / 0.5 / 1.0) to suggest a heatmap intensity.
- Tri-state colors via CSS:
  - Inactive: `color: var(--text-quaternary)`
  - Hover: `color: var(--text-secondary)`
  - Active: `color: var(--text-primary)`
- ARIA: each button has `role="tab"` and `aria-pressed={isActive}` with descriptive `aria-label` (`Line view` / `Heatmap view`).

### `<ContributionGraph compact>` — modify existing

Add one optional prop. Default behavior unchanged so the existing Timeline page
remains visually identical.

```ts
interface ContributionGraphProps {
  year: number
  metric: TimelineMetric
  data: HeatmapPoint[]
  onSelectDay?: (date: string) => void
  compact?: boolean   // NEW — default false
}
```

When `compact === true`:
- Cell size: 6×6 with 2px gap (down from current dimensions).
- Hide month header row (`JAN FEB MAR ...`).
- Hide day-of-week column (`M W F`).
- Hide the "Less / More" intensity legend at the bottom.
- Hide the "Jan 1 → Dec 31, YYYY" range label (already in `<MenubarPage>` header).
- Container width clamps to 360 - 36 = 324px (popover width minus padding).

When `compact === false` (default): no change. Existing Timeline page renders
identically to today.

## Data flow

Reuse `useTimelineHeatmap` from `packages/ui/src/hooks/use-timeline.ts`. It
already accepts `{ from, to, metric, project? }` and returns `HeatmapPoint[]`.

In `<MenubarPage>`:

```tsx
const today = new Date().toISOString().slice(0, 10)
const weekAgo = isoDate(subDays(new Date(), 6))
const yearAgo = isoDate(subDays(new Date(), 364))
const yearStart = `${CURRENT_YEAR}-01-01`
const yearEnd = `${CURRENT_YEAR}-12-31`

const { data: tokensWeek }    = useTimelineHeatmap({ from: weekAgo, to: today, metric: 'tokens' })
const { data: sessionsWeek }  = useTimelineHeatmap({ from: weekAgo, to: today, metric: 'sessions' })
const { data: tokensYear }    = useTimelineHeatmap({ from: yearStart, to: yearEnd, metric: 'tokens' })
const { data: sessionsYear }  = useTimelineHeatmap({ from: yearStart, to: yearEnd, metric: 'sessions' })
```

Three or four React Query keys cache independently. Re-rendering toggling the
view does not refetch (cache holds). The hook's `enabled` option can be used to
defer the year queries until the user toggles to heatmap if first-paint latency
matters; default behavior is to fetch all upfront so the toggle is instant.

**Header totals** are computed by reducing the relevant arrays:
- Line view header: sum `tokensWeek`, count `sessionsWeek`.
- Heatmap view header: sum `tokensYear`, sum `sessionsYear`.

**Footer meta** for line view: scan `tokensWeek` for `Math.max`, find the matching date, look up the same date in `sessionsWeek`.

**Footer meta** for heatmap view: filter `tokensYear` to the current calendar month, count entries with `value > 0`.

## Router

`packages/ui/src/app.tsx` adds one route at the same level as `/timeline`,
`/explore`, `/profiles`:

```tsx
<Route path="/menubar" element={<MenubarPage />} />
```

The `<MenubarPage>` is a chrome-less full-popover layout. It does NOT render
inside the app's normal header/sidebar layout. If the app currently wraps all
routes in a `<Layout>` element, this route needs to bypass it — either by
moving the wrapper inside specific routes, or by branching the layout based on
pathname (`pathname.startsWith('/menubar')` → render children directly).

The exact app.tsx structure will be inspected during implementation and the
minimal correct change applied.

## Tauri popover URL

In dev: the popover should load `http://localhost:1420/menubar`.
In prod (when sidecar lands later): the popover loads `http://localhost:PORT/menubar`.

For this slice, since the sidecar is deferred, we hardcode the dev URL or set
it via `tauri.conf.json` window `url` field if Tauri 2 supports a path suffix
on `devUrl`. If not, the popover URL is set at runtime in `main.rs` using
`WebviewWindowBuilder::new(...).url("http://localhost:1420/menubar")`.

The implementation will pick whichever form Tauri 2's API supports cleanly.
Either way, this is a one-line change.

**Router type:** verify whether the existing app uses `BrowserRouter` or
`HashRouter`. Both work with Tauri's webview, but the URL form differs:
- `BrowserRouter`: `localhost:1420/menubar`
- `HashRouter`: `localhost:1420/#/menubar`

The verification + correct URL choice is the first step of the implementation
task that touches `main.rs` / `tauri.conf.json`.

## Test strategy

**Unit tests (Vitest + React Testing Library, in packages/ui):**

| File | Test surface |
|------|---|
| `view-switch.test.tsx` | click each icon fires `onChange` with correct value; active state aria-pressed; renders both glyphs |
| `dual-line-chart.test.tsx` | renders 2 polylines with 7 points each; renders 14 dots (7 per series); legend is `opacity: 0` by default; legend becomes visible on `:hover` of chart-wrap; Y-axis tick labels render correctly for sample data |
| `menubar-page.test.tsx` | initial state is line view; clicking heatmap switch swaps body; header totals reflect summed data; range label updates per view; loading state renders without crashing; empty data (all zeros) renders without crashing |
| `contribution-graph.test.tsx` | (existing tests still pass); new test: `compact={true}` hides month/day labels and the legend; `compact={false}` (default) shows them; both modes render the cell grid |

**Test data:** stubbed `HeatmapPoint[]` constructed inline in each test. No mocks of React Query — use a `QueryClientProvider` wrapper with hardcoded query data (`queryClient.setQueryData(...)`).

**Manual smoke test (end of slice):**

1. `pnpm dev` from repo root (web app + CLI server)
2. `pnpm --filter @ohmyc/desktop tauri:dev` in a second terminal
3. Verify in web browser at `localhost:5173/menubar`:
   - Real chart renders with real data from `timeline.db`
   - View toggle works (line ↔ heatmap)
   - Header totals update on toggle
   - Hovering the line chart reveals the legend
4. Click the tray icon — popover should now show the real chart (not the scaffold placeholder)

## Error handling

- **`useTimelineHeatmap` returns undefined / loading**: `<MenubarPage>` renders a skeleton (header with `—` for totals, empty chart-wrap). No spinner — instant render with placeholder values.
- **Query error**: render the error text in the chart-wrap area, log to console. No retry button in this slice (React Query auto-retries).
- **Empty data** (no sessions ingested yet): chart renders flat at 0 on both axes. Header shows `0 tokens · 0 sessions`. This is acceptable for v0.1; the real onboarding/empty state with install instructions is its own slice.

## Dependencies

- No new dependencies. Uses existing Vite, React, `@tanstack/react-query`, `@ohmyc/shared`, `@ohmyc/timeline`.
- The CLI's `/api/timeline/heatmap` route already serves the required shape.
- `packages/timeline`'s `getHeatmap` query function already aggregates by day for the requested metric.

## Decisions log

| # | Decision | Why |
|---|----------|-----|
| 1 | Hand-rolled SVG for `<DualLineChart>`, not Tremor or Recharts | Tremor has no dual-axis support (hard blocker), Recharts adds 50KB and fights DESIGN.md monochrome. Wireframe is 50 LOC of SVG. |
| 2 | Reuse `<ContributionGraph>` with new `compact` prop, not a new component | Single shared heatmap component, minimal surface, existing Timeline page untouched. |
| 3 | Two `useTimelineHeatmap` calls per view (tokens + sessions), four total | Existing hook signature accepts one metric per call. React Query caches each; toggle is instant. |
| 4 | Tauri repoint in this slice (Slice B from D1), no sidecar | Sidecar gates on the bun-compile spike (its own slice). The Vite dev server is sufficient to validate this slice end-to-end. |
| 5 | Y-axis tick labels always visible; only legend is hover-only | Wireframe's final iteration kept ticks on; only the line-identity legend hides at rest. |
| 6 | No day-detail drill-down on click | Office-hours design defers this to v0.2 with the main window. |

## Success criteria

This slice is done when:

1. `pnpm --filter @ohmyc/ui test` passes with all new tests (≥3 in view-switch, ≥4 in dual-line-chart, ≥5 in menubar-page, ≥2 new in contribution-graph).
2. `pnpm --filter @ohmyc/ui build` passes (no type errors).
3. `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml` still passes.
4. `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml` still passes (14 tests, no change).
5. Opening `http://localhost:5173/menubar` in a browser renders the real chart with real data from `~/.config/ohmyc/timeline.db`.
6. Clicking the tray icon in `pnpm tauri:dev` opens a popover containing the same real chart (verified manually).
7. View toggle (line ↔ heatmap) works instantly, no refetch on toggle.
8. Hovering the line chart reveals the legend; hovering elsewhere does not.
9. No regressions on the existing Timeline page (`localhost:5173/timeline`) — `<ContributionGraph>` without the `compact` prop renders identically to today.
