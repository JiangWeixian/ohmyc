---
phase: 11-project-local-loading
plan: 01
subsystem: api
tags: [fastify, zod, dual-source, merge, scope]

requires:
  - phase: 10-config-foundation
    provides: ConfigLocator with projectAgentsDir/projectSkillsDir/projectCommandsDir getters and projectPath
provides:
  - ScopeEnum (global|project) in shared schemas with optional scope field
  - All entity routes (agents, skills, commands) load from project directories with scope tagging
  - All config routes (mcp, hooks, lsp) load from project directories with scope tagging
  - Project-first sorting on name collision via custom comparator
  - Single-item GET routes support source=project and scope=project query params
affects: [11-02-PLAN, frontend hooks, Explorer, EntityDetail, ConfigSection]

tech-stack:
  added: []
  patterns: [dual-source merge with scope tagging, project-first sort comparator]

key-files:
  created: []
  modified:
    - packages/shared/src/agentSchema.ts
    - packages/shared/src/skillSchema.ts
    - packages/shared/src/commandSchema.ts
    - packages/cli/src/server/index.ts
    - packages/cli/src/server/routes/agents.ts
    - packages/cli/src/server/routes/skills.ts
    - packages/cli/src/server/routes/commands.ts
    - packages/cli/src/server/routes/configs.ts
    - packages/cli/src/server/routes/__tests__/agents.test.ts
    - packages/cli/src/server/routes/__tests__/skills.test.ts
    - packages/cli/src/server/routes/__tests__/commands.test.ts
    - packages/cli/src/server/routes/__tests__/configs.test.ts

key-decisions:
  - "ScopeEnum exported from agentSchema.ts, imported by skillSchema and commandSchema — single definition point"
  - "All route options accept null|undefined for project directory params — backward compatible when no project found"
  - "Project-first sort uses stable comparator: id comparison first, then project scope wins on tie"

patterns-established:
  - "Dual-source merge pattern: load global → tag scope:global, load plugins → tag scope:global, load project → tag source:project+scope:project, concatenate, sort with project-first tiebreaker"
  - "Config route project loading: read projectBaseDir configs with source:project+scope:project, concatenate with existing entries"

requirements-completed: [LOAD-01, LOAD-02, LOAD-03]

duration: 5min
completed: 2026-04-18
---

# Phase 11: Project-Local Loading Plan 01 Summary

**Backend dual-source loading with scope field, project-first merge sort, and config route extension**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-18T14:37:00Z
- **Completed:** 2026-04-18T14:42:00Z
- **Tasks:** 3 (consolidated into single commit)
- **Files modified:** 12

## Accomplishments
- All API routes now return merged global + project items with scope field
- Entity routes sort project items first when names collide (per D-04)
- Config routes (MCP, Hooks, LSP) read from project directory with both versions visible on overlap (per D-09)
- 15 new project-loading tests added (298 CLI tests total, all passing)

## Task Commits

1. **Tasks 1-3: Schema scope field + route extension + config routes** - `76fc0df` (feat)

## Decisions Made
- ScopeEnum defined in agentSchema.ts and imported by skill/command schemas — avoids duplication
- All existing config test expectations updated to include `scope: 'global'` — consistent field presence
- Single commit for all 3 tasks since they form an atomic unit (schemas → wiring → routes)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- All backend routes return `scope` field on every item — frontend can now consume and render scope
- Plan 11-02 can proceed: update hooks, Explorer, EntityDetail, ConfigSection

---
*Phase: 11-project-local-loading*
*Completed: 2026-04-18*
