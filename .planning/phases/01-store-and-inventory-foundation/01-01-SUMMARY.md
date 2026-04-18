---
phase: 01-store-and-inventory-foundation
plan: 01
subsystem: api
tags: [fastify, vitest, zod, store, provenance, import]
requires: []
provides:
  - Preview-before-apply store imports with explicit overwrite handling
  - Store provenance persisted in store/.metadata/imports.json
  - Provenance-aware store list and detail API responses
affects: [phase-01-ui, store-browser, import-dialog]
tech-stack:
  added: []
  patterns: [scan-before-apply imports, sidecar provenance index, route-level provenance decoration]
key-files:
  created:
    - packages/shared/src/storeSchema.ts
  modified:
    - packages/cli/src/server/services/storeService.ts
    - packages/cli/src/server/routes/store.ts
    - packages/cli/src/server/services/__tests__/storeService.test.ts
    - packages/cli/src/server/routes/__tests__/store.test.ts
key-decisions:
  - "Persist import provenance in store/.metadata/imports.json instead of mutating imported Claude files."
  - "Keep import flow on one POST /api/store/import route with dryRun and overwrite flags rather than split endpoints."
patterns-established:
  - "Store imports follow scan -> confirm -> apply semantics with conflict reporting."
  - "Store list/detail routes enrich canonical file-backed entities with sidecar provenance metadata."
requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-06]
duration: 5min
completed: 2026-03-29
---

# Phase 1 Plan 01: Harden Store Import Contracts, Overwrite Preview Flow, and Provenance Tracking Summary

**Previewable store imports with overwrite confirmation, recursive skill copy support, and persisted provenance surfaced through the store API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T13:57:00Z
- **Completed:** 2026-03-29T14:01:55Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Added shared Zod contracts for store import requests, results, conflicts, and component provenance.
- Reworked `StoreService` into scan/apply import behavior with overwrite support, recursive skill copying, and provenance persistence in `store/.metadata/imports.json`.
- Updated store routes to validate dry-run and overwrite behavior and to include provenance on store list/detail responses.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the store import and provenance contract** - `24a5b88` (feat)
2. **Task 2: Expose the new import flow and provenance through store routes** - `0873fc5` (feat)

## Files Created/Modified
- `packages/shared/src/storeSchema.ts` - Shared import/provenance contracts used by the service and routes.
- `packages/cli/src/server/services/storeService.ts` - Conflict scanning, apply flow, overwrite handling, recursive copy, and provenance persistence.
- `packages/cli/src/server/routes/store.ts` - Import request validation and provenance-aware list/detail responses.
- `packages/cli/src/server/services/__tests__/storeService.test.ts` - Service coverage for dry-run, overwrite, nested skill assets, and provenance metadata.
- `packages/cli/src/server/routes/__tests__/store.test.ts` - Route coverage for conflicts, overwrite counts, invalid dry-run+overwrite, and provenance exposure.

## Decisions Made
- Persisted import provenance in a sidecar metadata index so imported Claude assets remain canonical.
- Kept preview and apply on the existing import endpoint by using `dryRun` and `overwrite` flags rather than introducing separate endpoints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated runtime-resolved JavaScript siblings for changed store modules**
- **Found during:** Task 1 verification
- **Issue:** Vitest resolved the checked-in `.js` siblings for extensionless imports, so the new TypeScript behavior was not the code under test.
- **Fix:** Added matching runtime `.js` updates for the touched store/shared modules and removed missing sourcemap footer references from newly created JS files.
- **Files modified:** `packages/shared/src/storeSchema.js`, `packages/shared/src/agentSchema.js`, `packages/shared/src/skillSchema.js`, `packages/shared/src/commandSchema.js`, `packages/shared/src/index.js`, `packages/cli/src/server/services/storeService.js`, `packages/cli/src/server/routes/store.js`
- **Verification:** `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/store.test.ts src/server/services/__tests__/storeService.test.ts`
- **Committed in:** `24a5b88`, `0873fc5`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make the repo execute the planned behavior in tests. No scope expansion beyond the touched store modules.

## Issues Encountered
- The repo contains many unrelated modified and generated files. Commits were staged file-by-file to avoid absorbing unrelated work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Store import behavior now supports preview-before-overwrite and provenance survives reloads, so Phase 1 UI work can depend on a stable backend contract.
- Store API consumers can read `provenance.importPath` and `provenance.importedAt` from list/detail responses without parsing asset files.

## Self-Check
PASSED

---
*Phase: 01-store-and-inventory-foundation*
*Completed: 2026-03-29*
