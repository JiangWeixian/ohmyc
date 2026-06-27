# Component Styles Inline Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate component-specific CSS classes out of `globals.css` into co-located inline `<style>` tags, using a hybrid approach where Tailwind utility classes (from `@apply`) move to JSX `className` and complex CSS stays in `<style>` strings.

**Architecture:** Each component directory gets a `styles.ts` exporting CSS string constants. Top-level page components render `<style>{...}</style>`; child components trust the parent. No `.css` files, no CSS modules. Design tokens and base resets stay in `globals.css`.

**Tech Stack:** React, Tailwind CSS v3, Vite, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-27-component-styles-inline-migration-design.md`

> **Line numbers** in deletion steps refer to the original `globals.css` (1653 lines). Prior task deletions shift subsequent line numbers. Use the **content markers** (starting/ending CSS selectors shown in each step) as the source of truth — search for the selector text, not the line number.

---

## File Structure

### Files to create

| File | Responsibility |
|------|---------------|
| `packages/ui/src/components/onboarding/styles.ts` | Exports `onboardingStyles` — CSS for `.onboarding-spike` + all `.onboard-*` classes |
| `packages/ui/src/components/timeline/styles.ts` | Exports `timelinePageStyles` + `heatmapCardStyles` — CSS for timeline page chrome + heatmap card |
| `packages/ui/src/components/menubar/styles.ts` | Exports `menubarPopoverStyles` + `menubarOnboardStyles` — CSS for popover shell + onboard compact state |

### Files to modify

| File | Changes |
|------|---------|
| `packages/ui/src/globals.css` | Delete migrated CSS blocks (4 separate deletions, one per task) |
| `packages/ui/src/components/markdown-renderer.tsx` | Add inline `<style>` const + render |
| `packages/ui/src/components/onboarding/onboarding-gate.tsx` | Import styles, render `<style>` |
| `packages/ui/src/components/timeline/timeline-view.tsx` | Import styles, render `<style>`, redistribute 7 `@apply` to `className` |
| `packages/ui/src/components/timeline/contribution-graph.tsx` | Import styles, render `<style>`, redistribute 3 `@apply` to `className` |
| `packages/ui/src/components/menubar/menubar-page.tsx` | Import styles, render `<style>`, redistribute 3 `@apply` to `className` |
| `packages/ui/src/components/menubar/menubar-onboard.tsx` | Import styles, render `<style>`, redistribute 2 `@apply` to `className` |

---

## Task 1: Migrate `.prose-ohmyc` → `markdown-renderer.tsx`

**Files:**
- Modify: `packages/ui/src/components/markdown-renderer.tsx`
- Modify: `packages/ui/src/globals.css` (delete lines 1365–1444)

No `@apply` in this block — the CSS moves verbatim to an inline const. Simplest migration; validates the pattern.

- [ ] **Step 1: Add inline style const and `<style>` tag to `markdown-renderer.tsx`**

Replace the entire file content:

```tsx
// Lightweight Markdown renderer using react-markdown with GitHub-Flavored Markdown support.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

const proseStyles = `
.prose-ohmyc {
  --tw-prose-body: var(--text-secondary);
  --tw-prose-headings: var(--text-primary);
  --tw-prose-lead: var(--text-secondary);
  --tw-prose-links: var(--text-primary);
  --tw-prose-bold: var(--text-primary);
  --tw-prose-counters: var(--text-tertiary);
  --tw-prose-bullets: var(--text-quaternary);
  --tw-prose-hr: var(--border-default);
  --tw-prose-quotes: var(--text-secondary);
  --tw-prose-quote-borders: var(--border-default);
  --tw-prose-captions: var(--text-tertiary);
  --tw-prose-code: var(--text-primary);
  --tw-prose-pre-code: var(--text-primary);
  --tw-prose-pre-bg: #08090a;
  --tw-prose-th-borders: var(--border-default);
  --tw-prose-td-borders: var(--border-default);
  font-size: 1rem;
  line-height: 1.7;
  max-width: 72ch;
}
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *)) {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-weight: 500;
}
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *))::before,
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *))::after {
  content: none;
}
.prose-ohmyc :where(pre):not(:where([class~="not-prose"] *)) {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}
.prose-ohmyc :where(pre code):not(:where([class~="not-prose"] *)) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-weight: 400;
}
.prose-ohmyc :where(h2):not(:where([class~="not-prose"] *)) {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.0125rem;
  margin-top: 2em;
  margin-bottom: 0.6em;
}
.prose-ohmyc :where(h3):not(:where([class~="not-prose"] *)) {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01rem;
  margin-top: 1.6em;
  margin-bottom: 0.5em;
}
.prose-ohmyc :where(a):not(:where([class~="not-prose"] *)) {
  text-decoration: underline;
  text-underline-offset: 0.1875rem;
  text-decoration-color: color-mix(in oklab, var(--text-primary) 40%, transparent);
  font-weight: 500;
}
.prose-ohmyc :where(blockquote):not(:where([class~="not-prose"] *)) {
  border-left: 2px solid var(--border-default);
  font-style: normal;
  font-weight: 400;
  quotes: none;
}
.prose-ohmyc :where(blockquote p):not(:where([class~="not-prose"] *))::before,
.prose-ohmyc :where(blockquote p):not(:where([class~="not-prose"] *))::after {
  content: none;
}
.prose-ohmyc :where(table):not(:where([class~="not-prose"] *)) {
  font-size: 0.875rem;
}
`

/** Properties for the {@link MarkdownRenderer} component. */
interface MarkdownRendererProperties {
  /** Raw markdown string to render. */
  content: string
  /** Additional CSS classes applied to the wrapper div. */
  className?: string
}

/** Renders markdown content with GFM (tables, strikethrough, task lists)
 *  using the OhMyC prose typography styles. */
export function MarkdownRenderer({ content, className }: MarkdownRendererProperties) {
  return (
    <>
      <style>{proseStyles}</style>
      <div className={cn('prose prose-ohmyc mx-auto', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Delete the `.prose-ohmyc` block from `globals.css`**

Delete lines 1365–1444 in `packages/ui/src/globals.css` — the entire `.prose-ohmyc` block starting with `.prose-ohmyc {` and ending with the closing `}` before `.text-pretty {`.

The block to delete starts with:
```css
  .prose-ohmyc {
    --tw-prose-body: var(--text-secondary);
```

And ends with:
```css
  .prose-ohmyc :where(table):not(:where([class~="not-prose"] *)) {
    font-size: 0.875rem;
  }
```

Leave `.text-pretty` and the closing `}` of `@layer utilities` intact.

- [ ] **Step 3: Verify type check and tests pass**

Run:
```bash
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
```

Expected: tsc clean, all 148 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/markdown-renderer.tsx packages/ui/src/globals.css
git commit -m "refactor(ui): migrate prose-ohmyc CSS to inline style tag"
```

---

## Task 2: Migrate `.onboarding-spike` + `.onboard-*` → `onboarding/styles.ts`

**Files:**
- Create: `packages/ui/src/components/onboarding/styles.ts`
- Modify: `packages/ui/src/components/onboarding/onboarding-gate.tsx`
- Modify: `packages/ui/src/globals.css` (delete lines 1451–1653)

No `@apply` in this block — CSS moves verbatim. `onboarding-gate.tsx` renders `<style>`; `retro-computer-atropos.tsx` is a child that trusts the parent.

- [ ] **Step 1: Create `packages/ui/src/components/onboarding/styles.ts`**

Cut the entire onboarding CSS block from `globals.css` (lines 1451–1653, starting with the `/* Onboarding setup gate */` comment and ending with the reduced-motion media query). Paste it as a template string export. The content is the verbatim CSS — no modifications needed since there are no `@apply` directives.

```ts
/**
 * Onboarding setup gate styles — frosted-ivory-lamplit Atropos retro computer scene.
 * Layered construction: Atropos tilt reveals shell + keyboard thickness.
 *
 * Rendered by OnboardingGate via <style>. RetroComputerAtropos is a child
 * component that trusts the parent has loaded these styles.
 */
export const onboardingStyles = `
/* Ambient letter-glitch field sits at the bottom and never blocks the pointer. */
.onboarding-spike .onboard-letter-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.16;
  pointer-events: none;
}
/* Size the Atropos root directly (.atropos is display:block; its scale/rotate/
 * inner are 100% — without an explicit size the interactive surface collapses). */
.onboarding-spike .retro-computer-atropos {
  position: relative;
  z-index: 1;
  width: min(86vw, 760px);
  aspect-ratio: 1 / 1;
}
.onboarding-spike .retro-computer-atropos--inactive {
  pointer-events: none;
}
/* Scene wrapper fills the atropos-inner so absolute layers resolve against it. */
.onboarding-spike .onboard-atropos-scene {
  position: absolute;
  inset: 0;
}
.onboarding-spike .retro-computer-atropos .atropos-inner {
  overflow: visible;
  border-radius: 0;
  background: transparent;
}
.onboard-atropos-scene .onboard-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.onboard-letter-bg {
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 42% 34%, rgba(255, 178, 86, 0.09), transparent 28%),
    radial-gradient(circle at 50% 48%, rgba(75, 255, 204, 0.07), transparent 34%);
}
.onboard-letter-bg pre {
  margin: -24px;
  white-space: pre-wrap;
  opacity: 0.68;
  text-shadow: 0 0 10px rgba(83, 247, 209, 0.2);
  transform: rotate(-1deg) scale(1.04);
}
.onboard-rim {
  z-index: 1;
  background:
    radial-gradient(circle at 37% 30%, rgba(255, 184, 96, 0.13), transparent 24%),
    radial-gradient(circle at 55% 49%, rgba(104, 255, 213, 0.14), transparent 22%);
  mix-blend-mode: screen;
}
.onboard-asset {
  display: grid;
  place-items: center;
}
.onboard-asset img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center;
  display: block;
}
.onboard-shell-back {
  z-index: 2;
  opacity: 0.68;
}
.onboard-shell-back img {
  transform: translateY(-1%) scale(0.88) translate(18px, 14px);
  filter: brightness(0.34) saturate(0.72);
}
.onboard-shell-mid {
  z-index: 3;
  opacity: 0.5;
}
.onboard-shell-mid img {
  transform: translateY(-1%) scale(0.88) translate(9px, 7px);
  filter: brightness(0.56) saturate(0.82);
}
.onboard-shell {
  z-index: 5;
}
.onboard-shell img {
  transform: translateY(-1%) scale(0.88);
  filter: drop-shadow(0 30px 32px rgba(0, 0, 0, 0.5));
}
.onboard-keyboard-back {
  z-index: 6;
  opacity: 0.5;
}
.onboard-keyboard-back img {
  transform: translate(-6%, 36%) scale(0.7) translate(10px, 8px);
  filter: brightness(0.44) saturate(0.82);
}
.onboard-keyboard {
  z-index: 7;
}
.onboard-keyboard img {
  transform: translate(-6%, 36%) scale(0.7);
  filter: drop-shadow(0 20px 22px rgba(0, 0, 0, 0.42));
}
.onboard-frags {
  z-index: 8;
}
.onboard-frag {
  position: absolute;
  color: rgba(118, 255, 216, 0.58);
  font: 800 16px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-shadow: 0 0 12px rgba(118, 255, 216, 0.36);
}
.onboard-frag:nth-child(1) { left: 18%; top: 28%; }
.onboard-frag:nth-child(2) { right: 19%; top: 36%; }
.onboard-frag:nth-child(3) { left: 23%; bottom: 24%; }

/* Onboarding gate layout */
.onboarding-spike {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  min-height: 100dvh;
  padding: 3rem 1.5rem;
  background: var(--bg-marketing);
  color: var(--text-primary);
  font-family: var(--font-display);
}
.onboarding-spike .retro-computer-atropos {
  width: min(42vw, 380px);
}
.onboarding-spike .onboard-text {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  max-width: 26rem;
}
.onboarding-spike .onboard-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  text-align: left;
}
.onboarding-spike .onboard-title {
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.onboarding-spike .onboard-body {
  font-size: 0.95rem;
  line-height: 1.6;
  opacity: 0.72;
}
.onboarding-spike .onboard-status-line {
  font-size: 0.85rem;
  line-height: 1.5;
  opacity: 0.55;
  font-family: var(--font-mono, ui-monospace, monospace);
}
.onboarding-spike .onboard-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-start;
}
@media (max-width: 860px) {
  .onboarding-spike {
    flex-direction: column;
    gap: 2.5rem;
  }
  .onboarding-spike .retro-computer-atropos {
    width: min(70vw, 420px);
  }
  .onboarding-spike .onboard-text {
    align-items: center;
  }
  .onboarding-spike .onboard-copy {
    align-items: center;
    text-align: center;
  }
  .onboarding-spike .onboard-actions {
    justify-content: center;
  }
}

/* Reduced motion: disable tilt, glitch, fragment motion; keep static scene. */
@media (prefers-reduced-motion: reduce) {
  .onboarding-spike .retro-computer-atropos .atropos-inner { pointer-events: none; }
}
`
```

- [ ] **Step 2: Add `<style>` to `onboarding-gate.tsx`**

Add import at the top (after existing imports):

```tsx
import { onboardingStyles } from './styles'
```

Wrap the return in a fragment with `<style>`:

```tsx
  return (
    <>
      <style>{onboardingStyles}</style>
      <section className={cn('onboarding-spike')}>
        {/* ... existing children unchanged ... */}
      </section>
    </>
  )
```

The full updated return block:

```tsx
  return (
    <>
      <style>{onboardingStyles}</style>
      <section className={cn('onboarding-spike')}>
        {/* Ambient letter-glitch field — bottom layer, never intercepts pointer. */}
        <div className="onboard-letter-field" aria-hidden>
          <LetterGlitch disabled={reduced} glitchSpeed={140} />
        </div>

        <RetroComputerAtropos className="retro-computer-atropos" inactive={reduced} />

        <div className="onboard-text">
          <div className="onboard-copy">
            <h1 className="onboard-title">Monitor not connected</h1>
            <p className="onboard-body">
              Install the OhMyC plugin to start collecting local coding activity.
            </p>
            {line ? <p className="onboard-status-line">{line}</p> : null}
          </div>

          <div className="onboard-actions">
            <Button asChild variant="default" size="lg">
              <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">
                <ExternalLink /> Open plugin repo
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={isFetching}
              onClick={() => {
                void refetch()
              }}
            >
              <RotateCw /> Retry
            </Button>
          </div>
        </div>
      </section>
    </>
  )
```

- [ ] **Step 3: Delete the onboarding CSS block from `globals.css`**

Delete lines 1451–1653 in `packages/ui/src/globals.css` — starting from the comment:
```css
/* ---------------------------------------------------------------------------
 * Onboarding setup gate — frosted-ivory-lamplit Atropos retro computer scene.
```

through the end of the file (the reduced-motion media query block).

- [ ] **Step 4: Verify type check and tests pass**

Run:
```bash
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
```

Expected: tsc clean, all 148 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/onboarding/styles.ts packages/ui/src/components/onboarding/onboarding-gate.tsx packages/ui/src/globals.css
git commit -m "refactor(ui): migrate onboarding CSS to co-located styles.ts + inline style tag"
```

---

## Task 3: Migrate `.timeline-*` → `timeline/styles.ts`

**Files:**
- Create: `packages/ui/src/components/timeline/styles.ts`
- Modify: `packages/ui/src/components/timeline/timeline-view.tsx`
- Modify: `packages/ui/src/components/timeline/contribution-graph.tsx`
- Modify: `packages/ui/src/globals.css` (delete lines 1142–1347)

Has 7 `@apply` directives that redistribute to `className`. Two exports: `timelinePageStyles` (consumed by `timeline-view.tsx`) and `heatmapCardStyles` (consumed by `contribution-graph.tsx`).

### `@apply` redistributions for this task

| Class | Utilities → `className` | Element location |
|-------|------------------------|-----------------|
| `.timeline-heatmap-card` | `relative p-5` | `contribution-graph.tsx:183` |
| `.timeline-heatmap-months` | `text-xs uppercase` | `contribution-graph.tsx:206` |
| `.timeline-heatmap-dows` | `text-xs` | `contribution-graph.tsx:223` |
| `.timeline-tabs` | `h-auto overflow-hidden p-0` | `timeline-view.tsx:118` |
| `.timeline-tab` (×2) | `h-auto px-3 py-2` | `timeline-view.tsx:121,127` |
| `.timeline-filter-select` | `h-auto px-3 py-2` | `timeline-view.tsx:239` |
| `.timeline-stats` | `text-xs` | `timeline-view.tsx:149` |
| `.timeline-stats .sep` (×2) | `mx-1` | `timeline-view.tsx:152,156` |

- [ ] **Step 1: Create `packages/ui/src/components/timeline/styles.ts`**

Two exports. CSS content is from `globals.css` lines 1142–1347, with `@apply` lines removed (the utilities they contained move to `className` in Step 2 and 3).

```ts
/**
 * Timeline page chrome styles — page title, lede, tabs, filter, stats.
 * Rendered by TimelineView via <style>.
 */
export const timelinePageStyles = `
.timeline-page-title {
  color: var(--timeline-title-color);
  font-family: var(--timeline-title-font);
  font-size: var(--timeline-title-size);
  font-weight: var(--timeline-title-weight);
  letter-spacing: var(--timeline-title-letter-spacing);
  line-height: var(--timeline-title-line-height);
  text-shadow: var(--timeline-title-shadow);
  text-transform: var(--timeline-title-transform);
}
.timeline-page-title::before {
  content: var(--timeline-title-prefix);
  color: var(--timeline-title-prefix-color);
  font-weight: 400;
  text-shadow: var(--timeline-title-prefix-shadow);
}
.timeline-page-lede {
  color: var(--timeline-lede-color);
  font-family: var(--timeline-lede-font);
  font-size: var(--timeline-lede-size);
  font-weight: var(--timeline-lede-weight);
  letter-spacing: var(--timeline-lede-letter-spacing);
  line-height: var(--timeline-lede-line-height);
}
.timeline-tabs {
  border: 1px solid var(--timeline-control-border);
  border-radius: var(--timeline-control-radius);
  background: var(--timeline-control-bg);
  clip-path: var(--timeline-control-clip);
}
.timeline-tab {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--timeline-control-color);
  font-family: var(--timeline-control-font);
  font-size: var(--timeline-control-size);
  font-weight: var(--timeline-control-weight);
  letter-spacing: var(--timeline-control-letter-spacing);
  line-height: 1.2;
  text-transform: var(--timeline-control-transform);
  box-shadow: none !important;
  text-shadow: none;
}
.timeline-tab + .timeline-tab {
  border-left: 1px solid var(--border-subtle);
}
.timeline-tab:hover {
  color: var(--timeline-control-hover-color);
  text-shadow: var(--timeline-control-hover-shadow);
}
.timeline-tab[data-state='active'] {
  background: var(--timeline-control-active-bg) !important;
  color: var(--timeline-control-active-color) !important;
  box-shadow: var(--timeline-control-active-shadow) !important;
  text-shadow: var(--timeline-control-active-text-shadow) !important;
}
.timeline-filter-select {
  border: 1px solid var(--timeline-select-border);
  border-radius: var(--timeline-control-radius);
  background: var(--timeline-select-bg) !important;
  color: var(--timeline-select-color);
  clip-path: var(--timeline-control-clip);
  font-family: var(--timeline-control-font);
  font-size: var(--timeline-control-size);
  font-weight: var(--timeline-control-weight);
  letter-spacing: var(--timeline-control-letter-spacing);
  line-height: 1.2;
  text-shadow: var(--timeline-control-hover-shadow);
  text-transform: var(--timeline-control-transform);
}
.timeline-filter-select:hover,
.timeline-filter-select[data-state='open'] {
  border-color: var(--timeline-select-hover-border);
  box-shadow: var(--timeline-select-hover-shadow);
}
.timeline-filter-label {
  color: var(--timeline-select-label-color);
  text-shadow: none;
}
.timeline-filter-value {
  color: var(--timeline-select-color);
}
.timeline-stats {
  color: var(--timeline-stats-color);
  font-family: var(--timeline-stats-font);
  letter-spacing: var(--timeline-stats-letter-spacing);
}
.timeline-stats b {
  color: var(--timeline-stats-value-color);
  font-weight: 500;
  text-shadow: var(--timeline-stats-shadow);
}
.timeline-stats .sep {
  color: var(--timeline-stats-sep-color);
}
`

/**
 * Heatmap card styles — card container, month strip, DOW labels, legend.
 * Rendered by ContributionGraph via <style>.
 */
export const heatmapCardStyles = `
.timeline-heatmap-card {
  background: var(--heatmap-panel-bg);
  border: 1px solid var(--heatmap-panel-border);
  border-radius: var(--heatmap-panel-radius);
  box-shadow: var(--heatmap-panel-shadow);
  clip-path: var(--heatmap-panel-clip);
}
.timeline-heatmap-card::before,
.timeline-heatmap-card::after {
  content: '';
  position: absolute;
  width: var(--heatmap-corner-size);
  height: var(--heatmap-corner-size);
  pointer-events: none;
}
.timeline-heatmap-card::before {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--heatmap-corner-a-color);
  border-left: 2px solid var(--heatmap-corner-a-color);
  box-shadow: var(--heatmap-corner-a-shadow);
}
.timeline-heatmap-card::after {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--heatmap-corner-b-color);
  border-bottom: 2px solid var(--heatmap-corner-b-color);
  box-shadow: var(--heatmap-corner-b-shadow);
}
.timeline-heatmap-months {
  color: var(--heatmap-month-color);
  font-family: var(--heatmap-month-font);
  font-weight: var(--heatmap-month-weight);
  letter-spacing: var(--heatmap-month-letter-spacing);
  text-shadow: var(--heatmap-month-shadow);
}
.timeline-heatmap-dows {
  color: var(--heatmap-dow-color);
  font-family: var(--heatmap-dow-font);
  font-weight: var(--heatmap-dow-weight);
  letter-spacing: var(--heatmap-dow-letter-spacing);
}
.timeline-heatmap-dow-visible {
  color: var(--heatmap-dow-active-color);
  text-shadow: var(--heatmap-dow-active-shadow);
}
.timeline-heatmap-legend {
  color: var(--heatmap-legend-color);
  font-family: var(--heatmap-legend-font);
  font-size: var(--heatmap-legend-size);
  font-weight: 400;
  letter-spacing: var(--heatmap-legend-letter-spacing);
  text-transform: uppercase;
}
[data-theme='cyberpunk'] .timeline-heatmap-card::before {
  top: 0;
  left: 0;
  width: 30%;
  height: 0.125rem;
  background: var(--accent-primary);
  border: 0;
  box-shadow: var(--text-glow);
}
`
```

- [ ] **Step 2: Update `timeline-view.tsx` — import, render `<style>`, redistribute `@apply`**

Add import after existing imports:

```tsx
import { timelinePageStyles } from './styles'
```

Redistribute `@apply` to `className` — 7 changes:

Line 118 — `.timeline-tabs`:
```tsx
// Before:
<TabsList className="timeline-tabs">

// After:
<TabsList className="h-auto overflow-hidden p-0 timeline-tabs">
```

Line 121 — first `.timeline-tab`:
```tsx
// Before:
className="timeline-tab"

// After:
className="h-auto px-3 py-2 timeline-tab"
```

Line 127 — second `.timeline-tab`:
```tsx
// Before:
className="timeline-tab"

// After:
className="h-auto px-3 py-2 timeline-tab"
```

Line 149 — `.timeline-stats`:
```tsx
// Before:
<span className="timeline-stats">

// After:
<span className="text-xs timeline-stats">
```

Line 152 — first `.sep`:
```tsx
// Before:
<span className="sep">·</span>

// After:
<span className="sep mx-1">·</span>
```

Line 156 — second `.sep`:
```tsx
// Before:
<span className="sep">·</span>

// After:
<span className="sep mx-1">·</span>
```

Line 239 — `.timeline-filter-select`:
```tsx
// Before:
className="timeline-filter-select focus-visible:ring-0 [&_svg]:size-3"

// After:
className="h-auto px-3 py-2 timeline-filter-select focus-visible:ring-0 [&_svg]:size-3"
```

Add `<style>` to the return — wrap in fragment:

```tsx
  return (
    <>
      <style>{timelinePageStyles}</style>
      <div className="w-full max-w-4xl">
        {/* ... existing children unchanged ... */}
      </div>
    </>
  )
```

- [ ] **Step 3: Update `contribution-graph.tsx` — import, render `<style>`, redistribute `@apply`**

Add import after existing imports:

```tsx
import { heatmapCardStyles } from './styles'
```

Redistribute `@apply` to `className` — 3 changes:

Line 183 — `.timeline-heatmap-card`:
```tsx
// Before:
className="timeline-heatmap-card"

// After:
className="relative p-5 timeline-heatmap-card"
```

Line 206 — `.timeline-heatmap-months`:
```tsx
// Before:
className="timeline-heatmap-months"

// After:
className="text-xs uppercase timeline-heatmap-months"
```

Line 223 — `.timeline-heatmap-dows`:
```tsx
// Before:
className="timeline-heatmap-dows"

// After:
className="text-xs timeline-heatmap-dows"
```

Add `<style>` to the return — wrap in fragment. The current return starts at line 179:

```tsx
  return (
    <>
      <style>{heatmapCardStyles}</style>
      <div
        ref={cardRef}
        data-testid="timeline-heatmap-card"
        className="relative p-5 timeline-heatmap-card"
        style={{
          '--heatmap-cell': `${cellSize}px`,
          '--heatmap-row-gap': `${rowGap}px`,
        } as CSSProperties}
      >
        {/* ... existing children unchanged ... */}
      </div>
    </>
  )
```

- [ ] **Step 4: Delete the timeline CSS block from `globals.css`**

Delete lines 1142–1347 in `packages/ui/src/globals.css` — starting from:
```css
  .timeline-heatmap-card {
```

through:
```css
  .timeline-stats .sep {
    @apply mx-1;
    color: var(--timeline-stats-sep-color);
  }
```

Leave `.font-display` and everything after intact.

- [ ] **Step 5: Verify type check and tests pass**

Run:
```bash
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
```

Expected: tsc clean, all 148 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/timeline/styles.ts packages/ui/src/components/timeline/timeline-view.tsx packages/ui/src/components/timeline/contribution-graph.tsx packages/ui/src/globals.css
git commit -m "refactor(ui): migrate timeline CSS to co-located styles.ts + inline style tag"
```

---

## Task 4: Migrate `.menubar-*` + `.menubar-onboard-*` → `menubar/styles.ts`

**Files:**
- Create: `packages/ui/src/components/menubar/styles.ts`
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`
- Modify: `packages/ui/src/components/menubar/menubar-onboard.tsx`
- Modify: `packages/ui/src/globals.css` (delete lines 906–1140)

Has 3 `@apply` directives that redistribute to `className`. Two exports: `menubarPopoverStyles` (shared — consumed by both `menubar-page.tsx` and `menubar-onboard.tsx`) and `menubarOnboardStyles` (consumed only by `menubar-onboard.tsx`).

### `@apply` redistributions for this task

| Class | Utilities → `className` | Element locations |
|-------|------------------------|------------------|
| `.menubar-popover` | `relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)]` | `menubar-page.tsx:84`, `menubar-onboard.tsx:21` |
| `.menubar-content` | `relative z-[1]` | `menubar-page.tsx:88`, `menubar-onboard.tsx:23` |
| `.menubar-chart-area` | `relative -mx-1 min-h-[168px] rounded` | `menubar-page.tsx:96` (line view only) |

- [ ] **Step 1: Create `packages/ui/src/components/menubar/styles.ts`**

Two exports. CSS content is from `globals.css` lines 906–1140, with `@apply` lines removed.

```ts
/**
 * Menubar popover shell styles — popover container, title, view buttons,
 * chart area, KPI values, labels, footer, open button.
 *
 * Rendered by MenubarActivity (via menubar-page.tsx) and MenubarOnboard
 * via <style>. Child components (view-switch, recent-heatmap) trust the
 * parent has loaded these styles.
 */
export const menubarPopoverStyles = `
.menubar-popover {
  background: var(--menubar-popover-bg);
  backdrop-filter: var(--menubar-popover-backdrop);
  border: 1px solid var(--menubar-popover-border);
  border-radius: var(--menubar-popover-radius);
  box-shadow: var(--menubar-popover-shadow);
  clip-path: var(--menubar-popover-clip);
}

.menubar-popover::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--menubar-popover-overlay);
  mix-blend-mode: screen;
}

.menubar-popover::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0.125rem;
  pointer-events: none;
  background: var(--menubar-popover-accent);
  box-shadow: var(--menubar-title-shadow);
}

[data-theme='cyberpunk'] .menubar-popover::after {
  right: auto;
  width: 50%;
}

.menubar-popover-corner {
  position: absolute;
  right: 0;
  bottom: 1.125rem;
  width: 1.125rem;
  height: 1.125rem;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  background: var(--menubar-popover-corner);
  opacity: 0.5;
  pointer-events: none;
}

.menubar-title {
  color: var(--menubar-title-color);
  font-family: var(--menubar-title-font);
  font-size: var(--menubar-title-size);
  font-weight: var(--menubar-title-weight);
  letter-spacing: var(--menubar-title-letter-spacing);
  line-height: 1;
  text-shadow: var(--menubar-title-shadow);
  text-transform: uppercase;
}

.menubar-title::before {
  content: var(--menubar-title-prefix);
  color: var(--menubar-title-prefix-color);
  text-shadow: var(--menubar-switch-hover-shadow);
}

.menubar-view-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--menubar-switch-size);
  height: var(--menubar-switch-size);
  padding: 0;
  color: var(--menubar-switch-color);
  background: transparent;
  border: 1px solid var(--menubar-switch-border);
  border-radius: var(--menubar-switch-radius);
  clip-path: var(--menubar-switch-clip);
  cursor: pointer;
  line-height: 1;
  transition:
    color var(--motion-fast) var(--motion-ease-out),
    background-color var(--motion-fast) var(--motion-ease-out),
    border-color var(--motion-fast) var(--motion-ease-out);
}

.menubar-view-button:hover {
  color: var(--menubar-switch-hover-color);
  background: var(--menubar-switch-hover-bg);
  border-color: var(--menubar-switch-hover-border);
  text-shadow: var(--menubar-switch-hover-shadow);
}

.menubar-view-button[data-active='true'] {
  color: var(--menubar-switch-active-color);
  background: var(--menubar-switch-active-bg);
  border-color: var(--menubar-switch-active-border);
  filter: var(--menubar-switch-active-shadow);
}

.menubar-chart-area {
  background: var(--menubar-chart-bg);
}

.menubar-kpi-value {
  color: var(--menubar-kpi-token-color);
  font-family: var(--menubar-kpi-font);
  font-size: var(--menubar-kpi-size);
  font-weight: var(--menubar-kpi-weight);
  letter-spacing: var(--menubar-kpi-letter-spacing);
  line-height: var(--menubar-kpi-line-height);
  font-variant-numeric: tabular-nums;
}

.menubar-kpi-value[data-kpi='tokens'] {
  color: var(--menubar-kpi-token-color);
  text-shadow: var(--menubar-kpi-token-shadow);
}

.menubar-kpi-value[data-kpi='sessions'] {
  color: var(--menubar-kpi-session-color);
  text-shadow: var(--menubar-kpi-session-shadow);
}

.menubar-kpi-value[data-kpi='peak'] {
  color: var(--menubar-kpi-peak-color);
  text-shadow: var(--menubar-kpi-peak-shadow);
}

.menubar-label {
  color: var(--menubar-label-color);
  font-family: var(--menubar-label-font);
  font-size: var(--menubar-label-size);
  font-weight: var(--menubar-label-weight);
  letter-spacing: var(--menubar-label-letter-spacing);
  text-transform: uppercase;
}

.menubar-footer-meta {
  color: var(--menubar-footer-meta-color);
  text-shadow: var(--menubar-open-shadow);
}

.menubar-open {
  color: var(--menubar-open-color);
  background: var(--menubar-open-bg);
  border: 1px solid var(--menubar-open-border);
  clip-path: var(--menubar-open-clip);
  padding: var(--menubar-open-padding);
  text-shadow: var(--menubar-open-shadow);
}

.menubar-open:hover {
  color: var(--menubar-open-hover-color);
  border-color: currentColor;
}
`

/**
 * Compact onboarding state styles — shrunk retro-computer scene + centered copy.
 * Rendered by MenubarOnboard via <style> (combined with menubarPopoverStyles).
 */
export const menubarOnboardStyles = `
.menubar-onboard-scene {
  position: relative;
  height: 188px;
  margin: 0 -0.25rem 0.5rem;
  overflow: hidden;
  border-radius: var(--menubar-popover-radius);
  display: flex;
  align-items: center;
  justify-content: center;
}
.menubar-onboard-glitch {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.14;
  pointer-events: none;
}
.menubar-onboard-computer {
  position: relative;
  z-index: 1;
  width: 132px;
  aspect-ratio: 1 / 1;
}
.menubar-onboard-computer .atropos-inner {
  overflow: visible;
  border-radius: 0;
  background: transparent;
}
.menubar-onboard-computer .onboard-atropos-scene {
  position: absolute;
  inset: 0;
}
.menubar-onboard-computer .onboard-keyboard img,
.menubar-onboard-computer .onboard-keyboard-back img {
  transform: translate(-6%, 28%) scale(0.7);
}
.menubar-onboard-computer .onboard-keyboard-back img {
  transform: translate(-6%, 28%) scale(0.7) translate(10px, 8px);
}
.menubar-onboard-computer .onboard-letter-bg,
.menubar-onboard-computer .onboard-rim {
  display: none;
}
.menubar-onboard-head {
  text-align: center;
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.menubar-onboard-sub {
  text-align: center;
  font-family: var(--menubar-label-font);
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--menubar-label-color);
  max-width: 16rem;
  margin: 0.125rem auto 0;
}
.menubar-onboard-status {
  text-align: center;
  font-family: var(--font-mono, var(--menubar-label-font));
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--menubar-title-prefix-color);
  margin-top: 0.25rem;
}
`
```

- [ ] **Step 2: Update `menubar-page.tsx` — import, render `<style>`, redistribute `@apply`**

Add import after existing imports:

```tsx
import { menubarPopoverStyles } from './styles'
```

Redistribute `@apply` to `className` — 3 changes in `MenubarActivity`:

Line 84 — `.menubar-popover`:
```tsx
// Before:
className="menubar-popover"

// After:
className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover"
```

Line 88 — `.menubar-content`:
```tsx
// Before:
className="menubar-content"

// After:
className="relative z-[1] menubar-content"
```

Line 96 — `.menubar-chart-area` (conditional className):
```tsx
// Before:
className={view === 'line' ? 'menubar-chart-area' : 'relative -mx-1 min-h-[168px]'}

// After:
className={view === 'line' ? 'relative -mx-1 min-h-[168px] rounded menubar-chart-area' : 'relative -mx-1 min-h-[168px]'}
```

Add `<style>` — wrap `MenubarActivity`'s return in a fragment:

```tsx
  return (
    <>
      <style>{menubarPopoverStyles}</style>
      <div
        className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover"
        data-menubar-page
      >
        {/* ... existing children unchanged ... */}
      </div>
    </>
  )
```

- [ ] **Step 3: Update `menubar-onboard.tsx` — import, render `<style>`, redistribute `@apply`**

Add import after existing imports:

```tsx
import { menubarOnboardStyles, menubarPopoverStyles } from './styles'
```

Redistribute `@apply` to `className` — 2 changes:

Line 21 — `.menubar-popover`:
```tsx
// Before:
className="menubar-popover"

// After:
className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover"
```

Line 23 — `.menubar-content`:
```tsx
// Before:
className="menubar-content"

// After:
className="relative z-[1] menubar-content"
```

Add `<style>` — wrap return in fragment with both style exports:

```tsx
  return (
    <>
      <style>{menubarPopoverStyles + menubarOnboardStyles}</style>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover" data-menubar-page>
        {/* ... existing children unchanged ... */}
      </div>
    </>
  )
```

- [ ] **Step 4: Delete the menubar CSS block from `globals.css`**

Delete lines 906–1140 in `packages/ui/src/globals.css` — starting from:
```css
  .menubar-popover {
    @apply relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)];
```

through:
```css
  .menubar-open:hover {
    color: var(--menubar-open-hover-color);
    border-color: currentColor;
  }
```

This includes the `.menubar-onboard-*` block (lines 1053–1127) which sits between the main menubar classes and `.menubar-open`.

Leave `.timeline-heatmap-card` (already deleted in Task 3 if sequential) or whatever follows intact.

- [ ] **Step 5: Verify type check and tests pass**

Run:
```bash
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
```

Expected: tsc clean, all 148 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/menubar/styles.ts packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/components/menubar/menubar-onboard.tsx packages/ui/src/globals.css
git commit -m "refactor(ui): migrate menubar CSS to co-located styles.ts + inline style tag"
```

---

## Post-Migration Verification

After all 4 tasks are complete:

- [ ] **Verify `globals.css` line count dropped significantly**

```bash
wc -l packages/ui/src/globals.css
```

Expected: ~870 lines (down from 1653).

- [ ] **Verify no `@apply` remains in migrated component CSS**

Search the new `styles.ts` files for any leftover `@apply`:

```bash
rg "@apply" packages/ui/src/components/*/styles.ts
```

Expected: no matches.

- [ ] **Full test suite + type check**

```bash
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
```

Expected: tsc clean, all 148 tests pass.
