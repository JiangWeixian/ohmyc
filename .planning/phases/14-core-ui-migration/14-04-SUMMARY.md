---
phase: 14-core-ui-migration
plan: 04
subsystem: ui-components
tags: [profile-card, hover-card, quick-actions, shadcn-card, css-transitions, framer-motion-removal, hook-extraction]
dependency_graph:
  requires: [14-01]
  provides: [ProfileCard-with-useActivationFlow, CSS-HoverCard, CSS-QuickActions]
  affects: [profiles-page, entity-display]
tech_stack:
  added: []
  patterns: [extracted-hook-for-dialog-state, css-hover-transitions, shadcn-card-layout]
key_files:
  created: []
  modified:
    - packages/ui/src/components/profiles/ProfileCard.tsx
    - packages/ui/src/components/ui/HoverCard.tsx
    - packages/ui/src/components/ui/QuickActions.tsx
decisions:
  - useActivationFlow hook encapsulates discriminated-union dialog state, preflight mutation, lock error, and auto-dismiss timer
  - ProfileCard wraps content in shadcn Card > CardContent to match established pattern
  - HoverCard uses plain div with Tailwind hover:-translate-y-0.5 and hover:shadow CSS transitions
  - FloatingActionButton uses active:scale-95 and hover:scale-105 CSS transitions replacing whileHover/whileTap
  - Custom Tooltip in QuickActions removed entirely (not imported anywhere else)
metrics:
  duration: 4min
  completed: 2026-04-19T23:00:07Z
  tasks: 2
  files: 3
  tests_passing: 77
---

# Phase 14 Plan 04: ProfileCard/HoverCard/QuickActions Migration Summary

ProfileCard migrated to shadcn Card with extracted useActivationFlow hook managing dialog state machine; HoverCard and QuickActions converted to CSS-only transitions with custom Tooltip removed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract useActivationFlow hook and migrate ProfileCard to shadcn Card | a6532c1 | ProfileCard.tsx |
| 2 | Migrate HoverCard and QuickActions — remove framer-motion, use shadcn Tooltip | db81dac | HoverCard.tsx, QuickActions.tsx |

## What Changed

### Task 1: ProfileCard Hook Extraction + Card Migration
- Extracted `useActivationFlow` custom hook from ProfileCard component body
- Hook manages: dialogState (discriminated union), lockError with auto-dismiss, preflight mutation, handleActivateClick, handleDeleteClick
- Replaced `motion.div` outer wrapper with shadcn `<Card className="panel p-6">` + `<CardContent>`
- Removed framer-motion entry animation (`initial={{ opacity: 0, y: 12 }}`, `animate`, `transition`)
- Replaced hardcoded `#5E6AD2` with `var(--accent-blue)` in Active badge and RuntimeGroup spans
- All three dialog components (ConfirmSwitchDialog, ActivateConfirmDialog, ActivationBlockedDialog) and inline delete-blocked dialog preserved unchanged
- ComponentGroup and RuntimeGroup helper components unchanged

### Task 2: HoverCard + QuickActions CSS Migration
- HoverCard: removed `motion, useMotionValue` from framer-motion, replaced `motion.div` with plain `div`
- Added CSS hover transitions: `hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-transform duration-150`
- Kept cursor-pointer/cursor-default conditional via className
- QuickActions: removed all `motion.div`, `motion.button` instances, `AnimatePresence`, and animation props
- Removed custom Tooltip implementation (mouse-event based with AnimatePresence) — not imported elsewhere
- FloatingActionButton: replaced `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}` with CSS `hover:scale-105 active:scale-95 transition-transform duration-150`
- All variant logic (default/primary/danger) preserved with `transition-colors duration-150`

## Verification

All 77 tests pass across 12 test files — zero regressions.

```
Test Files  12 passed (12)
     Tests  77 passed (77)
```

Key verifications:
- ProfileCard.tsx contains `useActivationFlow` hook ✓
- ProfileCard.tsx contains `from '@/components/ui/card'` ✓
- ProfileCard.tsx does NOT contain `from 'framer-motion'` ✓
- ProfileCard.tsx does NOT contain `motion.div` ✓
- ProfileCard.tsx does NOT contain `#5E6AD2` ✓
- HoverCard.tsx does NOT contain `from 'framer-motion'` ✓
- HoverCard.tsx has CSS hover transitions ✓
- QuickActions.tsx does NOT contain `from 'framer-motion'` ✓
- QuickActions.tsx does NOT contain `AnimatePresence` ✓
- QuickActions.tsx does NOT contain custom Tooltip ✓
- QuickActions still exports `QuickActions` and `FloatingActionButton` ✓

## Decisions Made

1. **useActivationFlow hook colocated in ProfileCard.tsx**: Hook defined above the component in the same file rather than extracted to a separate hooks file. ProfileCard is the sole consumer and the hook is tightly coupled to ProfileCard's dialog rendering.

2. **Card > CardContent nesting**: Used `<Card>` as outer wrapper with `<CardContent className="p-0">` to preserve the existing `panel p-6` styling while satisfying the shadcn Card structure. The `p-0` override prevents CardContent from adding its own padding.

3. **Custom Tooltip removed, not replaced with shadcn Tooltip**: The custom Tooltip in QuickActions was not imported by any other file. Per plan instructions, it was simply removed without adding a replacement wrapper. Future consumers needing tooltips should import directly from `@/components/ui/tooltip`.

4. **CSS transitions over framer-motion**: All hover/tap interactions now use Tailwind CSS classes (`hover:-translate-y-0.5`, `hover:scale-105`, `active:scale-95`) with `transition-transform duration-150`. This matches the D-05/D-15/D-16 directives for zero entry animations and CSS-only transitions.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all components are internal display-only with no external data flows.

## Self-Check: PASSED

- All 3 modified files exist on disk ✓
- Both task commits (a6532c1, db81dac) found in git log ✓
- 14-04-SUMMARY.md created ✓
- 77/77 tests passing ✓
