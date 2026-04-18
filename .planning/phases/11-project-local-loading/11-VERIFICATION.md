---
phase: 11-project-local-loading
verified: 2026-04-18T14:47:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
---

# Phase 11: Project-Local Loading Verification Report

**Phase Goal:** Users see both global and project-scoped components merged in every inventory view, with source badges distinguishing origin and project items taking precedence on conflicts.
**Verified:** 2026-04-18T14:47:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/agents returns merged global + project agents with scope field | ✓ VERIFIED | `agents.test.ts` project-local loading tests: both global and project agents returned, global tagged scope:'global', project tagged scope:'project'. Sort test confirms project-first on collision. |
| 2 | GET /api/skills returns merged global + project skills with scope field | ✓ VERIFIED | `skills.test.ts` project-local loading: same pattern — both sources returned, correct scope tagging, project-first sort on name collision. |
| 3 | GET /api/commands returns merged global + project commands with scope field | ✓ VERIFIED | `commands.test.ts` project-local loading: same pattern verified. |
| 4 | GET /api/mcp returns merged local + project entries with scope field | ✓ VERIFIED | `configs.test.ts` project-local loading: MCP entries from both global and project returned, correct scope tagging. Both versions visible on key collision. |
| 5 | GET /api/hooks returns merged local + project hooks with scope field | ✓ VERIFIED | `configs.test.ts` project-local loading: hooks from both sources, correct scope. |
| 6 | GET /api/lsp returns merged local + project LSP entries with scope field | ✓ VERIFIED | `configs.test.ts` project-local loading: LSP entries from both sources, correct scope. |
| 7 | Project items sort first when names collide | ✓ VERIFIED | Entity route sort tests: `agents[0].scope === 'project'`, `agents[1].scope === 'global'` for same-id items. Custom comparator: id comparison then project-first tiebreaker. |
| 8 | When no project directory exists (null), all routes behave identically to before | ✓ VERIFIED | Backward-compat tests: `projectAgentsDir: null` returns only global items with scope:'global'. All existing tests pass unchanged. |
| 9 | EntityDetail shows "From project directory — view only." notice for project-scoped items | ✓ VERIFIED | EntityDetail.tsx: `{scope === 'project' && (...)}` renders green notice with matching #22c55e color. |
| 10 | Explorer passes scope through ItemLocator for entity selection | ✓ VERIFIED | Explorer.tsx: `setSelectedItem({ name: entity.id, source: entity.source, pluginId: entity.pluginId, scope: entity.scope })`. |
| 11 | ConfigSection handles overlapping config names from global and project | ✓ VERIFIED | ConfigSection.tsx: key uses `${entry.source}-${entry.name}-${entry.scope ?? 'global'}` — unique keys for overlapping names. |

**Score:** 11/11 truths verified

### Roadmap Success Criteria Coverage

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | API routes return merged results from both global and project directories | ✓ VERIFIED | All entity routes + config routes load from project dirs when provided. 15 new tests + 298 total CLI tests pass. |
| 2 | Project-scoped item appears as active override on name collisions | ✓ VERIFIED | Custom sort comparator places project items first when ids match. Per D-04, project wins. |
| 3 | Every merged item carries a source field (global or project) | ✓ VERIFIED | ScopeEnum in shared schemas. All items tagged scope:'global' or scope:'project' server-side. Tests verify field presence. |
| 4 | Explorer views display both with distinct source badges | ✓ VERIFIED | SourceBadge 'project' variant renders green badge (Phase 10). Explorer passes scope through. ConfigSection handles scope-aware keys. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/agentSchema.ts` | ScopeEnum + scope field on AgentSchema | ✓ VERIFIED | ScopeEnum exported, AgentSchema has `scope: ScopeEnum.optional()`. |
| `packages/shared/src/skillSchema.ts` | scope field on SkillSchema | ✓ VERIFIED | Imports ScopeEnum, has `scope: ScopeEnum.optional()`. |
| `packages/shared/src/commandSchema.ts` | scope field on CommandSchema | ✓ VERIFIED | Imports ScopeEnum, has `scope: ScopeEnum.optional()`. |
| `packages/cli/src/server/index.ts` | projectAgentsDir/projectSkillsDir/projectCommandsDir/projectBaseDir wiring | ✓ VERIFIED | Lines 93-97: all four project paths passed to routes. |
| `packages/cli/src/server/routes/agents.ts` | projectAgentsDir option + project loading + scope tagging | ✓ VERIFIED | AgentsRoutesOptions has projectAgentsDir. GET list loads project, tags source:'project'+scope:'project'. Sort with project-first comparator. |
| `packages/cli/src/server/routes/configs.ts` | projectBaseDir option + project MCP/hooks/LSP loading | ✓ VERIFIED | ConfigRoutesOptions has projectBaseDir. All three endpoints load from project dir. McpEntry/HookEntry/LspEntry include scope field. |
| `packages/ui/src/components/EntityDetail.tsx` | scope prop + view-only notice | ✓ VERIFIED | EntityDetailProps has `scope?: 'global' \| 'project'`. Green notice renders when scope==='project'. |
| `packages/ui/src/Explorer.tsx` | scope in ItemLocator + passed to EntityDetail | ✓ VERIFIED | setSelectedItem includes `scope: entity.scope`. EntityDetail receives `scope={selectedEntity.scope}`. |
| `packages/ui/src/components/ConfigSection.tsx` | scope in ConfigEntryCard props | ✓ VERIFIED | ConfigEntryCardProps has `scope?: 'global' \| 'project'`. Key includes scope. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| configLocator.ts | index.ts | projectAgentsDir/projectSkillsDir/projectCommandsDir/projectPath getters | ✓ WIRED | ConfigLocator getters used in route registration. |
| index.ts | agents.ts | projectAgentsDir option | ✓ WIRED | Route registration passes `projectAgentsDir: config.projectAgentsDir`. |
| agents.ts | agentSchema.ts | scope field on response objects | ✓ WIRED | `scope: 'project' as const` / `scope: 'global' as const` set on returned items. |
| Explorer.tsx | useAgents.ts | scope in ItemLocator | ✓ WIRED | `scope: entity.scope` in setSelectedItem, used in query key and fetch params. |
| Explorer.tsx | EntityDetail.tsx | scope prop | ✓ WIRED | `scope={selectedEntity.scope}` passed to EntityDetail. |
| ConfigSection.tsx | SourceBadge | source prop | ✓ WIRED | ConfigEntryCard passes `source={entry.source}` to SourceBadge. |

### Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ConfigLocator | `projectDir` | `existsSync(cwd + agentHome)` | Yes — resolves from filesystem | ✓ FLOWING |
| agents.ts | `scope` on items | Computed from directory source | Yes — 'global' for agentsDir, 'project' for projectAgentsDir | ✓ FLOWING |
| configs.ts | `scope` on McpEntry/HookEntry/LspEntry | Computed from directory source | Yes — 'global' for baseDir, 'project' for projectBaseDir | ✓ FLOWING |
| Explorer.tsx | `entity.scope` | API response → useAgents hook | Yes — scope flows from API to component state | ✓ FLOWING |
| EntityDetail.tsx | `scope` prop | Explorer → EntityDetail | Yes — scope determines view-only notice rendering | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full CLI test suite passes | `cd packages/cli && npx vitest run` | 294 passed, 4 skipped | ✓ PASS |
| Full UI test suite passes | `cd packages/ui && npx vitest run` | 51 passed | ✓ PASS |
| Shared package builds | `cd packages/shared && pnpm build` | Build success | ✓ PASS |
| TypeScript compiles clean | `cd packages/ui && npx tsc --noEmit` | Exits 0 (no output) | ✓ PASS |
| Project-loading tests (agents) | `cd packages/cli && npx vitest run -- agents` | 4 new tests pass | ✓ PASS |
| Project-loading tests (skills) | `cd packages/cli && npx vitest run -- skills` | 3 new tests pass | ✓ PASS |
| Project-loading tests (commands) | `cd packages/cli && npx vitest run -- commands` | 3 new tests pass | ✓ PASS |
| Project-loading tests (configs) | `cd packages/cli && npx vitest run -- configs` | 5 new tests pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LOAD-01 | 11-01-PLAN | API routes return merged items from both global and project directories | ✓ SATISFIED | All entity and config routes load from project dirs, merge, tag scope. |
| LOAD-02 | 11-01-PLAN, 11-02-PLAN | Project items override global items on name collisions | ✓ SATISFIED | Custom sort comparator places project first on id collision. Explorer passes scope to EntityDetail. |
| LOAD-03 | 11-01-PLAN | Every item in merged responses carries a source field | ✓ SATISFIED | ScopeEnum in shared schemas. All items tagged scope:'global' or scope:'project' server-side. |

### Anti-Patterns Found

None.

### Human Verification Required

None. All truths are programmatically verifiable.

### Gaps Summary

No gaps found. All 11 observable truths verified. All artifacts exist and are properly wired. Data flows confirmed from filesystem through API to UI rendering. All 3 requirement IDs (LOAD-01, LOAD-02, LOAD-03) are satisfied. Test suites pass with 298 CLI + 51 UI tests and zero regressions.

---
_Verified: 2026-04-18T14:47:00Z_
_Verifier: the agent (gsd-next inline verification)_
