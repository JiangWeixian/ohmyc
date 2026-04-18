# Phase 11: Project-Local Loading - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see both global and project-scoped components merged in every inventory view, with source badges distinguishing origin and project items taking precedence on conflicts. Success criteria: (1) Agents, skills, commands, and configs API routes return merged results from both directories, (2) project-scoped items override global items on name collisions, (3) every merged item carries a `scope` field, (4) Explorer views display both with distinct source badges.

</domain>

<decisions>
## Implementation Decisions

### Source field model
- **D-01:** Add a `scope: 'global' | 'project'` field alongside the existing `source` field. `source` keeps current values (`local`/`profile`/`plugin`/`project`) for UI attribution. `scope` drives merge logic: `local`/`profile`/`plugin` → `global`, `project` → `project`.
- **D-02:** SourceBadge continues rendering based on `source` (showing "local", "profile", "plugin", "project" badges). Merge and sorting logic uses `scope`.

### Same-name display
- **D-03:** When project and global items share the same name, both appear side-by-side in the list — no dimming, no override label. The SourceBadge on each card tells the story.
- **D-04:** Project items sort first when names collide (project override is the active version, shown at top).
- **D-05:** No "overridden" badge or gray styling on the global version — SourceBadge `project` (green) vs `local`/`profile` is sufficient distinction.

### Project read-only UI
- **D-06:** Project items are view-only. Edit and delete buttons are hidden (not grayed out/disabled) in the detail view.
- **D-07:** A notice line appears in the detail view for project items: "From project directory — view only."
- **D-08:** Project items never appear in store CRUD routes — they only show in explorer/GET routes (consistent with research finding).

### Config merging
- **D-09:** MCP servers, hooks, and LSP entries merge per-key by name. When project and global both define an entry with the same key, both versions appear in the response with their respective `scope` badges, and the project entry is the active one.
- **D-10:** Non-overlapping keys pass through unchanged. This mirrors the agent/skill/command merge behavior — consistent override semantics across all types.

### Carried-forward decisions (Phase 10)
- **D-01 (P10):** Server checks `${cwd()}/.claude` only — no walk-up, no env var override. Silent fallback to global-only.
- **D-03 (P10):** Class-based service pattern for ConfigLocator (matches AgentService, SkillService).
- **D-04 (P10):** ConfigLocator resolves paths and passes subdirectory strings to routes — route signatures unchanged.
- **D-06 (P10):** SourceBadge `project` variant with green (#22c55e), label "project", no pluginId sub-label.
- **D-08 (P10):** Merge policy: "Project items override global items when both provide the same component name. Both remain visible."

### Agent's Discretion
- Exact merge implementation in each service/route (concatenate + sort, or read-then-merge at route level)
- How scope field is computed in route handlers (inline vs helper function)
- Test structure for merged inventory scenarios
- Error handling for unreadable project `.claude/` subdirectories

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 implementation (foundation for Phase 11)
- `packages/cli/src/server/services/configLocator.ts` — ConfigLocator class with globalDir/projectDir getters including projectAgentsDir, projectSkillsDir, projectCommandsDir
- `packages/cli/src/server/index.ts` — Server setup, route registration with ConfigLocator wiring, current path-passing pattern
- `packages/ui/src/components/SourceBadge.tsx` — Existing badge variants (local, profile, plugin, project) and rendering pattern
- `packages/shared/src/agentSchema.ts` — Agent schema with `source` field (z.enum includes 'project')
- `packages/shared/src/skillSchema.ts` — Skill schema with `source` field
- `packages/shared/src/commandSchema.ts` — Command schema with `source` field

### Routes to extend for dual-source loading
- `packages/cli/src/server/routes/agents.ts` — Current list/get route pattern with resolveInventorySource and plugin aggregation
- `packages/cli/src/server/routes/configs.ts` — Current local + plugin merge pattern for MCP/Hooks/LSP
- `packages/cli/src/server/routes/inventorySource.ts` — Current source resolution logic (symlink vs regular file)

### UI components to update
- `packages/ui/src/Explorer.tsx` — Main explorer view rendering agent/skill/command lists and config sections
- `packages/ui/src/hooks/useAgents.ts` — Query hooks for fetching agents (pattern for other hooks)
- `packages/ui/src/components/EntityCard.tsx` — Card component rendering EntityDetail links
- `packages/ui/src/components/EntityDetail.tsx` — Detail view where read-only notice goes

### Project context
- `.planning/REQUIREMENTS.md` — LOAD-01, LOAD-02, LOAD-03 requirements
- `.planning/ROADMAP.md` — Phase 11 success criteria and phase details
- `.planning/phases/10-config-foundation/10-CONTEXT.md` — Phase 10 decisions that Phase 11 builds on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfigLocator`: Already has `projectAgentsDir`, `projectSkillsDir`, `projectCommandsDir` getters returning `null` when no project. Ready for Phase 11 to pass these to routes.
- `SourceBadge`: Already renders `project` variant with green (#22c55e). No changes needed to the badge itself.
- Shared schemas (`agentSchema`, `skillSchema`, `commandSchema`): Already include `'project'` in their `source` z.enum. No schema change needed for source field.
- `inventorySource.ts`: Existing `resolveInventorySource()` determines local vs profile vs plugin — can be extended or supplemented with scope logic.
- Config routes (`configs.ts`): Already merge local + plugin entries per-key for MCP/Hooks/LSP. The project merge pattern can follow this established aggregation approach.

### Established Patterns
- Route registration: Routes receive directory paths via options object. ConfigLocator already passes `agentsDir`, `skillsDir`, etc. — Phase 11 adds `projectAgentsDir`, etc.
- Source tagging: Routes set `source` field after listing items. The existing pattern in `agents.ts` (resolve inventory source + plugin aggregation) is the model for scope-aware merging.
- Plugin aggregation: Routes already iterate `resolver.getEnabledPluginPaths()` and push plugin items with `source: 'plugin'`. Project items follow the same push-with-source pattern.

### Integration Points
- `server/index.ts:createServer()` — Where ConfigLocator is instantiated and paths are wired to routes. This is where project directory paths get added to route options.
- Explorer tabs (agents, skills, commands, MCP, hooks, LSP) — All need to pass `scope` from API responses so SourceBadge continues working, and read-only notice can check `scope === 'project'`.
- `EntityDetail.tsx` — Where the "view only" notice and edit/delete button hiding goes.
- Config route responses — MCP/Hooks/LSP list endpoints need project directory reading added.

</code_context>

<specifics>
## Specific Ideas

- Side-by-side listing with project items sorted first on name collision is consistent with how the existing merge works (sorted by id) — just ensure project version appears before global when names match.
- "From project directory — view only." notice in EntityDetail view for project-scoped items.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-project-local-loading*
*Context gathered: 2026-04-18*