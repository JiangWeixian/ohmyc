---
phase: 01-store-and-inventory-foundation
plan: 03
subsystem: ui
tags: [react, tanstack-query, vitest, store, inventory]
requires:
  - phase: 01-00
    provides: store-aware UI shell and read-only inventory surfaces
  - phase: 01-01
    provides: canonical store import API with dry-run, overwrite, and provenance
provides:
  - unified store browser with local name search and type filtering
  - secondary provenance disclosure for store-managed components
  - two-phase store import dialog with overwrite-all confirmation
affects: [phase-01-store-and-inventory-foundation, store-ui, import-flow]
tech-stack:
  added: []
  patterns:
    - unified client-side store browsing over three query sources
    - dry-run then apply import flow driven from a modal UI
key-files:
  created: []
  modified:
    - packages/ui/src/ProfilesView.tsx
    - packages/ui/src/components/profiles/ProfilesSidebar.tsx
    - packages/ui/src/hooks/useStore.ts
    - packages/ui/src/components/store/StoreComponentList.tsx
    - packages/ui/src/components/store/ImportComponentsDialog.tsx
    - packages/ui/src/components/store/DeleteConfirmDialog.tsx
    - packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx
    - packages/ui/src/components/store/__tests__/ImportComponentsDialog.test.tsx
key-decisions:
  - "Expose store-backed component management through `/profiles/agents`, `/profiles/skills`, and `/profiles/commands` so Profiles and Explorer use the same type taxonomy."
  - "Keep provenance secondary by rendering importPath and importedAt inside collapsible source details instead of a dominant list column."
  - "Run imports in two phases from the UI: dry-run preview first, then apply automatically when there are no conflicts or require explicit Overwrite All when collisions exist."
patterns-established:
  - "Store browser rows flatten agents, skills, and commands into one local-filtered surface."
  - "Store mutations invalidate the ['store'] query family so the unified browser refreshes without route changes."
requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06]
duration: 5min
completed: 2026-03-29
---

# Phase 01 Plan 03: Store UI Summary

**Unified canonical store browser with local search/filtering, secondary provenance details, and a two-phase import confirmation dialog**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T14:05:30Z
- **Completed:** 2026-03-29T14:10:25Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Reworked the store area into one browse surface that sits behind `/profiles/agents`, `/profiles/skills`, and `/profiles/commands`, while still fetching all three store component types and filtering locally by name and type.
- Kept provenance lightweight by moving `importPath` and `importedAt` into expandable row metadata while keeping the main row focused on type, name, description, and profile reference count.
- Wired store-side import and destructive flows to the canonical API with dry-run preview, conflict listing, overwrite confirmation, and immediate browser refresh via `['store']` invalidation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Turn the store view into a searchable, type-filtered canonical browser** - `46d93d2` (feat)
2. **Task 2: Wire create/edit/delete and import-confirmation flows to the canonical store API** - `58ced80` (feat)

## Files Created/Modified

- `packages/ui/src/ProfilesView.tsx` - Accepts `/profiles/agents`, `/profiles/skills`, and `/profiles/commands` and keeps component management inside the profiles shell.
- `packages/ui/src/components/profiles/ProfilesSidebar.tsx` - Simplifies store navigation to a single canonical store entry.
- `packages/ui/src/hooks/useStore.ts` - Exposes explicit preview/apply helpers for store imports and invalidates `['store']`.
- `packages/ui/src/components/store/StoreComponentList.tsx` - Flattens store rows, applies local search/type filters, shows reference counts, and opens import/delete flows.
- `packages/ui/src/components/store/ImportComponentsDialog.tsx` - Implements preview-first import behavior with conflict listing and `Overwrite All`.
- `packages/ui/src/components/store/DeleteConfirmDialog.tsx` - Applies the Phase 1 destructive-copy contract, including `Delete anyway?`.
- `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` - Verifies local filtering and secondary provenance disclosure.
- `packages/ui/src/components/store/__tests__/ImportComponentsDialog.test.tsx` - Verifies preview, cancel, and overwrite-all mutation paths.

## Decisions Made

- Kept component browsing inside the profiles shell while exposing first-class typed routes that match Explorer's agents/skills/commands taxonomy.
- Auto-applied the second import request after a dry-run only when the preview returned no conflicts; overwrite paths still require explicit confirmation.
- Left AGENT_HOME inventory views untouched and kept all create/edit/delete/import entry points inside the canonical store surface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The UI test command also executed unrelated dirty-worktree suites outside this plan. Store-specific component behavior passed, and the out-of-scope failures were logged in `.planning/phases/01-store-and-inventory-foundation/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The store UI now exposes the canonical browse and import flows required for Phase 1.
- Deferred unrelated UI test failures in `usePlugins` and Explorer inventory should be resolved separately from this store plan.

## Self-Check: PASSED

- Found `.planning/phases/01-store-and-inventory-foundation/01-03-SUMMARY.md`
- Found commit `46d93d2`
- Found commit `58ced80`
