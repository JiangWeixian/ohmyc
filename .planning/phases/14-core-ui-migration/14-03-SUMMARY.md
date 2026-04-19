---
phase: 14-core-ui-migration
plan: 03
subsystem: ui-components
tags: [entity-card, config-section, section-header, shadcn-card, framer-motion-removal, explorer]
dependency_graph:
  requires: [14-01]
  provides: [shadcn-EntityCard, shadcn-ConfigEntryCard, plain-SectionHeader, stagger-free-Explorer]
  affects: [Explorer.tsx, EntityCard.tsx, ConfigSection.tsx, SectionHeader.tsx]
tech_stack:
  added: [shadcn Card/CardHeader/CardContent/CardFooter]
  patterns: [inline-css-custom-property-for-accent, no-stagger-card-grid]
key_files:
  created: []
  modified:
    - packages/ui/src/components/EntityCard.tsx
    - packages/ui/src/components/ConfigSection.tsx
    - packages/ui/src/components/SectionHeader.tsx
    - packages/ui/src/Explorer.tsx
decisions:
  - iconAccentVar uses inline style with --icon-accent CSS custom property and fallback in group-hover
  - ConfigEntryCard uses shadcn Card but not sub-components (simple layout doesn't need them)
  - Explorer.tsx framer-motion import removed entirely — no remaining motion usage
  - ConfigEntryCard no longer receives index prop (was only for stagger delay)
metrics:
  duration: 5min
  completed: "2026-04-19"
  tasks: 3
  files: 4
  tests_passing: 77
---

# Phase 14 Plan 03: EntityCard/ConfigSection/SectionHeader + Explorer Cleanup Summary

EntityCard and ConfigSection migrated to shadcn Card primitives; SectionHeader converted to plain HTML; Explorer.tsx stripped of AnimatePresence stagger and framer-motion dependency.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate EntityCard to shadcn Card | 2296aaa | EntityCard.tsx |
| 2 | Migrate ConfigSection and SectionHeader | 7001e9f | ConfigSection.tsx, SectionHeader.tsx |
| 3 | Update Explorer.tsx — remove AnimatePresence stagger, clean imports | 936dc65 | Explorer.tsx |

## What Changed

### Task 1: EntityCard Migration
- Replaced `motion.button` with shadcn `Card` + `CardHeader`, `CardContent`, `CardFooter`
- `iconAccentVar` now injects `--icon-accent` CSS custom property via inline `style` attribute
- Group-hover uses `text-[var(--icon-accent,var(--accent-blue))]` with fallback — avoids purge-risky template literals
- Removed all animation props: `initial`, `animate`, `whileHover`, `whileTap`, `transition`
- Re-export of `Badge`/`MonoBadge` preserved from `./Badge`

### Task 2: ConfigSection + SectionHeader Migration
- **ConfigEntryCard**: `motion.div` → shadcn `Card`, removed `index` prop (was only for stagger), removed `initial`, `animate`, `transition`, `whileHover`
- **ConfigSection**: All `motion.div` wrappers → plain `div`, removed stagger variants (`staggerChildren: 0.05`), removed entry animations on loading/error/empty states
- **SectionHeader**: `motion.div` → `div`, `motion.h1` → `h1`, `motion.p` → `p`, removed all animation props including fade-in delay

### Task 3: Explorer.tsx Cleanup
- Split `import { EntityCard, Badge, MonoBadge } from './components/EntityCard'` into separate imports from `./components/EntityCard` and `./components/Badge`
- Removed `import { motion, AnimatePresence } from 'framer-motion'` entirely (no remaining usage)
- Replaced `AnimatePresence mode="wait"` + `motion.div` card grid with plain `div` grid
- Cards render immediately with no stagger delay (`index * 0.03` removed)
- No `motion.div` wrapper per card — `EntityCard` renders directly in grid

## Verification

All 77 tests pass across 12 test files — zero regressions.

```
Test Files  12 passed (12)
     Tests  77 passed (77)
```

Key verifications:
- EntityCard.tsx contains `from '@/components/ui/card'` ✓
- ConfigSection.tsx contains `from '@/components/ui/card'` ✓
- EntityCard.tsx does NOT contain `framer-motion` ✓
- ConfigSection.tsx does NOT contain `framer-motion` ✓
- SectionHeader.tsx does NOT contain `framer-motion` ✓
- Explorer.tsx does NOT contain `framer-motion`, `AnimatePresence`, or stagger ✓
- Explorer.tsx imports `Badge, MonoBadge` from `./components/Badge` ✓

## Decisions Made

1. **Inline CSS custom property for iconAccentVar**: The plan specified using inline `style` with `--icon-accent` CSS property. This avoids the purge-risky `group-hover:text-[var(${iconAccentVar})]` template-literal pattern from the original code. The `group-hover` CSS class uses `var(--icon-accent, var(--accent-blue))` with a built-in fallback.

2. **ConfigEntryCard without Card sub-components**: ConfigEntryCard has a simple two-section layout (header row + JSON pre) that doesn't benefit from CardHeader/CardContent separation. Using Card as the outer container is sufficient.

3. **Complete framer-motion removal from Explorer**: After removing the card grid AnimatePresence, no framer-motion usage remained in Explorer.tsx, so the import was removed entirely.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all components render internal data with no external HTML injection risk.

## Self-Check: PASSED

- [x] EntityCard.tsx exists and contains `Card, CardContent, CardHeader, CardFooter`
- [x] ConfigSection.tsx exists and contains `Card` import
- [x] SectionHeader.tsx exists and has no framer-motion
- [x] Explorer.tsx exists (507 lines) and imports Badge from `./components/Badge`
- [x] Commit 2296aaa exists in git log
- [x] Commit 7001e9f exists in git log
- [x] Commit 936dc65 exists in git log
