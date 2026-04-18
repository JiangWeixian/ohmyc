---
phase: 03-safe-switching-and-reference-safety
plan: 01
subsystem: api
tags: [proper-lockfile, transactional-activation, preflight, rollback, file-locking]

# Dependency graph
requires:
  - phase: 02-profile-composition
    provides: "ProfileService with basic activate/deactivate, profiles routes, settings merge"
provides:
  - "LockService with proper-lockfile for inter-process activation locking"
  - "Transactional activate() with undo stack, rollback, and previous-profile restoration"
  - "preflight() method for pre-activation validation (missing components, settings warnings)"
  - "Full deactivation cleanup (symlinks, .claude-plugin, hooks, .mcp.json, .lsp.json)"
  - "Per-profile backup naming (settings.backup.<name>.json)"
  - "ActivationBlockedError exported for route-level error handling"
  - "GET /api/profiles/:name/preflight endpoint"
  - "DELETE /api/profiles/:name returns 409 for active profile protection"
  - "POST /api/profiles/:name/activate returns 422 for missing components, 423 for lock contention"
affects: [03-safe-switching-and-reference-safety-02, frontend-safety-ux]

# Tech tracking
tech-stack:
  added: [proper-lockfile@4.1.2, @types/proper-lockfile@4.1.4]
  patterns: [undo-stack-rollback, preflight-gate, per-profile-backup-naming, advisory-file-lock]

key-files:
  created:
    - packages/cli/src/server/services/lockService.ts
    - packages/cli/src/server/services/__tests__/lockService.test.ts
  modified:
    - packages/cli/src/server/services/profileService.ts
    - packages/cli/src/server/services/__tests__/profileService.test.ts
    - packages/cli/src/server/routes/profiles.ts
    - packages/cli/src/server/routes/__tests__/profiles.test.ts
    - packages/cli/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Use proper-lockfile for inter-process file locking with 10s stale threshold"
  - "Name per-profile backup after the profile being activated (settings.backup.<newName>.json) for simple deactivation lookup"
  - "Write .active marker early (before symlinks) for crash recovery"
  - "Use instanceof check for ActivationBlockedError in route handler instead of string matching"

patterns-established:
  - "Undo stack pattern: each filesystem operation records a reverse action; rollback pops in reverse on failure"
  - "Preflight gate pattern: validation runs both externally (UI) and internally (safety) to avoid TOCTOU issues"
  - "Per-profile backup naming: settings.backup.<profileName>.json ties backup to the profile that created it"

requirements-completed: [ACT-03, ACT-04, ACT-05, ACT-06]

# Metrics
duration: 19min
completed: 2026-04-06
---

# Phase 03 Plan 01: Backend Safety Foundation Summary

**Transactional profile activation with rollback stack, file-based locking, preflight validation, full deactivation cleanup, and active-profile delete protection**

## Performance

- **Duration:** 19 min
- **Started:** 2026-04-06T12:45:30Z
- **Completed:** 2026-04-06T13:04:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- LockService with proper-lockfile prevents concurrent activation attempts across processes
- ProfileService.activate() is now transactional: missing components block activation entirely, failures trigger full rollback
- Preflight endpoint (GET /api/profiles/:name/preflight) validates without filesystem changes
- Deactivate cleans all generated artifacts (symlinks, .claude-plugin, hooks, .mcp.json, .lsp.json) and restores per-profile backup
- Active profile deletion blocked with 409 status code

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LockService and transactional ProfileService with preflight** - `9987ce3` (feat)
2. **Task 2: Add preflight API endpoint and active-profile delete protection to routes** - `38a7514` (feat)

## Files Created/Modified
- `packages/cli/src/server/services/lockService.ts` - File-based advisory lock using proper-lockfile
- `packages/cli/src/server/services/__tests__/lockService.test.ts` - LockService unit tests (5 tests)
- `packages/cli/src/server/services/profileService.ts` - Transactional activate with rollback, preflight, full deactivate cleanup
- `packages/cli/src/server/services/__tests__/profileService.test.ts` - Extended tests (45 tests: preflight, transactional, full cleanup)
- `packages/cli/src/server/routes/profiles.ts` - Preflight endpoint, 422/423 error codes, 409 delete protection
- `packages/cli/src/server/routes/__tests__/profiles.test.ts` - Route tests (16 tests: preflight, errors, delete protection)
- `packages/cli/package.json` - Added proper-lockfile and @types/proper-lockfile dependencies

## Decisions Made
- **Per-profile backup naming uses the *new* profile name** rather than the previous profile name. This simplifies deactivation: deactivate X restores settings.backup.X.json. The backup represents the state *before* profile X was applied.
- **Used instanceof check** for ActivationBlockedError in the route handler for type safety, rather than matching the error name string.
- **Wrapped proper-lockfile errors** in a user-friendly "Another activation is in progress" message since the library's internal error message ("Lock file is already being held") is not user-facing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing await on async getActiveProfileName() calls**
- **Found during:** Task 1 (profileService implementation)
- **Issue:** `getActiveProfileName()` is async but was called without `await` in `preflight()` and `deactivate()`, causing "path argument must be of type string, received Promise" errors
- **Fix:** Added `await` to both call sites
- **Files modified:** packages/cli/src/server/services/profileService.ts
- **Committed in:** 9987ce3 (part of Task 1 commit)

**2. [Rule 1 - Bug] proper-lockfile error message wrapped for user-facing clarity**
- **Found during:** Task 1 (LockService test)
- **Issue:** Test expected "Another activation is in progress" but library throws "Lock file is already being held"
- **Fix:** Wrapped lockfile.lock() in try/catch and rethrew with user-friendly message
- **Files modified:** packages/cli/src/server/services/lockService.ts
- **Committed in:** 9987ce3 (part of Task 1 commit)

**3. [Rule 1 - Bug] Per-profile backup naming mismatch between activation and deactivation**
- **Found during:** Task 1 (deactivate tests failing)
- **Issue:** Plan specified `settings.backup.<previousProfileName>.json` for backup naming. This caused a naming mismatch: activate B (no previous) creates `settings.backup.default.json`, but deactivate B looks for `settings.backup.B.json`.
- **Fix:** Changed backup naming to use the *new* profile name (`settings.backup.<name>.json`) so deactivation can always find the backup by looking up the active profile name
- **Files modified:** packages/cli/src/server/services/profileService.ts, packages/cli/src/server/services/__tests__/profileService.test.ts
- **Committed in:** 9987ce3 (part of Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. The backup naming change is a minor architectural refinement that simplifies the deactivate lookup logic.

## Issues Encountered
- npm registry (https://registry.npmjs.org/) was unreachable during execution. Resolved by using `--registry https://registry.npmjs.org` flag with pnpm.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend safety foundation complete for Plan 02 (frontend safety UX) to consume
- Preflight endpoint ready for confirmation dialog integration
- Error codes (422, 423, 409) documented and tested for frontend handling

---
*Phase: 03-safe-switching-and-reference-safety*
*Completed: 2026-04-06*
