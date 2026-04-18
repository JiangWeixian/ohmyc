# Feature Research: v1.4 Project-Aware Loading + .cu Rebrand

**Domain:** Project-local config discovery, merged views with source badges, directory rebranding for existing CLI tool
**Researched:** 2026-04-16
**Confidence:** HIGH (codebase-verified + official Claude Code docs + established industry patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a tool that manages Claude Code configs. Missing any = the tool feels incomplete or broken relative to Claude Code's own behavior.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Project-local `.claude/` discovery alongside global | Claude Code itself reads both `~/.claude/` and `<project>/.claude/`; a manager that only sees global is immediately incomplete | MEDIUM | Server currently resolves a single `baseDir` from `AGENT_HOME` (line 91 of server/index.ts). Must add project directory detection and dual-path loading. |
| Merged component views (agents, skills, commands) with source badges | Users with project-local agents expect them to appear alongside global ones, not require switching contexts | MEDIUM | SourceBadge component already exists with `local / profile / plugin` types. Must add `project` source type and extend inventory resolution to distinguish project-local from global-local. |
| Merged settings view (global + project overlay) | Settings follow a cascade: defaults -> global -> project. Users expect the tool to show merged result with per-key origin | HIGH | Settings route already accepts `?project=` query param but writes to `.claude/settings.json`. Must implement read-merge from both sources and display provenance per key. |
| `.cu` directory for activation writes | The tool's brand is `cu`, not `.claude`. Activation output should live in `.cu/` to avoid polluting the user's Claude directory | MEDIUM | ProfileService writes symlinks, settings, and plugin files to `baseDir`. Must change write target from `.claude` to `.cu` while keeping reads from `.claude`. |
| Backward-compatible read from `.claude` | Existing users have data in `.claude/`. The tool must still read from it even after rebrand | LOW | Read paths already use `AGENT_HOME`. Adding `.cu` as a fallback read path is straightforward. |
| Claude Code continues to work alongside `.cu` | The tool is a manager, not a replacement. Claude Code must still function normally | LOW | Claude Code reads `~/.claude/` and `<project>/.claude/`. As long as `.cu` writes are limited to ClaudeUI-specific data (store, profiles), there is no conflict. |

### Differentiators (Competitive Advantage)

Features that set the tool apart from manual config editing or simpler managers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-key settings provenance display | Shows exactly which layer (global, project, profile override) contributed each settings key -- no other tool does this for Claude config | MEDIUM | Requires tracking source for each merged key. VS Code does this in its Settings UI (rendered with colored scope indicators). We should follow that pattern. |
| Project-aware profile activation context | Profiles can reference components that exist only at project level, and activation resolves them from the correct scope | HIGH | ProfileService.preflight currently checks store components in a single baseDir. Must extend to check both project-local store and global store. |
| Visual merge conflict indicators in UI | When project and global define the same agent name, the UI should show both with source badges rather than silently hiding one | MEDIUM | SourceBadge already handles `local / profile / plugin`. Adding `project` is a natural extension. The harder part is the API response including both copies. |
| Migration helper from `.claude` to `.cu` | One-time guided migration that moves ClaudeUI-managed data (store, profiles, backups) to `.cu` while preserving user's `.claude/` for Claude Code itself | MEDIUM | Not a runtime feature -- a startup check or CLI command. Must be careful not to touch Claude Code's own files (sessions, transcripts, memory). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem reasonable but would cause real issues in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rename `.claude/` to `.cu/` entirely | Clean rebrand, single directory | Breaks Claude Code which expects `.claude/`. Would require every user's Claude Code installation to change its config path. Not our tool to change. | Read `.claude/` (Claude Code's data), write `.cu/` (our management data). Keep them separate. |
| Real-time file watching for project config changes | Would show live updates when team members change project `.claude/` | Adds WebSocket complexity, file watcher edge cases (macOS fsevents), and the tool is not a long-running daemon during normal use | Poll on tab focus or explicit refresh. The tool is a management UI, not a file monitor. |
| Deep-merge project settings with automatic conflict resolution | "Just make it work" when global and project settings conflict | Silent resolution destroys user trust. Claude Code itself uses simple "project overrides global" -- the tool should expose that, not invent a new merge strategy. | Show both values, let project win (matching Claude Code behavior), but display the override clearly. |
| Two-way sync between `.cu` store and `.claude` activation output | Keep store and activated state in sync automatically | Creates race conditions with Claude Code's own writes, makes it unclear who owns the source of truth | One-way flow: store -> activation write. Never read back from activation output into store. |

## Feature Dependencies

```
Project directory detection
    |
    +--required by--> Project-local component loading (agents, skills, commands)
    |                       |
    |                       +--required by--> Merged component view with source badges
    |                       |
    |                       +--required by--> Project-aware profile preflight
    |
    +--required by--> Project-local settings loading
                            |
                            +--required by--> Merged settings view with per-key provenance

SourceBadge extension (add 'project' type)
    |
    +--required by--> Merged component view with source badges
    |
    +--required by--> Merged settings view with per-key provenance

.cu directory creation
    |
    +--required by--> Write-path rebrand (activation writes to .cu, not .claude)
                            |
                            +--required by--> Migration helper (optional but valuable)

Write-path rebrand
    |
    +--conflicts with--> Simultaneous read-from-.cu -- must be sequential:
                         Phase 1: Write to .cu, read from .claude
                         Phase 2 (future): Optionally read from .cu as fallback

Project-local component loading
    |
    +--enhances--> Profile activation (profiles can now reference project-scoped components)
```

### Dependency Notes

- **Project directory detection is the foundation:** Without knowing which project the user is in, nothing else works. The server must accept a `project` parameter (likely via CLI argument when launched from a project directory, or via an API query param).
- **SourceBadge extension is small but blocking:** The UI component already handles three source types. Adding `project` is a four-line change in SourceBadge.tsx, but every API route that returns components must also populate the new source type.
- **Write-path rebrand must not change read paths:** The tool reads Claude Code's data from `.claude/`. Activation output (symlinks, settings, plugin metadata) writes to `.cu/`. These are separate concerns and must be implemented separately.
- **Merged settings view is the highest-complexity item:** It requires parsing both global and project `settings.json`, computing a merged result, tracking per-key provenance, and presenting it clearly. The existing settings route does none of this yet.
- **Profile preflight must check both scopes:** Currently `ProfileService.storeComponentExists()` checks only the global store. It must also check a project-local store or project-local agents/skills/commands directories.

## MVP Definition

### Launch With (v1.4)

These are the minimum features for the milestone to be complete.

- [ ] **Project directory detection** -- Server discovers `<project>/.claude/` on startup (alongside global `~/.claude/`). CLI passes `--project <path>` or auto-detects from `process.cwd()`.
- [ ] **Dual-source component loading** -- API routes read agents, skills, commands from both global and project directories. Responses include a `source` field distinguishing `global` from `project`.
- [ ] **SourceBadge UI extension** -- SourceBadge component renders a `project` variant (e.g., green or teal badge). Explorer lists show components from both scopes with correct badges.
- [ ] **`.cu` write path** -- All activation writes (symlinks, settings, plugin files) go to `~/.cu/` instead of `~/.claude/`. AGENT_HOME default changes from `.claude` to `.cu`.
- [ ] **Backward-compatible `.claude` reads** -- If `.cu/` does not exist, the tool still reads from `.claude/` for store and profiles. First run auto-creates `.cu/`.

### Add After Validation (v1.4.x)

- [ ] **Merged settings view with per-key provenance** -- Once basic project loading works, enhance settings to show which layer each key comes from.
- [ ] **Migration helper** -- CLI command or startup prompt to migrate existing `.claude/` ClaudeUI data to `.cu/`.
- [ ] **Project-aware profile composition** -- Allow profiles to reference project-scoped components during activation.

### Future Consideration (v2+)

- [ ] **Multi-project support** -- Manage configs for multiple projects simultaneously (tabbed or switchable).
- [ ] **`.cu` as primary read path** -- Once users have migrated, reads default to `.cu/` with `.claude/` as legacy fallback.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Project directory detection | HIGH | LOW | P1 |
| `.cu` write path (AGENT_HOME rebrand) | HIGH | MEDIUM | P1 |
| Dual-source component loading | HIGH | MEDIUM | P1 |
| SourceBadge `project` variant | MEDIUM | LOW | P1 |
| Backward-compatible `.claude` reads | HIGH | LOW | P1 |
| Merged settings view with provenance | HIGH | HIGH | P2 |
| Project-aware profile preflight | MEDIUM | MEDIUM | P2 |
| Migration helper | MEDIUM | MEDIUM | P2 |
| Multi-project support | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.4 milestone
- P2: Should have, add after core project loading works
- P3: Nice to have, future milestone

## Competitor / Analog Feature Analysis

| Feature | VS Code | Git | Claude Code (native) | Our Approach |
|---------|---------|-----|----------------------|--------------|
| Global + project config merge | 3-layer cascade: Default -> User -> Workspace. Workspace wins. | 4-layer cascade: System -> Global -> Local -> Worktree. Local wins. | Reads `~/.claude/` + `<project>/.claude/`. Project overrides global. | Follow Claude Code's pattern: project overrides global. Show both layers in merged view. |
| Per-key settings provenance | Shows "Modified in Workspace" badges per setting | `git config --show-origin --show-scope` reveals source file per key | No UI for this -- users run `/doctor` or inspect files manually | Expose provenance per key in settings UI. Unique differentiator. |
| Config directory customization | `$VSCODE_PORTABLE` or `--user-data-dir` | `$GIT_CONFIG_GLOBAL`, `$XDG_CONFIG_HOME/git/config` | `CLAUDE_CONFIG_DIR` env var overrides `~/.claude` | Use `AGENT_HOME` env var (already exists). Default to `.cu` for writes. |
| Directory rename / rebrand | Never renamed -- always `.vscode/` | Never renamed -- always `.git/` | Never renamed -- always `.claude/` | Use a separate `.cu/` for our management data. Never rename `.claude/`. |

## Existing Codebase Dependencies

This section maps what already exists and what must change.

### What Already Exists (Reuse)

| Component | Location | What It Provides |
|-----------|----------|-----------------|
| `SourceBadge` component | `packages/ui/src/components/SourceBadge.tsx` | Three-way source rendering (local, profile, plugin). Extend with `project`. |
| `resolveInventorySource()` | `packages/cli/src/server/routes/inventorySource.ts` | Symlink-based source detection. Extend for project-local files. |
| `AGENT_HOME` env var | `packages/cli/src/server/index.ts:91` | Configurable base directory. Change default from `.claude` to `.cu`. |
| Settings route with `?project=` | `packages/cli/src/server/routes/settings.ts` | Already reads project `.claude/settings.json`. Foundation for merge. |
| `StoreService` | `packages/cli/src/server/services/storeService.ts` | Import and provenance tracking. Works with any store directory. |
| `ProfileService` with activation | `packages/cli/src/server/services/profileService.ts` | Symlink-based activation with rollback. Write path must change to `.cu`. |
| Plugin resolution | `packages/cli/src/server/services/pluginResolver.ts` | Already aggregates components from plugin paths. Model for project aggregation. |

### What Must Change

| Component | Change | Complexity |
|-----------|--------|------------|
| `createServer()` in `server/index.ts` | Accept project directory parameter, instantiate duplicate route sets for project scope | MEDIUM |
| `agentsRoutes`, `skillsRoutes`, `commandsRoutes` | Add project-local directory scanning, merge results with source tagging | MEDIUM |
| `resolveInventorySource()` | Extend to detect project-scoped files (not just local vs profile) | LOW |
| `SourceBadge.tsx` | Add `project` source type with distinct styling | LOW |
| `ProfileService` constructor | Change default `baseDir` from `.claude` to `.cu` | LOW |
| `ProfileService.activate()` | Write symlinks/settings/plugin files to `.cu/` instead of `.claude/` | MEDIUM |
| `Explorer.tsx` | Display project-scope components alongside global, handle duplicate names | MEDIUM |

## Sources

- [Claude Code .claude directory official documentation](https://code.claude.com/docs/en/claude-directory) -- HIGH confidence, official Anthropic docs
- [VS Code User and Workspace Settings](https://code.visualstudio.com/docs/configure/settings) -- HIGH confidence, official Microsoft docs
- Git config hierarchy (system/global/local/worktree) -- HIGH confidence, established Git documentation
- Codebase analysis: `packages/cli/src/server/`, `packages/ui/src/components/SourceBadge.tsx`, `packages/shared/src/` -- HIGH confidence, direct source review
- ESLint flat config merge patterns -- MEDIUM confidence, official ESLint blog + docs

---
*Feature research for: v1.4 Project-Aware Loading + .cu Rebrand*
*Researched: 2026-04-16*
