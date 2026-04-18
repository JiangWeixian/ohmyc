---
phase: 08-cli-launcher
plan: 01
subsystem: infra
tags: [fastify, tsup, vite, static-serving, spa, get-port, packaging]

# Dependency graph
requires: []
provides:
  - Packaged static asset resolution with resolveStaticRoot()
  - createServer({ staticRoot }) with deterministic asset root
  - startServer() with port fallback detection and close() handle
  - tsup onSuccess hook that copies UI dist into CLI build output
  - build:full script for combined UI+CLI build
affects: [08-02, cli-launcher, packaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveStaticRoot() validates index.html presence before registering static serving"
    - "tsup onSuccess hook copies pre-built UI assets into dist/ui/ at build time"
    - "startServer returns { port, fallback, staticRoot, close } for launcher control"

key-files:
  created:
    - packages/cli/src/server/__tests__/launcherServer.test.ts
  modified:
    - packages/cli/src/server/index.ts
    - packages/cli/tsup.config.ts
    - packages/cli/package.json

key-decisions:
  - "resolveStaticRoot uses explicit candidate path list with index.html validation, not filesystem globbing"
  - "Packaged UI assets placed at dist/ui/ via tsup onSuccess copy, not publicDir (avoids polluting dist root)"
  - "startServer accepts both number and options object for backward compatibility with existing callers"
  - "fallback flag treats defaultPort 0 as 'any port' so it never reports false fallback"

patterns-established:
  - "resolveStaticRoot(): validates packaged asset directory contains index.html before serving"
  - "StartServerResult.close(): async cleanup handle for test teardown and launcher control"

requirements-completed: [CLI-02, CLI-05]

# Metrics
duration: 9min
completed: 2026-04-13
---

# Phase 8 Plan 01: Packaged Server Runtime Summary

**Fastify server resolves packaged UI assets from dist/ui/ at runtime, serves SPA with fallback routing, and auto-selects open ports when the requested one is occupied**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-13T04:43:55Z
- **Completed:** 2026-04-13T04:53:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Deterministic static asset resolution via resolveStaticRoot() with candidate path priority and index.html validation
- Packaged build pipeline: tsup onSuccess copies packages/ui/dist into dist/ui/ during CLI build
- Rich startServer metadata: port, fallback indicator, resolved staticRoot, and async close() handle
- Descriptive startup error when no UI asset directory can be resolved (mitigates T-08-01)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Lock the packaged server contract with launcher integration tests** - `98eb962` (test)
2. **Task 1 (GREEN): Implement packaged server contract with static asset resolution** - `eca3e69` (feat)
3. **Task 2: Make the CLI build output include pre-built UI assets** - `1f3790a` (feat)

_Note: Task 1 was TDD with separate RED and GREEN commits._

## Files Created/Modified
- `packages/cli/src/server/__tests__/launcherServer.test.ts` - 8 tests covering static serving, SPA fallback, port selection, fallback detection, and error cases
- `packages/cli/src/server/index.ts` - resolveStaticRoot(), createServer({ staticRoot }), startServer(options) with rich metadata, backward-compatible number overload
- `packages/cli/tsup.config.ts` - onSuccess hook that copies UI dist into dist/ui/ at build time
- `packages/cli/package.json` - Added build:full script for combined UI+CLI build

## Decisions Made
- **resolveStaticRoot uses explicit candidate path list** -- searched in priority order (packaged, monorepo dev, source fallback) with index.html existence check, avoiding filesystem globbing for security and determinism
- **Packaged UI assets placed at dist/ui/ via tsup onSuccess** -- tsup's publicDir would flatten contents into dist root; onSuccess gives control over subdirectory placement
- **startServer backward-compatible number overload** -- existing callers pass a plain port number; new callers pass an options object with staticRoot
- **fallback treats port 0 as 'any port'** -- when defaultPort is 0, the chosen port always differs from 0, but that is not a fallback scenario; only report fallback when a specific port was requested and could not be obtained

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Server runtime is package-ready: createServer and startServer work with bundled assets
- resolveStaticRoot can be called from the CLI launcher entry point for pre-flight validation
- Port fallback metadata (fallback flag, actual port) is available for launcher URL construction
- Ready for 08-02 to wire the CLI launcher command with dep build, browser open, and rebrand

---
*Phase: 08-cli-launcher*
*Completed: 2026-04-13*

## Self-Check: PASSED

All files verified present:
- packages/cli/src/server/__tests__/launcherServer.test.ts
- packages/cli/src/server/index.ts
- packages/cli/tsup.config.ts
- packages/cli/package.json
- .planning/phases/08-cli-launcher/08-01-SUMMARY.md

All commits verified: 98eb962, eca3e69, 1f3790a
