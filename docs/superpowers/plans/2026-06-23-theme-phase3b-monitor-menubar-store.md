# Phase 3b — Monitor, Menubar & Store Theme Tokenization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded colors and font strings in the Monitor route DOM layer, Menubar popover, Store editors, and CodeMirror theme so they follow the active theme.

**Architecture:** Same mechanical approach as Plan 3a — replace hardcoded `rgba`/hex/font values with the bridged CSS variable tokens. Monitor WebGL scene (Three.js material colors) is largely deferred — 3D material colors are scene constants, not theme tokens. Focus on the DOM chrome around the WebGL stage.

**Tech Stack:** React 19, R3F/Drei, CodeMirror 6, Tailwind CSS 3.

**Depends on:** Phase 3a complete (token mapping established). Can run independently if needed.

**Token mapping:** Same table as Plan 3a. Key additions for this plan:

| Pattern | Replacement | Notes |
|---|---|---|
| `font-['Geist','Inter_var'...]` | `font-[var(--font-display)]` | Monitor spike views |
| CodeMirror `EditorView.theme()` rgba strings | `var(--surface-raised)` etc. | CodeMirror accepts CSS var() strings |
| `rgba(25,26,27,...)` (menubar popover) | `color-mix(in srgb, var(--bg-panel) 45%, transparent)` | Translucent popover |

---

### Task 1: Tokenize Monitor DOM layer

**Files:**
- Modify: `packages/ui/src/components/monitor/monitor-view.tsx`
- Modify: `packages/ui/src/components/monitor/lanyard-stage.tsx:59`

- [ ] **Step 1: Tokenize monitor-view.tsx**

Read the file. Replace:
- `radial-gradient(...rgba(255,255,255,0.08)...)` and `rgba(255,255,255,0.05)` grid lines → replace white-rgba with `var(--border-standard)` and `var(--border-subtle)` respectively
- Any `#08090a` → `var(--bg-marketing)`
- Any `rgba(255,255,255,0.08)` in the grid background → `var(--border-standard)`

- [ ] **Step 2: Tokenize lanyard-stage.tsx**

Line 59: `bg-[#f7f8f8] text-[#08090a]` → `bg-[var(--text-primary)] text-[var(--bg-marketing)]` (inverted branded card)

- [ ] **Step 3: Tokenize monitor-spike font references**

In `monitor-spike/monitor-spike-view.tsx` and `monitor-spike/lanyard-stats-spike-view.tsx`:
- `font-['Geist','Inter_var','Inter',sans-serif]` → `font-[var(--font-display)]`
- `bg-[#08090a]` → `bg-[var(--bg-marketing)]`
- `rgba(255,255,255,0.08/0.16/0.10)` → `var(--border-standard)` / `var(--border-hover)` per mapping
- `rgba(15,16,17,0.72)` → `color-mix(in srgb, var(--bg-panel) 72%, transparent)` (or Tailwind: `color-mix(in_srgb,var(--bg-panel)_72%,transparent)`)

Leave Three.js `meshBasicMaterial color="#..."` and `emissive="#..."` values as-is — these are 3D scene constants, not themeable surface tokens.

- [ ] **Step 4: Verify build** — `cd packages/ui && pnpm build` — Expected: success.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/monitor/ packages/ui/src/components/monitor-spike/
git commit -m ":recycle: refactor(ui): tokenize Monitor DOM layer and spike fonts"
```

---

### Task 2: Tokenize Menubar popover and heatmap

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/recent-heatmap.tsx`

- [ ] **Step 1: Tokenize menubar-page.tsx**

- Line 87: `background: 'rgba(25, 26, 27, 0.45)'` → `background: 'color-mix(in srgb, var(--bg-panel) 45%, transparent)'`
- Line 105: `linear-gradient(180deg, rgba(255,255,255,0.02)...)` → `linear-gradient(180deg, var(--surface-raised)...)`
- Any remaining `rgba(255,255,255,...)` → per mapping table

- [ ] **Step 2: Tokenize recent-heatmap.tsx**

- Line 272: `background: '#08090a'` (tooltip) → `background: 'var(--bg-marketing)'`
- Line 278: `boxShadow: '0 4px 12px rgba(0,0,0,0.5)'` → `boxShadow: 'var(--shadow-md)'`
- Line 232: `borderRadius: 2` (heat cells) → `borderRadius: 'var(--heatmap-cell-radius, 0.125rem)'`
- Line 256: `width: 9, height: 9, borderRadius: 1` (legend swatch) → convert to rem: `width: '0.5625rem', height: '0.5625rem', borderRadius: 'var(--heatmap-cell-radius, 0.125rem)'`
- Lines 153-155: `gridTemplateRows: '14px auto'`, `rowGap: '2px'` → `'0.875rem auto'`, `'0.125rem'`

- [ ] **Step 3: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/menubar/
git commit -m ":recycle: refactor(ui): tokenize menubar popover and heatmap tooltip"
```

---

### Task 3: Tokenize Store editors

**Files:**
- Modify: `packages/ui/src/components/store/store-component-editor.tsx`
- Modify: `packages/ui/src/components/store/store-component-list.tsx`

These files have ~34 combined `rgba(255,255,255,...)` occurrences plus hex colors. This is a mechanical pass.

- [ ] **Step 1: Tokenize store-component-editor.tsx**

Search the file for every `rgba(255,255,255` and `#` hex color. Apply the token mapping table:
- All `rgba(255,255,255,0.02)` → `var(--surface-raised)`
- All `rgba(255,255,255,0.04)` → `var(--bg-hover)`
- All `rgba(255,255,255,0.08)` → `var(--border-standard)` (if border context) or `var(--bg-hover)` (if bg context)
- `#0f1011` → `var(--bg-panel)`
- `#08090a` → `var(--bg-marketing)`
- `#22c55e` → `var(--accent-signal)`
- `rgba(247,248,248,0.12)` → `var(--text-primary)` with appropriate opacity handling
- `rgba(0,0,0,0.25)` → keep as shadow or use `var(--shadow-xs)`

- [ ] **Step 2: Tokenize store-component-list.tsx**

Same mechanical pass for ~12 `rgba(255,255,255,...)` values.

- [ ] **Step 3: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/store/
git commit -m ":recycle: refactor(ui): tokenize store editor and list surfaces"
```

---

### Task 4: Tokenize CodeMirror theme

**Files:**
- Modify: `packages/ui/src/components/codemirror-container-theme.ts`

CodeMirror's `EditorView.theme()` accepts CSS string values, so `var(--*)` references work.

- [ ] **Step 1: Replace hardcoded colors**

Search for all `'#191a1b'`, `'#0f1011'`, `'#08090a'`, and `rgba(255,255,255,...)` values. Replace per mapping table:
- `'#191a1b'` → `'var(--surface-raised)'`
- `'#0f1011'` → `'var(--bg-panel)'`
- `'#08090a'` → `'var(--bg-marketing)'`
- `rgba(255,255,255,0.06)` (code bg) → `'var(--surface-raised)'`
- `rgba(255,255,255,0.08)` → `'var(--border-standard)'`

- [ ] **Step 2: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/codemirror-container-theme.ts
git commit -m ":recycle: refactor(ui): tokenize CodeMirror theme colors"
```

---

### Task 5: Full verification

- [ ] **Step 1: Run test suite** — `cd packages/ui && pnpm test` — Expected: 198+ pass.

- [ ] **Step 2: Run production build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Comprehensive grep audit**

```bash
cd packages/ui && grep -rn "rgba(255,255,255" src/components/ src/explorer.tsx src/app.tsx --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test." | grep -v ".stories."
```

Review remaining matches. Acceptable residuals:
- Three.js material colors in `monitor-spike/` (`color="#..."`)
- Black shadow rgba (`rgba(0,0,0,...)`) in box-shadow stacks
- Comment references

If non-acceptable residuals remain, fix them.

- [ ] **Step 4: Final commit if fixes were made**

```bash
git add -A && git commit -m ":bug: fix(ui): resolve remaining hardcoded values from Phase 3 audit"
```

Phase 3b complete. All remaining surfaces — Monitor DOM, Menubar, Store editors, CodeMirror — now follow the active theme. Combined with Phase 3a, the entire app is theme-aware.

---

## What's intentionally deferred

- **Three.js WebGL material colors** (`meshBasicMaterial color="..."`, `emissive="..."`) — these are 3D scene constants. Themed WebGL is a future enhancement.
- **`uitripled/native-dialog.tsx`** — shadcn-origin dialog primitives with `dark:` prefix patterns. These already work via the `darkMode: ['class', '[data-theme]']` Tailwind config.
- **Timeline residual values** (5 stragglers noted in audit) — minor; can be swept in a future polish pass.
