# Pitfalls Research

**Domain:** ClaudeUI v1.4 -- Project-aware config loading with global fallback, directory rebrand from `.claude` to `.cu`
**Researched:** 2026-04-16
**Confidence:** HIGH (based on direct codebase analysis of all affected files; integration pitfalls grounded in actual architecture)

## Critical Pitfalls

### Pitfall 1: Two Config Location Systems Already Exist -- Confusion Between Them

**What goes wrong:**
The codebase already has two completely different config location mechanisms:
1. `settingsRoutes` (lines 14-42 in `settings.ts`) reads from `process.cwd()/.claude/settings.json` (project-local, hardcoded `.claude`)
2. `configRoutes`, `agentsRoutes`, `skillsRoutes`, `commandsRoutes` all read from `baseDir` which resolves to `~/.claude/` via the `AGENT_HOME` env var

When adding "project-local loading alongside global," developers may not realize `settingsRoutes` already does project-local and build a third, inconsistent mechanism. Or they may modify the wrong one, thinking it already uses `baseDir`.

**Why it happens:**
The `settingsRoutes` file uses `process.cwd()` and hardcodes `.claude/` directly in the route handler (lines 17, 47), completely bypassing the `baseDir`/`AGENT_HOME` abstraction used everywhere else. These two systems have no shared code, no shared path resolver, and no shared mental model.

**How to avoid:**
- Inventory ALL config-read locations before starting. The complete list is: `settingsRoutes` (project-local, hardcoded path), `configRoutes` (global `baseDir` for `.mcp.json`, `.lsp.json`), inventory routes (`agentsRoutes`, `skillsRoutes`, `commandsRoutes` via `baseDir`), `profileService` (global `baseDir` for profiles/store/settings), `storeService` (global `baseDir` for store), and `pluginService` (global `baseDir` for plugins).
- Unify the "where does config live" abstraction into a single service or resolver BEFORE adding project-local support to new routes.
- The `AGENT_HOME` / `baseDir` pattern is the correct one to extend. `settingsRoutes` is the outlier that must be brought into the fold.

**Warning signs:**
- PR touches `settingsRoutes` and another route file but they use different path resolution logic.
- Tests for project-local loading pass for one route but fail for others.
- API responses from `/api/settings` vs `/api/agents` disagree about what "project-local" means.

**Phase to address:**
Phase 1 (foundation) -- must establish a unified config location resolver before any feature work begins.

---

### Pitfall 2: Source Badge Enum Explosion Without Clear Merge Semantics

**What goes wrong:**
`SourceBadge` currently uses `InventorySource = 'local' | 'profile' | 'plugin'`. Adding project-local config introduces a new source dimension. Developers will be tempted to add `'project'` to the union, making it `'local' | 'profile' | 'plugin' | 'project'`. But "local" already means "present in the global `~/.claude/` directory as a non-symlink file" (see `resolveInventorySource`). "Project" would mean "present in the project's `.claude/` directory." These overlap: what if an agent exists in BOTH global and project, and the project version wins? The badge would say "project" but the user may not understand why "local" disappeared.

**Why it happens:**
The current source resolution (`resolveInventorySource`) is binary within a single directory: symlink vs regular file. Adding a second directory (project) creates a merge layer on top, but the `source` field is a flat string tag applied per-item. There is no concept of "override source" or "effective source."

**How to avoid:**
- Decide the merge model FIRST: does project override global? Do they merge (global + project)? Do duplicates show both with badges?
- Extend the source enum to include `'project'` but also consider whether items need an `effectiveSource` field separate from their `originSource`. For example: an agent might have `originSource: 'project'` but also appear in global as `originSource: 'local'`. The badge should show the winning source.
- The `resolveInventorySource` function currently only handles one directory. It must be extended or replaced with a multi-directory resolver that tags items with their origin.

**Warning signs:**
- UI shows duplicate agents/skills/commands with different badges and no indication of which is active.
- Source badge says "local" for a project-provided override because the merge logic overwrote the source tag.
- Tests only verify source badges in isolation (global OR project) but never the combined case.

**Phase to address:**
Phase 1 (schema/contract design) -- the source enum and merge semantics must be locked down before route or UI changes.

---

### Pitfall 3: Hardcoded `.claude` String Scattered Across Codebase

**What goes wrong:**
The string `.claude` appears in at least two distinct production contexts:
1. As `AGENT_HOME` default value in `createServer` (line 91: `process.env.AGENT_HOME || '.claude'`)
2. As hardcoded string in `settingsRoutes` (lines 17, 47: `path.join(project, '.claude', 'settings.json')` and `path.join(project, '.claude')`)

When rebranding to `.cu`, developers will change the `AGENT_HOME` default to `.cu` but miss the hardcoded strings in `settingsRoutes`. Or they will change the default but not handle the migration case where users still have data in `.claude/`.

**Why it happens:**
There is no centralized constant for the directory name. The `AGENT_HOME` env var provides an escape hatch for the global path, but `settingsRoutes` bypasses it entirely and hardcodes `.claude/`.

**How to avoid:**
- Extract a single constant (e.g., `AGENT_DIR_NAME = '.cu'`) in shared config.
- Replace ALL hardcoded `.claude` references with this constant.
- For `settingsRoutes`, the project-local `.claude/` directory must STAY as `.claude/` because that is Claude Code's convention. Only the global/app-managed directory rebrands to `.cu`. The `settingsRoutes` hardcoded path is actually correct for a different reason -- it reads Claude's own project config. The issue is that it should use a constant (`CLAUDE_PROJECT_DIR = '.claude'`) distinct from the app's home directory (`CU_HOME_DIR = '.cu'`).
- Add a grep test that fails if `.claude` appears as a literal string outside of test fixtures and the constant definition.

**Warning signs:**
- `settingsRoutes` still writes to `.claude/` while everything else writes to `.cu/` and nobody can explain why or whether it is intentional.
- `git grep "\.claude"` returns hits in production code after the rebrand is "complete."
- Users report that settings changes are not reflected in the UI because the read path and write path use different directory names.

**Phase to address:**
Phase 1 (constant extraction) before any rebrand work; Phase 3 (rebrand) as the main execution.

---

### Pitfall 4: Profile Activation Writes to the Wrong Directory After Rebrand

**What goes wrong:**
`ProfileService.activate()` writes symlinks into `baseDir/agents/`, `baseDir/skills/`, etc., and merges settings into `baseDir/settings.json`. After rebrand, `baseDir` changes from `~/.claude/` to `~/.cu/`. But the symlinks' targets point into `~/.cu/store/` (previously `~/.claude/store/`). If the migration only renames the top-level directory but profile data references old absolute paths, symlinks break.

More critically: `deactivateInternal` reads backup files from `baseDir` using hardcoded patterns like `settings.backup.${activeName}.json`. If the active profile was activated before the rebrand (when `baseDir` was `~/.claude/`), the backup files are in the OLD location. After rebrand, `baseDir` is `~/.cu/`, so deactivation cannot find the backups and silently falls through to the generic backup path, potentially restoring stale state.

**Why it happens:**
Profile activation stores absolute paths: the `.active` file contains `path.resolve(dir)` which embeds the full path to the profile directory. The backup strategy assumes `baseDir` is stable across the activation lifecycle.

**How to avoid:**
- The rebrand MUST include a migration step that moves data from `~/.claude/` to `~/.cu/` atomically, BEFORE any writes occur with the new path.
- During migration, check for an active profile and either: (a) deactivate first, migrate, then reactivate; or (b) rewrite all stored paths to reference the new directory.
- Add a startup check: if `~/.claude/` exists but `~/.cu/` does not, trigger migration automatically.
- Consider storing relative paths in `.active` instead of absolute paths to reduce migration fragility. `getActiveProfileName()` already handles both formats, but `activate()` writes absolute paths.

**Warning signs:**
- After rebrand, activating a profile shows "success" but Claude does not see the agents/skills because symlinks point to nonexistent paths.
- Deactivation silently fails to restore settings, leaving the user with modified `settings.json`.
- `ls -la ~/.cu/profiles/my-profile/agents/` shows broken symlinks.

**Phase to address:**
Phase 3 (rebrand execution) -- migration must be the first task in this phase, before any other rebrand changes.

---

### Pitfall 5: Merge Conflicts Between Global and Project Config Without Defined Precedence

**What goes wrong:**
When both `~/.cu/agents/reviewer.md` and `./claude/agents/reviewer.md` exist with the same name but different content, the system must decide which wins. If different routes handle this differently (agents use project, hooks use global, configs silently merge), users get unpredictable behavior.

Looking at the existing code: `settingsRoutes` reads ONLY from the project directory (no merge). `configRoutes` reads ONLY from global `baseDir` (no project awareness). Neither has a merge strategy. Adding project-local loading requires defining merge semantics, and doing it differently for different component types would create a confusing product.

**Why it happens:**
There is no shared "config merge policy" abstraction. Each route currently reads from exactly one location. The developer adding project support will naturally implement merge logic in each route independently, leading to subtle inconsistencies.

**How to avoid:**
- Define ONE merge policy that applies to all component types. Recommended: "project overrides global, with both visible." Show both in the UI with badges, but the project version is the "effective" one.
- Implement the merge in a shared service (not per-route). Every route should call a resolver like `resolver.resolve(type, name)` which returns the winning item with correct source attribution.
- For structured configs (settings.json, hooks), deep-merge global as base with project as overlay -- matching the existing `deepMerge` pattern in `profileService`.

**Warning signs:**
- Deleting a project-local agent reveals the global one in the UI, but the detail view still shows the project content from cache.
- API returns different merge results depending on which endpoint you call.
- Two agents with the same name appear in the list with no indication of which is effective.

**Phase to address:**
Phase 1 (design the merge resolver service) before any route changes.

---

### Pitfall 6: Race Condition During Migration

**What goes wrong:**
If the migration from `.claude` to `.cu` is not atomic, a second process (another `cu` instance, or Claude Code itself reading `~/.claude/`) can read from a partially-migrated state. Half the files are in `.cu/` and half are still in `.claude/`. This is especially dangerous because the existing `LockService` uses lock files within the profiles directory -- if the profiles directory moves during migration, the lock is in the wrong place.

**Why it happens:**
The migration involves moving or copying data between directories. The existing locking mechanism (`proper-lockfile`) locks specific files within the profiles directory, not the migration process itself. There is no cross-directory lock.

**How to avoid:**
- Use a migration lock file at the home directory level (e.g., `~/.cu-migration.lock`), not inside the directory being migrated.
- Perform the migration as a single atomic rename if possible (`fs.rename` is atomic on the same filesystem on macOS/Linux).
- If copy is needed (cross-filesystem), write a manifest first, copy all files, then swap a "migration complete" marker.
- On startup, if migration is in progress (lock file exists), wait or fail with a clear message rather than proceeding with partial data.

**Warning signs:**
- Two `cu` processes running simultaneously during migration.
- Migration succeeds but `~/.claude/` still exists with some files (partial copy).
- `ENOTEMPTY` errors during rename because another process created files in the target.

**Phase to address:**
Phase 3 (rebrand) -- migration atomicity must be designed before implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Adding `'project'` to source enum without refactoring `resolveInventorySource` | Faster to ship | Every new location requires another enum member and another conditional in badge rendering | Never -- this is the right time to make source resolution pluggable |
| Rebranding only `AGENT_HOME` default without migrating existing data | Avoids migration complexity | Users with existing `~/.claude/` data lose everything on upgrade | Never -- data loss is unacceptable |
| Keeping `settingsRoutes` as a separate, unmerged system | Less refactoring now | Third config location model makes future changes 3x harder | Only if project-local is explicitly limited to agents/skills/commands and settings are excluded from scope |
| Hardcoding `.cu` in new code instead of using the shared constant | One less import to wire | Same problem as `.claude` -- scattered literals that are hard to change later | Never |
| Skipping symlink validation during migration | Faster migration | Broken symlinks that silently point to old `~/.claude/store/` paths | Never -- validate symlinks after migration |
| Using `process.cwd()` as the project directory without explicit configuration | No CLI changes needed | Breaks when server is started from a different directory than the project; `settingsRoutes` already has this problem | Only during prototyping; must add explicit project path for production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code reading `.claude/` | Rebranding the project-local directory to `.cu/` -- Claude Code expects `.claude/` and will not find config | Project-local reads MUST stay as `.claude/`; only the global/app-managed directory rebrands to `.cu/` |
| `settingsRoutes` project-local reads | Modifying `settingsRoutes` to read from `~/.cu/` instead of `process.cwd()/.claude/` | `settingsRoutes` reads project-local `.claude/` -- this is Claude's directory, not ours to rename |
| `proper-lockfile` during migration | Migrating the directory while locks are held inside it | Ensure no active locks before migration; use a separate migration lock at the home-directory level |
| `storeService` import provenance paths | Provenance index (`imports.json`) stores absolute `importPath` values that reference `~/.claude/` | Migrate provenance index paths during rebrand, or switch to relative paths going forward |
| `pluginService` install paths | `installed_plugins.json` stores absolute `installPath` values that reference `~/.claude/plugins/` | These are Claude-managed files; determine whether they should migrate or stay in `.claude/` |
| `profileService` `.active` path | `.active` contains an absolute path like `/Users/x/.claude/profiles/my-profile` | Must be rewritten or invalidated during migration; relative paths would be safer long-term |
| `profileService` backup paths | `settings.backup.*.json` files are found via `path.join(this.baseDir, backupName)` | After rebrand, `baseDir` changes; old backups must be found and migrated |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Double filesystem scan (global + project) for every API call | Slow agent/skill listing, especially with many plugins | Cache the merged result or implement a filesystem watcher; lazy-load project config on first request | 100+ agents across both locations |
| Migration of large stores with file-by-file copy | `cu` startup hangs for minutes during migration | Use atomic rename for same-filesystem; show progress for cross-filesystem copy; run migration in background for non-critical data | Store with 1000+ components |
| Reading `.active` file on every inventory source resolution | N+1 filesystem reads per API call (already happening -- `resolveInventorySource` calls `readActiveProfileDir` per item) | Cache the active profile path per request lifecycle, not per item | Already a latent issue; gets worse with two directories |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Symlink traversal via project-local config | Malicious project could symlink agent files to `../../etc/passwd` or similar | Validate that resolved symlink targets are within expected directories; never follow symlinks outside the agent/skill root |
| Reading arbitrary project paths via `settingsRoutes` | The `?project=` query parameter accepts any path -- an attacker could craft `?project=/etc` to read `/etc/.claude/settings.json` | Validate that project paths are within expected parent directories or are CWD-subpaths; this is an existing vulnerability to fix |
| Migration leaking data to wrong location | If migration is interrupted, partial data in `~/.cu/` may have wrong permissions | Set umask before migration; verify permissions on migrated files match source |
| Path traversal in project directory resolution | If the server accepts a project path from the client without validation | Always resolve project paths server-side (CWD or explicit env var), never trust client-supplied paths for filesystem operations |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing duplicate items without merge indication | User sees two "reviewer" agents and does not know which one Claude will use | Show the project version with a "project" badge and dim/hide the global override with an "overridden by project" tooltip |
| Silent migration on first launch | User runs `cu` and it hangs for 30 seconds migrating data with no feedback | Show a migration progress message: "Migrating ~/.claude/ to ~/.cu/..." and completion status |
| Rebrand changes the settings.json location without notification | User's Claude Code session loses all settings because Claude still reads `~/.claude/settings.json` | Document clearly that this rebrand only affects the app-managed directory; Claude's own `~/.claude/` is untouched |
| Missing project-local config with no empty-state message | User opens Explorer in a project without `.claude/` and sees nothing -- unclear if feature is broken or just empty | Show "No project-local config found. Only global config is shown." when project directory is absent |
| Source badge says "local" for both global and project items | User cannot distinguish which items come from which scope | Use distinct badge colors/labels: "global" for `~/.cu/`, "project" for `./.claude/`, "profile" for activated profile |

## "Looks Done But Isn't" Checklist

- [ ] **Project-local loading:** Often missing the project directory DISCOVERY step -- verify the server knows what the current project directory is (CWD? env var? CLI argument?). Currently only `settingsRoutes` uses `process.cwd()`.
- [ ] **Source badges for project items:** Often missing the UI update -- verify that the `SourceBadge` component renders the new `'project'` source type with a distinct visual style (not just adding the word to the same badge).
- [ ] **Merge semantics:** Often missing the "which one wins" test -- verify tests cover: (1) global-only item, (2) project-only item, (3) both exist with same name, (4) delete project override reveals global, (5) identical content in both (dedup?).
- [ ] **Migration completeness:** Often missing edge cases -- verify: (1) migration with active profile, (2) migration with no data, (3) migration when `.cu` already exists, (4) migration rollback on failure, (5) migration when `.claude` and `.cu` both exist.
- [ ] **Symlink integrity after migration:** Often missing symlink re-targeting -- verify that all symlinks in profile directories point to the new `~/.cu/store/` paths, not the old `~/.claude/store/`.
- [ ] **Provenance index after migration:** Often missing path updates in `imports.json` -- verify that stored `importPath` values are updated or remain valid.
- [ ] **Plugin installed_plugins.json paths:** Often missing plugin path migration -- verify that `installed_plugins.json` entries reference correct install paths after rename.
- [ ] **Backup file locations:** Often missing settings backup migration -- verify that `settings.backup.*.json` files are found during deactivation after rebrand.
- [ ] **Lock file locations:** Often missing lock file path update -- verify that `LockService` operates in the new `~/.cu/profiles/` directory after migration.
- [ ] **`settingsRoutes` path:** Often incorrectly changed to `.cu` -- verify that `settingsRoutes` still reads from `.claude/` (Claude's convention) not `.cu/` (our convention).
- [ ] **`process.cwd()` assumption:** Often left as the only way to discover the project directory -- verify that the server has an explicit project path configuration option for non-CWD use cases.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Broken symlinks after migration | LOW | Re-run activation for the current profile; symlinks regenerate from store paths automatically |
| Missing backup files after migration | MEDIUM | If `settings.json` is corrupted and backup is in old location: check `~/.claude/settings.backup.*.json` manually and restore |
| Partial migration (some files in `.cu`, some in `.claude`) | MEDIUM | Stop all processes; verify data integrity in both directories; if `.claude/` is intact, delete `.cu/` and re-run migration |
| Provenance index with stale paths | LOW | Delete `~/.cu/store/.metadata/imports.json` and re-import; provenance is non-critical metadata |
| Source badge showing wrong source | LOW | Fix in code; no data recovery needed; API response is computed per-request |
| Migration race condition (two processes) | HIGH | Stop all processes; verify data integrity in both `~/.claude/` and `~/.cu/`; merge manually or restore from backup |
| Active profile with pre-migration absolute paths | MEDIUM | Delete `.active` file, deactivate via UI, then reactivate; this regenerates all symlinks with correct paths |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Two config location systems (Pitfall 1) | Phase 1: Foundation | Unified config location resolver with tests covering both existing code paths |
| Source badge enum explosion (Pitfall 2) | Phase 1: Schema design | Source enum and merge semantics documented; `SourceBadge` extended with `'project'` |
| Hardcoded `.claude` strings (Pitfall 3) | Phase 1: Constant extraction | `git grep` test passes -- no literal `.claude` outside constant definition and test fixtures |
| Profile activation wrong directory (Pitfall 4) | Phase 3: Rebrand | Integration test: activate profile before migration, migrate, verify symlinks are valid |
| Merge conflicts no precedence (Pitfall 5) | Phase 1: Merge resolver | Unit tests for resolver: global-only, project-only, both, delete override, identical content |
| Race condition during migration (Pitfall 6) | Phase 3: Migration | Test: concurrent startup during migration; verify lock prevents data corruption |

## Recommended Phase Structure

Based on the pitfall analysis, the phases should be ordered:

1. **Phase 1: Foundation** -- Extract directory constants, build unified config resolver service, define source enum with `'project'`, define merge semantics, extend `SourceBadge`. No behavioral changes yet.
2. **Phase 2: Project-Local Loading** -- Wire project directory into routes via the unified resolver. Add `'project'` source tagging. Update UI to render project badges. Tests for merge cases.
3. **Phase 3: `.cu` Rebrand** -- Migration logic (atomic rename, path rewriting, symlink validation). Update `AGENT_HOME` default. Startup migration check. Keep `.claude/` reading for project-local (Claude's convention).

Rationale: Phase 1 removes the scattered-abstraction problem (Pitfalls 1, 3, 5). Phase 2 adds the new feature on clean foundations (Pitfalls 2, 5). Phase 3 is last because it is the riskiest and depends on Phases 1-2 being correct (Pitfalls 4, 6). Rebranding before the resolver is unified would mean migrating code that is about to be refactored.

## Sources

- Direct codebase analysis: `packages/cli/src/server/index.ts` (AGENT_HOME resolution, baseDir construction)
- Direct codebase analysis: `packages/cli/src/server/routes/settings.ts` (project-local hardcoded `.claude/`)
- Direct codebase analysis: `packages/cli/src/server/routes/inventorySource.ts` (source resolution logic)
- Direct codebase analysis: `packages/cli/src/server/routes/configs.ts` (global-only config reads)
- Direct codebase analysis: `packages/cli/src/server/routes/agents.ts` (inventory source tagging pattern)
- Direct codebase analysis: `packages/cli/src/server/services/profileService.ts` (activation, deactivation, backup logic)
- Direct codebase analysis: `packages/cli/src/server/services/storeService.ts` (provenance index with absolute paths)
- Direct codebase analysis: `packages/ui/src/components/SourceBadge.tsx` (badge rendering)
- Direct codebase analysis: `packages/shared/src/storeSchema.ts` and `pluginSchema.ts` (data schemas)
- Project context: `.planning/PROJECT.md` (v1.4 milestone definition, key decisions log)

---
*Pitfalls research for: ClaudeUI v1.4 Project-Aware Loading + .cu Rebrand*
*Researched: 2026-04-16*
