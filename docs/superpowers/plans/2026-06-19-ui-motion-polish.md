# UI Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `packages/ui` motion feel immediate, precise, accessible, and consistent with OhMyC's personal Coding Monitor identity.

**Architecture:** Centralize motion policy in `packages/ui/src/globals.css`, then make high-frequency surfaces opt out of decorative motion while preserving clear state transitions where they explain spatial change. Use CSS transitions and Radix transform origins for predetermined UI motion, keep Framer Motion only where the design system explicitly allows it, and add reduced-motion branches for every movement.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Tailwind CSS, Framer Motion, Radix UI, `tailwindcss-animate`.

---

## File Structure

- Modify: `DESIGN.md`
  - Source-of-truth update for motion rules: no broad `transition-all`, command palette no entrance choreography, reduced motion behavior, exact timing/easing.
- Modify: `packages/ui/src/globals.css`
  - Motion tokens, reduced-motion global scroll behavior, precise `.transition-smooth`.
- Modify: `packages/ui/src/components/ui/button.tsx`
  - Replace broad transition defaults and add controlled press feedback.
- Modify: `packages/ui/src/components/ui/badge.tsx`
  - Replace broad transition defaults.
- Modify: `packages/ui/src/components/ui/switch.tsx`
  - Replace broad transition defaults with root color + thumb transform transitions.
- Modify: `packages/ui/src/components/ui/tabs.tsx`
  - Replace broad trigger transition with exact properties.
- Modify: `packages/ui/src/components/uitripled/native-dialog.tsx`
  - Add `motionPreset` and reduced-motion handling.
- Modify: `packages/ui/src/components/command-palette.tsx`
  - Use the instant dialog preset for `Cmd+K`.
- Modify: `packages/ui/src/components/navigation-island.tsx`
  - Disable shared-layout morph in reduced motion and gate hover scale.
- Modify: `packages/ui/src/explorer.tsx`
  - Add `AnimatePresence` around list/detail route handoff.
- Modify: `packages/ui/src/components/entity-detail.tsx`
  - Convert Framer shorthand `x/y` to full `transform`, add reduced-motion path and stable motion role.
- Modify: `packages/ui/src/components/timeline/event-list.tsx`
  - Add short session-group entry animation on project expansion, reduced-motion branch, and no height/padding animation.
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`
  - Respect reduced motion for heatmap click scrolling.
- Modify: `packages/ui/src/components/ui/select.tsx`
  - Add reduced-motion variants for select content.
- Modify: `packages/ui/src/components/ui/dropdown-menu.tsx`
  - Add reduced-motion variants for dropdown content and submenu content.
- Modify: `packages/ui/src/components/monitor/monitor-view.tsx`
  - Replace Framer `x/y` shorthand with full transform strings or CSS-equivalent transform animation.
- Modify: `packages/ui/src/components/uitripled/native-button.tsx`
  - Remove Framer hover/tap wrapper and glow hover motion; keep CSS press feedback only.
- Create: `packages/ui/tests/motion-policy.test.ts`
  - Source-level policy tests for tokens, reduced motion, banned broad transitions, and high-frequency exceptions.
- Modify: `packages/ui/tests/components/command-palette.test.tsx`
  - Assert command palette uses instant motion preset.
- Modify: `packages/ui/tests/components/navigation-island.test.tsx`
  - Assert reduced-motion mode is exposed and collapse/expand remains usable.
- Create: `packages/ui/tests/components/entity-detail.test.tsx`
  - Assert entity detail exposes motion role and still renders content/actions.
- Modify: `packages/ui/tests/components/timeline/event-list.test.tsx`
  - Assert expanded session group exposes motion role.
- Modify: `packages/ui/tests/components/monitor/monitor-view.test.tsx`
  - Assert reduced-motion render still shows final stats without movement classes.

## Motion Rules To Preserve

| Surface | Decision |
| --- | --- |
| Command palette toggle (`Cmd+K`) | No transform, no blur, no scale; instant or opacity-only under 120ms |
| Navigation Island expand/collapse | Keep 180-220ms shared morph for normal motion; immediate/opacity-only for reduced motion |
| Library card grids | No item entrance choreography; hover is color/border only |
| Entity detail open/close | Short spatial handoff is allowed because it explains list-to-detail relationship |
| Timeline project expansion | Short child-content reveal is allowed; do not animate height, padding, or list layout |
| Select/dropdown | Keep origin-aware Radix scale in normal motion; fade-only or instant in reduced motion |
| Monitor | Identity surface may animate; DOM chrome uses full transform strings and reduced-motion direct rendering |

## Task 1: Document And Global Motion Policy

**Files:**
- Modify: `DESIGN.md`
- Modify: `packages/ui/src/globals.css`
- Create: `packages/ui/tests/motion-policy.test.ts`

- [ ] **Step 1: Write failing motion token and reduced-motion tests**

Create `packages/ui/tests/motion-policy.test.ts` with this content:

```ts
import { readFileSync } from 'node:fs'

import {
  describe,
  expect,
  it,
} from 'vitest'

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('motion policy', () => {
  it('defines strong motion tokens and reduced-motion scroll behavior', () => {
    const css = readSource('../src/globals.css')

    expect(css).toContain('--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);')
    expect(css).toContain('--motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);')
    expect(css).toContain('--motion-fast: 120ms;')
    expect(css).toContain('--motion-short: 160ms;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('scroll-behavior: auto;')
  })

  it('keeps transition-smooth on explicit non-layout properties only', () => {
    const css = readSource('../src/globals.css')
    const transitionSmooth = css.match(/\.transition-smooth\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? ''

    expect(transitionSmooth).toContain('color var(--motion-short)')
    expect(transitionSmooth).toContain('background-color var(--motion-short)')
    expect(transitionSmooth).toContain('border-color var(--motion-short)')
    expect(transitionSmooth).toContain('opacity var(--motion-short)')
    expect(transitionSmooth).toContain('transform var(--motion-short)')
    expect(transitionSmooth).not.toContain('box-shadow')
    expect(transitionSmooth).not.toContain('all')
  })

  it('keeps DESIGN.md aligned with the code motion policy', () => {
    const design = readSource('../../DESIGN.md')

    expect(design).toContain('Do not use `transition-all` for reusable UI primitives')
    expect(design).toContain('Command palette open/close is instant or opacity-only')
    expect(design).toContain('Reduced motion removes transform, slide, blur, count-up, parallax, and smooth-scroll movement')
  })
})
```

- [ ] **Step 2: Run the policy test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: FAIL because `--motion-ease-out`, reduced-motion scroll behavior, and the new `DESIGN.md` policy text do not exist yet.

- [ ] **Step 3: Update `DESIGN.md` motion policy**

Modify the `## Motion` section in `DESIGN.md` so it contains these exact policy bullets after the duration list:

```md
- **Reusable motion tokens:** use `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entering/exiting UI, `--motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement, `--motion-fast: 120ms`, `--motion-short: 160ms`, and `--motion-medium: 200ms`.
- **Do not use `transition-all` for reusable UI primitives.** Specify exact properties: `color`, `background-color`, `border-color`, `opacity`, and `transform`. Avoid animating `box-shadow`, `width`, `height`, `padding`, `margin`, `top`, or `left`.
- **Command palette open/close is instant or opacity-only.** `⌘K` / Ctrl+K is a high-frequency keyboard surface; it must not scale, slide, blur, or wait behind dialog choreography.
- **Reduced motion removes transform, slide, blur, count-up, parallax, and smooth-scroll movement.** Keep opacity/color transitions only when they help comprehension.
```

Also replace the Card hover line:

```md
  - Transition: `transition-all duration-150 ease-out`
```

with:

```md
  - Transition: `background-color, border-color 160ms var(--motion-ease-out)`
```

Add this row to the Decisions Log:

```md
| 2026-06-19 | Tighten UI motion policy around high-frequency surfaces | Command palette and repeated library interactions should feel immediate; reusable primitives specify exact animated properties, and reduced motion removes transform/scroll/count-up movement |
```

- [ ] **Step 4: Update global CSS motion tokens and reduced-motion scroll**

In `packages/ui/src/globals.css`, replace the transition token block:

```css
    /* Transitions */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

with:

```css
    /* Motion */
    --motion-fast: 120ms;
    --motion-short: 160ms;
    --motion-medium: 200ms;
    --motion-long: 300ms;
    --motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    --motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

    /* Legacy aliases for smooth migration */
    --transition-fast: var(--motion-fast) var(--motion-ease-out);
    --transition-normal: var(--motion-medium) var(--motion-ease-out);
    --transition-slow: var(--motion-long) var(--motion-ease-out);
    --ease-out: var(--motion-ease-out);
    --ease-in-out: var(--motion-ease-in-out);
```

Add this after the `html` base rule:

```css
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }
```

Replace `.transition-smooth` with:

```css
  .transition-smooth {
    transition:
      color var(--motion-short) var(--motion-ease-out),
      background-color var(--motion-short) var(--motion-ease-out),
      border-color var(--motion-short) var(--motion-ease-out),
      opacity var(--motion-short) var(--motion-ease-out),
      transform var(--motion-short) var(--motion-ease-out);
  }
```

- [ ] **Step 5: Run the policy test to verify it passes**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md packages/ui/src/globals.css packages/ui/tests/motion-policy.test.ts
git commit -m "docs: define ui motion policy"
```

## Task 2: Remove Broad Transitions From Shared Primitives

**Files:**
- Modify: `packages/ui/tests/motion-policy.test.ts`
- Modify: `packages/ui/src/components/ui/button.tsx`
- Modify: `packages/ui/src/components/ui/badge.tsx`
- Modify: `packages/ui/src/components/ui/switch.tsx`
- Modify: `packages/ui/src/components/ui/tabs.tsx`
- Modify: `packages/ui/src/components/uitripled/native-dialog.tsx`
- Modify: `packages/ui/src/components/command-palette-trigger.tsx`
- Modify: `packages/ui/src/components/config-section.tsx`

- [ ] **Step 1: Extend source policy test for `transition-all`**

Append this test to `packages/ui/tests/motion-policy.test.ts`:

```ts
  it('does not use transition-all in UI primitives or shell controls', () => {
    const files = [
      '../src/components/ui/button.tsx',
      '../src/components/ui/badge.tsx',
      '../src/components/ui/switch.tsx',
      '../src/components/ui/tabs.tsx',
      '../src/components/uitripled/native-dialog.tsx',
      '../src/components/command-palette-trigger.tsx',
      '../src/components/config-section.tsx',
    ]

    for (const file of files) {
      expect(readSource(file), file).not.toContain('transition-all')
    }
  })
```

- [ ] **Step 2: Run the source policy test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: FAIL with at least `button.tsx`, `badge.tsx`, `switch.tsx`, `tabs.tsx`, `native-dialog.tsx`, `command-palette-trigger.tsx`, or `config-section.tsx` containing `transition-all`.

- [ ] **Step 3: Replace broad transitions in primitives**

Make these exact class changes:

In `packages/ui/src/components/ui/button.tsx`, replace:

```ts
"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

with:

```ts
"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
```

In `packages/ui/src/components/ui/badge.tsx`, replace:

```ts
'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
```

with:

```ts
'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
```

In `packages/ui/src/components/ui/switch.tsx`, replace root `transition-all` with:

```ts
'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-[background-color,border-color,opacity] duration-150 ease-out outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'
```

and replace the thumb class with:

```tsx
className="pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-150 ease-out group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] dark:data-[state=checked]:bg-primary-foreground group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0 dark:data-[state=unchecked]:bg-foreground"
```

In `packages/ui/src/components/ui/tabs.tsx`, replace `transition-all` in `TabsTrigger` with:

```ts
transition-[color,background-color,border-color,opacity]
```

In `packages/ui/src/components/uitripled/native-dialog.tsx`, replace close button `transition-all` with:

```tsx
transition-[color,background-color,opacity]
```

In `packages/ui/src/components/command-palette-trigger.tsx`, replace:

```ts
'transition-all duration-150',
```

with:

```ts
'transition-[background-color,border-color,color] duration-150 ease-out',
```

In `packages/ui/src/components/config-section.tsx`, replace:

```tsx
<div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] transition-all duration-300 hover:border-[var(--border-hover)]">
```

with:

```tsx
<div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] transition-colors duration-150 ease-out hover:border-[var(--border-hover)]">
```

- [ ] **Step 4: Run the source policy test to verify it passes**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/tests/motion-policy.test.ts packages/ui/src/components/ui/button.tsx packages/ui/src/components/ui/badge.tsx packages/ui/src/components/ui/switch.tsx packages/ui/src/components/ui/tabs.tsx packages/ui/src/components/uitripled/native-dialog.tsx packages/ui/src/components/command-palette-trigger.tsx packages/ui/src/components/config-section.tsx
git commit -m "refactor: remove broad ui transitions"
```

## Task 3: Split Command Palette Motion From Standard Dialog Motion

**Files:**
- Modify: `packages/ui/src/components/uitripled/native-dialog.tsx`
- Modify: `packages/ui/src/components/command-palette.tsx`
- Modify: `packages/ui/tests/components/command-palette.test.tsx`

- [ ] **Step 1: Write failing command palette preset test**

Append this test to `packages/ui/tests/components/command-palette.test.tsx` inside `describe('CommandPalette', () => { ... })`:

```tsx
  it('uses instant motion for the high-frequency keyboard palette', () => {
    render(
      <CommandPaletteProvider>
        <CommandPalette commands={[{ id: 'one', label: 'One', action: vi.fn() }]} />
      </CommandPaletteProvider>,
    )

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const input = screen.getByPlaceholderText('Search commands...')
    const dialog = input.closest('[data-motion-preset]')
    expect(dialog).toHaveAttribute('data-motion-preset', 'instant')
  })
```

- [ ] **Step 2: Run the command palette test to verify it fails**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/command-palette.test.tsx
```

Expected: FAIL because no rendered dialog element has `data-motion-preset="instant"`.

- [ ] **Step 3: Add `motionPreset` to `NativeDialogContent`**

In `packages/ui/src/components/uitripled/native-dialog.tsx`, add this type near the imports:

```ts
type NativeDialogMotionPreset = 'dialog' | 'instant'
```

Replace the `NativeDialogContent` declaration with this version:

```tsx
const NativeDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    motionPreset?: NativeDialogMotionPreset
  }
>(({ className, children, motionPreset = 'dialog', ...properties }, reference) => {
  const reduceMotion = React.useMemo(
    () =>
      typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const instant = motionPreset === 'instant' || reduceMotion
  const motionState = instant
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, scale: 0.95, filter: 'blur(8px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, scale: 0.97, filter: 'blur(6px)' },
        transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
      }

  return (
    <NativeDialogPortal>
      <NativeDialogOverlay instant={instant} />
      <DialogPrimitive.Content ref={reference} asChild {...properties}>
        <div className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            {...motionState}
            data-motion-preset={motionPreset}
            className={cn(
              'grid w-full max-w-lg gap-4 border border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl p-6 shadow-2xl sm:rounded-2xl',
              className,
            )}
          >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 opacity-70 ring-offset-background transition-[color,background-color,opacity] hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </motion.div>
        </div>
      </DialogPrimitive.Content>
    </NativeDialogPortal>
  )
})
```

Replace `NativeDialogOverlay` with this version:

```tsx
const NativeDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
    instant?: boolean
  }
>(({ className, instant = false, ...properties }, reference) => (
  <DialogPrimitive.Overlay ref={reference} asChild {...properties}>
    <motion.div
      initial={{ opacity: instant ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: instant ? 1 : 0 }}
      transition={{ duration: instant ? 0 : 0.12, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        'fixed inset-0 z-50 bg-black/20 backdrop-blur-sm',
        className,
      )}
    />
  </DialogPrimitive.Overlay>
))
```

- [ ] **Step 4: Use instant preset in the command palette**

In `packages/ui/src/components/command-palette.tsx`, replace:

```tsx
<NativeDialogContent className="p-0 gap-0 max-w-xl overflow-hidden bg-[var(--surface-overlay)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
```

with:

```tsx
<NativeDialogContent motionPreset="instant" className="p-0 gap-0 max-w-xl overflow-hidden bg-[var(--surface-overlay)] border-[var(--border-default)] rounded-[var(--radius-xl)]">
```

- [ ] **Step 5: Run command palette tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/command-palette.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/uitripled/native-dialog.tsx packages/ui/src/components/command-palette.tsx packages/ui/tests/components/command-palette.test.tsx
git commit -m "fix: make command palette motion immediate"
```

## Task 4: Fix Navigation Island Reduced Motion And Hover Gating

**Files:**
- Modify: `packages/ui/src/components/navigation-island.tsx`
- Modify: `packages/ui/tests/components/navigation-island.test.tsx`

- [ ] **Step 1: Write failing reduced-motion test**

Append this test to `packages/ui/tests/components/navigation-island.test.tsx` inside `describe('NavigationIsland', () => { ... })`:

```tsx
  it('marks the shell as reduced motion when the user prefers reduced motion', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-motion-mode', 'reduced')
  })
```

- [ ] **Step 2: Run navigation tests to verify failure**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/navigation-island.test.tsx
```

Expected: FAIL because the navigation shell does not expose `data-motion-mode="reduced"`.

- [ ] **Step 3: Make layout morph conditional and expose mode**

In `packages/ui/src/components/navigation-island.tsx`, add this near the existing refs:

```ts
  const motionMode = reduceMotion ? 'reduced' : 'full'
  const shellLayoutProps = reduceMotion
    ? {}
    : {
        layout: true,
        layoutId: 'primary-navigation-island-shell',
      }
```

In the collapsed shell, replace:

```tsx
<motion.div
  key="collapsed"
  layout
  layoutId="primary-navigation-island-shell"
```

with:

```tsx
<motion.div
  key="collapsed"
  {...shellLayoutProps}
  data-motion-mode={motionMode}
```

In the expanded shell, replace:

```tsx
<motion.nav
  key="expanded"
  layout
  layoutId="primary-navigation-island-shell"
```

with:

```tsx
<motion.nav
  key="expanded"
  {...shellLayoutProps}
  data-motion-mode={motionMode}
```

Replace the collapsed shell `whileHover` prop:

```tsx
whileHover={reduceMotion ? undefined : { scale: 1.02 }}
```

with:

```tsx
whileHover={undefined}
```

Add this class to the collapsed `Button` class list:

```ts
'motion-safe:hover:scale-[1.02] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out',
```

The collapsed `Button` class block should include the new class alongside the existing hover background class.

- [ ] **Step 4: Run navigation tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/navigation-island.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/navigation-island.tsx packages/ui/tests/components/navigation-island.test.tsx
git commit -m "fix: respect reduced motion in navigation island"
```

## Task 5: Add Purposeful Detail And Timeline Expansion Motion

**Files:**
- Modify: `packages/ui/src/explorer.tsx`
- Modify: `packages/ui/src/components/entity-detail.tsx`
- Create: `packages/ui/tests/components/entity-detail.test.tsx`
- Modify: `packages/ui/src/components/timeline/event-list.tsx`
- Modify: `packages/ui/tests/components/timeline/event-list.test.tsx`

- [ ] **Step 1: Write entity detail motion-role test**

Create `packages/ui/tests/components/entity-detail.test.tsx`:

```tsx
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { EntityDetail } from '@/components/entity-detail'

describe('EntityDetail', () => {
  it('renders a motion handoff surface with content and back action', () => {
    const onBack = vi.fn()

    render(
      <EntityDetail
        title="agents"
        name="reviewer"
        description="Reviews changes"
        content="# Notes\n\nUse carefully."
        meta={[{ label: 'scope', value: 'global' }]}
        onBack={onBack}
      />,
    )

    expect(screen.getByTestId('entity-detail-motion')).toHaveAttribute('data-motion-role', 'entity-detail')
    expect(screen.getByRole('heading', { name: 'reviewer' })).toBeInTheDocument()
    expect(screen.getByText('Reviews changes')).toBeInTheDocument()
    expect(screen.getByText('scope')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Back to agents/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Extend timeline test for session-group motion role**

Append this assertion to the end of `renders day rollups and expanded sessions for the first day` in `packages/ui/tests/components/timeline/event-list.test.tsx`:

```tsx
    expect(screen.getByTestId('timeline-session-group-alpha')).toHaveAttribute('data-motion-role', 'timeline-session-group')
```

- [ ] **Step 3: Run the focused tests to verify failure**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/entity-detail.test.tsx tests/components/timeline/event-list.test.tsx
```

Expected: FAIL because `data-testid="entity-detail-motion"` and `data-testid="timeline-session-group-alpha"` do not exist yet.

- [ ] **Step 4: Add `AnimatePresence` around entity list/detail handoff**

In `packages/ui/src/explorer.tsx`, add:

```ts
import { AnimatePresence } from 'framer-motion'
```

Wrap the non-Monitor rendered route block:

```tsx
{activeSection === 'timeline' && <TimelineView />}
{activeSection === 'agents' && renderEntityList('agents')}
{activeSection === 'skills' && renderEntityList('skills')}
{activeSection === 'commands' && renderEntityList('commands')}
{activeSection === 'plugins' && renderPlugins()}
```

with:

```tsx
<AnimatePresence mode="wait" initial={false}>
  <div key={`${activeSection}-${selectedItem ? selectedItem.name : 'list'}`}>
    {activeSection === 'timeline' && <TimelineView />}
    {activeSection === 'agents' && renderEntityList('agents')}
    {activeSection === 'skills' && renderEntityList('skills')}
    {activeSection === 'commands' && renderEntityList('commands')}
    {activeSection === 'plugins' && renderPlugins()}
  </div>
</AnimatePresence>
```

- [ ] **Step 5: Update `EntityDetail` motion**

In `packages/ui/src/components/entity-detail.tsx`, change the import:

```ts
import { motion } from 'framer-motion'
```

to:

```ts
import { motion, useReducedMotion } from 'framer-motion'
```

Inside `EntityDetail`, after `const isReadOnly = scope === 'project'`, add:

```ts
  const reduceMotion = useReducedMotion()
  const pageMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] },
      }
    : {
        initial: { opacity: 0, transform: 'translateX(8px)' },
        animate: { opacity: 1, transform: 'translateX(0px)' },
        exit: { opacity: 0, transform: 'translateX(-8px)' },
        transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
      }
  const blockMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] },
      }
    : {
        initial: { opacity: 0, transform: 'translateY(6px)' },
        animate: { opacity: 1, transform: 'translateY(0px)' },
        transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
      }
```

Replace the top-level `<motion.div ...>` motion props with:

```tsx
      {...pageMotion}
      data-testid="entity-detail-motion"
      data-motion-role="entity-detail"
```

Replace the header `<motion.div ...>` motion props with:

```tsx
        {...blockMotion}
```

Replace the article motion props:

```tsx
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, delay: 0.05, ease: 'easeOut' }}
```

with:

```tsx
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, delay: reduceMotion ? 0 : 0.04, ease: [0.23, 1, 0.32, 1] }}
```

- [ ] **Step 6: Add timeline session-group motion role and short reveal**

In `packages/ui/src/components/timeline/event-list.tsx`, add:

```ts
import { motion, useReducedMotion } from 'framer-motion'
```

Inside `ProjectRollup`, before `return`, add:

```ts
  const reduceMotion = useReducedMotion()
  const sessionGroupMotion = reduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, transform: 'translateY(-4px)' },
        animate: { opacity: 1, transform: 'translateY(0px)' },
        exit: { opacity: 0, transform: 'translateY(-2px)' },
        transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] },
      }
```

Replace:

```tsx
      {open && (
        <div
          className="mb-2"
          style={{ margin: '2px 0 8px 28px', paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)' }}
        >
          {sessions.map(s => (
            <SessionItem key={s.session_id} session={s} bucket={bucket} />
          ))}
        </div>
      )}
```

with:

```tsx
      {open && (
        <motion.div
          {...sessionGroupMotion}
          data-testid={`timeline-session-group-${group.project}`}
          data-motion-role="timeline-session-group"
          className="mb-2"
          style={{ margin: '2px 0 8px 28px', paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)' }}
        >
          {sessions.map(s => (
            <SessionItem key={s.session_id} session={s} bucket={bucket} />
          ))}
        </motion.div>
      )}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/components/entity-detail.test.tsx tests/components/timeline/event-list.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/explorer.tsx packages/ui/src/components/entity-detail.tsx packages/ui/tests/components/entity-detail.test.tsx packages/ui/src/components/timeline/event-list.tsx packages/ui/tests/components/timeline/event-list.test.tsx
git commit -m "feat: add purposeful detail and timeline motion"
```

## Task 6: Respect Reduced Motion For Scroll, Popovers, And Monitor DOM Motion

**Files:**
- Modify: `packages/ui/tests/motion-policy.test.ts`
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`
- Modify: `packages/ui/src/components/ui/select.tsx`
- Modify: `packages/ui/src/components/ui/dropdown-menu.tsx`
- Modify: `packages/ui/src/components/monitor/monitor-view.tsx`
- Modify: `packages/ui/tests/components/monitor/monitor-view.test.tsx`

- [ ] **Step 1: Extend policy test for reduced-motion hooks and no Framer shorthand**

Append these tests to `packages/ui/tests/motion-policy.test.ts`:

```ts
  it('uses reduced-motion variants for scroll, select, and dropdown motion', () => {
    expect(readSource('../src/components/timeline/timeline-view.tsx')).toContain('(prefers-reduced-motion: reduce)')
    expect(readSource('../src/components/ui/select.tsx')).toContain('motion-reduce:data-[state=open]:animate-none')
    expect(readSource('../src/components/ui/dropdown-menu.tsx')).toContain('motion-reduce:data-[state=open]:animate-none')
  })

  it('does not use Framer x/y shorthand in Monitor DOM motion', () => {
    const monitor = readSource('../src/components/monitor/monitor-view.tsx')

    expect(monitor).not.toContain('x: 0')
    expect(monitor).not.toContain('x: 18')
    expect(monitor).not.toContain('y: 0')
    expect(monitor).not.toContain('y: 12')
    expect(monitor).toContain("transform: 'translate")
  })
```

- [ ] **Step 2: Run policy test to verify failure**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: FAIL because timeline scrolling does not check reduced motion, popovers lack motion-reduce classes, and Monitor still uses `x/y` shorthand.

- [ ] **Step 3: Respect reduced motion in heatmap scrolling**

In `packages/ui/src/components/timeline/timeline-view.tsx`, replace:

```ts
      ;(node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
```

with:

```ts
      const reduceMotion = typeof globalThis.matchMedia === 'function'
        && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      ;(node as HTMLElement).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
```

- [ ] **Step 4: Add reduced-motion classes to Select**

In `packages/ui/src/components/ui/select.tsx`, add these classes to the `SelectContent` class string after `duration-100`:

```ts
motion-reduce:duration-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[side=bottom]:slide-in-from-top-0 motion-reduce:data-[side=left]:slide-in-from-right-0 motion-reduce:data-[side=right]:slide-in-from-left-0 motion-reduce:data-[side=top]:slide-in-from-bottom-0
```

- [ ] **Step 5: Add reduced-motion classes to DropdownMenu**

In `packages/ui/src/components/ui/dropdown-menu.tsx`, add the same class sequence after `duration-100` in `DropdownMenuContent`.

In `DropdownMenuSubContent`, add:

```ts
motion-reduce:duration-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[side=bottom]:slide-in-from-top-0 motion-reduce:data-[side=left]:slide-in-from-right-0 motion-reduce:data-[side=right]:slide-in-from-left-0 motion-reduce:data-[side=top]:slide-in-from-bottom-0
```

- [ ] **Step 6: Replace Monitor Framer shorthand**

In `packages/ui/src/components/monitor/monitor-view.tsx`, replace the lanyard wrapper motion props:

```tsx
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
```

with:

```tsx
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(12px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }}
```

Replace the stats wrapper motion props:

```tsx
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.34, delay: 0.05 }}
```

with:

```tsx
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateX(18px)' }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          transition={{ duration: reduceMotion ? 0 : 0.26, delay: reduceMotion ? 0 : 0.04, ease: [0.23, 1, 0.32, 1] }}
```

- [ ] **Step 7: Add reduced-motion monitor assertion**

Append this test to `packages/ui/tests/components/monitor/monitor-view.test.tsx`:

```tsx
  it('renders final stat values when reduced motion is requested', async () => {
    const now = Date.now()
    setMockHandler('timeline.status', async () => ({ sessionCount: 3, lastSyncAt: now }))
    setMockHandler('timeline.events', async () => ({
      days: [
        { day: '2026-06-19', session_count: 3, turn_count: 12, token_count: 42_000, project_groups: [] },
      ],
    }))

    renderWithProviders(<MonitorView />)

    expect(await screen.findByText('42.0k')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts tests/components/monitor/monitor-view.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/ui/tests/motion-policy.test.ts packages/ui/src/components/timeline/timeline-view.tsx packages/ui/src/components/ui/select.tsx packages/ui/src/components/ui/dropdown-menu.tsx packages/ui/src/components/monitor/monitor-view.tsx packages/ui/tests/components/monitor/monitor-view.test.tsx
git commit -m "fix: respect reduced motion across ui surfaces"
```

## Task 7: Refactor NativeButton Backup Motion

**Files:**
- Modify: `packages/ui/tests/motion-policy.test.ts`
- Modify: `packages/ui/src/components/uitripled/native-button.tsx`

- [ ] **Step 1: Add source policy test for NativeButton**

Append this test to `packages/ui/tests/motion-policy.test.ts`:

```ts
  it('keeps NativeButton free of Framer hover and glow motion', () => {
    const source = readSource('../src/components/uitripled/native-button.tsx')

    expect(source).not.toContain('whileHover')
    expect(source).not.toContain('whileTap')
    expect(source).not.toContain('blur-xl')
    expect(source).toContain('active:scale-[0.97]')
  })
```

- [ ] **Step 2: Run policy test to verify failure**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: FAIL because `NativeButton` still contains Framer hover/tap props and a `blur-xl` glow.

- [ ] **Step 3: Replace `NativeButton` with CSS press feedback**

Replace all content in `packages/ui/src/components/uitripled/native-button.tsx` with:

```tsx
// Button wrapper with loading state and restrained press feedback.

'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ButtonProps } from '@/components/ui/button'
import type { ReactNode } from 'react'

/** Props for the NativeButton component. */
export interface NativeButtonProps extends ButtonProps {
  children: ReactNode
  loading?: boolean
  glow?: boolean
}

const NativeButton = ({
  className,
  variant = 'default',
  size = 'lg',
  children,
  loading = false,
  glow: _glow = false,
  disabled,
  ...properties
}: NativeButtonProps) => {
  const buttonClassName = cn(
    'cursor-pointer h-12 rounded-md px-7 text-sm relative overflow-hidden',
    'transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out',
    'active:scale-[0.97]',
    variant === 'outline' && 'text-foreground/80 hover:bg-foreground/5',
    (disabled || loading) && 'opacity-50 cursor-not-allowed grayscale active:scale-100',
    className,
  )

  return (
    <Button
      variant={variant}
      size={size}
      className={buttonClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      {...properties}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <span className="flex items-center gap-2">
        {children}
      </span>
    </Button>
  )
}

NativeButton.displayName = 'NativeButton'

export { NativeButton }
```

- [ ] **Step 4: Run policy test**

Run:

```bash
pnpm --filter @ohmyc/ui test -- tests/motion-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/tests/motion-policy.test.ts packages/ui/src/components/uitripled/native-button.tsx
git commit -m "refactor: simplify native button motion"
```

## Final Verification

- [ ] **Step 1: Run all UI tests**

```bash
pnpm --filter @ohmyc/ui test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run UI lint**

```bash
pnpm --filter @ohmyc/ui lint
```

Expected: no ESLint errors and no warnings.

- [ ] **Step 3: Run UI build**

```bash
pnpm --filter @ohmyc/ui build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Manual QA normal motion**

Run:

```bash
pnpm --filter @ohmyc/ui dev
```

Open the printed local URL and verify:

- `Cmd+K` appears immediately without scale, slide, or blur.
- Navigation Island expands/collapses with the existing 180-220ms shell morph.
- Entity list-to-detail has a short spatial handoff.
- Timeline project rollup reveals sessions without height/padding wobble.
- Select/dropdown popovers still originate from their triggers.
- Monitor still shows the lanyard/fallback and final stats.

- [ ] **Step 5: Manual QA reduced motion**

Enable reduced motion in macOS or browser emulation, reload the dev server, and verify:

- `Cmd+K` remains immediate.
- Navigation Island switches state without shell morph, slide, or blur.
- Heatmap click scroll jumps directly to the day instead of smooth scrolling.
- Select/dropdown content does not slide or zoom.
- Monitor stat numbers render final values without count-up movement.

## Self-Review

**Spec coverage:** The plan covers global tokens, high-frequency command palette, Navigation Island, entity detail handoff, Timeline expansion, reduced-motion scroll/popovers/Monitor, primitive transition cleanup, and NativeButton backup motion.

**Placeholder scan:** No task uses unresolved placeholder wording or vague test instructions. Every code-changing step contains concrete code or exact replacement text.

**Type consistency:** New names are consistent across tasks: `motionPreset`, `NativeDialogMotionPreset`, `data-motion-preset`, `data-motion-mode`, `data-motion-role`, `timeline-session-group`, and `entity-detail-motion`.
