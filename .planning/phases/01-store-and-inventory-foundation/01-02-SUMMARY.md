---
phase: 01-store-and-inventory-foundation
plan: 02
subsystem: ui
tags: [react, tanstack-query, fastify, inventory, plugins]
requires:
  - phase: 01-00
    provides: UI test harness and Explorer inventory behavior coverage
provides:
  - Explicit local, profile, and plugin source badges in the inventory UI
  - Read-only Explorer plugin inventory with enabled state and bundled component counts
  - Current environment summary blocks for hooks, MCP servers, and LSP servers
affects: [01-03, explorer, profiles, inventory]
tech-stack:
  added: []
  patterns:
    - Normalize backend payload mismatches at the UI hook boundary
    - Keep AGENT_HOME inventory and environment sections read-only in Explorer
key-files:
  created:
    - packages/ui/src/hooks/__tests__/usePlugins.test.tsx
  modified:
    - packages/ui/src/components/SourceBadge.tsx
    - packages/ui/src/Explorer.tsx
    - packages/ui/src/hooks/usePlugins.ts
    - packages/cli/src/server/routes/__tests__/agents.test.ts
    - packages/cli/src/server/routes/__tests__/skills.test.ts
    - packages/cli/src/server/routes/__tests__/commands.test.ts
    - packages/cli/src/server/routes/__tests__/plugins.test.ts
    - packages/ui/src/__tests__/Explorer.inventory.test.tsx
key-decisions:
  - "Contained the enabledPlugins/settings mismatch in usePlugins instead of widening Phase 1 into a settings schema refactor."
  - "Reused a shared Current environment summary block across plugin, hooks, MCP, and LSP Explorer sections."
patterns-established:
  - "Normalize sparse API payloads into stable booleans and count fields before Explorer rendering."
  - "Use route and UI tests together to lock backend source classification and read-only inventory presentation."
requirements-completed: [INV-01, INV-02]
duration: 5min
completed: 2026-03-29
---

# Phase 1 Plan 2: Source-Aware Inventory and Read-Only Environment Inspection Summary

**Source-aware inventory badges plus normalized plugin and environment inspection panels for the current Explorer**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T14:06:00Z
- **Completed:** 2026-03-29T14:11:07Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Locked explicit `local`, `profile`, and `plugin` source labeling with UI typing and route-list assertions.
- Replaced the Explorer plugins placeholder with a real read-only inventory panel backed by normalized plugin data.
- Added a `Current environment` summary for hooks, MCP servers, and LSP servers without introducing edit flows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make inventory source labeling explicit and stable** - `886e5bb` (fix)
2. **Task 2: Replace Explorer placeholders with read-only plugin and environment inspection panels** - `53bc9d5` (feat)

## Files Created/Modified
- `packages/ui/src/components/SourceBadge.tsx` - Narrows source handling to explicit inventory literals.
- `packages/cli/src/server/routes/__tests__/agents.test.ts` - Locks `local` and `profile` source classification in mixed listings.
- `packages/cli/src/server/routes/__tests__/skills.test.ts` - Locks `local` and `profile` source classification in mixed listings.
- `packages/cli/src/server/routes/__tests__/commands.test.ts` - Locks `local` and `profile` source classification in mixed listings.
- `packages/ui/src/hooks/usePlugins.ts` - Normalizes plugin API payloads into stable booleans and component count fields.
- `packages/ui/src/Explorer.tsx` - Renders read-only plugin cards and current-environment summary blocks.
- `packages/ui/src/hooks/__tests__/usePlugins.test.tsx` - Verifies enabled and disabled plugin payload normalization against the real route shape.
- `packages/ui/src/__tests__/Explorer.inventory.test.tsx` - Covers the plugin panel and read-only config summary rendering.
- `packages/cli/src/server/routes/__tests__/plugins.test.ts` - Locks plugin route payload shape and sparse-data defaults.

## Decisions Made
- Contained the `enabledPlugins` mismatch in `usePlugins` so Phase 1 can ship read-only inspection without refactoring settings schemas.
- Kept plugin/config sections inspection-only and reused one environment summary block rather than adding edit affordances.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forced the new hook test to import the TypeScript hook module**
- **Found during:** Task 2 (Replace Explorer placeholders with read-only plugin and environment inspection panels)
- **Issue:** A stale sibling `usePlugins.js` file caused the new test to execute outdated, unnormalized hook logic.
- **Fix:** Updated the test to import `usePlugins.ts` directly and asserted against serialized normalized output.
- **Files modified:** packages/ui/src/hooks/__tests__/usePlugins.test.tsx
- **Verification:** `pnpm --filter @claudeui/ui test -- src/hooks/__tests__/usePlugins.test.tsx src/__tests__/Explorer.inventory.test.tsx`
- **Committed in:** `53bc9d5`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to verify the intended hook normalization without widening scope.

## Issues Encountered
- A stale `.git/index.lock` briefly blocked the Task 1 commit; the lock was already gone when rechecked, so the commit was retried successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Explorer now exposes the current environment clearly enough for Phase 1 store/browser work to build on top of it.
- The existing generated `.js` artifacts in `packages/ui/src/hooks/` remain workspace noise and should stay out of future plan scopes unless they block execution again.

## Self-Check

PASSED

- Found summary file: `.planning/phases/01-store-and-inventory-foundation/01-02-SUMMARY.md`
- Found task commits: `886e5bb`, `53bc9d5`

---
*Phase: 01-store-and-inventory-foundation*
*Completed: 2026-03-29*
