# Navigation Island Stage Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the click-to-expand navigation island with a hover-to-expand Stage Manager interaction — collapsed keycaps expand on hover with right-edge-into-screen rotation, page blur/dim/scale, and borderless floating nav.

**Architecture:** A zustand store holds both a discrete `isHovered` boolean (triggers re-renders for DOM/aria changes) and a `hoverProgress` MotionValue (drives continuous animation via `useTransform` without re-renders). `setHovered` updates the boolean AND animates the MotionValue. No Context provider needed — zustand is global.

**Tech Stack:** React 19, zustand 5, Framer Motion (motionValue, useTransform, animate), Tailwind CSS 3.

**Depends on:** Theme system (Phase 2) complete.

---

## File Structure

- Create: `packages/ui/src/state/island-store.ts` — zustand store with `isHovered` + `hoverProgress` MotionValue
- Rewrite: `packages/ui/src/components/navigation-island.tsx` — hover-to-expand, borderless keycaps, rotation
- Modify: `packages/ui/src/explorer.tsx` — wrap route content in blur/scale `motion.main`, add dim overlay
- Modify: `DESIGN.md` — update Navigation Island section + Decisions Log

---

### Task 1: Create island store (zustand + MotionValue)

**Files:**
- Create: `packages/ui/src/state/island-store.ts`

- [ ] **Step 1: Create the zustand store**

```ts
// packages/ui/src/state/island-store.ts
// Zustand store for navigation island hover state.
// isHovered: discrete boolean (triggers re-renders for DOM/aria — low frequency).
// hoverProgress: MotionValue 0→1 (drives continuous animation — 60fps, no re-renders).
// setHovered updates both: zustand state for discrete consumers, MotionValue for animation.
import { animate, motionValue, type MotionValue } from 'framer-motion'
import { create } from 'zustand'

interface IslandState {
  isHovered: boolean
  hoverProgress: MotionValue<number>
  setHovered: (hovered: boolean) => void
  toggle: () => void
}

export const useIslandStore = create<IslandState>((set, get) => ({
  isHovered: false,
  hoverProgress: motionValue(0),
  setHovered: (hovered) => {
    set({ isHovered: hovered })
    animate(get().hoverProgress, hovered ? 1 : 0, {
      duration: hovered ? 0.42 : 0.36,
      ease: [0.23, 1, 0.32, 1],
    })
  },
  toggle: () => get().setHovered(!get().isHovered),
}))
```

- [ ] **Step 2: Verify it compiles** — `cd packages/ui && pnpm build 2>&1 | tail -3` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/state/island-store.ts
git commit -m ":sparkles: feat(ui): add island zustand store with MotionValue hover progress"
```

---

### Task 2: Rewrite NavigationIsland with hover-to-expand

**Files:**
- Rewrite: `packages/ui/src/components/navigation-island.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
// packages/ui/src/components/navigation-island.tsx
import { motion, useReducedMotion, useTransform } from 'framer-motion'
import {
  Activity, Blocks, Bot, Code2, Search, Sparkles, TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useCommandPalette } from '@/components/command-palette'
import { useIslandStore } from '@/state/island-store'
import { cn } from '@/lib/utils'

import type { LucideIcon } from 'lucide-react'

interface IslandItem {
  keycap: string
  label: string
  to: string
}

const SIGNAL_ITEMS: IslandItem[] = [
  { keycap: 'M', label: 'Monitor', to: '/explore/monitor' },
  { keycap: 'T', label: 'Timeline', to: '/explore/timeline' },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { keycap: 'A', label: 'Agents', to: '/explore/agents' },
  { keycap: 'C', label: 'Commands', to: '/explore/commands' },
  { keycap: 'S', label: 'Skills', to: '/explore/skills' },
  { keycap: 'P', label: 'Plugins', to: '/explore/plugins' },
]

const ALL_ITEMS = [...SIGNAL_ITEMS, ...EXPLORE_ITEMS]

const COLLAPSED_WIDTH = 56
const EXPANDED_WIDTH = 220
const ROTATION_DEG = 18

function detectTouch(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false
  return globalThis.matchMedia('(hover: none)').matches
}

export function NavigationIsland() {
  const { hoverProgress, isHovered, setHovered, toggle } = useIslandStore()
  const { open: openPalette } = useCommandPalette()
  const hookReduceMotion = useReducedMotion()
  const reduceMotion = hookReduceMotion
    || (typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const [isTouch] = useState(detectTouch)

  // Derive visual values from hoverProgress MotionValue (no re-renders)
  const containerWidth = useTransform(
    hoverProgress,
    v => `${COLLAPSED_WIDTH + v * (EXPANDED_WIDTH - COLLAPSED_WIDTH)}px`,
  )
  const rotateY = useTransform(hoverProgress, [0, 1], [0, ROTATION_DEG])
  const keycapOpacity = useTransform(hoverProgress, [0, 0.35], [1, 0])
  const keycapPointer = useTransform(keycapOpacity, v => (v < 0.5 ? 'none' : 'auto'))
  const navOpacity = useTransform(hoverProgress, [0.25, 1], [0, 1])
  const navX = useTransform(hoverProgress, [0.25, 1], [-8, 0])
  const navPointer = useTransform(navOpacity, v => (v > 0.5 ? 'auto' : 'none'))

  function handleMouseEnter() {
    if (!isTouch && !reduceMotion) setHovered(true)
  }

  function handleMouseLeave() {
    if (!isTouch && !reduceMotion) setHovered(false)
  }

  function handleNavigate() {
    if (isTouch) setHovered(false)
  }

  const ICON_MAP: Record<string, LucideIcon> = {
    M: Code2, T: Activity, A: Bot, C: TerminalSquare, S: Sparkles, P: Blocks,
  }

  return (
    <motion.div
      style={{ width: containerWidth }}
      className="fixed left-[18px] top-[48px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => { if (!isTouch) setHovered(true) }}
      onBlur={() => { if (!isTouch) setHovered(false) }}
    >
      <div style={{ perspective: 1200 }}>
        <motion.div
          style={{
            rotateY: reduceMotion ? 0 : rotateY,
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
          }}
          className="flex h-[calc(100dvh-66px)] max-sm:h-[calc(100dvh-28px)] flex-col overflow-hidden"
        >
          {/* Collapsed keycaps (crossfaded) */}
          <motion.div
            style={{ opacity: keycapOpacity, pointerEvents: keycapPointer }}
            className="flex flex-col gap-1 pt-2"
          >
            {ALL_ITEMS.map(item => (
              <button
                key={item.keycap}
                onClick={isTouch ? toggle : undefined}
                className={cn(
                  'flex size-11 items-center justify-center rounded-lg font-mono text-sm font-medium',
                  'text-[var(--text-tertiary)] transition-colors',
                  'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                )}
                aria-label={item.label}
                aria-expanded={isHovered}
              >
                {item.keycap}
              </button>
            ))}
          </motion.div>

          {/* Expanded nav (crossfaded) */}
          <motion.div
            style={{ opacity: navOpacity, x: navX, pointerEvents: navPointer }}
            className="absolute inset-0 flex flex-col p-3"
          >
            <div className="mb-5 px-1">
              <div className="truncate text-[14px] font-[590] text-[var(--text-primary)]">OhMyC</div>
              <div className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                coding monitor
              </div>
            </div>

            <IslandGroup label="Signal" items={SIGNAL_ITEMS} icons={ICON_MAP} onNavigate={handleNavigate} />
            <IslandGroup label="Explore" items={EXPLORE_ITEMS} icons={ICON_MAP} className="mt-4" onNavigate={handleNavigate} />

            <button
              type="button"
              onClick={openPalette}
              className={cn(
                'mt-auto flex h-8 w-full items-center justify-between rounded-md border border-[var(--border-standard)]',
                'bg-[var(--surface-raised)] px-2.5 text-[12px] text-[var(--text-tertiary)]',
                'transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]',
              )}
            >
              <span className="flex items-center gap-2">
                <Search size={13} aria-hidden="true" />
                Command
              </span>
              <kbd className="rounded border border-[var(--border-standard)] px-1.5 py-0.5 text-[10px] text-[var(--text-quaternary)]">
                Cmd K
              </kbd>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function IslandGroup({
  label, items, icons, className, onNavigate,
}: {
  label: string
  items: IslandItem[]
  icons: Record<string, LucideIcon>
  className?: string
  onNavigate: () => void
}) {
  return (
    <div className={className}>
      <div className="mb-2 px-2 text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map(item => {
          const Icon = icons[item.keycap]
          return (
            <NavLink
              key={item.keycap}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-[510] transition-colors',
                  isActive
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-[inset_0_0_0_0.5px_var(--border-standard)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                )
              }
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build** — `cd packages/ui && pnpm build` — Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx
git commit -m ":sparkles: feat(ui): rewrite NavigationIsland with hover-to-expand Stage Manager"
```

---

### Task 3: Add page blur + dim overlay in Explorer

**Files:**
- Modify: `packages/ui/src/explorer.tsx`

- [ ] **Step 1: Add imports**

At the top of `explorer.tsx`, add:

```tsx
import { motion, useTransform } from 'framer-motion'
import { useIslandStore } from '@/state/island-store'
```

- [ ] **Step 2: Read the current Explorer return statement**

Read `explorer.tsx` lines 368-395 to see the current return structure:

```tsx
return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />
      <main className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-marketing)]">
        {/* ... existing content ... */}
      </main>
    </div>
  )
```

- [ ] **Step 3: Add hoverProgress hooks before the return**

Inside the `Explorer` function, right before the `return` statement, add:

```tsx
  const hoverProgress = useIslandStore(s => s.hoverProgress)
  const pageFilter = useTransform(hoverProgress, v => `blur(${v * 8}px) brightness(${1 - v * 0.5})`)
  const pageScale = useTransform(hoverProgress, [0, 1], [1, 0.96])
  const dimBg = useTransform(hoverProgress, v => `rgba(0,0,0,${v * 0.3})`)
```

- [ ] **Step 4: Replace the return wrapper**

Change `<NavigationIsland />` + `<main>` to add dim overlay and motion wrapper. The existing `<main>` content stays unchanged — only the opening tag changes and the dim overlay is inserted:

Old opening:
```tsx
      <NavigationIsland />

      <main className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-marketing)]">
```

New:
```tsx
      <NavigationIsland />

      <motion.div
        style={{ background: dimBg }}
        className="pointer-events-none fixed inset-0 z-30"
      />

      <motion.main
        style={{ filter: pageFilter, scale: pageScale }}
        className="relative h-full min-w-0 origin-center overflow-hidden bg-[var(--bg-marketing)]"
      >
```

And the closing `</main>` becomes `</motion.main>`. The dim overlay `<motion.div>` is self-closing.

- [ ] **Step 5: Verify build + dev**

```bash
cd packages/ui && pnpm build 2>&1 | tail -3
```

```bash
cd packages/ui && pnpm dev
```

Hover the left keycap area — confirm island expands + rotates, page blurs + dims. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/explorer.tsx
git commit -m ":sparkles: feat(ui): add Stage Manager page blur + dim overlay in Explorer"
```

---

### Task 4: Update DESIGN.md

**Files:**
- Modify: `DESIGN.md` — `### Navigation Island` section + Decisions Log

- [ ] **Step 1: Replace the Navigation Island section**

Find `### Navigation Island` in DESIGN.md and replace with:

```markdown
### Navigation Island
- **Shell:** floating, borderless island on the left edge. No panel background, no border, no backdrop-filter. Nav items float directly on the page; the page blur creates visual separation when expanded.
- **Interaction:** hover-to-expand. Mouse enter triggers expansion; mouse leave collapses. Touch devices: tap keycap to toggle. Keyboard: focus to expand, blur to collapse.
- **Collapsed state:** 56px wide. First-letter keycaps (M T A S C P) in `var(--font-mono)` 14px. Active item has a 3px phosphor dot on the left edge.
- **Expanded state:** 220px wide. Full nav with icons, grouped Signal (Monitor, Timeline) and Explore (Agents, Commands, Skills, Plugins). Command palette trigger at bottom.
- **Stage Manager effect:** on hover, island rotates `rotateY(18deg)` with `transform-origin: left center`. Page content blurs (`blur(8px)`), dims (`brightness(0.5)`), scales down (`scale(0.96)`). A `rgba(0,0,0,0.3)` dim overlay sits between island and content. All effects animate 420ms ease-out.
- **State management:** zustand store holds `isHovered` (boolean, discrete) + `hoverProgress` (Framer Motion `MotionValue<number>`, continuous 0→1). `setHovered` updates both. `useTransform` derives all visual values from `hoverProgress` without React re-renders.
- **Reduced motion:** disables rotation, blur, scale. Only opacity crossfade remains.
- **No chevron button** — hover-to-expand eliminates manual collapse.
```

- [ ] **Step 2: Add Decisions Log row**

```markdown
| 2026-06-23 | Navigation Island: hover-to-expand Stage Manager replaces click-to-expand | Hover more natural for floating island. zustand + MotionValue: zustand manages discrete isHovered, MotionValue drives continuous animation via useTransform (no re-renders). Borderless — page blur creates separation |
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m ":memo: docs(design): update Navigation Island spec for Stage Manager"
```

---

### Task 5: Verification

- [ ] **Step 1: Run tests** — `cd packages/ui && pnpm test` — Expected: pass. If any test references the old NavigationIsland API, update it.

- [ ] **Step 2: Run build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Manual smoke test** — `pnpm dev`:
  1. Hover keycap area → island expands + rotates, page blurs
  2. Mouse leave → collapses
  3. Click nav item → navigates
  4. ⌘K → command palette opens above dim overlay
  5. Tab into island → keyboard expands
  6. Switch themes → island follows theme
  7. `prefers-reduced-motion` → rotation/blur disabled, crossfade only

  Stop dev server.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git add -A && git commit -m ":bug: fix(ui): resolve Stage Manager verification issues"
```
