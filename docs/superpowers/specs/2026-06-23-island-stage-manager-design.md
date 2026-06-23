# Navigation Island Stage Manager Design

> **Status:** Approved design, pending implementation plan.
> **Date:** 2026-06-23
> **Branch:** `hotfix/geek-design`
> **Reference prototype:** `.superpowers/brainstorm/83382-1782215878/content/island-stage-manager-v2.html`

## Context

The current navigation island (`packages/ui/src/components/navigation-island.tsx`) uses a click-to-expand pattern with a translucent macOS-vibrancy panel. The user wants to replace it with a **hover-to-expand** interaction inspired by macOS Stage Manager: hovering the collapsed keycap island triggers a coordinated animation where the island expands and rotates while the page content behind it blurs and dims, creating a depth-of-field effect that focuses attention on the island.

Design principles retained from the `floating-collapse-a-phosphor-mono.html` variant: borderless (no panel background), collapsed state shows first-letter keycaps.

## Goal

Replace the click-to-expand navigation island with a hover-to-expand Stage Manager interaction: collapsed keycaps on the left edge, hover triggers expansion + rotation + page defocus, mouse leave collapses back.

## Interaction Model

| State | Trigger | Visual |
|---|---|---|
| **Collapsed (default)** | First paint / mouse leave | 56px wide, borderless, first-letter keycaps (M T A S C P), active item has phosphor dot indicator |
| **Hover-expanded** | Mouse enters island zone | Island expands to 220px, keycaps fade out, full nav fades in, island rotates `rotateY(18deg)` right-edge-into-screen, page content blurs + dims + scales down |
| **Transitioning** | mouseenter / mouseleave | Shell expand/collapse 420ms ease-out; nav content delayed 100ms then 200ms fade; page blur 400ms sync |

The chevron collapse button (`PanelLeftClose`) is removed — hover-to-expand eliminates the need for a manual collapse trigger.

## Stage Manager Effects

| Effect | Value | Element |
|---|---|---|
| Island rotation | `rotateY(18deg)`, `transform-origin: left center` | Island shell |
| Island width | 56px to 220px | Island zone container |
| Page blur | `blur(0px)` to `blur(8px)` | Route content wrapper |
| Page brightness | `1` to `0.5` | Route content wrapper |
| Page scale | `1` to `0.96` | Route content wrapper |
| Dim overlay | `rgba(0,0,0,0)` to `rgba(0,0,0,0.3)` | Fixed overlay div |
| Keycap fade | opacity 1 to 0 (200ms) | Keycap list |
| Nav fade | opacity 0 to 1, translateX(-8px) to 0 (200ms, +100ms delay) | Expanded nav content |

All values are global constants — they do not vary per theme.

## Borderless Treatment

Both collapsed and expanded states have **no panel background, no border, no backdrop-filter**. Navigation items float directly on the page. When expanded, the page blur behind the island creates natural visual separation — no panel chrome needed. Nav item hover states (`bg-hover`, `border-standard`) provide interactive feedback.

This replaces the current translucent `color-mix(in srgb, var(--bg-panel) 72%, transparent)` + `backdrop-filter: blur(24px)` panel treatment entirely.

## Keycap Design

- Collapsed shows first letters: **M**onitor / **T**imeline / **A**gents / **C**ommands / **S**kills / **P**lugins
- Font: `var(--font-mono)`, 14px, weight 500
- Inactive: `text-tertiary`
- Hover: `bg-hover` background + `border-standard` inset shadow
- Active: `text-primary` + 3px phosphor dot on the left edge with `box-shadow: 0 0 6px var(--accent-glow)`

## Framer Motion Architecture

The hover state is shared between the island (left side) and the route content (right side). These are siblings in different parts of the component tree. The optimal Framer Motion pattern uses **MotionValue + Context** to avoid React re-renders and prop drilling.

### Hover progress as a MotionValue

```
IslandHoverContext
  └── hoverProgress: MotionValue<number>  (0 = collapsed, 1 = expanded)
      ├── animate(hoverProgress, 1)  on mouseenter
      └── animate(hoverProgress, 0)  on mouseleave
```

The `hoverProgress` MotionValue is created once in a provider and consumed by descendants via `useTransform`. React state (`useState`) is used only for the discrete collapsed/expanded boolean that controls `AnimatePresence` (which nav DOM to render) — the continuous animation values (rotation, blur, scale, opacity) all derive from the MotionValue without triggering re-renders.

### Consumer derivations

| Consumer | Derivation | Framer Motion API |
|---|---|---|
| Island rotation | `useTransform(hoverProgress, [0, 1], [0, 18])` → `rotateY` | `style={{ rotateY }}` |
| Page blur | `useTransform(hoverProgress, [0, 1], ['blur(0px)', 'blur(8px)'])` | `style={{ filter: pageBlur }}` |
| Page scale | `useTransform(hoverProgress, [0, 1], [1, 0.96])` | `style={{ scale: pageScale }}` |
| Page brightness | `useTransform(hoverProgress, [0, 1], [1, 0.5])` | `style={{ filter: pageBrightness }}` |
| Dim overlay | `useTransform(hoverProgress, [0, 1], [0, 0.3])` → background alpha | `style={{ background: dimBg }}` |
| Keycap opacity | `useTransform(hoverProgress, [0, 0.4], [1, 0])` | `style={{ opacity: keycapOpacity }}` |
| Nav opacity | `useTransform(hoverProgress, [0.3, 1], [0, 1])` | `style={{ opacity: navOpacity }}` |

### Nav item stagger

Expanded nav items use `variants` with `staggerChildren` so they cascade in slightly rather than appearing all at once:

```tsx
const navContainerVariants = {
  collapsed: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
  expanded: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
}
```

The `variants` propagate is driven by the collapsed boolean (React state), not the MotionValue — `variants` animate discrete states, while the MotionValue handles the continuous visual effects.

### Width animation

The island zone width (56px to 220px) uses Framer Motion's `layout` prop (as the current code already does) or a CSS `width` transition on the container. The `layout` approach is preferred because it handles the shared-element morph cleanly with `layoutId`.

## Component Structure

```
IslandHoverProvider (app.tsx or explorer.tsx)
├── hoverProgress: MotionValue<number>     ← shared via context
├── collapsed: boolean                      ← React state, discrete DOM control
├── NavigationIsland                        ← consumes hoverProgress + collapsed
│   ├── motion.div (shell)                  ← rotateY from useTransform
│   ├── keycap list                         ← opacity from useTransform
│   └── nav expanded                        ← variants + staggerChildren
├── dim overlay div                         ← background alpha from useTransform
└── RouteContentWrapper (motion.div)        ← filter + scale from useTransform
    └── <Outlet /> (page content)
```

The provider lives at the app shell level (either `app.tsx` or `explorer.tsx`) so both the island and the route content can access the context.

## Edge Cases

| Scenario | Solution |
|---|---|
| **Touch devices (no hover)** | `matchMedia('(hover: none)')` detects touch. On touch: tap keycap to expand (sets `collapsed = false`), tap outside or tap a nav item to collapse. The MotionValue still animates but is driven by click events instead of hover. |
| **Keyboard users** | Tab focus into the island zone triggers expansion (focusin/focusout on the island container). Focus leaving the island collapses it. |
| **prefers-reduced-motion** | `useReducedMotion()` disables rotation, blur, and scale. Only opacity transitions remain (keycap/nav crossfade). The discrete collapsed/expanded state still toggles so the nav is functional. |
| **Navigate to route** | Clicking a nav item navigates. On desktop, island stays expanded until mouse leaves. On mobile (`max-width: 767px`), island auto-collapses after navigation (existing behavior preserved). |
| **Command palette open** | The command palette dialog renders at a higher z-index with its own backdrop. The Stage Manager dim overlay is below the dialog. No conflict. |
| **Page scroll** | Island is `position: fixed`. Hover expansion does not affect scroll position. |

## Theme Integration

All colors use existing CSS variable tokens:
- Text: `--text-primary`, `--text-tertiary`, `--text-quaternary`
- Backgrounds: `--bg-hover`, `--surface-raised`
- Borders: `--border-standard`, `--border-subtle`
- Glow: `--accent-glow`

Rotation angle (18deg), blur (8px), brightness (0.5), scale (0.96), and dim (0.3 alpha) are global constants defined as JS constants in the component — they do not vary per theme.

## Code Change Scope

| File | Change |
|---|---|
| `packages/ui/src/components/navigation-island.tsx` | **Rewrite** — hover-to-expand, borderless, keycaps, Stage Manager rotation. Remove chevron button, remove translucent panel. |
| `packages/ui/src/components/island-hover-context.tsx` | **Create** — MotionValue provider + `useIslandHover` hook. Creates `hoverProgress` MotionValue, `collapsed` state, and mouseenter/leave handlers. |
| `packages/ui/src/explorer.tsx` (or `app.tsx`) | **Modify** — wrap route content in `motion.div` with `filter`/`scale` derived from `hoverProgress` via context. Add dim overlay div. Mount `IslandHoverProvider`. |
| `DESIGN.md` `### Navigation Island` section | **Update** — document the new hover-to-expand interaction, remove chevron/vibrancy-panel specs, add Stage Manager effect specs. Add Decisions Log row. |

## Open Questions

- **Provider location** — `app.tsx` (global) or `explorer.tsx` (explorer-only)? If the Monitor route should also have the Stage Manager effect, the provider should be in `app.tsx`. If only Explorer routes, `explorer.tsx` is sufficient. Lean `app.tsx` for consistency.
- **Width animation method** — Framer `layout` prop (current approach) vs CSS `width` transition. `layout` is cleaner for shared-element morph but can cause layout thrashing if the route content is complex. Test both during implementation.
