---
phase: 05-model-config-store-backend
plan: 02
subsystem: api
tags: [fastify, vitest, zod, crud, reference-checking, provenance]

# Dependency graph
requires:
  - phase: 05-01
    provides: ModelConfigService, ModelConfigSchema, profileSchema.modelConfig field
provides:
  - StoreService.getReferencingProfiles extended for model-configs (scalar check)
  - StoreService.readProvenanceIndex includes model-configs key
  - Full CRUD API at /api/store/model-configs with delete protection (409/referencedBy)
  - Permissive validation accepting any string for baseUrl and modelName (STORE-11)
affects: [06-ui, 07-activation]

# Tech tracking
tech-stack:
  added: []
  patterns: [scalar-reference-check, provenance-manual-attachment]

key-files:
  created: []
  modified:
    - packages/cli/src/server/services/storeService.ts
    - packages/cli/src/server/routes/store.ts
    - packages/cli/src/server/services/__tests__/storeService.test.ts
    - packages/cli/src/server/routes/__tests__/store.test.ts

key-decisions:
  - "Model configs use scalar profile.modelConfig === name check (not array includes) since modelConfig is optional string"
  - "Provenance attached manually (not via attachProvenance helper) because model configs use name field not id"
  - "STORE-11 permissive validation: accept any string for baseUrl/modelName, no URL format enforcement"

patterns-established:
  - "Scalar reference check: model-configs check profile.modelConfig === name vs array includes for agents/skills/commands"
  - "Manual provenance attachment: when objects use name instead of id, call storeService.getProvenance directly"

requirements-completed: [STORE-08, STORE-11]

# Metrics
duration: 8min
completed: 2026-04-09
---

# Phase 05 Plan 02: Model Config Reference Checking and CRUD Routes Summary

**StoreService extended with model-config reference checking (scalar modelConfig field) and full CRUD API at /api/store/model-configs with delete protection returning 409 with referencedBy array**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-09T05:46:43Z
- **Completed:** 2026-04-09T05:55:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- StoreService.getReferencingProfiles now handles 'model-configs' type with scalar profile.modelConfig check
- StoreService.readProvenanceIndex includes 'model-configs' key in both try and catch paths
- Full CRUD API at /api/store/model-configs with provenance attachment on list and detail responses
- Delete protection returns 409 with { error, referencedBy } when profiles reference a model config
- DELETE with force=true bypasses reference check
- Permissive validation accepting any string for baseUrl and modelName (STORE-11)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend StoreService for model-config reference checking and provenance** - `cc31cf2` (feat)
2. **Task 2: Add model config CRUD routes with delete protection** - `938d863` (feat)

_Note: TDD tasks had RED (test) and GREEN (implement) phases within single commits_

## Files Created/Modified
- `packages/cli/src/server/services/storeService.ts` - Extended getReferencingProfiles for model-configs, readProvenanceIndex includes model-configs key
- `packages/cli/src/server/routes/store.ts` - Added model config CRUD routes with delete protection and provenance
- `packages/cli/src/server/services/__tests__/storeService.test.ts` - 3 new tests for model-config reference checking
- `packages/cli/src/server/routes/__tests__/store.test.ts` - 17 new integration tests for model config routes

## Decisions Made
- Model configs use scalar profile.modelConfig === name check (not array includes) since modelConfig is an optional string field, not an array
- Provenance attached manually via storeService.getProvenance('model-configs', config.name) instead of generic attachProvenance helper because model configs use name field not id
- STORE-11 permissive validation: no URL format enforcement on baseUrl or modelName, accepting any string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full model config CRUD API available for Phase 6 (UI) to consume
- Delete protection (409 with referencedBy) prevents accidental data loss
- Provenance tracking ready for imported model configs
- All 237 tests passing across 15 test files

---
*Phase: 05-model-config-store-backend*
*Completed: 2026-04-09*

## Self-Check: PASSED
- All 4 modified files found on disk
- Both task commits found in git history (cc31cf2, 938d863)
- SUMMARY.md exists at expected path
