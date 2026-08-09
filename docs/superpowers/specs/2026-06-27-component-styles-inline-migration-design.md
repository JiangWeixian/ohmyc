# Component Styles Inline Migration Design

## Summary

Migrate component-specific CSS classes out of `globals.css` into co-located inline `<style>` tags within the components that consume them. Use a hybrid approach: Tailwind utility classes (currently in `@apply` directives) move to JSX `className`, while complex CSS (pseudo-elements, CSS variables, theme cascades, `clip-path`) stays as raw CSS in `<style>` strings.

## Problem

`globals.css` is 1653 lines. It mixes three concerns:

1. **Design tokens** (~750 lines) — `:root` + `[data-theme]` custom properties
2. **Base resets** (~110 lines) — `html`, `body`, scrollbar, focus
3. **Component classes** (~790 lines) — `.menubar-*`, `.timeline-*`, `.onboard-*`, `.prose-ohmyc`

Finding a component's styles requires searching a monolithic file. Adding a new component means appending to it. The component classes have no co-location with the components that consume them.

## Approach: Hybrid A+B

Two co-location mechanisms work together:

- **Tailwind utility classes** → JSX `className`. The build pipeline (PostCSS/Tailwind) processes them at build time via `content` scanning.
- **Complex CSS** → inline `<style>` tag rendered by the component. Raw CSS string at module scope, not processed by PostCSS.

### Why not pure Tailwind?

Pseudo-elements (`::before`, `::after`), `content: var(--menubar-title-prefix)`, adjacent sibling selectors (`.timeline-tab + .timeline-tab`), theme cascade selectors (`[data-theme='cyberpunk'] .menubar-popover::after`), `clip-path: polygon(...)`, and `backdrop-filter` are impractical or impossible to express as Tailwind utility classes.

### Why not `.css` files?

User preference. No `.css` files or CSS modules.

### Verified: `@apply` does not work in `<style>` tags

Empirically verified with a minimal Vite + Tailwind v3 project. A `<style>` tag containing `@apply bg-red-500` passes through as a raw string in the JS bundle. PostCSS/Tailwind only processes `.css` files in the import graph. The browser ignores `@apply` (it is a PostCSS build-time directive, not standard CSS).

The fix: redistribute `@apply` contents into `className` where Tailwind can see them.

## Inventory

### Stays in `globals.css` (~870 lines)

- Design tokens (`:root`, `[data-theme='*']`, `[data-intensity]`, reduced-motion overrides)
- Base resets (`html`, `body`, `*`, scrollbar, focus-visible, selection, form elements)
- Cross-component utilities (`.transition-smooth`, `.focus-ring`, `.panel`, `.panel-subtle`)
- Font utilities (`.font-display`, `.font-body-theme`, `.font-mono-theme`)
- Text utilities (`.text-balance`, `.text-pretty`)
- `.heat-*` cells — shared across `timeline/` and `menubar/` directories, same category as `.panel`

### Moves to components (~780 lines)

| Block | Lines | Consumers | Target |
|-------|-------|-----------|--------|
| `.menubar-popover`, `.menubar-title`, `.menubar-view-button`, `.menubar-kpi-value`, `.menubar-label`, `.menubar-open`, etc. | ~234 | `menubar-page.tsx`, `menubar-onboard.tsx`, `view-switch.tsx`, `recent-heatmap.tsx` | `menubar/styles.ts` (shared) |
| `.menubar-onboard-scene/head/sub/status/computer` | ~74 | `menubar-onboard.tsx` | `menubar/styles.ts` (shared export) |
| `.timeline-heatmap-card`, `.timeline-page-title`, `.timeline-tabs`, `.timeline-filter-select`, `.timeline-stats`, etc. | ~205 | `contribution-graph.tsx`, `timeline-view.tsx` | `timeline/styles.ts` (shared) |
| `.onboarding-spike`, `.onboard-*` (layers, text, frags, media queries) | ~202 | `onboarding-gate.tsx`, `retro-computer-atropos.tsx` | `onboarding/styles.ts` (shared) |
| `.prose-ohmyc` | ~79 | `markdown-renderer.tsx` | `markdown-renderer.tsx` (inline) |

## Component Pattern

### Rule 1: CSS strings live at module scope

```ts
// menubar/styles.ts
export const menubarPopoverStyles = `
.menubar-popover {
  background: var(--menubar-popover-bg);
  backdrop-filter: var(--menubar-popover-backdrop);
}
.menubar-popover::before { ... }
[data-theme='cyberpunk'] .menubar-popover::after { ... }
`
```

### Rule 2: Top-level page component renders `<style>`, child components trust it

```
menubar-page.tsx     ← renders <style>{menubarPopoverStyles}</style>
  ├── view-switch.tsx       ← className only, no <style>
  └── recent-heatmap.tsx    ← className only, no <style>
```

Mutually exclusive page components each render their own `<style>`. No dedup mechanism needed — for a Tauri desktop app with limited instances, identical `<style>` content is harmless.

### Rule 3: `@apply` redistributes to `className`

Tailwind utilities from `@apply` move to JSX `className`. Complex CSS stays in `<style>`.

Example — `.menubar-popover` currently has:

```css
.menubar-popover {
  @apply relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)];
  background: var(--menubar-popover-bg);
  backdrop-filter: var(--menubar-popover-backdrop);
  border: 1px solid var(--menubar-popover-border);
  /* ... */
}
```

After migration:

```tsx
<div className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover">
```

```css
/* <style> string */
.menubar-popover {
  background: var(--menubar-popover-bg);
  backdrop-filter: var(--menubar-popover-backdrop);
  border: 1px solid var(--menubar-popover-border);
  /* ... */
}
```

Pseudo-elements, adjacent sibling selectors, theme cascade selectors, and `content: var(...)` all stay in `<style>` — Tailwind cannot express them.

## Shared Styles: Directory-Level `styles.ts`

Each component directory gets a `styles.ts` that exports CSS string constants, split by consuming component:

```
components/
  menubar/
    styles.ts                    ← menubarPopoverStyles + menubarOnboardStyles
    menubar-page.tsx             ← renders <style>{menubarPopoverStyles}</style>
    menubar-onboard.tsx          ← renders <style>{menubarPopoverStyles + menubarOnboardStyles}</style>
    view-switch.tsx              ← className only
    recent-heatmap.tsx           ← className only
  timeline/
    styles.ts                    ← timelinePageStyles + heatmapCardStyles
    timeline-view.tsx            ← renders <style>{timelinePageStyles}</style>
    contribution-graph.tsx       ← renders <style>{heatmapCardStyles}</style>
  onboarding/
    styles.ts                    ← onboardingStyles (gate + atropos layers)
    onboarding-gate.tsx          ← renders <style>{onboardingStyles}</style>
    retro-computer-atropos.tsx   ← className only
  markdown-renderer.tsx          ← inline <style>, no styles.ts needed
```

Split principle: each component renders only the CSS it directly consumes. Child components trust the parent has loaded shared styles.

### `menubar-onboard.tsx` special case

Needs both shared menubar styles (`.menubar-popover`) and its own onboard-specific styles. Combines them:

```tsx
<style>{menubarPopoverStyles + menubarOnboardStyles}</style>
```

## `@apply` Redistribution

11 `@apply` directives need redistribution across the migrating components:

| Class | `@apply` utilities → `className` | Remaining CSS → `<style>` |
|-------|----------------------------------|--------------------------|
| `.menubar-popover` | `relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)]` | background, backdrop-filter, border, border-radius, box-shadow, clip-path |
| `.menubar-content` | `relative z-[1]` | (none — all was `@apply`) |
| `.menubar-chart-area` | `relative -mx-1 min-h-[168px] rounded` | background |
| `.timeline-heatmap-card` | `relative p-5` | background, border, border-radius, box-shadow, clip-path |
| `.timeline-heatmap-months` | `text-xs uppercase` | color, font-family, font-weight, letter-spacing, text-shadow |
| `.timeline-heatmap-dows` | `text-xs` | color, font-family, font-weight, letter-spacing |
| `.timeline-tabs` | `h-auto overflow-hidden p-0` | border, border-radius, background, clip-path |
| `.timeline-tab` | `h-auto px-3 py-2` | border, background, color, font, letter-spacing, etc. |
| `.timeline-filter-select` | `h-auto px-3 py-2` | border, border-radius, background, color, font, clip-path |
| `.timeline-stats` | `text-xs` | color, font-family, letter-spacing |
| `.timeline-stats .sep` | `mx-1` (on the `.sep` element) | color |

Classes with `@apply` that produces zero remaining CSS (like `.menubar-content`) disappear entirely from `<style>` — their styles live fully in `className`.

## Migration Order

From most isolated to most complex:

| Step | Component | Lines | Validates |
|------|-----------|-------|-----------|
| 1 | `.prose-ohmyc` → `markdown-renderer.tsx` | ~79 | Simplest case: single consumer, no shared styles, no children |
| 2 | `.onboarding-spike` + `.onboard-*` → `onboarding/styles.ts` | ~202 | Parent-child pattern, `@media` queries |
| 3 | `.timeline-*` → `timeline/styles.ts` | ~205 | Multi-export `styles.ts`, pseudo-elements, theme cascades, adjacent selectors |
| 4 | `.menubar-*` + `.menubar-onboard-*` → `menubar/styles.ts` | ~308 | Four consumers, shared + specific split, most `@apply` usage |

### Per-step mechanical transformation

1. Cut the component's CSS block from `globals.css`
2. Identify all `@apply` directives; move utility classes to JSX `className` (merge with existing classes)
3. Store remaining CSS as a module-level `const` in `styles.ts` or inline in the component
4. Add `<style>{...}</style>` to the component's JSX
5. Delete the migrated block from `globals.css`

### Per-step verification

1. `pnpm --filter @ohmyc/ui exec tsc --noEmit`
2. `pnpm --filter @ohmyc/ui test`
3. (Optional) dev server visual check

## Test Impact

**Zero.** Class names do not change — `<div className="menubar-popover">` stays as-is. Only the CSS rule definition moves from `globals.css` to a `<style>` tag. Tests query by class name, text content, and test IDs, not by CSS application. `setup-gate.test.tsx`'s `querySelector('.onboarding-spike')` continues to work.

Child components rendered in isolation in tests (e.g., `view-switch.tsx` without `menubar-page.tsx`) will not have the `<style>` tag in the DOM, but this does not affect test assertions — jsdom does not apply CSS styling.
