# Project Research Summary

**Project:** ClaudeUI v1.4 -- Project-Aware Loading + .cu Rebrand
**Domain:** Brownfield CLI tool for managing Claude Code configurations (agents, skills, commands, profiles, settings)
**Researched:** 2026-04-16
**Confidence:** HIGH

## Executive Summary

ClaudeUI is a local-first CLI tool (Node.js/TypeScript/Fastify/React) that manages Claude Code configurations through profile-based activation, a component store, and a web-based explorer UI. The v1.4 milestone adds two independent but complementary features: project-local config discovery (so the tool reads both global `~/.cu/` and project-scoped `<project>/.claude/` configurations) and a directory rebrand (activation writes move from `~/.claude/` to `~/.cu/` to separate ClaudeUI-managed data from Claude Code's own files).

The recommended approach is a three-phase build: first establish a unified config location resolver (ConfigLocator + ProjectDiscovery services) and clean up scattered hardcoded paths; then wire project-local loading into inventory routes with source badges; finally execute the `.cu` rebrand with a safe migration strategy. The architecture research identified a critical existing problem -- `settingsRoutes` uses `process.cwd()` with hardcoded `.claude/` strings while all other routes use `baseDir` via `AGENT_HOME` -- that must be unified before any feature work begins. Only one new dependency is needed (`find-up@8` for directory walk-up).

The key risks center on the `.cu` rebrand: symlink integrity after migration, backup file discovery across directory changes, and race conditions during migration. The pitfalls research mapped six critical issues to specific phases, with the most important being "never rename project-local `.claude/` directories" (Claude Code owns those) and "always validate symlinks after migration." The merge model for global + project configs should follow Claude Code's own pattern: project overrides global, both are visible, source badges distinguish them.

## Key Findings

### Recommended Stack

The stack is almost entirely unchanged from v1.3. The codebase uses Node.js 20 LTS+, TypeScript 5.x, Fastify 4.x, React 18 + Vite 5, Zod 3.x, and a set of supporting libraries (TanStack Query, gray-matter, proper-lockfile, cac, open, get-port, vitest). The only new dependency for v1.4 is `find-up@8` for walking up from `cwd()` to discover the nearest `.claude/` project directory. It is ESM-only but tsup already handles this pattern for `get-port` and `open` by adding it to the `noExternal` list.

**Core technologies:**
- Node.js 20 LTS+: runtime -- local-first CLI with filesystem/symlink orchestration
- TypeScript 5.x: shared types -- profile composition and config overlays need strict typing
- Fastify 4.x: API layer -- I/O-heavy routes, already in use
- React 18 + Vite 5: web UI -- stateful desktop-like management interface
- Zod 3.x: validation -- trust boundary before disk writes
- find-up 8.0.0: directory discovery -- walks up from CWD to find `.claude/` project directory

**No new libraries needed for:** deep merge (existing `ProfileService.deepMerge`), source attribution (extend existing `InventorySource` type), directory rebrand (pure code change to `AGENT_HOME` default), migration (`fs.rename` at startup).

### Expected Features

**Must have (table stakes):**
- Project-local `.claude/` discovery alongside global -- Claude Code reads both, a manager must too
- Dual-source component loading (agents, skills, commands) -- merged API responses with `source` field
- SourceBadge `project` variant -- visual distinction for project-scope items
- `.cu` write path -- activation writes go to `~/.cu/` not `~/.claude/`
- Backward-compatible `.claude` reads -- existing users must not lose data

**Should have (competitive):**
- Per-key settings provenance display -- shows which layer contributed each settings key (no other tool does this)
- Visual merge conflict indicators -- both items shown with source badges, project wins
- Migration helper -- guided one-time move from `.claude` to `.cu` for ClaudeUI data only

**Defer (v1.4.x / v2+):**
- Merged settings view with per-key provenance -- HIGH complexity, add after basic project loading works
- Project-aware profile composition -- profiles referencing project-scoped components
- Multi-project support -- manage multiple projects simultaneously
- `.cu` as primary read path -- future state after migration

### Architecture Approach

The target architecture introduces two new services (ConfigLocator, ProjectDiscovery) and extends existing inventory routes with project-scope scanning. The key principle is that services remain single-directory scanners -- scope awareness lives in the route handler layer, which calls services twice (once for global, once for project) and merges results. This avoids modifying any existing service internals.

**Major components:**
1. ConfigLocator -- centralizes multi-scope path resolution; replaces scattered `path.join(baseDir, ...)` calls in `createServer()`
2. ProjectDiscovery -- walks up from `cwd()` to find nearest `.claude/` directory; called once at startup
3. Extended inventory routes (agents, skills, commands, configs) -- add project scan block after existing plugin scan, tag items as `'project'`
4. ProfileService/StoreService -- no internal changes; only the `baseDir` value passed in changes from `~/.claude/` to `~/.cu/`
5. SourceBadge UI -- add `'project'` variant with green/teal styling

**Key architecture decisions:**
- Project items are read-only; they appear in explorer views only, never in store CRUD routes
- Write path (`~/.cu/`) is separate from read scopes (`~/.cu/` + `<project>/.claude/`)
- Merge strategy: concatenate all scopes, sort by id, let SourceBadge distinguish them (same pattern as existing local vs plugin handling)
- `AGENT_HOME` continues to override both read and write for development/testing compatibility

### Critical Pitfalls

1. **Two config location systems already exist** -- `settingsRoutes` hardcodes `process.cwd()/.claude/` while everything else uses `baseDir` via `AGENT_HOME`. Must unify into ConfigLocator before adding project support. (Phase 1)

2. **Hardcoded `.claude` string scattered across codebase** -- at least two production contexts use literal `.claude` with no shared constant. Extract `CU_HOME_DIR = '.cu'` and `CLAUDE_PROJECT_DIR = '.claude'` constants. (Phase 1)

3. **Profile activation writes to wrong directory after rebrand** -- symlinks store absolute paths to `~/.claude/store/`; backups use `path.join(baseDir, backupName)` which breaks when baseDir changes. Must migrate atomically with symlink re-targeting. (Phase 3)

4. **Race condition during migration** -- no cross-directory lock exists. Use a home-directory-level lock file (`~/.cu-migration.lock`) and prefer atomic `fs.rename` for same-filesystem migration. (Phase 3)

5. **Merge conflicts without defined precedence** -- no shared merge policy exists. Define ONE policy (project overrides global, both visible) and implement in a shared resolver, not per-route. (Phase 1)

## Implications for Roadmap

Based on combined research, the recommended phase structure is:

### Phase 1: Foundation -- ConfigLocator, Constants, and Source Schema
**Rationale:** Pitfalls research identified that scattered abstractions (two config location systems, hardcoded `.claude` strings, no merge policy) must be unified before any feature work. Building on clean foundations prevents rework.
**Delivers:** ConfigLocator service, ProjectDiscovery service, shared directory constants, extended source enum with `'project'`, merge semantics definition, SourceBadge UI extension.
**Addresses:** Project directory detection, SourceBadge extension, backward-compatible reads.
**Avoids:** Pitfalls 1 (two config systems), 2 (source badge explosion), 3 (hardcoded strings), 5 (merge conflicts).
**Features:** P1 items: project directory detection, SourceBadge project variant, backward-compatible reads.

### Phase 2: Project-Local Loading -- Inventory Routes and UI
**Rationale:** With the foundation in place, extending inventory routes to scan project directories is a straightforward additive change. Route handlers call existing services with project paths and merge results. UI renders the new source badge.
**Delivers:** Dual-source component loading for agents, skills, commands, and configs. Merged API responses with source attribution. UI showing global and project items together with distinct badges.
**Addresses:** Dual-source component loading, merged component views.
**Avoids:** Pitfall anti-patterns (passing both dirs to every service, project items in store CRUD).
**Uses:** ConfigLocator (from Phase 1), existing AgentService/SkillService/CommandService (unchanged).
**Features:** P1 items: dual-source component loading, visual merge indicators.

### Phase 3: .cu Rebrand -- Write Path and Migration
**Rationale:** The rebrand is the riskiest change (migration, symlink integrity, race conditions) and should come last so it lands on a stable codebase with unified path resolution. Changing `baseDir` before the resolver is unified would mean migrating code that is about to be refactored.
**Delivers:** Activation writes to `~/.cu/`, atomic migration from `~/.claude/`, startup migration check, symlink validation, provenance index path updates.
**Addresses:** `.cu` write path, migration helper.
**Avoids:** Pitfalls 4 (wrong directory), 6 (race condition).
**Features:** P1 item: `.cu` write path. P2 item: migration helper.

### Phase Ordering Rationale

- Phase 1 must come first because it fixes the architectural debt that would otherwise make Phase 2 and Phase 3 unreliable (scattered path resolution, no merge policy, no shared constants).
- Phase 2 comes before Phase 3 because project-local loading is the primary user-facing feature and has no dependency on the write directory. It is purely additive (new scan block in existing routes) and lower risk.
- Phase 3 comes last because it is destructive (changes the write target) and depends on Phases 1-2 being correct. Migration on a codebase with unified path resolution is safer than migration on scattered code.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Merge semantics for duplicate component names need design validation. The "both appear, project wins" model should be verified against actual user workflows. Consider `/gsd-research-phase` for the merge resolver design.
- **Phase 3:** Migration strategy needs careful design. The atomicity guarantees, rollback procedures, and multi-process safety need specification. Consider `/gsd-research-phase` for migration edge cases.

Phases with standard patterns (skip research-phase):
- **Phase 1 (ConfigLocator/ProjectDiscovery):** Well-documented patterns (find-up walk-up, centralized path resolution). Direct codebase analysis provides sufficient guidance.
- **Phase 2 (inventory route extension):** Purely additive route changes following the existing plugin-scan pattern. Well-understood codebase territory.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (find-up@8). All other technologies proven in v1.3. ESM bundling pattern already established. |
| Features | HIGH | Feature set derived from official Claude Code settings docs, codebase analysis, and established analogs (VS Code, Git config hierarchy). MVP scope is well-defined. |
| Architecture | HIGH | Direct codebase analysis of all affected files. New components (ConfigLocator, ProjectDiscovery) have clear interfaces. Existing services confirmed unchanged. |
| Pitfalls | HIGH | Six critical pitfalls identified from direct code analysis. Each mapped to specific prevention phase. Recovery strategies defined. |

**Overall confidence:** HIGH

### Gaps to Address

- **Merge semantics for settings:** The per-key provenance display (which layer contributed each settings key) is deferred to v1.4.x but the merge model for structured configs (settings.json, hooks) needs definition in Phase 1. Research the exact deep-merge behavior Claude Code uses for settings cascades.
- **Plugin path migration:** `installed_plugins.json` stores absolute paths to `~/.claude/plugins/`. Whether these should migrate to `~/.cu/plugins/` or remain in `.claude/` needs a product decision. Claude Code manages plugin installs -- we may not own those paths.
- **Multi-process safety during startup:** The migration check at startup must handle the case where two `cu` processes start simultaneously. The lock mechanism needs specification beyond "use a lock file."
- **`settingsRoutes` unification strategy:** The current `?project=` query parameter approach in settings routes may conflict with the new ConfigLocator-based project discovery. Decide whether to keep both mechanisms or converge.

## Sources

### Primary (HIGH confidence)
- Context7 /sindresorhus/find-up -- API verified: `findUp()`, `findUpSync()`, `type: 'directory'` option, ESM-only module type
- Claude Code Settings Docs (https://code.claude.com/docs/en/settings) -- Settings hierarchy, file locations, merge semantics
- Direct codebase analysis -- `packages/cli/src/server/` (all services, routes), `packages/ui/src/components/SourceBadge.tsx`, `packages/shared/src/` (schemas)
- `.planning/PROJECT.md` -- v1.4 milestone definition and key decisions

### Secondary (MEDIUM confidence)
- VS Code User and Workspace Settings -- config cascade pattern reference
- Git config hierarchy (system/global/local/worktree) -- multi-scope config pattern reference
- GitHub Issue #11626 (anthropics/claude-code) -- feature request for auto-merge of global and project settings
- ESLint flat config merge patterns -- merge strategy reference

### Tertiary (LOW confidence)
- npm registry version checks -- package version availability (fastify@5, zod@4 noted but not adopted)

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes*
