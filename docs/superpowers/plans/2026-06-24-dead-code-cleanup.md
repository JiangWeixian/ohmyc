# Dead-Code Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all High-confidence dead code identified by the `/fire` analysis — dead files, dead symbols, unused dependencies, and stale config.

**Architecture:** Delete in 5 reversible batches: (1) fully-dead files + tests, (2) dead symbols from live files, (3) dead symbol tests, (4) unused dependencies + storybook config, (5) config cleanup. Each batch ends with build + test verification.

**Tech Stack:** React 19, TypeScript, Vite, pnpm workspace.

---

## File Structure

**Delete (source):**
- `src/components/monitor-spike/dark-veil.tsx`
- `src/lib/markdown-frontmatter.ts`
- `src/hooks/use-store.ts`
- `src/hooks/use-settings.ts`
- `src/hooks/use-configs.ts`
- `src/utils/truncate-url.ts`
- `src/utils/mask-api-key.ts`
- `src/components/monitor/monitor-view.tsx`
- `src/components/monitor/lanyard-stage.tsx`
- `src/components/monitor/react-bits-lanyard.tsx`
- `src/components/markdown-editor.tsx`
- `src/components/codemirror-container-theme.ts`

**Delete (tests):**
- `tests/hooks/use-store.test.tsx`
- `tests/hooks/use-settings.test.tsx`
- `tests/hooks/use-configs.test.tsx`
- `tests/utils/truncate-url.test.ts`
- `tests/utils/mask-api-key.test.ts`
- `tests/components/markdown-editor.test.tsx`
- `tests/components/monitor/monitor-view.test.tsx`
- `tests/components/chart.test.tsx`

**Modify (remove dead symbols):**
- `src/components/badge.tsx` — remove `Badge`, keep `MonoBadge`
- `src/components/icons.ts` — remove `IconProps`, keep `IconType`
- `src/components/command-palette.tsx` — remove `KeyboardShortcut` + `getKeyLabel`
- `src/components/chart.tsx` — remove `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`
- `src/components/uitripled/native-dialog.tsx` — remove `NativeDialogTrigger`, `NativeDialogClose`
- `src/components/monitor-spike/lanyard.tsx` — remove `Lanyard` function
- `tests/components/command-palette.test.tsx` — remove `KeyboardShortcut` test + import

**Modify (deps + config):**
- `package.json` — remove unused deps
- `.storybook/main.ts` — remove `@lobehub/ui` references
- `tailwind.config.mjs` — remove `.deco-scanlines`, `.deco-vignette`
- `tests/test/setup.ts` — remove duplicate localStorage defineProperty

**Keep (user request):**
- `@radix-ui/react-avatar` — retained
- `@radix-ui/react-separator` — retained

---

### Task 1: Delete fully-dead source files + their tests

**Files:**
- Delete: 12 source files + 7 test files (listed below)

- [ ] **Step 1: Delete orphan source files (zero production references)**

```bash
rm packages/ui/src/components/monitor-spike/dark-veil.tsx
rm packages/ui/src/lib/markdown-frontmatter.ts
```

- [ ] **Step 2: Delete dead hooks + their tests**

```bash
rm packages/ui/src/hooks/use-store.ts
rm packages/ui/src/hooks/use-settings.ts
rm packages/ui/src/hooks/use-configs.ts
rm packages/ui/tests/hooks/use-store.test.tsx
rm packages/ui/tests/hooks/use-settings.test.tsx
rm packages/ui/tests/hooks/use-configs.test.tsx
```

- [ ] **Step 3: Delete dead utils + their tests**

```bash
rm packages/ui/src/utils/truncate-url.ts
rm packages/ui/src/utils/mask-api-key.ts
rm packages/ui/tests/utils/truncate-url.test.ts
rm packages/ui/tests/utils/mask-api-key.test.ts
```

- [ ] **Step 4: Delete superseded monitor/ view chain + its test**

The `monitor/` folder is superseded by `monitor-spike/`. Only `monitor-stats.tsx` survives (used by `monitor-spike-view.tsx`).

```bash
rm packages/ui/src/components/monitor/monitor-view.tsx
rm packages/ui/src/components/monitor/lanyard-stage.tsx
rm packages/ui/src/components/monitor/react-bits-lanyard.tsx
rm packages/ui/tests/components/monitor/monitor-view.test.tsx
```

- [ ] **Step 5: Delete markdown-editor + codemirror-container-theme + test**

```bash
rm packages/ui/src/components/markdown-editor.tsx
rm packages/ui/src/components/codemirror-container-theme.ts
rm packages/ui/tests/components/markdown-editor.test.tsx
```

- [ ] **Step 6: Delete empty directories if any**

```bash
rmdir packages/ui/src/utils 2>/dev/null; true
rmdir packages/ui/tests/components/monitor 2>/dev/null; true
rmdir packages/ui/tests/utils 2>/dev/null; true
```

- [ ] **Step 7: Verify build**

```bash
cd packages/ui && pnpm build 2>&1 | tail -5
```

Expected: `✓ built` — no errors. If a non-deleted file imports a deleted file, fix the import or note it.

- [ ] **Step 8: Verify tests**

```bash
cd packages/ui && pnpm test 2>&1 | tail -5
```

Expected: all remaining tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m ":fire: chore(ui): remove 12 dead source files and their tests

Deleted (zero production references):
- dark-veil.tsx (162 LOC)
- markdown-frontmatter.ts (103 LOC)
- use-store.ts + use-settings.ts + use-configs.ts (305 LOC)
- truncate-url.ts + mask-api-key.ts (29 LOC)
- monitor-view.tsx + lanyard-stage.tsx + react-bits-lanyard.tsx (superseded by monitor-spike)
- markdown-editor.tsx + codemirror-container-theme.ts (entity-detail uses MarkdownRenderer)"
```

---

### Task 2: Remove dead symbols from live files

**Files:**
- Modify: `src/components/badge.tsx`
- Modify: `src/components/icons.ts`
- Modify: `src/components/command-palette.tsx`
- Modify: `src/components/chart.tsx`
- Modify: `src/components/uitripled/native-dialog.tsx`
- Modify: `src/components/monitor-spike/lanyard.tsx`

- [ ] **Step 1: Remove `Badge` from `badge.tsx`**

In `packages/ui/src/components/badge.tsx`, remove the `Badge` function (lines 24-37) and the `BadgeProperties` interface (lines 18-22) and the `colorClasses`/`BadgeVariant` types (lines 8-16). Keep `MonoBadge` (lines 39-49) and the `ShadcnBadge`/`cn` imports it needs.

The resulting file should be:

```tsx
// Styled badge variants — monospace badges for entity metadata.
import React from 'react'

import { Badge as ShadcnBadge } from '@/components/ui/badge'

/** Monospace badge for technical values (e.g. file extensions, version strings). */
export function MonoBadge({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnBadge
      variant="outline"
      className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--surface-panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]"
    >
      {children}
    </ShadcnBadge>
  )
}
```

Note: `cn` import is no longer needed since MonoBadge uses a static className string. Remove it.

- [ ] **Step 2: Remove `IconProps` from `icons.ts`**

In `packages/ui/src/components/icons.ts`, remove the `IconProps` interface (lines 7-10). Keep `IconType`.

The resulting file should be:

```ts
// Type aliases for Lucide icon components used across entity cards and sections.
import type { LucideIcon } from 'lucide-react'

/** Convenience alias for any Lucide icon component. */
export type IconType = LucideIcon
```

- [ ] **Step 3: Remove `KeyboardShortcut` + `getKeyLabel` from `command-palette.tsx`**

In `packages/ui/src/components/command-palette.tsx`, remove:
- `getKeyLabel` function (lines 157-171)
- `KeyboardShortcut` function (lines 173-194)

These are at the end of the file (after the `AppCommandPalette` component's closing brace at line 155). Simply truncate the file after line 155.

After removal, check if `React` default import is still needed. It is used by `useEffect`/`useState` via `import React, { useEffect, useState } from 'react'`. If no other code in the file references `React.` (the default), simplify to `import { useEffect, useState } from 'react'`. Check with:

```bash
rg "React\." packages/ui/src/components/command-palette.tsx
```

If the only match is `React.Fragment` (now deleted), change the import line to remove the `React` default.

- [ ] **Step 4: Remove dead chart symbols from `chart.tsx`**

In `packages/ui/src/components/chart.tsx`, remove these 4 exports:
- `ChartTooltip` (line 115): `const ChartTooltip = RechartsPrimitive.Tooltip`
- `ChartTooltipContent` (lines 117-272): the full function
- `ChartLegend` (line 274): `const ChartLegend = RechartsPrimitive.Legend`
- `ChartLegendContent` (lines 276-376): the full function

Keep: `ChartContainer`, `ChartConfig`, `ChartContext`, `ChartStyle` (if present).

After removal, check if `RechartsPrimitive.Tooltip` and `RechartsPrimitive.Legend` are still referenced. If not, the `RechartsPrimitive` import may need narrowing. Verify with:

```bash
rg "RechartsPrimitive\.(Tooltip|Legend)" packages/ui/src/components/chart.tsx
```

- [ ] **Step 5: Remove `NativeDialogTrigger` + `NativeDialogClose` from `native-dialog.tsx`**

In `packages/ui/src/components/uitripled/native-dialog.tsx`, remove:
- Line 25: `const NativeDialogTrigger = DialogPrimitive.Trigger`
- Line 31: `const NativeDialogClose = DialogPrimitive.Close`

Keep all other exports (`NativeDialog`, `NativeDialogPortal`, `NativeDialogOverlay`, `NativeDialogContent`, etc.).

- [ ] **Step 6: Remove `Lanyard` function from `lanyard.tsx`**

In `packages/ui/src/components/monitor-spike/lanyard.tsx`, remove the `Lanyard` function (lines 83-122). This function wraps `LanyardScene` in a `<Canvas>` — it's only used by the deleted `react-bits-lanyard.tsx`.

Keep `LanyardScene` (line 124+) and `LanyardProps` interface (line 58) — `LanyardSceneProps` (line 70) uses `Pick<LanyardProps, ...>`.

- [ ] **Step 7: Verify build**

```bash
cd packages/ui && pnpm build 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m ":fire: chore(ui): remove dead exports from live files

- badge.tsx: remove Badge (keep MonoBadge)
- icons.ts: remove IconProps (keep IconType)
- command-palette.tsx: remove KeyboardShortcut + getKeyLabel
- chart.tsx: remove ChartTooltip/ChartTooltipContent/ChartLegend/ChartLegendContent
- native-dialog.tsx: remove NativeDialogTrigger/NativeDialogClose
- lanyard.tsx: remove Lanyard wrapper (keep LanyardScene)"
```

---

### Task 3: Remove dead symbol tests

**Files:**
- Delete: `tests/components/chart.test.tsx`
- Modify: `tests/components/command-palette.test.tsx`

- [ ] **Step 1: Delete chart test file**

`chart.test.tsx` only tests `ChartTooltipContent` and `ChartLegendContent` — both removed in Task 2.

```bash
rm packages/ui/tests/components/chart.test.tsx
```

- [ ] **Step 2: Remove KeyboardShortcut test from `command-palette.test.tsx`**

In `packages/ui/tests/components/command-palette.test.tsx`:

1. Remove `KeyboardShortcut` from the import (line 17):
   - Change `import { CommandPalette, CommandPaletteProvider, KeyboardShortcut, useCommandPalette } from '@/components/command-palette'`
   - To: `import { CommandPalette, CommandPaletteProvider, useCommandPalette } from '@/components/command-palette'`

2. Delete the test block "renders shortcut labels with platform glyphs" (lines 71-77):
   ```tsx
   it('renders shortcut labels with platform glyphs', () => {
     render(<KeyboardShortcut shortcut="meta+shift+k" />)
     expect(screen.getByText('⌘')).toBeInTheDocument()
     expect(screen.getByText('⇧')).toBeInTheDocument()
     expect(screen.getByText('k')).toBeInTheDocument()
   })
   ```

- [ ] **Step 3: Verify tests pass**

```bash
cd packages/ui && pnpm test 2>&1 | tail -5
```

Expected: all remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m ":white_check_mark: test(ui): remove tests for deleted dead symbols"
```

---

### Task 4: Remove unused dependencies + storybook config

**Files:**
- Modify: `package.json` (via `pnpm remove`)
- Modify: `.storybook/main.ts`

- [ ] **Step 1: Remove unused Radix packages**

```bash
cd packages/ui && pnpm remove @radix-ui/react-checkbox @radix-ui/react-slider @radix-ui/react-tooltip
```

Keeping: `@radix-ui/react-avatar`, `@radix-ui/react-separator` (per user request).

- [ ] **Step 2: Remove CodeMirror packages + js-yaml**

These were only used by the deleted `markdown-editor.tsx` + `codemirror-container-theme.ts` + `markdown-frontmatter.ts`.

```bash
cd packages/ui && pnpm remove @codemirror/commands @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-yaml @codemirror/state @codemirror/theme-one-dark @codemirror/view codemirror js-yaml @types/js-yaml
```

- [ ] **Step 3: Remove other unused deps**

```bash
cd packages/ui && pnpm remove fast-deep-equal @lobehub/ui
```

- [ ] **Step 4: Remove `@lobehub/ui` from storybook config**

In `packages/ui/.storybook/main.ts`, remove the two `'@lobehub/ui'` entries (lines 54 and 62). Keep `'@lobehub/icons'` (it IS used by `event-list.tsx`).

Line 54 context (`optimizeDeps.include`):
```ts
include: [
  ...(config.optimizeDeps?.include ?? []),
  '@lobehub/ui',     // <-- remove this line
  '@lobehub/icons',
],
```

Line 62 context (`ssr.noExternal`):
```ts
noExternal: [
  ...(Array.isArray(config.ssr?.noExternal) ? config.ssr.noExternal : []),
  '@lobehub/ui',     // <-- remove this line
  '@lobehub/icons',
],
```

- [ ] **Step 5: Verify build + test**

```bash
cd packages/ui && pnpm build 2>&1 | tail -5 && pnpm test 2>&1 | tail -5
```

Expected: build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m ":arrow_down: chore(ui): remove 14 unused dependencies

Radix (no wrapper components): react-checkbox, react-slider, react-tooltip
CodeMirror (markdown-editor deleted): @codemirror/* (7), codemirror, js-yaml, @types/js-yaml
Other: fast-deep-equal, @lobehub/ui (keeping @lobehub/icons)"
```

---

### Task 5: Config cleanup

**Files:**
- Modify: `tailwind.config.mjs`
- Modify: `tests/test/setup.ts`

- [ ] **Step 1: Remove unused tailwind utilities**

In `packages/ui/tailwind.config.mjs`, remove these 2 utility definitions (lines 62-68):

```js
      '.deco-scanlines': {
        backgroundImage: 'repeating-linear-gradient(to bottom, var(--scanline-color) 0, var(--scanline-color) 1px, transparent 1px, transparent 3px)',
        opacity: 'var(--scanline-opacity)',
      },
      '.deco-vignette': {
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,calc(var(--vignette-strength) * 0.55)))',
      },
```

Keep `.deco-glow-text`, `.deco-notch`, `.deco-title-shadow` — all three have className usages in source.

- [ ] **Step 2: Remove duplicate localStorage defineProperty**

In `packages/ui/tests/test/setup.ts`, remove the duplicate block (lines 40-43):

```ts
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})
```

Keep the first occurrence (lines 36-39) — it's the identical definition.

- [ ] **Step 3: Verify build + test**

```bash
cd packages/ui && pnpm build 2>&1 | tail -5 && pnpm test 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m ":broom: chore(ui): remove dead tailwind utilities and duplicate test setup"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full test suite**

```bash
cd packages/ui && pnpm test
```

Expected: all tests pass (should be ~168 tests after removing ~9 dead tests).

- [ ] **Step 2: Build**

```bash
cd packages/ui && pnpm build
```

Expected: success.

- [ ] **Step 3: TypeScript check**

```bash
cd packages/ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify desktop package still builds**

```bash
cd packages/desktop && pnpm build 2>&1 | tail -5
```

Expected: success — desktop imports `@ohmyc/ui/app`, `@ohmyc/ui/components/menubar/menubar-page`, `@ohmyc/ui/globals.css`, none of which are affected.

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A && git commit -m ":bug: fix: resolve cleanup verification issues"
```
