# Phase 3a — Chrome & Library Theme Tokenization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded `rgba(255,255,255,...)`, hex colors, and font strings in the app chrome and Library surfaces with CSS variable tokens so they follow the active theme.

**Architecture:** Mechanical find-and-replace using the existing bridged token aliases. The `[data-theme]` legacy derivation block (added in Phase 2's token-bridging fix) already maps `--surface-*`, `--border-*`, `--accent-*` to the per-theme semantic tokens. Components just need to reference these variables instead of hardcoded Monitor-era values.

**Tech Stack:** React 19, Tailwind CSS 3, CSS custom properties.

**Depends on:** Phase 2 complete (theme system + token bridging in place). Timeline already themed by codex.

---

## Token Mapping Table

Apply this mapping consistently across all tasks. When a value isn't in the table, use the closest semantic match.

| Hardcoded pattern | Replacement (Tailwind arbitrary) | Semantic meaning |
|---|---|---|
| `rgba(255,255,255,0.02)` / `bg-white/[0.02]` | `bg-[var(--surface-raised)]` | Card / panel background |
| `rgba(255,255,255,0.03)` / `bg-white/[0.03]` | `bg-[var(--bg-hover)]` | Hover background |
| `rgba(255,255,255,0.04)` / `bg-white/[0.04]` | `bg-[var(--bg-hover)]` | Hover background |
| `bg-white/[0.06]` | `bg-[var(--bg-hover)]` | Selected/active background |
| `bg-white/[0.08]` | `bg-[var(--bg-hover)]` | Strong hover / active |
| `rgba(255,255,255,0.05)` (border) | `border-[var(--border-subtle)]` | Subtle border |
| `rgba(255,255,255,0.08)` (border) | `border-[var(--border-standard)]` | Standard border |
| `rgba(255,255,255,0.12)` / `rgba(255,255,255,0.14)` (hover border) | `border-[var(--border-hover)]` | Hover border |
| `#08090a` | `var(--bg-marketing)` / `bg-[var(--bg-marketing)]` | Page background |
| `#0f1011` | `var(--bg-panel)` / `bg-[var(--bg-panel)]` | Panel background |
| `#191a1b` | `var(--bg-surface)` / `bg-[var(--surface-raised)]` | Surface background |
| `#f7f8f8` | `var(--text-primary)` | Primary text |
| `#d0d6e0` | `var(--text-secondary)` | Secondary text |
| `#8a8f98` | `var(--text-tertiary)` | Tertiary text |
| `#62666d` | `var(--text-quaternary)` | Quaternary text |
| `#22c55e` | `var(--accent-signal)` | Success / signal color |
| `'Berkeley Mono'` font strings | `var(--font-mono)` | Monospace font |
| `rgba(15,16,17,0.72)` (translucent panel) | `color-mix(in srgb, var(--bg-panel) 72%, transparent)` | Translucent vibrancy panel |

---

### Task 1: Tokenize EntityCard

**Files:**
- Modify: `packages/ui/src/components/entity-card.tsx:39-40`

- [ ] **Step 1: Replace card background and border classes**

In `entity-card.tsx`, replace lines 39-40:

Old:
```tsx
        'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-lg',
        'hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]',
```

New:
```tsx
        'bg-[var(--surface-raised)] border border-[var(--border-standard)] rounded-lg',
        'hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
```

- [ ] **Step 2: Verify build** — `cd packages/ui && pnpm build` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/entity-card.tsx
git commit -m ":recycle: refactor(ui): tokenize EntityCard bg/border/hover"
```

---

### Task 2: Tokenize EntityDetail

**Files:**
- Modify: `packages/ui/src/components/entity-detail.tsx`

- [ ] **Step 1: Replace all hardcoded values**

Apply these replacements using the token mapping table:

1. Line 86: `hover:bg-white/[0.03]` → `hover:bg-[var(--bg-hover)]`
2. Line 93: `border-[#22c55e]/20 bg-[#22c55e]/5 ... text-[#22c55e]` → `border-[var(--accent-signal)]/20 bg-[var(--accent-signal)]/5 ... text-[var(--accent-signal)]`
3. Line 101: `bg-white/[0.02]` → `bg-[var(--surface-raised)]`
4. Line 122: `bg-white/[0.04] ... hover:bg-white/[0.08]` → `bg-[var(--bg-hover)] ... hover:bg-[var(--bg-hover)]`
5. Search the rest of the file for any remaining `bg-white/[`, `rgba(255,255,255`, `#08090a`, `#0f1011`, `#191a1b` and replace per the mapping table.

- [ ] **Step 2: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/entity-detail.tsx
git commit -m ":recycle: refactor(ui): tokenize EntityDetail surfaces and success badge"
```

---

### Task 3: Tokenize CommandPalette trigger and palette

**Files:**
- Modify: `packages/ui/src/components/command-palette-trigger.tsx`
- Modify: `packages/ui/src/components/command-palette.tsx:129`

- [ ] **Step 1: Tokenize command-palette-trigger.tsx**

Replace ALL hardcoded values in this file:

- Line 15: `border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]` → `border-[var(--border-standard)] bg-[var(--surface-raised)]`
- Line 17: `hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.14)]` → `hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]`
- Line 22: `text-[#8a8f98]` → `text-[var(--text-tertiary)]`
- Line 23: `text-[#8a8f98]` → `text-[var(--text-tertiary)]`
- Line 27: `text-[#62666d]` → `text-[var(--text-quaternary)]`
- Line 28: `border-[rgba(255,255,255,0.08)]` → `border-[var(--border-standard)]`

- [ ] **Step 2: Tokenize command-palette.tsx selected state**

In `command-palette.tsx`, line 129:
- `data-[selected=true]:bg-[rgba(255,255,255,0.06)]` → `data-[selected=true]:bg-[var(--bg-hover)]`

- [ ] **Step 3: Verify build + tests** — `pnpm build && pnpm test` — Expected: success, 198 pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/command-palette-trigger.tsx packages/ui/src/components/command-palette.tsx
git commit -m ":recycle: refactor(ui): tokenize command palette trigger and selected state"
```

---

### Task 4: Tokenize Navigation Island

**Files:**
- Modify: `packages/ui/src/components/navigation-island.tsx`

This file has ~14 hardcoded rgba values across the collapsed badge, expanded panel, and nav item hover states.

- [ ] **Step 1: Tokenize the translucent panel background**

The island uses `bg-[rgba(15,16,17,0.72)]` for its macOS vibrancy effect. Replace with `color-mix` so it follows the theme while keeping translucency:

- Lines 127, 148: `bg-[rgba(15,16,17,0.72)]` → `bg-[color-mix(in_srgb,var(--bg-panel)_72%,transparent)]`

Note: Tailwind arbitrary value syntax requires underscores instead of spaces. The `color-mix` becomes: `bg-[color-mix(in_srgb,var(--bg-panel)_72%,transparent)]`

- [ ] **Step 2: Tokenize borders and shadows**

- Lines 127, 148: `border-[rgba(255,255,255,0.05)]` → `border-[var(--border-subtle)]`
- Lines 128-129, 149: The `[box-shadow:0_0_0_0.5px_rgba(255,255,255,0.10),...]` shadow stack — replace the `rgba(255,255,255,0.10)` ring with `var(--border-standard)`: `[box-shadow:0_0_0_0.5px_var(--border-standard),0_8px_30px_rgba(0,0,0,0.38),0_24px_60px_rgba(0,0,0,0.22)]`. Keep the black shadow rgba values as-is (they're depth shadows, not theme-colored).

- [ ] **Step 3: Tokenize hover and active states**

- Line 130: `hover:bg-[rgba(255,255,255,0.04)]` → `hover:bg-[var(--bg-hover)]`
- Line 180: `hover:bg-[rgba(255,255,255,0.03)]` → `hover:bg-[var(--bg-hover)]`
- Line 194: `border-[rgba(255,255,255,0.08)]` → `border-[var(--border-standard)]`
- Line 195: `bg-[rgba(255,255,255,0.02)]` → `bg-[var(--surface-raised)]`
- Line 196: `hover:bg-[rgba(255,255,255,0.04)]` → `hover:bg-[var(--bg-hover)]`
- Line 203: `border-[rgba(255,255,255,0.08)]` → `border-[var(--border-standard)]`

- [ ] **Step 4: Search for any remaining hardcoded values in the file**

Use grep to find any remaining `rgba(255,255,255` or `rgba(0,0,0` in the file. Replace border/surface ones per the mapping table. Leave pure black shadow rgba values (`rgba(0,0,0,0.38)` etc.) as-is — they are depth shadows, not theme tokens.

- [ ] **Step 5: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx
git commit -m ":recycle: refactor(ui): tokenize navigation island surfaces and borders"
```

---

### Task 5: Tokenize Explorer shell empty states

**Files:**
- Modify: `packages/ui/src/explorer.tsx`

- [ ] **Step 1: Replace empty-state backgrounds**

Search `explorer.tsx` for all `bg-[rgba(255,255,255,0.02)]` (approximately 5 occurrences around lines 231, 268, 293, 328, 354). Replace each with `bg-[var(--surface-raised)]`.

Also replace any `border-[rgba(255,255,255,0.08)]` → `border-[var(--border-standard)]` and `hover:bg-[rgba(255,255,255,...)]` → `hover:bg-[var(--bg-hover)]`.

- [ ] **Step 2: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/explorer.tsx
git commit -m ":recycle: refactor(ui): tokenize explorer empty-state surfaces"
```

---

### Task 6: Tokenize markdown-editor and source-switcher

**Files:**
- Modify: `packages/ui/src/components/markdown-editor.tsx:30,33,40,43`
- Modify: `packages/ui/src/components/source-switcher.tsx:43-44,54`

- [ ] **Step 1: Tokenize markdown-editor.tsx**

- Line 33: `fontFamily: '"Berkeley Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'` → `fontFamily: 'var(--font-mono)'`
- Line 30: `backgroundColor: '#08090a'` → `backgroundColor: 'var(--bg-marketing)'`
- Line 40: `'#0f1011'` → `'var(--bg-panel)'`
- Line 43: `'#08090a'` → `'var(--bg-marketing)'`

- [ ] **Step 2: Tokenize source-switcher.tsx**

- Search for `rgba(255,255,255,...)` and `#191a1b` values. Replace per mapping table:
  - `bg-[rgba(255,255,255,0.02)]` → `bg-[var(--surface-raised)]`
  - `bg-[rgba(255,255,255,0.04)]` → `bg-[var(--bg-hover)]`
  - `border-[rgba(255,255,255,0.08)]` → `border-[var(--border-standard)]`
  - `bg-[#191a1b]` → `bg-[var(--surface-raised)]`

- [ ] **Step 3: Verify build** — `pnpm build` — Expected: success.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/markdown-editor.tsx packages/ui/src/components/source-switcher.tsx
git commit -m ":recycle: refactor(ui): tokenize markdown-editor font/bg and source-switcher"
```

---

### Task 7: Verify and commit final

- [ ] **Step 1: Run full test suite** — `cd packages/ui && pnpm test` — Expected: 198+ pass.

- [ ] **Step 2: Run production build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Grep audit — verify no remaining offenders in chrome/library files**

```bash
cd packages/ui && grep -rn "rgba(255,255,255" src/components/entity-card.tsx src/components/entity-detail.tsx src/components/command-palette-trigger.tsx src/components/command-palette.tsx src/components/navigation-island.tsx src/explorer.tsx src/components/markdown-editor.tsx src/components/source-switcher.tsx
```

Expected: zero matches (or only inside CSS comments). If any remain, fix and re-commit.

- [ ] **Step 4: Grep for Berkeley Mono in the same files**

```bash
grep -rn "Berkeley Mono" src/components/entity-card.tsx src/components/entity-detail.tsx src/components/markdown-editor.tsx
```

Expected: zero matches.

- [ ] **Step 5: Final commit if any fixes were made**

If the grep audit found remaining issues:
```bash
git add -A && git commit -m ":bug: fix(ui): resolve remaining hardcoded values from audit"
```

Phase 3a complete. The app chrome, Library surfaces, command palette, and navigation island now follow the active theme.
