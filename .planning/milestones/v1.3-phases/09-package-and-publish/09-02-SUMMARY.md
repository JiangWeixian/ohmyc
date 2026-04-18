---
phase: 09-package-and-publish
plan: 02
subsystem: testing
tags: [vitest, npm-pack, package-verification, bundling, tsup]

# Dependency graph
requires:
  - phase: 09-package-and-publish
    plan: 01
    provides: Package configuration with files allowlist, publishConfig, prepublish script, and tsup bundling
provides:
  - Automated test suite verifying package.json configuration and build output correctness
  - Verification that npm pack tarball contains only dist/ and README.md
  - Verification that dist/index.js is self-contained with no external npm package imports
affects: [09-package-and-publish, release]

# Tech tracking
tech-stack:
  added: []
  patterns: [node-builtin-filtering-in-bundle-check]

key-files:
  created:
    - packages/cli/src/__tests__/package.test.ts
  modified: []

key-decisions:
  - "Node.js built-in modules filtered from bare import check since they are expected in a Node.js bundle"
  - "Conditional skip pattern (distTestSkip) for build-output tests that require prior build step"

patterns-established:
  - "Node builtin filtering: when checking bundled output for external npm imports, filter out Node.js built-in module names that appear as bare specifiers"

requirements-completed: [PKG-01, PKG-02, PKG-03]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 9 Plan 2: Package Verification Tests Summary

**9-test suite verifying bin config, files allowlist, prepublishOnly, publishConfig, noExternal coverage, and self-contained bundle with no external npm imports**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T02:37:40Z
- **Completed:** 2026-04-14T02:41:54Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created comprehensive package verification test suite with 9 tests in a single describe block
- All 273 tests pass (264 existing + 9 new package tests)
- npm pack --dry-run confirms tarball contains only dist/index.js, dist/ui/*, and package.json (5 files total, 679.2 kB)
- Verified dist/index.js has zero external npm package imports -- all 9 runtime deps are fully bundled
- Verified dist/ui/index.html exists (UI assets bundled into dist)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write package verification tests and confirm build output** - `9454955` (test)

## Files Created/Modified
- `packages/cli/src/__tests__/package.test.ts` - 9 tests verifying package.json configuration, tsup noExternal coverage, build output existence, and bundle self-containment

## Decisions Made
- Filtered Node.js built-in module names (fs, path, os, etc.) from the bare import check since tsup correctly preserves Node.js builtins as external imports -- the intent is to verify no npm package imports, not no bare imports at all
- Used conditional skip pattern (`distTestSkip = distExists ? it : it.skip`) for build-output tests so the test suite can run without a prior build step

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bare import regex matching Node.js built-in modules**
- **Found during:** Task 1 (package verification tests)
- **Issue:** The plan's regex `(?<=from\s['"])(?!node:|\.\/|\.\.\/)[^'"]+(?=['"])` matches Node.js built-in module names (fs, path, os, child_process, etc.) that tsup correctly preserves as external imports. These are not npm package imports -- they are expected bare specifiers in a Node.js ESM bundle.
- **Fix:** Added a NODE_BUILTINS set of all Node.js built-in module names and filtered them from the regex matches before asserting no npm imports exist
- **Files modified:** packages/cli/src/__tests__/package.test.ts
- **Verification:** All 273 tests pass, npm pack confirms correct tarball
- **Committed in:** 9454955 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix corrects the test logic to match the actual intent -- verifying no external npm package dependencies remain, while correctly allowing Node.js builtins. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package is fully verified and ready for `npm publish` as @aiou/cu
- All 273 tests pass including 9 new package verification tests
- npm pack --dry-run confirms correct minimal tarball contents
- Bundle is self-contained with zero external npm imports

## Self-Check: PASSED

All files verified present: packages/cli/src/__tests__/package.test.ts, 09-02-SUMMARY.md
All commits verified present: 9454955

---
*Phase: 09-package-and-publish*
*Completed: 2026-04-14*
