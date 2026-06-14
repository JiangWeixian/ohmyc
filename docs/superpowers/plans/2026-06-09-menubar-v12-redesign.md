# Menubar v12 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the menubar popover so the chart is the lead visual, three mono KPI numbers (Tokens / Sessions / Peak) sit below it, header collapses to a single `ACTIVITY` mono title + icon switch, footer collapses to one row, and the chart fills the popover content area exactly with zero dead space (popover bumps from 360 → 367, horizontal padding from 18 → 24).

**Architecture:** Single-file refactor of `menubar-page.tsx` (header, KPI row, footer all change). `RecentHeatmap` and `ViewSwitch` are untouched — they already match the spec. `DualLineChart` is untouched; the gradient backdrop lives on the chart-slot wrapper in `menubar-page.tsx` so the heatmap (ghost variant) doesn't inherit it. One config change in `tauri.conf.json` for window dimensions.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Recharts (existing chart), Vitest + React Testing Library, Tauri 2 (popover window).

**Spec:** [`~/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/approved.json`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/approved.json)

## Visual references

Before touching code, open the wireframe HTML for the screen you're implementing. The HTML is the source of truth for spacing, type, color, and layout — DESIGN.md tokens are honored throughout. All paths absolute.

| Wireframe | Why open it |
|---|---|
| [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) | **Approved final.** Both line and heatmap modes side-by-side at 367×? with 24px horizontal padding. Reference for every task. |
| [`wireframe-v7.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v7.html) | Earlier iteration — same `ACTIVITY` title and KPI layout, useful when you need to see the icon switch + ghost heatmap relationship in isolation (no padding-tweak distractions). |
| [`wireframe-v6.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v6.html) | Reference for the type swap rationale (mono `ACTIVITY` title + mono hero numbers). Includes prose notes on why both moved to Berkeley Mono. |

Open these in a browser (`open <path>` on macOS) and keep them in a second window while writing each task. The wireframes are deliberately rendered at popover scale so visual proportions match.

---

## File map

**Modify:**
- `packages/desktop/src-tauri/tauri.conf.json` — popover `width` 360 → 367, `height` 300 → 340 (taller popover needed because KPI row + footer rule add ~36px of vertical content)
- `packages/ui/src/components/menubar/menubar-page.tsx` — header rewrite, add KPI row, collapse footer, swap gradient location, bump horizontal padding
- `packages/ui/tests/components/menubar/menubar-page.test.tsx` — replace assertions for old header strings with assertions for new structure (Activity title, KPI labels, peak-only footer)

**Untouched:**
- `packages/ui/src/components/menubar/dual-line-chart.tsx`
- `packages/ui/src/components/menubar/recent-heatmap.tsx`
- `packages/ui/src/components/menubar/view-switch.tsx`

---

## Task 1: Bump popover window dimensions

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json:14-27`

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — note the popover's narrow horizontal footprint (367px) and the breathing room around the chart edges.

- [ ] **Step 1: Open the file and update width + height**

Edit lines 18–19. Current:

```json
        "label": "popover",
        "title": "OhMyC",
        "width": 360,
        "height": 300,
```

After:

```json
        "label": "popover",
        "title": "OhMyC",
        "width": 367,
        "height": 340,
```

Width math: chart natural width 319px + horizontal padding 24px × 2 = 367. Height math: top-pad 18 + header 28 + mb-3 12 + chart slot 168 + mt-3.5 14 + KPI row 36 + mt-3.5 14 + pt-3 12 + footer 16 + bottom-pad 18 = 336, rounded up to 340.

- [ ] **Step 2: Verify the Rust crate still compiles**

Run: `cargo check --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: success, no diagnostics related to `tauri.conf.json`.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/tauri.conf.json
git commit -m "chore(desktop): bump menubar popover to 367x340 for v12 layout"
```

---

## Task 2: Replace header — drop 2-line stat block, add `Activity` mono title

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx:89-105`
- Test: `packages/ui/tests/components/menubar/menubar-page.test.tsx:72-83`

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) (top-head row in both popovers) and [`wireframe-v6.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v6.html) for the prose rationale on why `ACTIVITY` moved to Berkeley Mono uppercase.

- [ ] **Step 1: Update the existing test assertions first (they will fail)**

Open `packages/ui/tests/components/menubar/menubar-page.test.tsx`. Replace the first three tests (lines 72–92):

```ts
  it('renders the ACTIVITY mono title in the header', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    const title = await screen.findByText(/^Activity$/i)
    expect(title).toBeInTheDocument()
    expect(title.tagName.toLowerCase()).toBe('span')
  })

  it('keeps the ACTIVITY title after switching to heatmap view', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    await screen.findByText(/^Activity$/i)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    await userEvent.click(heatmapBtn)
    expect(await screen.findByText(/^Activity$/i)).toBeInTheDocument()
  })
```

(The third test about `header totals after data loads` becomes obsolete here — totals move into the KPI row covered by Task 4's test.)

- [ ] **Step 2: Run the suite to confirm tests fail before implementation**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: FAIL — `findByText(/^Activity$/i)` not found, and the deleted assertions for `/Last 16 weeks/i` / `/tokens · 5 sessions/i` no longer exist.

- [ ] **Step 3: Replace the header JSX**

In `packages/ui/src/components/menubar/menubar-page.tsx`, locate lines 89–105 (the `<header>...</header>` block). Replace with:

```tsx
      <header className="flex items-center justify-between gap-3 mb-3">
        <span
          className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]"
          style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
        >
          Activity
        </span>
        <ViewSwitch value={view} onChange={setView} />
      </header>
```

Note: `headerTokens`, `headerSessions`, and `rangeLabel` are still computed at the top of the function. They're consumed by Task 4 (KPI row), so don't delete them yet.

- [ ] **Step 4: Run tests, confirm the two new assertions pass**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: the two new `Activity` tests pass. Other tests (line/heatmap toggle, recharts, footer, Open button) still pass because they don't depend on the header.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx \
        packages/ui/tests/components/menubar/menubar-page.test.tsx
git commit -m "feat(menubar): replace 2-line stat header with ACTIVITY mono title"
```

---

## Task 3: Move gradient backdrop onto the chart slot (line mode only)

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx:107-115`

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — flip between the Line and Heatmap popovers and notice the line side has a subtle vertical gradient backdrop fading top→bottom (`rgba(255,255,255,0.02) → 0`) while the heatmap side has no backdrop at all.

The gradient currently lives on the chart's container only if `DualLineChart` defines it (it doesn't — current spec called for a gradient on the LINE chart slot, not the heatmap). Move/add it on the slot wrapper so it's mode-aware.

- [ ] **Step 1: Update the chart slot wrapper**

In `packages/ui/src/components/menubar/menubar-page.tsx`, replace lines 107–115 (the `<div className="min-h-[168px]">...</div>` block) with:

```tsx
      <div
        className="min-h-[168px] overflow-hidden"
        style={view === 'line'
          ? { background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.0) 100%)' }
          : undefined}
      >
        {view === 'line'
          ? (
              <DualLineChart tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )
          : (
              <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )}
      </div>
```

- [ ] **Step 2: Run tests, confirm no regression**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: PASS. The chart slot still renders the right component per view; the inline style doesn't break the existing recharts/heatmap assertions.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx
git commit -m "feat(menubar): gradient backdrop on chart slot in line mode only"
```

---

## Task 4: Add KPI row (Tokens / Sessions / Peak) below the chart

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx` (after the chart slot, before the old footer)
- Test: `packages/ui/tests/components/menubar/menubar-page.test.tsx` (add new test)

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — `.kpis` block sits below the chart slot in both popovers. Each cell: 22px mono number top, 10px mono uppercase label bottom, 1px `border-subtle` left rule between cells.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('MenubarPage', ...)` block in `packages/ui/tests/components/menubar/menubar-page.test.tsx`:

```ts
  it('renders the three KPI cells with mono labels and values', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })

    // Wait for data to load (the Tokens value is the sum: 10000 + 5000 = 15000 → "15k")
    expect(await screen.findByText(/^15k$/i)).toBeInTheDocument()
    expect(await screen.findByText(/^Tokens$/i)).toBeInTheDocument()

    // Sessions sum: 3 + 2 = 5
    expect(await screen.findByText(/^5$/)).toBeInTheDocument()
    expect(await screen.findByText(/^Sessions$/i)).toBeInTheDocument()

    // Peak day token value: max(10000, 5000) = 10000 → "10k"
    expect(await screen.findByText(/^10k$/i)).toBeInTheDocument()
    expect(await screen.findByText(/^Peak$/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: FAIL — `Tokens` / `Sessions` / `Peak` labels not in DOM.

- [ ] **Step 3: Add the KPI row JSX**

In `packages/ui/src/components/menubar/menubar-page.tsx`, add this block **between** the chart slot `<div>` and the footer `<div className="mt-2.5 pt-2 border-t...">` block (i.e. after the closing `</div>` of the chart slot):

```tsx
      {/* KPI row — three mono numbers with hairline dividers */}
      <div className="flex mt-3.5">
        <div className="flex flex-1 flex-col gap-1 pr-3.5">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            {formatTokens(headerTokens)}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            Tokens
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 pl-3.5 pr-3.5 border-l border-[var(--border-subtle)]">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            {headerSessions.toLocaleString()}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            Sessions
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 pl-3.5 border-l border-[var(--border-subtle)]">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            {peak ? formatTokens(peak.value) : '—'}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            Peak
          </span>
        </div>
      </div>
```

- [ ] **Step 4: Run tests to confirm the KPI assertions pass**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: PASS — all three labels and all three numbers found.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx \
        packages/ui/tests/components/menubar/menubar-page.test.tsx
git commit -m "feat(menubar): add three-KPI row (Tokens / Sessions / Peak) under chart"
```

---

## Task 5: Collapse 2-row footer into a single row

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx:117-137` (the two existing footer divs)
- Test: `packages/ui/tests/components/menubar/menubar-page.test.tsx` (update peak-meta test)

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — `.vb-foot` block at the bottom of both popovers: hairline rule above, `peak <date>` mono micro on the left, `Open OhMyC →` link on the right, both vertically centered.

- [ ] **Step 1: Update the peak-meta test to match new format**

In `packages/ui/tests/components/menubar/menubar-page.test.tsx`, locate the test starting `it('renders the footer meta line with peak day for line view', ...)` (lines 110–119) and replace its body:

```ts
  it('renders the footer with peak-day eyebrow and Open OhMyC link on one row', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    // New footer: `peak {DOW MMM D}` (mono uppercase micro) on left,
    // Open OhMyC link on right. Peak token value + session count moved
    // into the KPI row (covered by the "three KPI cells" test).
    const footer = await screen.findByText(/^peak /i)
    expect(footer.textContent).toMatch(/peak/i)
    // Footer no longer carries the tokens or session count strings:
    expect(footer.textContent).not.toMatch(/sessions/i)
    expect(footer.textContent).not.toMatch(/10k/)
  })
```

- [ ] **Step 2: Run to confirm the assertion changes are wired**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: FAIL — the current footer string includes `· 10k · 3 sessions` so the negative assertions fail.

- [ ] **Step 3: Update `footerMeta` to date-only**

In `packages/ui/src/components/menubar/menubar-page.tsx`, locate lines 70–76 and replace with:

```tsx
  // Footer: peak day only — peak token value and session count are now
  // surfaced in the KPI row above.
  const peakMeta = peak
    ? `peak ${shortDayLabel(peak.date)}`
    : 'no activity yet'
```

Also delete the now-unused `peakSessionCount` constant (lines 71–73 of the old code).

- [ ] **Step 4: Replace the two footer divs with one**

In the same file, locate the two trailing `<div>` blocks (the `mt-2.5 pt-2 border-t...` meta block and the `mt-2 flex justify-end` button block — lines 117–137). Replace BOTH with a single block:

```tsx
      {/* Footer — peak-day eyebrow + Open link on one row */}
      <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
          style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
        >
          {peakMeta}
        </span>
        <button
          type="button"
          onClick={async () => {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('open_main_window')
            await invoke('hide_popover')
          }}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
        >
          Open OhMyC →
        </button>
      </div>
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: PASS — footer matches `/^peak /i`, no `sessions` or `10k` in the same node, Open button still callable.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx \
        packages/ui/tests/components/menubar/menubar-page.test.tsx
git commit -m "feat(menubar): collapse footer into single row (peak meta + Open link)"
```

---

## Task 6: Bump horizontal padding 18 → 24

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx:78-87` (root div className)

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — the breathing room between the chart's left edge and the popover's left rounded corner is the 24px to deliver.

- [ ] **Step 1: Update the root div's className**

In `packages/ui/src/components/menubar/menubar-page.tsx`, locate the root `<div>` (lines 78–87). Change the `p-[18px]` class to `py-[18px] px-6` (24px horizontal). Resulting opening tag:

```tsx
    <div
      className="min-h-dvh w-full py-[18px] px-6 text-[var(--text-primary)] overflow-hidden rounded-[12px]"
      style={{
        // macOS NSVisualEffectView (HudWindow) provides the desktop-blur;
        // light dark tint sits on top to ensure text contrast against
        // bright desktop content.
        background: 'rgba(25, 26, 27, 0.45)',
      }}
      data-menubar-page
    >
```

- [ ] **Step 2: Run tests to confirm no regression**

Run: `pnpm --filter @ohmyc/ui test menubar-page`
Expected: PASS — padding change is visual-only, no behavioral test affected.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx
git commit -m "feat(menubar): bump horizontal padding 18 → 24 to fit chart width"
```

---

## Task 7: Visual smoke test

**Files:** (none — verification only)

**Reference:** [`wireframe-v12-padding-24.html`](file:///Volumes/ORICO/Users/jiangwei/.gstack/projects/JiangWeixian-claudeui/designs/menubar-chart-20260608/wireframe-v12-padding-24.html) — keep this open in a browser next to the running app and compare side-by-side. The live popover should match the wireframe's proportions, spacing, and typography down to the pixel.

- [ ] **Step 1: Run the full test suite for the UI package**

Run: `pnpm --filter @ohmyc/ui test`
Expected: all menubar tests green. No regression in other test files.

- [ ] **Step 2: Build the desktop app for dev**

Run: `pnpm desktop`
Expected: Tauri dev server starts; `cargo` compiles; popover window opens at 367×340.

- [ ] **Step 3: Visually verify both modes in the popover**

In the running app, click the tray icon to open the popover. Confirm:

- Top: `ACTIVITY` in mono uppercase (left) + two icon buttons (right, line+heatmap)
- Chart slot fills the content area edge-to-edge with no right-side gap; gradient backdrop visible only in line mode
- Three KPI cells below the chart (Tokens / Sessions / Peak) with mono numbers and hairline dividers
- Single-row footer at bottom: `peak <date>` left, `Open OhMyC →` right
- Click the heatmap icon: switches to heatmap, gradient backdrop disappears, KPI numbers stay
- Click `Open OhMyC →`: main window opens, popover hides

If any item fails, capture the gap (e.g. "KPI dividers too dark," "popover height clips footer") and add a follow-up task. Otherwise, this slice is shipped.

- [ ] **Step 4: No commit (verification only)**

If everything passed, the prior 6 commits constitute the shipped feature. If you found a visual bug worth fixing, open a new task with the exact diff before committing further.

---

## Self-review notes

Walked the spec → plan after drafting:

| Spec requirement | Plan task |
|---|---|
| Popover 367×?, hpad 24 | Task 1 (window) + Task 6 (padding) |
| `ACTIVITY` mono title + ViewSwitch | Task 2 |
| Line gradient backdrop, heatmap ghost | Task 3 |
| Three mono KPIs (Tokens / Sessions / Peak) | Task 4 |
| Single-row footer (peak + Open) | Task 5 |
| `RecentHeatmap` unchanged | (untouched — confirmed in file map) |
| `ViewSwitch` unchanged | (untouched — confirmed in file map) |
| `DualLineChart` unchanged | (untouched — confirmed in file map; gradient lives on the slot wrapper) |
| Existing test suite still passes | Test edits in Tasks 2, 4, 5 |

No placeholders. Identifiers consistent across tasks (`headerTokens`, `headerSessions`, `peak`, `peakMeta`, `formatTokens`, `shortDayLabel`). File paths are absolute repo-relative. Code blocks are complete (full JSX for every changed block).
