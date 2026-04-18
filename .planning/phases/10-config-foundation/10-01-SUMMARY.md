---
phase: 10-config-foundation
plan: 01
subsystem: config
tags: [configlocator, path-resolution, tdd, vitest]
requires: []
provides:
  - ConfigLocator class with global and project path resolution
  - AGENT_DIR_NAME constant as single definition point for .claude references
  - Project-local .claude/ directory discovery at server startup
  - Zero scattered .claude/.cu string literals in server source
affects: [11-project-loading, settings-routes]
tech-stack:
  added: []
  patterns: [class-based-config-locator, single-source-of-truth-for-paths, centralized-discovery]
key-files:
  created:
    - packages/cli/src/server/services/configLocator.ts
    - packages/cli/src/server/services/__tests__/configLocator.test.ts
  modified:
    - packages/cli/src/server/index.ts
    - packages/cli/src/server/routes/settings.ts
key-decisions:
  - "ConfigLocator class follows existing AgentService/SkillService pattern (D-03)"
  - "Routes receive resolved directory strings via options, not ConfigLocator directly (D-04)"
  - "AGENT_DIR_NAME constant enables grep-based verification of zero scattered literals (D-05)"
  - "Project discovery checks cwd only — no walk-up traversal (D-01)"
  - "Silent fallback to global-only when no project .claude/ found"
requirements-completed: [FOUND-01, FOUND-02]
duration: 2min
completed: 2026-04-18
---

# Phase 10 Plan 01: ConfigLocator Service Summary

**ConfigLocator class centralizes all `.claude` path resolution with project discovery and AGENT_DIR_NAME constant**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-18T01:57:48Z
- **Completed:** 2026-04-18T02:00:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ConfigLocator class with global and project path resolution (D-03, D-04, D-05)
- Implemented project-local `.claude/` directory discovery at server startup (D-01)
- Exported AGENT_DIR_NAME constant replacing all scattered `.claude` string literals
- Wired ConfigLocator into server/index.ts, removed `os` import and inline path construction
- Updated settings.ts to import AGENT_DIR_NAME instead of hardcoded `.claude`
- All 283 tests pass (8 new ConfigLocator tests + 275 existing, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ConfigLocator class with unit tests** — `9e453b7` (test) + `fd25676` (feat)
2. **Task 2: Wire ConfigLocator into server and replace literals** — `52a34a9` (feat)

**Plan metadata:** (pending)

_Note: TDD task produced 2 commits (test → feat)_

## Files Created/Modified
- `packages/cli/src/server/services/configLocator.ts` — ConfigLocator class with globalDir, projectDir, AGENT_DIR_NAME, and all subdirectory getters
- `packages/cli/src/server/services/__tests__/configLocator.test.ts` — 8 unit tests covering project discovery, global paths, AGENT_HOME override, project subdirectories
- `packages/cli/src/server/index.ts` — Replaced os.homedir/AGENT_HOME path construction with `new ConfigLocator()`, passes config.*Dir getters to routes
- `packages/cli/src/server/routes/settings.ts` — Imports AGENT_DIR_NAME instead of hardcoded `.claude`, updated comments

## Decisions Made
- ConfigLocator follows class-based, constructor-injected pattern matching existing services (D-03)
- Routes receive directory strings via options objects, not ConfigLocator instances (D-04)
- Project discovery is CWD-only with silent fallback — no walk-up, no log message (D-01)
- `.claude-plugin/` references in profileService and pluginService were NOT moved — they are a different convention (Claude Code plugin manifests)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- ConfigLocator is complete and all path resolution flows through it
- Project path (projectPath, hasProject) and project subdirectory getters (projectAgentsDir, etc.) are exposed for Phase 11 dual-source loading
- AGENT_DIR_NAME constant enables future `.cu` rebrand by changing a single line
- FOUND-01 and FOUND-02 requirements satisfied

---
*Phase: 10-config-foundation*
*Completed: 2026-04-18*

## Self-Check: PASSED

- All 4 key files found on disk (configLocator.ts, configLocator.test.ts, index.ts, settings.ts)
- All 3 task commits found in git history (9e453b7, fd25676, 52a34a9)
- Metadata commit (f6f178d) includes SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md