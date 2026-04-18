---
phase: 04-explorer-tab-corrections
plan: 02
subsystem: ui
tags: [react, source-badge, config-entries, plugin-references, explorer-tabs]

# Dependency graph
requires:
  - phase: 04-01
    provides: Backend API returning tagged config entries with source/pluginId fields
provides:
  - Frontend source badges on all config entry cards (Hooks, MCP, LSP tabs)
  - CLAUDE.md tab hidden from Explorer sidebar
  - Plugin profile reference display on Plugins tab
affects: [ui, explorer, config-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [ConfigEntry/HookEntry typed arrays, SourceBadge rendering, pluginRefMap with useMemo]

key-files:
  created: []
  modified:
    - packages/ui/src/hooks/useConfigs.ts
    - packages/ui/src/components/ConfigSection.tsx
    - packages/ui/src/Explorer.tsx
    - packages/ui/src/__tests__/Explorer.inventory.test.tsx

key-decisions:
  - "useMemo for pluginRefMap moved to top-level component to satisfy React hooks rules (not inside renderPlugins)"
  - "Profile references use blue pill badges for 1-2 refs, summary text for 3+ matching StoreComponentList pattern"

patterns-established:
  - "ConfigEntry/HookEntry typed interfaces replace Record-based config shapes throughout UI"
  - "SourceBadge renders inline next to entry name in ConfigEntryCard"
  - "Plugin reference maps computed via useMemo at top-level, consumed in render functions"

requirements-completed: [TAB-01, TAB-02, TAB-03, TAB-04, PLUG-01]

# Metrics
duration: 14min
completed: 2026-04-07
---

# Phase 4 Plan 02: Explorer Tab Frontend Corrections Summary

**Source badges on all config entries (Hooks/MCP/LSP), CLAUDE.md tab hidden, plugin profile references with blue pill badges**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-07T06:18:47Z
- **Completed:** 2026-04-07T08:04:24Z
- **Tasks:** 2 (1 auto + 1 checkpoint approved)
- **Files modified:** 13

## Accomplishments
- Source badges (local/plugin) render on every config entry across Hooks, MCP Servers, and LSP Servers tabs
- CLAUDE.md tab removed from Explorer sidebar while preserving renderPlaceholder fallback
- Plugin cards display profile reference counts with blue pill badges (1-2 refs) or summary text (3+ refs)
- React hooks order violation fixed by moving useMemo to top-level component

## Task Commits

Each task was committed atomically:

1. **Task 1: Add source badges, hide CLAUDE.md tab, show plugin profile refs** - `7ca9b87` (feat)
2. **Task 2: Verify Explorer tab corrections in browser** - checkpoint approved by user (no commit)

**Additional fixes during/after checkpoint:**
- `235fc4f` (fix) - Move useMemo out of renderPlugins to fix React hooks order violation
- `e752abe` (fix) - Add missing vitest and React imports to 10 UI test files

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `packages/ui/src/hooks/useConfigs.ts` - ConfigEntry and HookEntry typed interfaces replacing Record shapes
- `packages/ui/src/components/ConfigSection.tsx` - SourceBadge rendering on ConfigEntryCard, array-based iteration
- `packages/ui/src/Explorer.tsx` - CLAUDE.md removed from SECTIONS, pluginRefMap for profile references, hooks order fix
- `packages/ui/src/__tests__/Explorer.inventory.test.tsx` - Updated tests for new array-based config shapes
- `packages/ui/src/__tests__/ProfilesView.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/__tests__/SourceBadge.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/profiles/__tests__/ProfileEditor.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/store/__tests__/ImportComponentsDialog.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/store/__tests__/StoreComponentEditor.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/hooks/__tests__/usePlugins.test.tsx` - Added missing imports (e752abe)
- `packages/ui/src/test/renderWithProviders.smoke.test.tsx` - Added missing imports (e752abe)

## Decisions Made
- Moved useMemo for pluginRefMap to top-level component rather than keeping it in renderPlugins -- React requires hooks at component top level, not inside nested functions
- Profile reference display follows StoreComponentList blue pill pattern for consistency across the UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React hooks order violation in Explorer.tsx**
- **Found during:** Task 2 (browser verification checkpoint)
- **Issue:** useMemo was called inside renderPlugins() function, violating React's rules of hooks (hooks must be called at top level of component)
- **Fix:** Moved useMemo computation to top-level Explorer component, passed pluginRefMap as parameter to renderPlugins
- **Files modified:** packages/ui/src/Explorer.tsx
- **Verification:** App renders without React hooks error
- **Committed in:** 235fc4f

**2. [Rule 3 - Blocking] Missing vitest and React imports in UI test files**
- **Found during:** Task 1 verification (test suite run)
- **Issue:** 10 UI test files missing `import { describe, it, expect } from 'vitest'` and/or `import React from 'react'` causing test failures
- **Fix:** Added the missing imports to all affected test files
- **Files modified:** 10 test files in packages/ui/src
- **Verification:** Full UI test suite passes
- **Committed in:** e752abe

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness and test execution. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 (Explorer Tab Corrections) is now fully complete
- All 5 requirements (TAB-01 through TAB-04, PLUG-01) satisfied
- Milestone v1.1 Bugfixes is complete (only phase in milestone)

## Self-Check: PASSED

All claimed files and commits verified present:
- 4 source files: FOUND
- 3 commits (7ca9b87, 235fc4f, e752abe): FOUND
- SUMMARY.md: FOUND

---
*Phase: 04-explorer-tab-corrections*
*Completed: 2026-04-07*
