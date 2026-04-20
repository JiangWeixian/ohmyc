---
phase: 14-core-ui-migration
plan: 01
subsystem: ui-components
tags: [badge, skeleton, shadcn, migration, framer-motion-removal]
dependency_graph:
  requires: [13-01, 13-02, 13-03]
  provides: [Badge.tsx, migrated-SourceBadge, motion-free-Skeleton]
  affects: [EntityCard, Explorer]
tech_stack:
  added: [shadcn-badge-wrapper]
  patterns: [css-var-colors, no-framer-motion-skeleton]
key_files:
  created:
    - packages/ui/src/components/Badge.tsx
  modified:
    - packages/ui/src/components/EntityCard.tsx
    - packages/ui/src/components/SourceBadge.tsx
    - packages/ui/src/components/__tests__/SourceBadge.test.tsx
    - packages/ui/src/components/ui/Skeleton.tsx
decisions:
  - Badge/MonoBadge wrap shadcn Badge with variant="outline" and className overrides for ClaudeUI tokens
  - SourceBadge uses shadcn Badge directly with variant="secondary" (local) and variant="outline" (others)
  - AnimatedList simplified to plain div wrapper — no animation, same export name for backward compat
  - h-auto min-h-0 overrides shadcn Badge's fixed h-5 for flexible badge sizing
metrics:
  duration: 6min
  completed: 2026-04-19T14:52:36Z
  tasks: 3
  files: 5
  tests_passing: 77
---

# Phase 14 Plan 01: Badge/Skeleton Migration Summary

Badge and MonoBadge extracted to dedicated Badge.tsx using shadcn Badge primitives; SourceBadge migrated to shadcn Badge wrapper with CSS var colors; Skeleton components stripped of framer-motion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract Badge and MonoBadge to Badge.tsx | fcb2090 | Badge.tsx (new), EntityCard.tsx |
| 2 | Migrate SourceBadge to shadcn Badge wrapper | ac3611e | SourceBadge.tsx, SourceBadge.test.tsx |
| 3 | Migrate Skeleton components — remove framer-motion | f8ad207 | Skeleton.tsx |

## What Changed

### Task 1: Badge/MonoBadge Extraction
- Created `packages/ui/src/components/Badge.tsx` with Badge (5 color variants) and MonoBadge components
- Both wrap shadcn `Badge` primitive from `@/components/ui/badge` using `variant="outline"` with className overrides
- EntityCard.tsx removed inline Badge/MonoBadge definitions, added re-export: `export { Badge, MonoBadge } from './Badge'`
- Explorer.tsx import `import { EntityCard, Badge, MonoBadge } from './components/EntityCard'` unchanged — backward compatible

### Task 2: SourceBadge Migration
- Replaced hand-built `<span>` elements with shadcn `<Badge>` wrapper
- Replaced hardcoded `#22c55e` (project green) with `var(--accent-green)` CSS variable
- No hardcoded hex colors remain in SourceBadge
- Updated test assertions from `[#22c55e]` to `[var(--accent-green)]`

### Task 3: Skeleton framer-motion Removal
- Removed all `import { motion } from 'framer-motion'`
- Replaced all `motion.div` with plain `div`
- Removed `initial`, `animate`, `transition` animation props
- Removed stagger delay calculations (`delay: index * 0.05`)
- `AnimatedList` simplified to plain `<div>` wrapper — renders children immediately
- Preserved `animate-pulse` CSS animation for loading shimmer
- All visual styling (colors, sizes, border-radius) unchanged

## Verification

All 77 tests pass across 12 test files — zero regressions.

```
Test Files  12 passed (12)
     Tests  77 passed (77)
```

Key verifications:
- Badge.tsx contains `from '@/components/ui/badge'` ✓
- EntityCard.tsx contains `export { Badge, MonoBadge } from './Badge'` ✓
- SourceBadge.tsx contains `from '@/components/ui/badge'` ✓
- SourceBadge.tsx does NOT contain `#22c55e` or `#5E6AD2` ✓
- Skeleton.tsx does NOT contain `framer-motion` or `motion.` ✓
- All 4 Skeleton exports preserved: Skeleton, CardSkeleton, ListItemSkeleton, AnimatedList ✓

## Decisions Made

1. **shadcn Badge variant="outline" as base**: Used outline variant for Badge/MonoBadge/SourceBadge because it provides the cleanest base (border + text) that can be fully overridden with ClaudeUI color tokens. The `border-transparent` override removes the visible border.

2. **h-auto min-h-0 override**: shadcn Badge has a fixed `h-5` height. Added `h-auto min-h-0` to className overrides to restore the flexible sizing of the original Badge components.

3. **AnimatedList as plain wrapper**: Per D-05/D-15, all card/list entry animations are removed. AnimatedList keeps its export name for backward compatibility but renders children directly in a plain `<div>`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all components are internal display-only with no external data flows.
