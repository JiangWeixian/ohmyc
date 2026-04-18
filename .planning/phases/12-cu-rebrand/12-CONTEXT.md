# Phase 12: .cu Rebrand - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

All managed data writes go to `~/.cui/` instead of `~/.claude/`, while project-local `.claude/` directories remain unchanged (Claude Code owns those). Reads come from `~/.cui/` only — no fallback to `~/.claude/`. No migration of existing data. Fresh start.

</domain>

<decisions>
## Implementation Decisions

### Scope — What Changes
- **D-01:** ConfigLocator gains a separate `writeDir` (default `~/.cui/`) distinct from the project discovery path (`.claude`). `AGENT_DIR_NAME` stays `.claude` for project discovery. A new constant `WRITE_DIR_NAME = '.cui'` defines the write target.
- **D-02:** Paths that rebrand to `~/.cui/`: `store/`, `profiles/`, `settings.json`, `.active`, `settings.backup.*.json`. All write paths derive from `writeDir`.
- **D-03:** Paths that stay at `~/.claude/`: `plugins/` (managed by Claude Code), `agents/`, `skills/`, `commands/` (global inventory read paths).
- **D-04:** ConfigLocator has two base paths: `writeBaseDir` (for store/profiles/settings writes) and `readBaseDir` (for global inventory reads like agents/skills/commands). Initially both point to `~/.cui/` via AGENT_HOME or WRITE_DIR_NAME.

### Read Strategy
- **D-05:** Reads are `~/.cui/` only — no fallback to `~/.claude/`. If `~/.cui/` doesn't exist yet, routes return empty data (same as fresh install). Simplest code, no dual-read complexity.
- **D-06:** AGENT_HOME env var, when set, overrides both read and write base directories (existing behavior preserved). `process.env.AGENT_HOME || WRITE_DIR_NAME` for write dir.

### Migration
- **D-07:** No migration — no auto-copy, no `cu migrate` command, no fallback. `~/.cui/` starts empty on first run. Existing `~/.claude/` data remains on disk but is invisible to ClaudeUI. This is a clean break.
- **D-08:** First startup creates `~/.cui/` subdirectories on demand (store/, profiles/) — same mkdir-on-demand pattern already in ProfileService and StoreService.

### AGENT_HOME Interaction
- **D-09:** AGENT_HOME overrides both read and write directories when set. `process.env.AGENT_HOME || WRITE_DIR_NAME` is the write directory. Project discovery continues checking `${cwd}/.claude` regardless.
- **D-10:** `AGENT_DIR_NAME` constant stays `.claude` — used only for project-local discovery. A new `WRITE_DIR_NAME = '.cui'` constant defines the managed data write target.

### Carried-forward decisions (Phase 10)
- **D-05 (P10):** ConfigLocator is the single source of truth for all path resolution — no path literals outside this service.
- **D-01 (P10):** Project discovery checks `${cwd}/.claude` only — unchanged.

### Agent's Discretion
- How writeBaseDir and readBaseDir are exposed to routes (separate options fields, or computed getters)
- Whether to add a `legacyBaseDir` getter pointing to `~/.claude/` for future migration support
- Error handling for unreadable `~/.cui/` directories
- Test structure for rebranded path scenarios

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 implementation (foundation for Phase 12)
- `packages/cli/src/server/services/configLocator.ts` — ConfigLocator class with AGENT_DIR_NAME constant, globalDir, projectDir, all path getters
- `packages/cli/src/server/index.ts` — Server setup, ConfigLocator instantiation, route wiring with baseDir

### Services with write paths that must switch to ~/.cui/
- `packages/cli/src/server/services/profileService.ts` — ProfileService uses baseDir for profiles/, store/, settings.json, backups
- `packages/cli/src/server/services/storeService.ts` — StoreService receives storeDir and profilesDir from ProfileService
- `packages/cli/src/server/services/modelConfigService.ts` — ModelConfigService writes to store/model-configs/

### Services that stay at ~/.claude/ (read-only, unchanged)
- `packages/cli/src/server/routes/agents.ts` — Agents route reads from agentsDir (global inventory)
- `packages/cli/src/server/routes/skills.ts` — Skills route reads from skillsDir
- `packages/cli/src/server/routes/commands.ts` — Commands route reads from commandsDir
- `packages/cli/src/server/services/pluginResolver.ts` — PluginResolver reads from pluginsDir
- `packages/cli/src/server/routes/configs.ts` — Config routes read .mcp.json/.lsp.json/settings.json

### Project context
- `.planning/REQUIREMENTS.md` — REBR-01, REBR-02 requirements
- `.planning/ROADMAP.md` — Phase 12 success criteria
- `.planning/phases/10-config-foundation/10-CONTEXT.md` — Phase 10 decisions (ConfigLocator design)
- `.planning/phases/11-project-local-loading/11-CONTEXT.md` — Phase 11 decisions (dual-source loading)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfigLocator`: Already centralizes all path resolution. Phase 12 just splits it into read vs write base paths. The class-based pattern (D-03 P10) and options-based threading (D-04 P10) stay.
- `ProfileService(storeDir, profilesDir)`: Already receives these as constructor params from `baseDir`. Changing what `baseDir` points to propagates automatically.
- `StoreService`: Receives storeDir and profilesDir from ProfileService. No direct path construction.

### Established Patterns
- Route registration: Routes receive directory paths via options. ConfigLocator passes paths — route code doesn't know about `.cui` or `.claude`.
- mkdir-on-demand: ProfileService and StoreService already create subdirectories on first write. No pre-creation needed.

### Integration Points
- `server/index.ts:createServer()` — Where ConfigLocator is instantiated. This is where the write dir vs read dir split happens.
- `profileService.ts:constructor(baseDir)` — Derives `profilesDir = baseDir + '/profiles'`, `storeDir = baseDir + '/store'`. If baseDir changes to `~/.cui/`, all writes follow automatically.
- `configs.ts` — Reads `.mcp.json` and `.lsp.json` from `baseDir`. These should also read from `~/.cui/` (D-04).

</code_context>

<specifics>
## Specific Ideas

- The rebrand is essentially a ConfigLocator change: split `globalDir` into `writeBaseDir` (~/.cui/) and `readBaseDir` (same), then update which routes use which base. Most route code is unchanged.
- Global inventory reads (agents, skills, commands from `~/.cui/agents/` etc.) will be empty on fresh start — users need to re-import or create. This is acceptable per D-07.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-cu-rebrand*
*Context gathered: 2026-04-18*
