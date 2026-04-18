---
phase: 12-cu-rebrand
plan: 01
subsystem: config
tags: [rebrand, configLocator, path-resolution, tdd]
dependency_graph:
  requires: [phase-10-config-foundation]
  provides: [WRITE_DIR_NAME, split-write-read-paths]
  affects: [configLocator, all-route-wiring]
tech_stack:
  added: [WRITE_DIR_NAME constant, writeBaseDir/claudeCodeDir split]
  patterns: [dual-base-directory-path-resolution]
key_files:
  created: []
  modified:
    - packages/cli/src/server/services/configLocator.ts
    - packages/cli/src/server/services/__tests__/configLocator.test.ts
decisions:
  - D-01: WRITE_DIR_NAME = '.cui' for managed data writes
  - D-03: claudeCodeDir = ~/.claude/ for plugin reads only
  - D-04: readBaseDir equals writeBaseDir (both ~/.cui/)
  - D-09: AGENT_HOME overrides both bases to same directory
  - D-10: AGENT_DIR_NAME stays '.claude' for project discovery
metrics:
  duration: 4min
  completed: 2026-04-18
  tasks: 2
  files: 2
  tests_added: 9
  tests_total: 18
---

# Phase 12 Plan 01: ConfigLocator Write Path Rebrand Summary

Split ConfigLocator into dual base directories: writeBaseDir (~/.cui/) for managed data and claudeCodeDir (~/.claude/) for plugin reads, enabling clean break rebrand with zero migration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for write path rebrand | 07e8e3c | configLocator.test.ts |
| 1 (GREEN) | Implement split writeBaseDir/claudeCodeDir | 92bb35d | configLocator.ts |
| 2 | Verify full test suite + no scattered literals | (verification only) | — |

## Key Changes

### ConfigLocator Split Architecture

**Before:** Single `globalDir` (~/.claude/) for all paths.

**After:** Two base directories:
- `writeBaseDir` — defaults to `~/.cui/` (managed data: store, profiles, settings, agents, skills, commands)
- `claudeCodeDir` — defaults to `~/.claude/` (plugin reads only)

**AGENT_HOME override:** When set, both bases resolve to the same directory (preserving existing override behavior).

### What Changed
- Added `WRITE_DIR_NAME = '.cui'` constant
- `baseDir`, `agentsDir`, `skillsDir`, `commandsDir`, `settingsPath` → resolve from `writeBaseDir` (~/.cui/)
- `pluginsDir` → resolves from `claudeCodeDir` (~/.claude/)
- Added `readBaseDir` getter (equals writeBaseDir per D-04)
- 18 tests total (9 new, 9 existing updated for new path expectations)

### What Did NOT Change
- `AGENT_DIR_NAME` stays `.claude` per D-10
- Project discovery logic unchanged (still checks cwd/.claude/)
- Project subdirectory getters unchanged
- `server/index.ts` — zero changes needed (routes use getters)
- `.claude-plugin` manifest references in profileService/pluginService — Claude Code convention, not our directory

## Verification Results

- Full test suite: 305/308 pass (3 pre-existing failures in package/launcher tests)
- ConfigLocator tests: 18/18 pass
- No `.cui` string literals outside configLocator.ts
- No `.claude` path literals outside configLocator.ts (except `AGENT_DIR_NAME` constant usage in settings.ts and `.claude-plugin` manifest convention)
- server/index.ts wiring confirmed using only ConfigLocator getters

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- [x] RED gate: `test(12-01)` commit (07e8e3c) — 9 tests failed
- [x] GREEN gate: `feat(12-01)` commit (92bb35d) — 18 tests passed
- [x] No REFACTOR gate needed (implementation is clean)

## Requirements Satisfied

- **REBR-01:** All managed data writes route to ~/.cui/ (store, profiles, settings, activation paths all derive from writeBaseDir)
- **REBR-02:** ~/.claude/ files not deleted — plugins still readable from ~/.claude/plugins/ via claudeCodeDir. No destructive operations performed.

## Self-Check

- [x] configLocator.ts exists and exports WRITE_DIR_NAME
- [x] configLocator.test.ts exists with 18 tests
- [x] Commit 07e8e3c exists (RED)
- [x] Commit 92bb35d exists (GREEN)
