# Architecture Research: Project-Aware Loading + .cu Rebrand

**Domain:** Brownfield service architecture extension for multi-scope config loading and write-path rebrand
**Researched:** 2026-04-16
**Confidence:** HIGH (direct codebase analysis, no speculative technology choices)
**Supersedes:** v1.0 architecture research from 2026-03-29

## Current Architecture (As-Is)

### System Overview

```text
                         CLI Entry (cac)
                              |
                         launcher.ts
                              |
                     createServer() / startServer()
                              |
                    +---------+---------+
                    |   Fastify Server   |
                    +---------+---------+
                              |
           +------------------+------------------+
           |                  |                  |
    REST Route Plugins   Static UI Assets   SPA Fallback
           |
    +------+------+--------+--------+--------+
    |      |      |        |        |        |
  config settings agents/skills/commands profiles  store
                                          plugins
                                          configs
           |
    Service Layer (instantiated per-route-plugin)
    +------+-------+--------+------+-------+------+
    |Agent |Skill  |Command |Plugin|Profile|Store |
    |Svc   |Svc    |Svc     |Svc   |Svc    |Svc   |
    +------+-------+--------+------+-------+------+
           |
    Single baseDir = ~/.claude/ (hardcoded via AGENT_HOME env)
```

### Key Architecture Constraint: Single baseDir

Every service receives paths derived from a single `baseDir` resolved once in `createServer()`:

```typescript
// packages/cli/src/server/index.ts:91-92
const agentHome = process.env.AGENT_HOME || '.claude';
const baseDir = path.join(os.homedir(), agentHome);
```

From this single `baseDir`, all paths are derived:

| Derived Path | Purpose | Consumer |
|---|---|---|
| `baseDir/agents/` | Inventory agents | AgentService via agents routes |
| `baseDir/skills/` | Inventory skills | SkillService via skills routes |
| `baseDir/commands/` | Inventory commands | CommandService via commands routes |
| `baseDir/plugins/` | Installed plugins | PluginService, PluginResolver |
| `baseDir/settings.json` | Merged settings | ProfileService, configsRoutes |
| `baseDir/.mcp.json` | MCP server config | configsRoutes |
| `baseDir/.lsp.json` | LSP server config | configsRoutes |
| `baseDir/profiles/` | Profile storage | ProfileService, StoreService |
| `baseDir/store/` | Canonical store | StoreService (sub-dirs: agents, skills, commands, model-configs) |

### Service Instantiation Pattern

Services are instantiated inside Fastify route plugin functions, not via dependency injection:

```typescript
// Route plugin receives options, creates services directly
export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir);
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath);
  // ... route handlers use service directly
};
```

Services accept pre-computed directory paths in their constructors. They are stateless per-request and have no shared state between route plugins.

### Source Tagging (Current)

The existing `source` field uses three values: `'local' | 'profile' | 'plugin'`.

- **local**: Regular file in the agents/skills/commands directory (not a symlink)
- **profile**: Symlink detected via `lstat`, target is inside active profile dir
- **plugin**: Aggregated from enabled plugin install paths via PluginResolver

The `resolveInventorySource()` function in `routes/inventorySource.ts` handles this classification by checking symlink status and comparing target paths to the active profile directory.

### Activation Write Path (Current)

`ProfileService.activate()` writes to `baseDir` (which is `~/.claude/`):

1. Creates symlinks in `baseDir/profiles/<name>/agents/` pointing to `baseDir/store/agents/`
2. Generates plugin files in `baseDir/profiles/<name>/.claude-plugin/`
3. Writes hooks, MCP, LSP config into profile dir
4. Merges settings into `baseDir/settings.json`
5. Writes `.active` marker to `baseDir/profiles/.active`

All writes go to `baseDir`. The activation target directory IS the profile subdirectory of baseDir.

---

## Target Architecture (v1.4)

### What Changes

Two independent but composable features:

1. **Project-local config loading**: Discover `<project>/.claude/` alongside global `~/.claude/`, merge into unified API responses with source badges
2. **Directory rebrand**: Activation writes go to `~/.cu/` instead of `~/.claude/` (read path still reads both)

### System Overview (Target)

```text
                         CLI Entry (cac)
                              |
                         launcher.ts  <-- NEW: discovers projectDir via cwd()
                              |
                     createServer({ projectDir })  <-- NEW: receives projectDir
                              |
                    +---------+---------+
                    |   Fastify Server   |
                    +---------+---------+
                              |
                    +---------+---------+
                    | ConfigLocator Svc  |  <-- NEW COMPONENT
                    | (global + project) |
                    +---------+---------+
                              |
           +------------------+------------------+
           |                  |                  |
    REST Route Plugins   Static UI Assets   SPA Fallback
           |
    Service Layer now receives BOTH:
      globalBaseDir = ~/.cu/ (write) / ~/.claude/ (read fallback)
      projectDir?  = <cwd>/.claude/  (read-only)
```

---

## New Component: ConfigLocator

### Responsibility

Centralizes path resolution for all directory scopes. Replaces the scattered `path.join(baseDir, ...)` calls in `createServer()` with a single service that knows about multiple scopes.

### Interface

```typescript
// NEW FILE: packages/cli/src/server/services/configLocator.ts

export type ConfigScope = 'global' | 'project';

export interface ResolvedPaths {
  // Global scope (always present)
  globalBaseDir: string;           // ~/.cu/ (write) or ~/.claude/ (read fallback)

  // Project scope (may be absent)
  projectBaseDir: string | null;   // <project>/.claude/ or null

  // Derived global paths
  globalAgentsDir: string;
  globalSkillsDir: string;
  globalCommandsDir: string;
  globalPluginsDir: string;
  globalSettingsPath: string;
  globalProfilesDir: string;
  globalStoreDir: string;

  // Derived project paths (null if projectBaseDir is null)
  projectAgentsDir: string | null;
  projectSkillsDir: string | null;
  projectCommandsDir: string | null;
  projectSettingsPath: string | null;
}

export class ConfigLocator {
  constructor(
    private globalBaseDir: string,   // Resolved write directory (~/.cu or ~/.claude)
    private projectDir: string | null, // Discovered project directory
  ) {}

  resolve(): ResolvedPaths { ... }
}
```

### Where it replaces existing code

Currently in `createServer()`:
```typescript
// BEFORE: scattered path computation (lines 91-102)
const agentHome = process.env.AGENT_HOME || '.claude';
const baseDir = path.join(os.homedir(), agentHome);
const pluginsDir = path.join(baseDir, 'plugins');
const settingsPath = path.join(baseDir, 'settings.json');
// ... then passed to each route plugin
```

After:
```typescript
// AFTER: centralized resolution
const locator = new ConfigLocator(globalBaseDir, projectDir);
const paths = locator.resolve();
// Pass paths (or individual derived paths) to route plugins
```

### Build Priority

This is the foundational change. Everything else depends on it. Build first.

---

## New Component: ProjectDiscovery

### Responsibility

Walks up from `cwd()` to find the nearest `.claude/` directory, establishing the "project scope" for this server session. Called once at startup.

### Interface

```typescript
// NEW FILE: packages/cli/src/server/services/projectDiscovery.ts

export interface ProjectInfo {
  projectRoot: string;          // Absolute path to project root
  claudeDir: string;            // Absolute path to <project>/.claude/
}

/**
 * Walk up from startDir looking for a .claude/ directory.
 * Returns null if no project .claude/ directory is found.
 * Stops at the user's home directory (global .claude/ is not a project).
 */
export function discoverProjectDir(startDir: string, homeDir: string): ProjectInfo | null { ... }
```

### Design Decision: Walk-up vs. Explicit Flag

Recommendation: walk-up from `cwd()` as default behavior. This matches how `.git/` discovery works and requires zero configuration. An optional `--project` CLI flag or `PROJECT_DIR` env var can override if needed later.

### Build Priority

Build alongside ConfigLocator. Both are Phase 1 foundation work.

---

## Modified Component: Source Tagging

### Current Source Values

```typescript
type InventorySource = 'local' | 'profile' | 'plugin';
```

### Target Source Values

```typescript
type InventorySource = 'local' | 'profile' | 'plugin' | 'project';
```

The new `'project'` value indicates the component originates from the project-local `.claude/` directory. Project items are read-only in the UI -- they cannot be edited through the store CRUD interface.

### Where source tagging changes

| File | Current Behavior | Change Needed |
|------|-----------------|---------------|
| `routes/agents.ts` | Tags each agent with `resolveInventorySource()` | Add project scan after plugin scan, tag as `'project'` |
| `routes/skills.ts` | Same pattern as agents | Same change |
| `routes/commands.ts` | Same pattern as agents | Same change |
| `routes/configs.ts` | Tags MCP/hooks/LSP as `'local'` or `'plugin'` | Add project scan for project-local `.mcp.json`, hooks, `.lsp.json` |
| `shared/src/agentSchema.ts` | `source: z.enum(['local', 'profile', 'plugin'])` | Add `'project'` to enum |
| `shared/src/skillSchema.ts` | Same | Same |
| `shared/src/commandSchema.ts` | Same | Same |
| `ui/components/SourceBadge.tsx` | Renders local/profile/plugin variants | Add project variant (green/teal) |

### Data Flow: Merged Inventory

```text
GET /api/agents
    |
    v
1. Scan globalBaseDir/agents/     --> tag 'local' or 'profile' (existing)
2. Scan enabled plugins            --> tag 'plugin' (existing)
3. Scan projectDir/agents/ (NEW)  --> tag 'project' (NEW)
    |
    v
Merge: concatenate all, sort by id
(project items coexist with global items; SourceBadge distinguishes them)
    |
    v
Return { agents: [...all, sorted by id] }
```

### Important: project items are NOT in store routes

Project-local components appear only in the Agent Home explorer tabs (agents/skills/commands routes). Store CRUD routes (`/api/store/agents/*`) remain global-only. This follows the existing principle that the store is for user-owned global components.

### Build Priority

Second, after ConfigLocator. Depends on ConfigLocator providing project paths.

---

## Modified Component: ProfileService (Write Path Rebrand)

### Change: baseDir value changes from `~/.claude/` to `~/.cu/`

The `baseDir` passed to ProfileService changes from `~/.claude/` to `~/.cu/`. This is externally a one-line change in `createServer()` but has cascading implications:

1. **Migration strategy**: If `~/.cu/` does not exist but `~/.claude/` has store/profiles data, create `~/.cu/` fresh. Users import components from `~/.claude/` via the existing import flow. No auto-migration in this milestone.

2. **Store references**: `preflight()` checks store components exist in `~/.cu/store/`. If store is empty (fresh install), activation fails with "missing store components." Correct behavior -- users import first.

3. **Settings path**: `readSettings()` reads from `~/.cu/settings.json`. Backup paths (`settings.backup.<name>.json`) also live in `~/.cu/`.

4. **Lock path**: `LockService` creates `.activation.lock` inside `~/.cu/profiles/`.

### ProfileService constructor: no internal change

```typescript
// BEFORE: constructor(private baseDir: string) { ... }
// AFTER:  constructor(private baseDir: string) { ... }
// Same signature. Only the VALUE passed in changes.
```

### Build Priority

Third, parallel with source tagging. ProfileService internals do not change; only its input value changes.

---

## Modified Component: StoreService

### Change

Same as ProfileService -- the `storeDir` and `profilesDir` passed to StoreService now point to `~/.cu/store/` and `~/.cu/profiles/`. No internal logic change.

The import flow (`storeService.import()`) can still import from any directory (including `~/.claude/`), so users can migrate their components explicitly.

### Build Priority

Parallel with ProfileService change.

---

## Route Changes Summary

### Settings Route: No Change Needed

The settings route (`routes/settings.ts`) already supports a `?project=<path>` query parameter that reads/writes `<project>/.claude/settings.json`. This is project-scoped by design and works correctly as-is.

### Inventory Routes: Add Project Scope

Extend agents/skills/commands routes with optional project path in their options:

```typescript
// BEFORE
interface AgentsRoutesOptions {
  agentsDir: string;
  pluginsDir: string;
  settingsPath: string;
  baseDir?: string;
}

// AFTER
interface AgentsRoutesOptions {
  agentsDir: string;
  pluginsDir: string;
  settingsPath: string;
  baseDir?: string;
  projectAgentsDir?: string | null;  // NEW
}
```

Route handler adds one scan block after plugin aggregation:

```typescript
// NEW block at the end of the list handler
if (options.projectAgentsDir) {
  const projectService = new AgentService(options.projectAgentsDir);
  const projectAgents = await projectService.list();
  for (const agent of projectAgents) {
    agents.push({ ...agent, source: 'project' });
  }
}
```

### Config Routes: Add Project Scope

Extend `configsRoutes` to read project-local `.mcp.json`, hooks (from project `.claude/settings.json`), and `.lsp.json`:

```typescript
// NEW block for project MCP
if (projectBaseDir) {
  const projectMcpData = await readJson(path.join(projectBaseDir, '.mcp.json'));
  const projectServers = projectMcpData?.mcpServers ?? {};
  for (const [name, config] of Object.entries(projectServers)) {
    entries.push({ name, config, source: 'project' });
  }
}
```

### Store/Profile Routes: No Change

Store routes and profile routes receive the same options shape. The `baseDir` value changes externally to `~/.cu/`, but the route handler code is unchanged.

---

## Data Flow Diagrams

### Startup Sequence (Target)

```text
cu (CLI)
  |
  v
launcher.ts
  |--> discoverProjectDir(cwd(), homedir())  // NEW: walk up from cwd
  |
  v
createServer({ projectDir })
  |--> resolveWriteDir()           // NEW: ~/.cu/ (primary) or ~/.claude/ (fallback)
  |--> ConfigLocator.resolve()     // NEW: centralized path resolution
  |
  v
Route plugins receive resolved paths
  |--> Inventory routes: receive both global + project paths
  |--> Store/Profile routes: receive global paths only
  |--> Settings route: unchanged
```

### Inventory Request Flow (Target)

```text
GET /api/agents
  |
  v
agentsRoutes handler
  |--> AgentService(globalAgentsDir).list()     // global scope
  |    --> tag 'local' or 'profile' via resolveInventorySource()
  |
  |--> PluginResolver.getEnabledPluginPaths()    // plugin scope
  |    --> tag 'plugin'
  |
  |--> if projectAgentsDir:                      // NEW: project scope
  |      AgentService(projectAgentsDir).list()
  |      --> tag 'project'
  |
  v
Merge: concatenate, sort by id
  |
  v
Response: { agents: [...all] }  with source badges
```

### Activation Flow (Target)

```text
POST /api/profiles/<name>/activate
  |
  v
ProfileService.activate(name)   // baseDir now = ~/.cu/
  |--> Lock acquire (~/.cu/profiles/.activation.lock)
  |--> Preflight: check store components in ~/.cu/store/
  |--> Deactivate current if any (restore from ~/.cu/settings.backup.*)
  |--> Backup current ~/.cu/settings.json
  |--> Write .active marker to ~/.cu/profiles/.active
  |--> Create symlinks in ~/.cu/profiles/<name>/agents/ -> ~/.cu/store/agents/
  |--> Generate plugin files in ~/.cu/profiles/<name>/.claude-plugin/
  |--> Merge settings, write to ~/.cu/settings.json
  |
  v
Response: { success: true, warnings: [...] }
```

---

## File Change Matrix

### New Files

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `packages/cli/src/server/services/configLocator.ts` | Centralize multi-scope path resolution | ~60 |
| `packages/cli/src/server/services/projectDiscovery.ts` | Walk up from cwd to find project `.claude/` dir | ~40 |

### Modified Files

| File | Change | Scope | Risk |
|------|--------|-------|------|
| `server/index.ts` | Accept `projectDir`, use ConfigLocator, resolve write dir to `~/.cu/` | High | Medium -- central wiring point |
| `routes/agents.ts` | Add project scope scan, extend options type | Medium | Low -- additive |
| `routes/skills.ts` | Add project scope scan, extend options type | Medium | Low -- additive |
| `routes/commands.ts` | Add project scope scan, extend options type | Medium | Low -- additive |
| `routes/configs.ts` | Add project scope scan for MCP/hooks/LSP | Medium | Low -- additive |
| `shared/src/agentSchema.ts` | Add `'project'` to source enum | Small | Low -- additive |
| `shared/src/skillSchema.ts` | Add `'project'` to source enum | Small | Low -- additive |
| `shared/src/commandSchema.ts` | Add `'project'` to source enum | Small | Low -- additive |
| `ui/components/SourceBadge.tsx` | Add 'project' badge variant | Small | Low -- additive |
| `ui/components/ViewSwitcher.tsx` | Optionally show project indicator | Small | Low |
| `launcher.ts` | Discover project dir, pass to createServer | Small | Low |

### Unchanged Files (Verified -- No Changes Needed)

| File | Why Unchanged |
|------|---------------|
| `services/profileService.ts` | Constructor signature unchanged; baseDir value changes externally |
| `services/storeService.ts` | Same -- baseDir value changes externally |
| `services/agentService.ts` | Stateless scanner; pointed at different dirs by callers |
| `services/skillService.ts` | Same |
| `services/commandService.ts` | Same |
| `services/pluginService.ts` | Same |
| `services/modelConfigService.ts` | Same |
| `services/pluginResolver.ts` | Same |
| `services/lockService.ts` | Same |
| `routes/profiles.ts` | Same -- ProfileService receives new baseDir externally |
| `routes/store.ts` | Same -- StoreService receives new baseDir externally |
| `routes/settings.ts` | Already project-aware via `?project=` param |
| `routes/plugins.ts` | Same |
| `routes/inventorySource.ts` | Same -- handles global scope classification |

---

## Suggested Build Order

### Phase 1: ConfigLocator + Write Dir Resolution (Foundation)

**Goal:** Introduce ConfigLocator, change global write dir to `~/.cu/`, keep all existing tests passing.

1. Create `configLocator.ts` with path resolution logic
2. Create `projectDiscovery.ts` with cwd-walkup logic
3. Modify `server/index.ts` to use ConfigLocator
4. Modify `launcher.ts` to discover projectDir and pass it through
5. **Test:** Existing 275 tests should still pass (test setup creates tmp dirs, not affected by write dir change)

**Key risk:** AGENT_HOME env var handling. Current: `process.env.AGENT_HOME || '.claude'`. New: still respect AGENT_HOME for reads, but write to `~/.cu/` by default. Decision: AGENT_HOME overrides both read and write for backwards compatibility in development/testing.

### Phase 2: Project Scope in Inventory Routes (Read Merge)

**Goal:** Extend agents/skills/commands routes to include project-local items with `'project'` source tag.

1. Add `'project'` to source enums in shared schemas (`agentSchema.ts`, `skillSchema.ts`, `commandSchema.ts`)
2. Extend route options types to accept project paths
3. Add project scan logic to agents/skills/commands route handlers
4. **Test:** Verify merged views show both global and project items with correct tags

**Key risk:** Name collisions. If project has `agent-x.md` and global has `agent-x.md`, both appear. This follows the existing PROJECT.md decision: "Allow name collisions between local and plugin entries. Frontend SourceBadge distinguishes them visually."

### Phase 3: Project Scope in Config Routes + UI Source Badge

**Goal:** Extend config routes for project-local MCP/hooks/LSP. Update SourceBadge.

1. Add project scan to `configsRoutes` for MCP, hooks, LSP entries
2. Update `SourceBadge.tsx` to render 'project' variant (green/teal color)
3. **Test:** Verify config explorer shows project-scope entries with correct badges

**Key risk:** Project hooks live in `<project>/.claude/settings.json`, not a separate `hooks/hooks.json`. Must read project settings for hooks.

### Phase 4: UI Integration

**Goal:** Frontend displays merged views correctly.

1. Update API query hooks to request merged scope
2. Optionally show project directory path in UI header or ViewSwitcher
3. **Test:** Visual verification of merged inventory with all four source types

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Passing Both Dirs to Every Service

**What people might do:** Modify every service constructor to accept `globalDir` and `projectDir`.
**Why wrong:** Services like AgentService are pure filesystem scanners. They should not know about scopes. Scope-awareness belongs in the route handler layer that orchestrates multiple service calls.
**Do instead:** Keep services single-dir. Route handlers call services twice (once for global, once for project) and merge results.

### Anti-Pattern 2: Auto-Migration from .claude to .cu

**What people might do:** On first run, copy everything from `~/.claude/` to `~/.cu/` automatically.
**Why wrong:** `~/.claude/` may contain Claude Code's own data (plugins, settings) that should not be duplicated or interfered with. Auto-migration risks corrupting the Claude Code installation state.
**Do instead:** Start with empty `~/.cu/`. Users import components from `~/.claude/` explicitly via the existing import flow. Document the one-time setup step.

### Anti-Pattern 3: Tight Coupling Between Write Dir and Read Scope

**What people might do:** Assume write dir IS the read dir, so all reads come from `~/.cu/`.
**Why wrong:** The whole point of project-local loading is to read from BOTH `~/.cu/` AND `<project>/.claude/`. The write dir is a separate concern from read scope.
**Do instead:** ConfigLocator explicitly separates write path (`~/.cu/`) from read paths (`~/.cu/` + project). Store/Profile services write to global. Inventory routes read from all scopes.

### Anti-Pattern 4: Project Items in Store CRUD

**What people might do:** Allow store routes to show and edit project-local components.
**Why wrong:** Project-local config is managed by the project, not by the user's global store. Allowing edits through the store UI would create confusion about where changes persist.
**Do instead:** Project items are read-only. They appear in the Agent Home explorer view only, never in store CRUD routes.

---

## Scalability Considerations

| Concern | Current | After v1.4 |
|---------|---------|------------|
| Number of dirs scanned per inventory request | 1 (global) + N plugins | 1 (global) + N plugins + 1 (project) |
| Impact on response time | Negligible | Negligible (one extra `readdir` per component type) |
| Memory for merged results | Small | Still small (project dirs typically have few items) |

The performance impact of adding project scope is minimal. One additional `readdir` call per component type. Project directories typically contain only a handful of items.

---

## Key Decisions for Implementation

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Where does ConfigLocator live? | `services/configLocator.ts` | Follows existing pattern of stateless helper classes |
| Where does project discovery happen? | Once at server startup in `launcher.ts` | Project dir does not change during server lifetime |
| Should project items appear in store CRUD routes? | No | Project items are read-only; store is for user-owned global components |
| Source badge color for 'project'? | Green (teal) | Blue=profile, purple=plugin, gray=local, green=project is visually distinct |
| Does AGENT_HOME override the write dir? | Yes | For backwards compat in testing and development |
| Merge strategy for duplicate names? | Both appear, distinguished by source badge | Follows existing pattern for local vs plugin name collisions |
| API design for merged scope? | Extend existing routes, default backward-compatible | Avoid new route files; default behavior unchanged |

---

## Integration Points Summary

### Internal Boundaries

| Boundary | Communication | Change Type |
|----------|---------------|-------------|
| launcher -> createServer | Options object | Modify: add projectDir |
| createServer -> ConfigLocator | Direct call | New dependency |
| createServer -> route plugins | Options objects | Modify: add project paths |
| route plugins -> services | Constructor args | No change (services are single-dir) |
| shared schemas -> UI | TypeScript types | Modify: add 'project' to source enums |
| API responses -> UI | JSON with source field | Modify: new source value |

### External Boundaries

| Boundary | Current | Change |
|----------|---------|--------|
| Filesystem read | `~/.claude/` only | Add `<project>/.claude/` reads |
| Filesystem write | `~/.claude/` | Change to `~/.cu/` |
| AGENT_HOME env var | Overrides `.claude` | Continue to override both read and write |
| CLI cwd | Ignored | Used for project discovery via walk-up |

---

## Sources

- Direct codebase analysis of all service files, route handlers, schemas, and UI components
- `.planning/PROJECT.md` v1.4 milestone definition (active requirements)
- Existing architecture decisions in PROJECT.md Key Decisions table
- Prior v1.0 architecture research in `.planning/research/ARCHITECTURE.md` (2026-03-29)
- `docs/superpowers/specs/2026-03-25-profiler-design.md` for original AGENT_HOME design intent

---
*Architecture research for: v1.4 Project-Aware Loading + .cu Rebrand*
*Researched: 2026-04-16*
