# Navigation Island Stage Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the click-to-expand navigation island with a hover-to-expand Stage Manager interaction — collapsed keycaps expand on hover with right-edge-into-screen rotation, page blur/dim/scale, and borderless floating nav.

**Architecture:** A shared `MotionValue<number>` (0→1 hover progress) is created in an `IslandHoverProvider` context. The `NavigationIsland` and the route content wrapper both consume it via `useTransform` — no React re-renders for animation. Mouse enter/leave triggers `animate(hoverProgress, target)` imperatively. Touch devices get a click-to-toggle fallback.

**Tech Stack:** React 19, Framer Motion (MotionValue, useTransform, animate), Tailwind CSS 3, CSS custom property tokens.

**Depends on:** Theme system (Phase 2) complete — island uses `--text-*`, `--bg-hover`, `--border-*` tokens.

---

## File Structure

- Create: `packages/ui/src/components/island-hover-context.tsx` — MotionValue provider + `useIslandHover` hook
- Rewrite: `packages/ui/src/components/navigation-island.tsx` — hover-to-expand, borderless keycaps, Stage Manager rotation
- Modify: `packages/ui/src/explorer.tsx` — wrap route content in blur/scale `motion.div`, add dim overlay, mount provider
- Modify: `DESIGN.md` — update Navigation Island section + Decisions Log

---

### Task 1: Create IslandHoverContext

**Files:**
- Create: `packages/ui/src/components/island-hover-context.tsx`

- [ ] **Step 1: Create the context provider**

```tsx
// packages/ui/src/components/island-hover-context.tsx
import { animate, useMotionValue, type MotionValue } from 'framer-motion'
import { createContext, useCallback, useContext, type ReactNode } from 'react'

interface IslandHoverContextValue {
  /** 0 = collapsed, 1 = fully expanded. Drives all Stage Manager effects via useTransform. */
  hoverProgress: MotionValue<number>
  /** Animate to expanded (1) or collapsed (0). Called on mouseenter/mouseleave. */
  setHovered: (hovered: boolean) => void
}

const IslandHoverContext = createContext<IslandHoverContextValue | null>(null)

const EXPAND_DURATION = 0.42
const COLLAPSE_DURATION = 0.36
const EASE = [0.23, 1, 0.32, 1] as const

export function IslandHoverProvider({ children }: { children: ReactNode }) {
  const hoverProgress = useMotionValue(0)

  const setHovered = useCallback((hovered: boolean) => {
    animate(hoverProgress, hovered ? 1 : 0, {
      duration: hovered ? EXPAND_DURATION : COLLAPSE_DURATION,
      ease: EASE,
    })
  }, [hoverProgress])

  return (
    <IslandHoverContext.Provider value={{ hoverProgress, setHovered }}>
      {children}
    </IslandHoverContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIslandHover(): IslandHoverContextValue {
  const ctx = useContext(IslandHoverContext)
  if (!ctx) throw new Error('useIslandHover must be used within IslandHoverProvider')
  return ctx
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd packages/ui && pnpm build 2>&1 | tail -3
```

Expected: builds successfully (no one consumes it yet, so no runtime impact).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/island-hover-context.tsx
git commit -m ":sparkles: feat(ui): add IslandHoverContext provider with MotionValue hover progress"
```

---

### Task 2: Rewrite NavigationIsland with hover-to-expand

**Files:**
- Rewrite: `packages/ui/src/components/navigation-island.tsx`

- [ ] **Step 1: Replace the entire file with the new hover-to-expand island**

```tsx
// packages/ui/src/components/navigation-island.tsx
import { animate, motion, useReducedMotion, useTransform } from 'framer-motion'
import {
  Activity,
  Blocks,
  Bot,
  Code2,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useCommandPalette } from '@/components/command-palette'
import { useIslandHover } from '@/components/island-hover-context'
import { cn } from '@/lib/utils'

import type { LucideIcon } from 'lucide-react'

interface IslandItem {
  keycap: string
  label: string
  to: string
  icon: LucideIcon
}

const SIGNAL_ITEMS: IslandItem[] = [
  { keycap: 'M', label: 'Monitor', to: '/explore/monitor', icon: Code2 },
  { keycap: 'T', label: 'Timeline', to: '/explore/timeline', icon: Activity },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { keycap: 'A', label: 'Agents', to: '/explore/agents', icon: Bot },
  { keycap: 'C', label: 'Commands', to: '/explore/commands', icon: TerminalSquare },
  { keycap: 'S', label: 'Skills', to: '/explore/skills', icon: Sparkles },
  { keycap: 'P', label: 'Plugins', to: '/explore/plugins', icon: Blocks },
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
  const { hoverProgress, setHovered } = useIslandHover()
  const { open: openPalette } = useCommandPalette()
  const hookReduceMotion = useReducedMotion()
  const reduceMotion = hookReduceMotion
    || (typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const [isTouch] = useState(detectTouch)
  const [touchExpanded, setTouchExpanded] = useState(false)

  // Touch: drive hoverProgress from touchExpanded state
  useEffect(() => {
    if (isTouch) {
      animate(hoverProgress, touchExpanded ? 1 : 0, { duration: 0.36, ease: [0.23, 1, 0.32, 1] })
    }
  }, [isTouch, touchExpanded, hoverProgress])

  // Derive visual values from hoverProgress
  const containerWidth = useTransform(hoverProgress, v => `${COLLAPSED_WIDTH + v * (EXPANDED_WIDTH - COLLAPSED_WIDTH)}px`)
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

  // Keyboard: expand on focus within, collapse on focus leave
  function handleFocus() {
    if (!isTouch) setHovered(true)
  }
  function handleBlur() {
    if (!isTouch) setHovered(false)
  }

  function handleNavigate() {
    if (isTouch) setTouchExpanded(false)
  }

  function toggleTouch() {
    setTouchExpanded(prev => !prev)
  }

  return (
    <motion.div
      style={{ width: containerWidth }}
      className="fixed left-[18px] top-[48px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
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
          {/* === Collapsed keycaps (always rendered, crossfaded) === */}
          <motion.div
            style={{ opacity: keycapOpacity, pointerEvents: keycapPointer }}
            className="flex flex-col gap-1 pt-2"
          >
            {ALL_ITEMS.map(item => (
              <button
                key={item.keycap}
                onClick={isTouch ? toggleTouch : undefined}
                className="flex size-11 items-center justify-center rounded-lg font-[var(--font-mono)] text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label={item.label}
              >
                {item.keycap}
              </button>
            ))}
          </motion.div>

          {/* === Expanded nav (always rendered, crossfaded) === */}
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

            <IslandGroup label="Signal" items={SIGNAL_ITEMS} onNavigate={handleNavigate} />
            <IslandGroup label="Explore" items={EXPLORE_ITEMS} className="mt-4" onNavigate={handleNavigate} />

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
  label,
  items,
  className,
  onNavigate,
}: {
  label: string
  items: IslandItem[]
  className?: string
  onNavigate: () => void
}) {
  return (
    <div className={className}>
      <div className="mb-2 px-2 text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
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
            <item.icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles** — `cd packages/ui && pnpm build` — Expected: success. The component won't render yet (no provider), but the types must resolve.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx
git commit -m ":sparkles: feat(ui): rewrite NavigationIsland with hover-to-expand Stage Manager

Borderless keycaps (M T A S C P) expand on hover with rotateY(18deg)
right-edge-into-screen. MotionValue + useTransform drives all visual
effects without React re-renders. Touch fallback: tap to toggle.
Keyboard: focus to expand, blur to collapse."
```

---

### Task 3: Add page blur wrapper + dim overlay + mount provider

**Files:**
- Modify: `packages/ui/src/explorer.tsx:368-395` (the return statement)

- [ ] **Step 1: Add imports to explorer.tsx**

Add these imports at the top of `explorer.tsx`:

```tsx
import { motion, useTransform } from 'framer-motion'

import { IslandHoverProvider, useIslandHover } from './components/island-hover-context'
```

- [ ] **Step 2: Split Explorer into provider wrapper + content consumer**

The current `Explorer` function renders `<NavigationIsland />` and `<main>` directly. We need to split it so the provider wraps a new inner component that can call `useIslandHover()`.

Rename the current `Explorer` function body to `ExplorerContent`, and create a new `Explorer` that wraps it:

At the top of the `Explorer` function (around line 63 where the component starts), the current signature is:

```tsx
export function Explorer({ viewSwitcher }: { viewSwitcher: ReactNode }) {
```

Change it to:

```tsx
export function Explorer({ viewSwitcher }: { viewSwitcher: ReactNode }) {
  return (
    <IslandHoverProvider>
      <ExplorerContent viewSwitcher={viewSwitcher} />
    </IslandHoverProvider>
  )
}

function ExplorerContent({ viewSwitcher }: { viewSwitcher: ReactNode }) {
  const { hoverProgress } = useIslandHover()

  // Stage Manager page effects
  const pageFilter = useTransform(hoverProgress, v => `blur(${v * 8}px) brightness(${1 - v * 0.5})`)
  const pageScale = useTransform(hoverProgress, [0, 1], [1, 0.96])
  const dimBg = useTransform(hoverProgress, v => `rgba(0,0,0,${v * 0.3})`)
```

- [ ] **Step 3: Wrap the main content and add dim overlay**

In the return statement of `ExplorerContent` (currently around line 368), the structure is:

```tsx
  return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />

      <main className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-marketing)]">
        {/* ... content ... */}
      </main>
    </div>
  )
```

Replace it with (keeping all the existing content inside `<main>` unchanged):

```tsx
  return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />

      {/* Stage Manager dim overlay */}
      <motion.div
        style={{ background: dimBg }}
        className="pointer-events-none fixed inset-0 z-30"
      />

      {/* Page content — blurs/scales on island hover */}
      <motion.main
        style={{ filter: pageFilter, scale: pageScale }}
        className="relative h-full min-w-0 origin-center overflow-hidden bg-[var(--bg-marketing)]"
      >
        {/* ... ALL existing main content stays here unchanged ... */}
      </motion.main>
    </div>
  )
```

The only changes are:
1. `<main>` becomes `<motion.main>` with `style={{ filter: pageFilter, scale: pageScale }}`
2. Added `origin-center` to the className for correct scale origin
3. Added the `<motion.div>` dim overlay between island and main

- [ ] **Step 4: Verify build + run dev**

```bash
cd packages/ui && pnpm build 2>&1 | tail -3
```

Expected: success.

```bash
cd packages/ui && pnpm dev
```

Open the dev server. Hover the left-edge keycap area. Confirm:
- Keycaps expand to full nav
- Island rotates right-edge-into-screen
- Page content blurs + dims + scales down
- Mouse leave collapses everything back

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/explorer.tsx
git commit -m ":sparkles: feat(ui): add Stage Manager page blur + dim overlay in Explorer

Route content wrapped in motion.main with filter/scale from
hoverProgress. Dim overlay between island and content. Explorer
split into provider wrapper + content consumer."
```

---

### Task 4: Update DESIGN.md

**Files:**
- Modify: `DESIGN.md` — `### Navigation Island` section + Decisions Log

- [ ] **Step 1: Replace the Navigation Island section**

Find the `### Navigation Island` section in `DESIGN.md` and replace it with:

```markdown
### Navigation Island
- **Shell:** floating, borderless island on the left edge. No panel background, no border, no backdrop-filter. Nav items float directly on the page; the page blur creates visual separation when expanded.
- **Interaction:** hover-to-expand (replaces click-to-expand). Mouse enter triggers expansion; mouse leave collapses. Touch devices: tap keycap to toggle. Keyboard: focus to expand, blur to collapse.
- **Collapsed state:** 56px wide. Shows first-letter keycaps (M T A S C P) in `var(--font-mono)` 14px. Active item has a 3px phosphor dot indicator on the left edge with `box-shadow: 0 0 6px var(--accent-glow)`.
- **Expanded state:** 220px wide. Full nav labels with icons, grouped Signal (Monitor, Timeline) and Explore (Agents, Commands, Skills, Plugins). Command palette trigger at bottom.
- **Stage Manager effect:** on hover, the island rotates `rotateY(18deg)` with `transform-origin: left center` (right edge swings into screen). Page content simultaneously blurs (`blur(8px)`), dims (`brightness(0.5)`), and scales down (`scale(0.96)`). A `rgba(0,0,0,0.3)` dim overlay sits between the island and the content. All effects animate in 420ms ease-out, driven by a shared Framer Motion `MotionValue`.
- **Animation architecture:** a `MotionValue<number>` (0→1 hover progress) is created in `IslandHoverProvider` context. The island and route content consume it via `useTransform` — no React re-renders during animation. Nav items use `variants` with `staggerChildren` for cascade entrance.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables rotation, blur, and scale. Only opacity crossfade remains.
- **Position:** `top: 48px`, `left: 18px` on desktop (clears macOS traffic lights). `top: 14px`, `left: 14px` on narrow screens.
- **No chevron button:** the collapse chevron (`PanelLeftClose`) is removed — hover-to-expand eliminates the need for manual collapse.
```

- [ ] **Step 2: Add Decisions Log row**

Append to the Decisions Log table:

```markdown
| 2026-06-23 | Navigation Island: hover-to-expand Stage Manager replaces click-to-expand | Hover-to-expand is more natural for a floating island. Stage Manager effect (rotateY + page blur) creates depth-of-field focus. Borderless treatment (no panel bg/border) relies on page blur for separation. MotionValue + useTransform drives animation without React re-renders |
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m ":memo: docs(design): update Navigation Island spec for Stage Manager

Replace click-to-expand + vibrancy panel spec with hover-to-expand +
borderless + Stage Manager rotation/blur. Document MotionValue
architecture. Remove chevron button spec. Add Decisions Log row."
```

---

### Task 5: Verification

- [ ] **Step 1: Run tests** — `cd packages/ui && pnpm test` — Expected: 178+ pass. If any test references the old NavigationIsland API (e.g., chevron button, `updateCollapsed`), update the test.

- [ ] **Step 2: Run build** — `pnpm build` — Expected: success.

- [ ] **Step 3: Manual smoke test** — `pnpm dev`:
  1. Hover the left-edge keycap area — island expands, rotates, page blurs
  2. Mouse leave — island collapses back
  3. Click a nav item — navigates correctly
  4. Press ⌘K — command palette opens above the dim overlay
  5. Tab into the island — keyboard expands it
  6. Switch themes via ⌘K — island follows theme colors
  7. Enable `prefers-reduced-motion` (devtools) — rotation/blur disabled, only crossfade

  Stop dev server.

- [ ] **Step 4: Final commit if fixes were made**

```bash
git add -A && git commit -m ":bug: fix(ui): resolve Stage Manager verification issues"
```

If clean, the implementation is complete.
