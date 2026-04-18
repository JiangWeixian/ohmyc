# Phase 1: Store and Inventory Foundation - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the local store as the canonical source of reusable Claude components and expose the current environment with clear source labeling. This phase covers store import/CRUD behavior, inventory visibility, and source/provenance presentation. It does not add profile activation features beyond what is needed to understand source relationships.

</domain>

<decisions>
## Implementation Decisions

### Import conflict handling
- Store import may overwrite existing items, but only after explicit user confirmation
- When import detects name collisions, the UI should show the conflicting items before applying overwrites
- The conflict confirmation should support a one-click "overwrite all" option

### Provenance visibility
- Store-managed provenance only needs to surface import path and import time in Phase 1
- Provenance metadata does not need to be heavily exposed in the main list view
- Provenance details should be lightweight enough to support future adapters later without turning this phase into a metadata-heavy management UI

### Inventory editing boundary
- AGENT_HOME inventory should remain read-only in Phase 1
- `local`, `profile`, and `plugin` items are all inspection-only from the inventory view
- Editing should happen through store management flows, not inline from the inventory browser

### Store browsing
- Store list UI should stay minimal in Phase 1
- Primary list information should be type, name, description, and profile reference count
- Store browsing must support name search and type filtering

### Claude's Discretion
- Exact visual treatment of source badges and tooltips
- Exact interaction details of the import conflict dialog, as long as explicit confirmation and overwrite-all are supported
- Exact placement and formatting of search/type filter controls

</decisions>

<specifics>
## Specific Ideas

- The user wants Phase 1 optimized for power-user clarity rather than a heavy management dashboard
- Import provenance should be discoverable but not dominant in the UI
- AGENT_HOME inventory should help users understand what is active and where it came from, without becoming another editing surface

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope
- `.planning/PROJECT.md` — product direction, Claude-first storage constraint, and local-store positioning
- `.planning/REQUIREMENTS.md` — Phase 1 requirement definitions for store and inventory behavior
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and planned sub-areas
- `.planning/research/SUMMARY.md` — roadmap implications, especially canonical store plus derived activation

### Existing profiler design
- `docs/superpowers/specs/2026-03-25-profiler-design.md` — intended store/profile model, AGENT_HOME read-only view, and source-label behavior

### Existing implementation anchors
- `packages/cli/src/server/services/storeService.ts` — current import behavior and profile reference lookup
- `packages/cli/src/server/routes/store.ts` — store CRUD and import endpoints
- `packages/cli/src/server/routes/agents.ts` — source tagging behavior for AGENT_HOME agent inventory
- `packages/cli/src/server/routes/skills.ts` — source tagging behavior for AGENT_HOME skill inventory
- `packages/cli/src/server/routes/commands.ts` — source tagging behavior for AGENT_HOME command inventory
- `packages/ui/src/components/store/StoreComponentList.tsx` — current store browsing UI and reference count display

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StoreService`: already imports agents, skills, and commands, and already checks profile references for delete safety
- Store CRUD routes and shared schemas: existing API surface can be extended rather than replaced
- `StoreComponentList`: already displays list items and profile reference counts, making it a natural base for minimal browsing plus search/filter

### Established Patterns
- Source classification for AGENT_HOME content already uses `local | profile | plugin`
- Current backend routes use `lstat`-based source tagging for agents, skills, and commands
- Store and profile management already live as distinct concepts in the product, which supports the “store is canonical, inventory is read-only” direction

### Integration Points
- Store import/provenance work should center on `packages/cli/src/server/services/storeService.ts` and `/api/store/import`
- Minimal store UX changes should build on `packages/ui/src/components/store/*`
- Inventory/source-label behavior should align across `agents`, `skills`, and `commands` route handlers and Explorer-facing UI

</code_context>

<deferred>
## Deferred Ideas

- Richer provenance models beyond import path and import time
- Inline editing of AGENT_HOME local items
- Cross-ecosystem import/conversion behavior
- Profile activation preview and switching safety UX

</deferred>

---
*Phase: 01-store-and-inventory-foundation*
*Context gathered: 2026-03-29*
