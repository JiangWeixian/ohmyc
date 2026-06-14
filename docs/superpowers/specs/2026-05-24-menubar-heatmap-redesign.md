# Menubar Heatmap — Redesign as Dedicated Component (v0.1 Slice 2.5)

**Date:** 2026-05-24
**Branch:** feat/menubar-chart
**Status:** APPROVED (brainstorming phase)

**Supersedes** (only the heatmap portion of):
- `docs/superpowers/specs/2026-05-22-menubar-chart-design.md` — Sections "ContributionGraph compact" and "Heatmap view" only. Line-view design (DualLineChart, ViewSwitch, MenubarPage scaffolding) from the 05-22 spec is **unchanged** and remains in effect.

**Upstream references:**
- Pixel-level wireframe (updated for this redesign — source of truth for visual + interaction):
  `~/.gstack/projects/JiangWeixian-claudeui/designs/menubar-popover-20260517/index.html`
- Office-hours design (full v0.1 vision):
  `~/.gstack/projects/JiangWeixian-claudeui/jiangwei-develop-design-20260517-201139.md`
- Scaffold slice: `docs/superpowers/specs/2026-05-18-desktop-scaffold-design.md`
- Original chart slice: `docs/superpowers/specs/2026-05-22-menubar-chart-design.md`

## Why this redesign

The original 05-22 spec reused the shared `<ContributionGraph>` component with a new `compact?: boolean` prop, rendering 53 weeks × 7 days in a 360px popover. Real-app testing revealed three issues:

1. **Cells too small to mouse-target.** Even with compact mode (4×4 cells + 1px gap), individual cells were impossible to hover precisely — defeating the planned drill-down tooltip.
2. **Shared component coupling.** Adding a `compact` prop to `<ContributionGraph>` to serve menubar-specific layout concerns created risk of breaking the existing Timeline page on every future menubar adjustment.
3. **Visible empty space.** The 53-column grid centered in the 360px popover left visible margins, and the chart card chrome (background + border) drew attention to the unused width.

The redesign: a new dedicated `<RecentHeatmap>` component, narrower scope (16 weeks rolling), comfortable cells (fixed 16×16 + 3px gap), ghost card (no bg/border), all four chrome elements from the Timeline page replicated, and a 2-line hover tooltip.

## Out of scope (unchanged from 05-22 spec)

- Bun-compile sidecar
- Quit kills sidecar
- Day-detail drill-down on click (v0.2)
- Empty / onboarding state when `timeline.db` is missing
- File-watch live updates (v0.2)
- Profiles removal (v0.2)
- Release pipeline

## Architecture changes (delta from 05-22 spec)

```
packages/ui/src/
├── components/
│   ├── menubar/
│   │   ├── recent-heatmap.tsx           [NEW]
│   │   ├── recent-heatmap.test.tsx      [NEW]
│   │   ├── menubar-page.tsx             [MODIFY: render RecentHeatmap not
│   │   │                                    ContributionGraph; fetch rolling
│   │   │                                    16-week range; add footer meta]
│   │   ├── menubar-page.test.tsx        [MODIFY: assert RecentHeatmap
│   │   │                                    present in heatmap view]
│   │   ├── dual-line-chart.tsx          [unchanged]
│   │   ├── view-switch.tsx              [unchanged]
│   │   ├── dual-line-chart.test.tsx     [unchanged]
│   │   └── view-switch.test.tsx         [unchanged]
│   └── timeline/
│       ├── contribution-graph.tsx       [REVERT: drop compact prop and the
│       │                                    {!compact && ...} conditionals;
│       │                                    restore CELL_SIZE=10, CELL_GAP=4;
│       │                                    drop data-heat-cell and
│       │                                    data-month-label attributes]
│       └── contribution-graph.test.tsx  [DELETE: covered only compact mode]
└── app.tsx                               [unchanged from 05-22]

packages/desktop/
├── src-tauri/tauri.conf.json             [unchanged from 05-22 (height=300)]
└── src/menubar.tsx                       [unchanged from 05-22]
```

## `<RecentHeatmap>` component spec

**Props:**
```ts
interface RecentHeatmapProps {
  /** 16 weeks × 7 days = 112 daily aggregates, oldest first. */
  tokens: HeatmapPoint[]
  /** Same shape as tokens, used by hover tooltip for the secondary metric. */
  sessions: HeatmapPoint[]
}
```

Both arrays come from `useTimelineHeatmapRange` calls in `<MenubarPage>` (one with `metric: 'tokens'`, one with `metric: 'sessions'`, both with `from: 16 weeks ago`, `to: today`).

**Grid layout:**
- 16 columns × 7 rows, fixed **16×16 px cells**, **3px gap**
- Total grid: 16×16 + 15×3 = **301 px wide**, 7×16 + 6×3 = **130 px tall**
- Plus DOW labels column (14px + 4px col-gap = 18px to the left of cells)
- Plus month labels row (~14px above cells)
- Total heatmap-body: ~319×148 px
- Fits the popover's 324px content area with ~2.5px margin each side (visually flush)

**Cell intensity:** 5 luminance buckets (level 0 → 4), using the same bucketing logic that exists in `contribution-graph.tsx`:
```ts
function bucketFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0
  const ratio = value / max
  if (ratio <= 0.15) return 1
  if (ratio <= 0.4) return 2
  if (ratio <= 0.7) return 3
  return 4
}
```
Copy this function locally into `recent-heatmap.tsx` (10 lines). Don't introduce a shared util for one extra consumer.

**Colors** (5 luminance steps mirroring the wireframe's monochrome scale):
- Level 0: `rgba(255,255,255,0.04)`
- Level 1: `rgba(255,255,255,0.10)`
- Level 2: `rgba(255,255,255,0.22)`
- Level 3: `rgba(255,255,255,0.45)`
- Level 4: `rgba(255,255,255,0.72)`
- (Wireframe shows a 6th level at `0.92` only in the "More" legend swatches; cells use 5 levels.)

**Chrome (all four elements):**
1. **Month labels (top row):** for each week-column where the first day's month is new, render the uppercase 3-char month name at that column position, spanning **2 columns** wide (clamped to remaining grid width). Font: Berkeley Mono 9px, `--text-quaternary`, letter-spacing 0.04em.
2. **DOW labels (left column):** 14px wide column of M / W / F (with empty rows for Sun, Tue, Thu, Sat). Font: Berkeley Mono 9px, `--text-quaternary`. **Left-aligned** within the column (justify-items: start) so they sit flush with the popover content edge.
3. **Range label (footer-left):** `MMM D → MMM D, YYYY` for the rolling 16-week window. Berkeley Mono 10px, `--text-quaternary`.
4. **Less / More legend (footer-right):** `Less ▢▢▢▢▢▢ More` with 6 9×9px swatches showing all luminance levels including the More-extreme `0.92`. Berkeley Mono 10px, `--text-quaternary`.

**Card chrome:** the `<RecentHeatmap>` is wrapped in a **ghost** version of `chart-wrap` (transparent background, no border, only 4px top padding). Defined in MenubarPage's CSS or as a `.chart-wrap.ghost` variant — the heatmap grid floats directly on the popover surface with no extra rectangle.

**Hover tooltip (2 lines):**
- Triggered on `mouseover` of any cell
- Positioned absolutely, anchored above the cell (4–6px gap above)
- Background `#08090a`, 1px border `var(--border-default)`, 4px radius, 2-layer shadow `0 4px 12px rgba(0,0,0,0.5)`
- Two lines:
  - Line 1 (metrics, `--text-primary`): `{N sessions} · {tokens} tokens` — sessions count from the `sessions` prop indexed by date, tokens formatted via the same `formatTokens` helper used elsewhere (`412k`, `1.2M`, etc.)
  - Line 2 (date, `--text-tertiary`, 10px): `MMM D, YYYY` — e.g. `May 14, 2026`
- Hides on `mouseleave` of the grid

**Subtle hover outline on cells:**
- On hover: `outline: 1px solid var(--text-tertiary); outline-offset: 1px;`
- No transition (per DESIGN.md: instant state changes)

**Empty data:** if `tokens` or `sessions` is empty, render all 112 cells at level 0. No special skeleton. The header and footer chrome still renders normally.

## `<MenubarPage>` changes

The 05-22 spec's MenubarPage is mostly correct — only the heatmap branch changes.

**1. Data fetch (heatmap branch):** change year-scoped to rolling 16-week window.

```tsx
// Replace:
const yearStartIso = `${CURRENT_YEAR}-01-01`
const yearEndIso = `${CURRENT_YEAR}-12-31`
const tokensYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'tokens' })
const sessionsYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'sessions' })

// With:
const fourMonthAgoIso = isoDate(subDays(today, 16 * 7 - 1))  // 16 weeks rolling
const tokensRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'tokens' })
const sessionsRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'sessions' })
```

**2. Body render:** swap `<ContributionGraph compact>` for `<RecentHeatmap>`.

```tsx
{view === 'line' ? (
  <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
) : (
  <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
)}
```

**3. Header range label:** `Last 16 weeks` for heatmap view (not `Last 365 days`).

**4. Header totals (heatmap view):** reduce from yearTotals to recentTotals (16-week aggregates).

**5. Footer meta line (NEW — was deferred in 05-22 spec, now in scope):**
Add a footer below the chart card, border-top, 11px Berkeley Mono, `--text-tertiary`:
- Line view: `peak {DOW MMM D} · {peakTokens}k · {peakSessions} sessions` (compute from `tokensWeek` argmax)
- Heatmap view: `peak {DOW MMM D} · {peakTokens}k · {peakSessions} sessions` (compute from `tokensRecent` argmax — same shape, different range)

The footer line is what fills the slight vertical asymmetry between the line and heatmap views (line view ~140px chart, heatmap view ~130px grid + chrome).

## `<ContributionGraph>` revert

Restore `packages/ui/src/components/timeline/contribution-graph.tsx` to its pre-Task-2 state:
- Remove `compact?: boolean` from `ContributionGraphProps`
- Remove `compact = false` destructure from function args
- Restore unconditional `const CELL_SIZE = 10` and `const CELL_GAP = 4`
- Remove all `{!compact && (...)}` wrappers around month labels, DOW labels, and "Less / More" legend
- Remove `data-heat-cell` and `data-month-label` attributes (added as test hooks for the compact tests)

Delete `packages/ui/src/components/timeline/contribution-graph.test.tsx` — every test in it asserts the `compact` prop behavior, which no longer exists. The Timeline page is the only consumer and there were no tests for it before the 05-22 slice; not adding any now (out of scope for this slice).

**Verification:** open `localhost:5173/timeline` after the revert — the contribution graph should render visually identically to its pre-slice state.

## Tests

**`recent-heatmap.test.tsx`** (~4 tests):

| Test | Assertion |
|------|---|
| renders correct grid shape | `container.querySelectorAll('[data-heat-cell]').length === 16 * 7` (112) |
| renders all four chrome elements | month labels container present, DOW labels (`M`, `W`, `F`) present, range label container present, Less/More legend container present |
| applies intensity buckets correctly | cells with `value > max * 0.7` get the highest opacity bucket; cells with `value === 0` get level 0 |
| handles empty data | renders 112 cells all at level 0 without crashing |

Hover tooltip behavior is **not** unit-tested (Tooltip positioning in jsdom is unreliable — covered by manual smoke test).

**`menubar-page.test.tsx`** (existing tests, with one update):

- Existing tests for default view, header totals, view toggle, polyline presence/absence remain.
- One new test: assert `RecentHeatmap` is rendered in heatmap view via `data-heat-cell` count or container query (replaces any assertion that mentioned `ContributionGraph` indirectly).

**`contribution-graph.test.tsx`:** DELETE (every test was for the compact prop being removed).

## Decisions log (additions to the 05-22 decisions)

| # | Decision | Why |
|---|----------|-----|
| 7 | New `<RecentHeatmap>` instead of `<ContributionGraph compact>` | Avoids shared-component coupling. The compact prop's only consumer is the menubar; isolating it keeps Timeline page's component clean. |
| 8 | Range cut from 53 weeks → 16 weeks rolling | Mouse-targetable cells (16×16) at this width force fewer cells. 16 weeks = ~4 months — meaningful "recent" scope, comfortable cell size, month labels fit without overlap. |
| 9 | Fixed cell sizing (16×16, 3px gap), not `1fr` + `aspect-ratio` | Deterministic; never overflows container. The `1fr` + `aspect-ratio` combination interacted badly with the parent grid and caused cells to leak outside the popover. |
| 10 | Ghost card variant for the heatmap (no bg / border / padding) | Removes visible "extra rectangle" chrome around an already-compact grid. The grid floats on the popover surface. The line view keeps the standard card chrome. |
| 11 | All four Timeline chrome elements replicated (month labels top, DOW left, range bottom-left, Less/More bottom-right) | Per explicit user request — these provide the spatial-orientation cues that make a heatmap readable. |
| 12 | Two-line hover tooltip with both metrics | Cell intensity shows tokens only; tooltip surfaces sessions too. Both metrics already fetched for the header totals — no extra query cost. |
| 13 | Left-align (flex-start) heatmap-body instead of center | Aligns DOW column + range label with the popover header text, so the left edge of all popover content is consistent. |
| 14 | DOW labels left-aligned in their column (justify-items: start) | Makes the M / W / F letters sit flush with the popover content edge instead of indented to the right side of the 14px column. |
| 15 | Footer meta line added in this slice (was deferred in 05-22) | Visual asymmetry between line and heatmap views needs a balanced height; the footer meta is the spec-blessed answer that doubles as user-facing insight. |

## Success criteria

1. `pnpm --filter @ohmyc/ui test` passes (existing 24 tests + 4 new in `recent-heatmap.test.tsx`; `contribution-graph.test.tsx` is deleted).
2. `pnpm --filter @ohmyc/ui build` passes (no type errors).
3. `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml` still passes (no Rust changes in this slice).
4. `pnpm desktop` boots; clicking the tray icon shows the popover with real chart data:
   - Line view default — dual-axis chart, 7 days, hover-only legend
   - Heatmap view (clicking the grid icon) — 16 weeks × 7 days at 16×16 cells, ghost card, all four chrome elements visible, hover any cell for the 2-line tooltip
   - View toggle is instant (cache hit on already-fetched data)
5. Existing Timeline page at `localhost:5173/timeline` renders **identically to its pre-slice state** (compact prop revert verified visually).
6. No regression: the 14 Rust unit tests still pass.

## File-by-file summary

| File | Action |
|------|--------|
| `packages/ui/src/components/menubar/recent-heatmap.tsx` | NEW |
| `packages/ui/src/components/menubar/recent-heatmap.test.tsx` | NEW |
| `packages/ui/src/components/menubar/menubar-page.tsx` | MODIFY (3 changes: data fetch, body render, footer meta) |
| `packages/ui/src/components/menubar/menubar-page.test.tsx` | MODIFY (one assertion update) |
| `packages/ui/src/components/timeline/contribution-graph.tsx` | REVERT to pre-Task-2 state |
| `packages/ui/src/components/timeline/contribution-graph.test.tsx` | DELETE |

No changes to packages/cli, packages/desktop, packages/shared, packages/timeline, or app.tsx.
