---
phase: 09-package-and-publish
plan: 01
subsystem: infra
tags: [npm, tsup, bundling, package-publish, esm]

# Dependency graph
requires:
  - phase: 08-cli-launcher
    provides: CLI entry point with tsup build and all runtime dependencies
provides:
  - Self-contained npm package config for @aiou/cu with zero-dependency bundle
  - tsup bundling that inlines all 9 runtime deps into single dist/index.js
  - Prepublish script that rewrites name from @claudeui/cli to @aiou/cu
  - Scoped .npmrc routing @aiou to public npm registry
affects: [09-package-and-publish, release]

# Tech tracking
tech-stack:
  added: []
  patterns: [explicit-noExternal-list, prepublish-name-rewrite, files-allowlist]

key-files:
  created:
    - packages/cli/.npmrc
    - packages/cli/scripts/prepublish.mjs
  modified:
    - packages/cli/tsup.config.ts
    - packages/cli/package.json

key-decisions:
  - "Explicit noExternal list of 9 deps instead of regex -- tsup v8+ regex is unreliable (egoist/tsup#619)"
  - "splitting: false + clean: true for deterministic single-file output"
  - "files allowlist (not .npmignore) for tarball control"
  - "prepublish.mjs handles name rewrite + dep clearing with process.on('exit') restore"

patterns-established:
  - "Explicit noExternal list: enumerate each dependency rather than using catch-all regex patterns"
  - "Prepublish rewrite pattern: modify package.json in-memory, write to disk, restore on process exit"
  - "Files allowlist: use package.json files field instead of .npmignore for explicit tarball control"

requirements-completed: [PKG-01, PKG-02, PKG-03]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 9 Plan 1: Package Configuration Summary

**CLI package configured as zero-dependency @aiou/cu with all 9 runtime deps bundled into single dist/index.js, prepublish name rewrite, and scoped npm registry routing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T02:25:27Z
- **Completed:** 2026-04-14T02:29:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- tsup bundles all 9 runtime dependencies into a single 2.13 MB dist/index.js with no code-split chunks
- package.json has files allowlist, publishConfig, and prepublishOnly script for clean npm publication
- prepublish.mjs rewrites package name from @claudeui/cli to @aiou/cu and clears dependencies, restoring original on exit
- All 264 existing tests continue to pass after configuration changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend tsup bundling** - `04f4060` (feat)
2. **Task 2: Configure package.json, .npmrc, prepublish** - `642e27a` (feat)

## Files Created/Modified
- `packages/cli/tsup.config.ts` - Added splitting:false, clean:true, extended noExternal to all 9 runtime deps
- `packages/cli/package.json` - Added files allowlist, publishConfig, prepublishOnly script
- `packages/cli/.npmrc` - Routes @aiou scope to public npm registry
- `packages/cli/scripts/prepublish.mjs` - Rewrites name to @aiou/cu, clears deps, restores on exit

## Decisions Made
- Explicit noExternal list of all 9 dependencies rather than regex catch-all -- tsup v8+ regex is unreliable per upstream issue #619
- splitting: false + clean: true ensures deterministic single-file output with no stale chunk artifacts
- files allowlist pattern (not .npmignore) gives explicit tarball content control
- prepublish script pattern with process.on('exit') restore ensures original package.json is never permanently modified

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package is fully configured and ready for `npm publish` as @aiou/cu
- Build produces a self-contained dist/index.js with zero external npm imports
- Prepublish script validated: name rewrite and restore cycle works correctly
- All 264 existing tests pass

## Self-Check: PASSED

All files verified present: tsup.config.ts, package.json, .npmrc, prepublish.mjs, 09-01-SUMMARY.md
All commits verified present: 04f4060, 642e27a

---
*Phase: 09-package-and-publish*
*Completed: 2026-04-14*
