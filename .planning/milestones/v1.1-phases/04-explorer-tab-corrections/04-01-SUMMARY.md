---
phase: 04-explorer-tab-corrections
plan: 01
subsystem: api
tags: [plugin-resolver, configs-routes, source-attribution, mcp, hooks, lsp, fastify]

# Dependency graph
requires:
  - phase: 03-safe-switching-and-reference-safety
    provides: PluginResolver class for resolving enabled plugin install paths
provides:
  - Plugin-merged configs API routes with source attribution for hooks, MCP servers, and LSP servers
  - Array-of-tagged-entries response shape for GET /api/mcp, GET /api/hooks, GET /api/lsp
affects: [04-02-PLAN, frontend explorer tabs, plugins-tab-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [plugin-merge-with-source-tags, flatten-hooks-to-entries]

key-files:
  created: []
  modified:
    - packages/cli/src/server/routes/configs.ts
    - packages/cli/src/server/index.ts
    - packages/cli/src/server/routes/__tests__/configs.test.ts

key-decisions:
  - "Flatten hooks into individual entries with event and composite name (event [index]) for source tagging"
  - "Allow name collisions between local and plugin entries -- frontend SourceBadge distinguishes them"
  - "Read .lsp.json as flat object (no wrapper key) per existing convention"

patterns-established:
  - "Plugin merging via PluginResolver: read local config, then iterate enabled plugins, tag each entry with source and pluginId"
  - "Array-of-tagged-entries response shape for config APIs replacing raw object responses"

requirements-completed: [TAB-01, TAB-02, TAB-03]

# Metrics
duration: 4min
completed: 2026-04-07
---

# Phase 4 Plan 1: Plugin-Merged Configs API Summary

**Configs API routes return plugin-merged arrays of tagged entries with source attribution for MCP servers, hooks, and LSP servers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-07T05:57:44Z
- **Completed:** 2026-04-07T06:02:36Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- All three config endpoints (mcp, hooks, lsp) now merge local and enabled-plugin data with source tags
- Hooks are flattened from nested event-keyed structure into individual tagged entries with event name and composite name
- Only enabled plugins contribute entries; disabled plugins are excluded
- Server registration passes pluginsDir and settingsPath to configsRoutes
- Full CLI test suite passes (201/201 tests, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for plugin-merged configs API** - `9fe3995` (test)
2. **Task 1 (GREEN): Implement plugin-merged configs API with source tags** - `7adde10` (feat)

## Files Created/Modified
- `packages/cli/src/server/routes/configs.ts` - Plugin-merged configs API routes with source attribution using PluginResolver
- `packages/cli/src/server/index.ts` - Updated server registration to pass pluginsDir and settingsPath to configsRoutes
- `packages/cli/src/server/routes/__tests__/configs.test.ts` - Updated and expanded tests (13 tests covering local-only, plugin-merged, disabled-plugin scenarios)

## Decisions Made
- Hooks flattened to individual entries with event name and composite name (e.g., "PreToolUse [0]") to enable per-hook source tagging
- Name collisions between local and plugin entries are allowed -- the frontend SourceBadge distinguishes them visually
- .lsp.json read as flat object (no wrapper key) consistent with existing project convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API ready for frontend consumption in plan 04-02 (source badges, CLAUDE.md tab removal)
- All three endpoints return tagged arrays that can drive SourceBadge components
- Frontend will need to update from object-based to array-based response handling

---
*Phase: 04-explorer-tab-corrections*
*Completed: 2026-04-07*
