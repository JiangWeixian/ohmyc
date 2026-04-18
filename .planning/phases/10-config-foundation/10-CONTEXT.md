# Phase 10: Config Foundation - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Centralize all `.claude` path resolution into a single ConfigLocator service, discover project-local `.claude/` at server startup, and add a `project` SourceBadge variant to the UI. Actual merge logic and dual-source loading belong in Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Project Discovery
- **D-01:** Server checks `${cwd()}/.claude` only — no walk-up, no env var override. If absent, silent fallback to global-only (no log message).
- **D-02:** Project path exposed to route handlers so services can read from both global and project directories in Phase 11.

### ConfigLocator Design
- **D-03:** Class-based service (matches existing AgentService, SkillService pattern). Encapsulates `globalDir` and `projectDir` state.
- **D-04:** ConfigLocator resolves all paths and passes subdirectory strings to routes — routes don't depend on ConfigLocator directly. This keeps route signatures unchanged.
- **D-05:** ConfigLocator is the single source of truth for all `.claude`/`.cu` path resolution. No path string literals outside this service. Success criterion: grepping for `.claude` or `.cu` outside ConfigLocator returns zero hits.

### SourceBadge Project Variant
- **D-06:** New `project` variant in SourceBadge component with green color (#22c55e), matching existing pattern of one color per source type.
- **D-07:** Label text is "project" (uppercase, like existing badges). No project folder name display.

### Merge Policy
- **D-08:** Merge policy defined as a decision here in CONTEXT.md: "Project items override global items when both provide the same component name. Both remain visible." Phase 11 planner reads this as a locked decision.
- **D-09:** No separate policy document needed — policy is simple enough for inline capture.

### Claude's Discretion
- Exact ConfigLocator method signatures and internal structure
- How project path is threaded to services (Fastify decorate, options object, etc.)
- Test file organization for ConfigLocator
- Error handling for unreadable project `.claude/` directories

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing code to understand before implementing
- `packages/cli/src/server/index.ts` -- Current path resolution (lines 91-93), route registration pattern
- `packages/ui/src/components/SourceBadge.tsx` -- Existing badge variants and styling pattern
- `packages/shared/src/index.ts` -- Shared schema exports (source types may need extending)

### Project context
- `.planning/REQUIREMENTS.md` -- FOUND-01, FOUND-02, FOUND-03 requirements
- `.planning/ROADMAP.md` -- Phase 10 success criteria and phase details
- `.planning/STATE.md` -- Blocker: merge semantics for structured configs needs definition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SourceBadge` component: Already renders 3 variants with consistent styling pattern. Adding `project` follows the same if-block pattern.
- Service class pattern: All services are class-based with constructor-injected paths. ConfigLocator can follow this.

### Established Patterns
- Route registration: `fastify.register(routes, { dir, pluginsDir, settingsPath, baseDir })` -- ConfigLocator feeds these same options, no signature change needed.
- Path resolution: Currently `os.homedir() + AGENT_HOME` -- ConfigLocator replaces this with a centralized call.

### Integration Points
- `server/index.ts:createServer()` is where ConfigLocator gets instantiated and paths are wired to routes.
- `SourceBadge` is used in `Explorer.tsx` and `ConfigSection.tsx` -- both will need to pass `project` source type.
- Shared schemas may need a `ProjectSource` type addition for API responses (preparation for Phase 11).

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- standard approaches work well here.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 10-config-foundation*
*Context gathered: 2026-04-18*
