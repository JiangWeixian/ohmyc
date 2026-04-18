---
phase: 09-package-and-publish
plan: 03
subsystem: infra
tags: [cjs, tsup, bundling, esbuild, prepublish, smoke-test]

# Dependency graph
requires:
  - phase: 09-package-and-publish
    plan: 01
    provides: Package configuration with files allowlist, publishConfig, prepublish script, and tsup bundling
  - phase: 09-package-and-publish
    plan: 02
    provides: Package verification tests for package.json config and build output
provides:
  - Self-contained CJS bundle that runs without "Dynamic require" crash
  - prepublishOnly script that runs build:full before name rewrite
  - import.meta.url shim via esbuild banner+define for CJS compatibility
  - Runtime smoke test verifying bundle executes correctly
affects: [09-package-and-publish, release]

# Tech tracking
tech-stack:
  added: []
  patterns: [cjs-banner-shim-for-import-meta, esbuild-define-with-banner-variable]

key-files:
  created: []
  modified:
    - packages/cli/tsup.config.ts
    - packages/cli/package.json
    - packages/cli/scripts/prepublish.mjs
    - packages/cli/src/__tests__/package.test.ts
    - .gitignore

key-decisions:
  - "CJS output with .cjs extension avoids conflict with package.json type:module field"
  - "Banner+define pattern to shim import.meta.url in CJS context without modifying source code"
  - "Filter internal bundled subpath references (containing /) from import check -- these are intra-bundle require() calls"

patterns-established:
  - "Banner+define shim: inject banner variable then use esbuild define to replace import.meta.url with it, keeping source code ESM-clean"
  - "CJS extension for type:module packages: use .cjs output extension when package.json has type:module to avoid module system conflict"

requirements-completed: [PKG-01, PKG-02, PKG-03]

# Metrics
duration: 11min
completed: 2026-04-14
---

# Phase 9 Plan 3: Gap Closure Summary

**CJS bundle format with esbuild import.meta.url shim, prepublishOnly build step, and runtime smoke test -- fixes dynamic require crash and adds 2 new verification tests**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-14T04:03:43Z
- **Completed:** 2026-04-14T04:14:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Switched tsup from ESM to CJS format, eliminating the "Dynamic require of X is not supported" crash
- Added esbuild banner+define pattern to shim import.meta.url in CJS context, keeping source code ESM-compatible
- Updated prepublishOnly to run `pnpm build:full` before the name rewrite script
- Added runtime smoke test that executes the bundle and verifies help output
- Added CJS format verification test for tsup config
- Updated all bin entries, scripts, and test references from .js to .cjs extension
- All 275 tests pass (264 existing + 9 package tests from plan 02 + 2 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ESM bundle crash by switching tsup to CJS format and update prepublishOnly** - `2ad5391` (feat)
2. **Task 2: Add runtime smoke test and update existing tests for CJS output** - `29636ab` (test)

## Files Created/Modified
- `packages/cli/tsup.config.ts` - Changed format to CJS, added esbuildOptions with banner+define for import.meta.url shim
- `packages/cli/package.json` - Updated bin entries to dist/index.cjs, scripts to reference .cjs, prepublishOnly with build:full
- `packages/cli/scripts/prepublish.mjs` - Updated pre-flight check path from dist/index.js to dist/index.cjs
- `packages/cli/src/__tests__/package.test.ts` - Updated for CJS assertions, added smoke test and format verification
- `.gitignore` - Added *.tsbuildinfo to build outputs

## Decisions Made
- Used .cjs extension for bundled output instead of forcing .js -- package.json has `"type": "module"` which makes Node treat .js files as ESM, causing require() to fail in CJS bundles. The .cjs extension is unambiguous.
- Used esbuild banner+define pattern to shim import.meta.url rather than modifying source code -- the banner declares `_importMetaUrl` from `require("url").pathToFileURL(__filename).href`, and define replaces `import.meta.url` with the variable reference. Source code remains clean ESM.
- Filtered internal bundled subpath references (specifiers containing `/`) from the import check -- these are require() calls within the bundled code referencing other parts of the same bundle (e.g., `ajv/dist/runtime/validation_error`), not external npm packages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import.meta.url crash in CJS bundle**
- **Found during:** Task 1 (CJS format switch)
- **Issue:** tsup outputs `import.meta` as empty in CJS, causing `fileURLToPath(import.meta.url)` to throw TypeError
- **Fix:** Added esbuildOptions with banner variable `_importMetaUrl` and define to replace `import.meta.url` with it
- **Files modified:** packages/cli/tsup.config.ts
- **Verification:** `node dist/index.cjs --help` runs without errors
- **Committed in:** 2ad5391 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed bin entry and script paths for .cjs extension**
- **Found during:** Task 1 (CJS format switch)
- **Issue:** CJS output produces dist/index.cjs not dist/index.js; bin entries and scripts pointed to wrong file
- **Fix:** Updated all bin entries, start/dev scripts, and prepublish.mjs to reference dist/index.cjs
- **Files modified:** packages/cli/package.json, packages/cli/scripts/prepublish.mjs
- **Verification:** `node dist/index.cjs --help` runs, prepublish pre-flight check works
- **Committed in:** 2ad5391 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added *.tsbuildinfo to .gitignore**
- **Found during:** Task 1 (build produced tsconfig.tsbuildinfo)
- **Issue:** Build artifact tsconfig.tsbuildinfo was not gitignored and would be tracked in version control
- **Fix:** Added `*.tsbuildinfo` to the build outputs section of .gitignore
- **Files modified:** .gitignore
- **Verification:** `git status` no longer shows tsconfig.tsbuildinfo as modified
- **Committed in:** 2ad5391 (Task 1 commit)

**4. [Rule 1 - Bug] Fixed import check false positives for CJS require() patterns**
- **Found during:** Task 2 (test updates)
- **Issue:** CJS require() regex matched internal bundled subpath references like `ajv/dist/runtime/validation_error` which are intra-bundle calls, not external npm packages. Also `async_hooks` Node builtin was missing from filter set.
- **Fix:** Added `async_hooks` to NODE_BUILTINS and filtered specifiers containing `/` (internal subpath references)
- **Files modified:** packages/cli/src/__tests__/package.test.ts
- **Verification:** All 275 tests pass
- **Committed in:** 29636ab (Task 2 commit)

**5. [Rule 1 - Bug] Fixed smoke test assertion for --port**
- **Found during:** Task 2 (test updates)
- **Issue:** Plan specified asserting `--port` in help output, but `--port` only appears in `cu start --help`, not the top-level `cu --help`
- **Fix:** Changed assertion to check for `--version` which appears in top-level help
- **Files modified:** packages/cli/src/__tests__/package.test.ts
- **Verification:** Smoke test passes
- **Committed in:** 29636ab (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (4 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. The CJS format change had cascading effects (file extension, import.meta shim, test updates) not fully anticipated in the plan. No scope creep -- all fixes directly support the plan's goal of a working CJS bundle.

## Issues Encountered

- The plan assumed the CJS output would be named `dist/index.js` but tsup produces `dist/index.cjs` for CJS format. The `outExtension` option could force `.js` but that conflicts with `"type": "module"` in package.json. Resolved by embracing `.cjs` extension and updating all references.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package is fully ready for `npm publish` as @aiou/cu
- CJS bundle runs without errors, all 275 tests pass
- prepublishOnly triggers full build before name rewrite
- dist/ is clean after build (only index.cjs and ui/)

## Self-Check: PASSED

All files verified present: packages/cli/tsup.config.ts, packages/cli/package.json, packages/cli/scripts/prepublish.mjs, packages/cli/src/__tests__/package.test.ts, .gitignore, 09-03-SUMMARY.md
All commits verified present: 2ad5391, 29636ab

---
*Phase: 09-package-and-publish*
*Completed: 2026-04-14*
