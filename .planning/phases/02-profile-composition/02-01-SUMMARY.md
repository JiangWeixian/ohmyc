---
phase: 02-profile-composition
plan: 01
subsystem: api
tags: [profiles, activation, symlinks, path-normalization, vitest]

# Dependency graph
requires: []
provides:
  - "Name-based active profile API contract (ProfileService.list() returns bare profile name)"
  - "Verified activation artifact generation (.claude-plugin/plugin.json, hooks/hooks.json, .mcp.json, .lsp.json)"
  - "Verified symlink targets pointing into store directory for agents, skills, and commands"
  - "Verified warning passthrough for missing store components without aborting activation"
affects: [02-02-PLAN, 02-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "path.basename() normalization at service boundary instead of UI inference"
    - "readlinkSync for symlink target verification in tests"

key-files:
  created: []
  modified:
    - packages/cli/src/server/services/profileService.ts
    - packages/cli/src/server/services/__tests__/profileService.test.ts
    - packages/cli/src/server/routes/__tests__/profiles.test.ts

key-decisions:
  - "Normalize active profile at read boundary (list method) rather than changing on-disk .active format"
  - "Keep activation implementation untouched; only expand test contract for Phase 2 verification"

patterns-established:
  - "Active profile normalization: path.isAbsolute(raw) ? path.basename(raw) : raw in list() method"
  - "On-disk .active format remains absolute path; API consumers receive bare name"

requirements-completed: [PROF-04, ACT-01, ACT-02]

# Metrics
duration: 10min
completed: 2026-04-02
---

# Phase 02 Plan 01: Normalize Profile Backend Contract Summary

**Active-profile name normalization at service boundary plus verified activation artifacts, symlink targets, and warning passthrough for the Phase 2 UI work**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-02T03:08:13Z
- **Completed:** 2026-04-02T03:18:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ProfileService.list() now returns bare profile name instead of raw filesystem path, enabling the UI to use exact equality checks
- Activation test coverage locked for all Claude-compatible runtime artifacts (plugin.json, hooks.json, .mcp.json, .lsp.json)
- Symlink target verification proves agents, skills, and commands resolve into the store directory
- Missing-component warning behavior verified: warnings returned but profile still activates successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize the active-profile contract to profile names** - `1e2799b` (feat)
2. **Task 2: Lock activation outputs and symlink behavior** - `0ca7c73` (test)

## Files Created/Modified
- `packages/cli/src/server/services/profileService.ts` - Added path.basename() normalization in list() for active profile name
- `packages/cli/src/server/services/__tests__/profileService.test.ts` - Added .lsp.json assertion, symlink target tests (readlinkSync), active-despite-warnings test, command symlink assertion
- `packages/cli/src/server/routes/__tests__/profiles.test.ts` - Added warnings array assertion on activate response, dedicated missing-component warning route test
- `packages/cli/src/server/routes/profiles.ts` - Unchanged (still returns service.list() directly)

## Decisions Made
- Normalized active profile value at the service read boundary rather than changing the on-disk .active format, so existing local state continues to work without migration
- Kept activation implementation untouched and only expanded test assertions to prove the Phase 2 requirements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed stale compiled .js artifacts from packages/cli/src and packages/shared/src**
- **Found during:** Task 1 (test verification)
- **Issue:** Vitest was picking up stale compiled .js files alongside .ts source files, causing test runners to execute the old unmodified code
- **Fix:** Deleted 121+ stale .js, .js.map, .d.ts, .d.ts.map files from packages/cli/src and packages/shared/src that were produced by a prior tsc build with outDir pointing at srcDir
- **Files modified:** None committed (build artifacts were untracked)
- **Verification:** Tests pass with correct assertions after cleanup

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. The stale artifact cleanup was necessary to make test verification work correctly.

## Issues Encountered
None beyond the stale artifact issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend contract is stable: `/api/profiles` returns `active` as a bare profile name or `null`
- UI can now use exact equality (`active === profile.name`) instead of substring matching
- Activation artifact generation and symlink behavior are locked by passing tests
- Ready for Plan 02-02 (UI restructuring) and Plan 02-03 (detail readability)

---
*Phase: 02-profile-composition*
*Completed: 2026-04-02*
