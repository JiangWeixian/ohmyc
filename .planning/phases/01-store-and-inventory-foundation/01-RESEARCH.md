# Phase 1: Store and Inventory Foundation - Research

**Researched:** 2026-03-29
**Domain:** Local Claude component store, AGENT_HOME inventory inspection, provenance, and source labeling
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Specific Ideas
- The user wants Phase 1 optimized for power-user clarity rather than a heavy management dashboard
- Import provenance should be discoverable but not dominant in the UI
- AGENT_HOME inventory should help users understand what is active and where it came from, without becoming another editing surface

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Richer provenance models beyond import path and import time
- Inline editing of AGENT_HOME local items
- Cross-ecosystem import/conversion behavior
- Profile activation preview and switching safety UX
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STORE-01 | User can import Claude-compatible agents from an existing directory into the local store | Extend `StoreService.import()` and `/api/store/import` with scan/apply conflict flow; keep agent files canonical in `store/agents/` |
| STORE-02 | User can import Claude-compatible skills from an existing directory into the local store | Import logic must recurse/copy full skill directories, not just top-level files; preserve `SKILL.md`-based structure |
| STORE-03 | User can import Claude-compatible commands from an existing directory into the local store | Reuse current command import path under `store/commands/` with preview + overwrite confirmation |
| STORE-04 | User can browse stored components grouped by type | Keep the existing type-separated store routes and `StoreComponentList`; add name search and type-local filtering without changing the route split |
| STORE-05 | User can create, edit, and delete store-managed components from the UI | Continue using per-type CRUD services/routes plus React Query invalidation; do not edit AGENT_HOME directly |
| STORE-06 | User can see where a store component came from when it was imported | Add lightweight provenance metadata keyed by store component with `importPath` and `importedAt`; show it outside the main dense list row |
| INV-01 | User can view current AGENT_HOME components with source labels that distinguish local files, profile-linked items, and plugin-provided items | Preserve route-level `lstat` classification in agents/skills/commands routes; make UI labels explicit for all three sources, including `local` |
| INV-02 | User can inspect installed plugins and Claude-related configuration from the current environment | Reuse existing `/api/plugins`, `/api/marketplaces`, `/api/mcp`, `/api/hooks`, `/api/lsp`; add read-only Explorer sections instead of new editing flows |
</phase_requirements>

## Summary

Phase 1 should be planned as an extension of the code that already exists, not as a new subsystem. The repo already has the right architectural spine: Fastify route plugins for store and AGENT_HOME inventory, per-type file services for Claude-compatible content, React Query hooks for store CRUD, and Vitest coverage around the backend routes and services. The main work is filling the gaps between the current skeleton and the phase requirements: import conflict preview/overwrite, lightweight provenance storage, explicit source labeling in the UI, and read-only inventory views for plugins/configuration.

The biggest implementation constraint is that the local store must remain the canonical writable surface while AGENT_HOME stays inspection-only. That means Phase 1 should not add inline inventory editing, should not mutate imported component files just to store metadata, and should not collapse store and inventory concepts into one list. Current code already separates these concerns cleanly enough to keep going with that model.

The main planning risks are subtle rather than broad: current skill import only copies top-level files, provenance does not exist yet, the Explorer still has placeholder sections for plugins and `CLAUDE.md`, and the settings/plugin ecosystem has a schema mismatch around `enabledPlugins`. Phase planning should explicitly reserve work for these hazards instead of assuming the existing skeleton already satisfies the requirements.

**Primary recommendation:** Build Phase 1 by extending the existing Fastify + per-type service + React Query architecture, add a two-step import flow plus a lightweight store metadata index, and keep AGENT_HOME strictly read-only with clearer source labels and config/plugin inspection.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | repo pin `^4.26.2` | Server routes for store, inventory, plugins, and config inspection | The backend is already organized as Fastify route plugins and tests use `app.inject()` effectively |
| `react` | repo pin `^18.2.0` | Inventory and store UI | The UI is already React-based and Phase 1 does not need a framework migration |
| `@tanstack/react-query` | repo pin `^5.28.4` | Query/mutation caching for store CRUD and inventory fetches | Existing hooks already follow the right invalidation model for per-type lists |
| `zod` | repo pin `^3.23.8` | Shared schemas for agents, skills, commands, profiles, and settings | Shared schema boundaries already exist; Phase 1 should extend them rather than hand-validate JSON |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | repo pin `^2.1.9` | Backend route/service verification | Use for all new store import, provenance, and inventory route coverage |
| `gray-matter` | repo pin `^4.0.3` | Parse and write Claude-compatible frontmatter files | Use through `AgentService`, `SkillService`, and `CommandService`; do not add a parallel parser |
| `lucide-react` | repo pin `^0.363.0` | Small, existing icon set in store/inventory UI | Reuse for Phase 1 UI polish rather than introducing another icon library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `/api/store/import` with preview/apply flags | Separate `/scan` and `/apply` endpoints | Separate endpoints are clearer, but a single route with `dryRun`/`overwrite` keeps the surface smaller and matches the current code shape |
| Store-side provenance index file | Embedding metadata into imported component files | Editing imported Claude assets for app metadata risks polluting canonical content and complicates future adapters |
| Route-level source tagging in each inventory route | A shared generic inventory aggregator | A generic layer is possible later, but Phase 1 is smaller and safer if it preserves the existing per-type route behavior |

**Installation:**
```bash
pnpm install
```

**Version verification:** Current registry versions were verified on 2026-03-29 with `npm view`.

| Package | Repo Pin | Latest Verified | Latest Publish Date |
|---------|----------|-----------------|--------------------|
| `fastify` | `^4.26.2` | `5.8.4` | 2026-03-23 |
| `@tanstack/react-query` | `^5.28.4` | `5.95.2` | 2026-03-23 |
| `react` | `^18.2.0` | `19.2.4` | 2026-03-28 |
| `vitest` | `^2.1.9` | `4.1.2` | 2026-03-26 |
| `zod` | `^3.23.8` | `4.3.6` | 2026-01-25 |
| `@fastify/static` | `^7.0.3` | `9.0.0` | 2026-03-05 |
| `lucide-react` | `^0.363.0` | `1.7.0` | 2026-03-25 |

**Guidance:** Do not turn Phase 1 into a dependency upgrade phase. Use the existing repo versions unless a specific implementation task proves blocked.

## Architecture Patterns

### Recommended Project Structure
```text
packages/cli/src/server/
├── routes/               # Fastify route plugins by domain
├── services/             # File-backed store/profile/plugin logic
└── services/__tests__/   # Route-independent backend behavior tests

packages/ui/src/
├── hooks/                # React Query data hooks per domain
├── components/store/     # Store CRUD, import, provenance, delete safety UI
├── components/           # Shared Explorer/UI primitives
└── Explorer.tsx          # AGENT_HOME read-only inventory shell
```

### Pattern 1: Keep Per-Type File Services as the Canonical Content Boundary
**What:** Keep `AgentService`, `SkillService`, and `CommandService` responsible for Claude-compatible file parsing/writing, and keep `StoreService` focused on cross-cutting concerns like import, provenance, and profile-reference safety.
**When to use:** Any feature that touches store CRUD, import, or provenance.
**Example:**
```typescript
// Source: local code - packages/cli/src/server/routes/store.ts
const agentService = new AgentService(path.join(storeDir, 'agents'))
const skillService = new SkillService(path.join(storeDir, 'skills'))
const commandService = new CommandService(path.join(storeDir, 'commands'))
const storeService = new StoreService(storeDir, profilesDir)
```

### Pattern 2: Use a Two-Step Import Flow
**What:** Treat import as `scan -> confirm -> apply`, with the backend returning collision details before any overwrite happens.
**When to use:** All imports for `STORE-01` to `STORE-03`.
**Example:**
```typescript
// Recommended shape for Phase 1
type StoreImportRequest = {
  sourceDir: string
  dryRun?: boolean
  overwrite?: boolean
}

type StoreImportResult = {
  imported: number
  skipped: number
  overwritten: number
  errors: string[]
  conflicts: Array<{ type: 'agents' | 'skills' | 'commands'; id: string }>
}
```

### Pattern 3: Keep Provenance Out of Imported Claude Files
**What:** Store metadata in a store-managed index under the store root, keyed by component type/id, instead of modifying imported markdown or skill directories.
**When to use:** `STORE-06` and any future adapter/import work.
**Example:**
```json
{
  "agents": {
    "reviewer": {
      "importPath": "/Users/example/.claude/agents/reviewer.md",
      "importedAt": "2026-03-29T10:00:00.000Z"
    }
  },
  "skills": {},
  "commands": {}
}
```

### Pattern 4: Keep Source Classification at the Inventory Route Boundary
**What:** Continue computing `local | profile | plugin` in the backend routes so the UI receives already-labeled entities.
**When to use:** `INV-01` and any AGENT_HOME list/detail view.
**Example:**
```typescript
// Source: local code - packages/cli/src/server/routes/agents.ts
const stats = await lstat(filePath)
(agent as any).source = stats.isSymbolicLink() ? 'profile' : 'local'
```

### Pattern 5: Invalidate Related Queries on Mutation Success
**What:** Keep using React Query `onSuccess` invalidation after store mutations so list views refetch automatically.
**When to use:** Store CRUD and import apply flows.
**Example:**
```typescript
// Source: TanStack Query docs + local hook pattern
const qc = useQueryClient()
return useMutation({
  mutationFn: createStoreItem,
  onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ['store'] })
  },
})
```

### Anti-Patterns to Avoid
- **Do not write to AGENT_HOME from store CRUD:** AGENT_HOME is Phase 1 inventory, not the canonical writable store.
- **Do not build a second frontmatter parser for imports:** Reuse existing services and `gray-matter`.
- **Do not store provenance only in client state:** It must survive reloads and power future adapters.
- **Do not bury `local` source state by omitting its badge:** Phase 1 requires clear source labeling, not just special treatment for profile/plugin items.
- **Do not fold plugin/config inspection into profile-editing UI:** `INV-02` is read-only environment inspection in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude component markdown parsing | Custom YAML/frontmatter parsing | `AgentService`, `SkillService`, `CommandService` with `gray-matter` | The repo already normalizes names/content differently for each component type |
| Route integration harness | Ad-hoc HTTP server tests | Fastify `app.inject()` with Vitest | Current tests are fast, isolated, and already verified in this repo |
| Client-side mutation synchronization | Manual refetch chains | React Query invalidation | The hooks layer is already structured around query keys and invalidation |
| Plugin inventory scanning in the UI | Browser-side filesystem assumptions | Existing `/api/plugins`, `/api/marketplaces`, `/api/mcp`, `/api/hooks`, `/api/lsp` routes | The backend already knows AGENT_HOME layout and enabled plugin state |
| Provenance persistence | Hidden metadata in markdown comments or mutated frontmatter | Store-managed metadata index | Keeps imported Claude files canonical and future adapter-friendly |

**Key insight:** Most of the required complexity already exists in narrow, reusable backend boundaries. Phase 1 should concentrate new logic in `StoreService`, store routes, Explorer/store UI components, and shared metadata/schema edges instead of inventing new subsystems.

## Common Pitfalls

### Pitfall 1: Skill Import Is Not Recursive Today
**What goes wrong:** Current `StoreService.import()` copies top-level files inside a skill directory with `copyFile`, which breaks if a skill contains nested folders or non-file assets.
**Why it happens:** The current implementation assumes skills are flat directories.
**How to avoid:** Plan a recursive copy strategy for skill directories and add a service-level test that imports nested content.
**Warning signs:** `EISDIR`/copy failures, imported skill missing supporting files, import succeeds for `SKILL.md` but runtime behavior is incomplete.

### Pitfall 2: Current Import Only Skips, It Does Not Support Confirmed Overwrite
**What goes wrong:** The existing `/api/store/import` path silently counts collisions as skipped, which does not satisfy the locked decision for explicit confirmation and overwrite-all.
**Why it happens:** The API only accepts `{ sourceDir }` and returns aggregate counters.
**How to avoid:** Add a dry-run/preview response with typed conflicts and a second confirmed apply call.
**Warning signs:** UI can only say "skipped", backend cannot name conflicts, overwrite requires hacks or repeated client-side diffing.

### Pitfall 3: Provenance Does Not Exist Yet
**What goes wrong:** Imported components are copied into the store with no persistent record of where they came from or when they were imported.
**Why it happens:** Current services treat imported content the same as authored content.
**How to avoid:** Introduce a dedicated metadata store keyed by type/id, update it during import/apply, and read it in store detail/list UI.
**Warning signs:** After refresh, provenance disappears; overwrite loses history; UI has no trustworthy import source to show.

### Pitfall 4: Source Labels Are Incomplete in the UI
**What goes wrong:** Backend routes already classify `local`, `profile`, and `plugin`, but `SourceBadge` currently renders badges only for `profile` and `plugin`.
**Why it happens:** The UI component optimized for minimal styling, not explicit completeness.
**How to avoid:** Add an explicit `local` treatment and keep tooltip/badge text stable across agents, skills, and commands.
**Warning signs:** Unbadged rows are ambiguous, users infer "no badge" means error/unknown, inventory clarity goal is not met.

### Pitfall 5: `enabledPlugins` Shape Is Inconsistent Across the Codebase
**What goes wrong:** Plugin services/profile activation read and write top-level `enabledPlugins: Record<string, boolean>`, while `SettingsJsonSchema` currently models `plugins.enabledPlugins` as `string[]`.
**Why it happens:** Two different settings models coexist.
**How to avoid:** Treat this as a deliberate boundary decision during planning: either normalize AGENT_HOME settings separately from project settings, or postpone schema unification but do not ignore the mismatch.
**Warning signs:** Validation rejects real AGENT_HOME data, plugin-enabled state renders incorrectly, future activation work breaks schema assumptions.

### Pitfall 6: Explorer Has Placeholder Sections for Phase 1 Inventory
**What goes wrong:** `plugins` and `claude-md` sections are still placeholders, so `INV-02` is not satisfied even though backend routes exist for much of the data.
**Why it happens:** The shell was scaffolded before the inventory details were implemented.
**How to avoid:** Plan explicit tasks for read-only plugin/config cards and decide whether `CLAUDE.md` belongs in Phase 1 or should be removed from the sidebar until supported.
**Warning signs:** Inventory nav exposes dead ends, backend coverage exists but user-visible inspection does not.

## Code Examples

Verified patterns from current repo and official sources:

### Fastify Route Test Pattern
```typescript
// Source: https://fastify.dev/docs/v5.7.x/Guides/Testing/
const app = Fastify()
await app.register(storeRoutes, { baseDir: tmpDir })
await app.ready()

const res = await app.inject({ method: 'GET', url: '/api/store/agents' })
expect(res.statusCode).toBe(200)
```

### Store Mutation Invalidation Pattern
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
export function useDeleteStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/agents/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}
```

### Route-Level Source Classification Pattern
```typescript
// Source: local code - packages/cli/src/server/routes/skills.ts
const dirPath = path.join(options.skillsDir, skill.dirName)
const stats = await lstat(dirPath)
(skill as any).source = stats.isSymbolicLink() ? 'profile' : 'local'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat AGENT_HOME files as the writable source of truth | Keep `store/` canonical and AGENT_HOME read-only/derived | Captured in profiler design on 2026-03-25 | Phase 1 should not add inventory editing flows |
| Blind import with skip-only collisions | Preview conflicts, then confirmed overwrite/apply | Required by Phase 1 context on 2026-03-29 | Import needs a planning-first UX/API instead of a one-shot copy |
| UI-only browsing of inventory categories | Backend-enriched entities with `source` and `pluginId` | Already in current routes | Keep source labeling authoritative on the server side |
| Generic "settings editor" thinking | Targeted environment inspection for plugins/hooks/MCP/LSP | Current Phase 1 scope | Inventory should expose current environment, not become a second settings authoring surface |

**Deprecated/outdated:**
- Skip-only import behavior as the final Phase 1 design: it no longer matches the locked overwrite-confirmation decision.
- Implicit "no badge means local" UI: it is too ambiguous for the clarity target of this phase.

## Open Questions

1. **Where should store provenance metadata live?**
   - What we know: Phase 1 only needs `importPath` and `importedAt`, and provenance should stay lightweight.
   - What's unclear: Whether to use one root metadata index or per-component sidecar files.
   - Recommendation: Use one store-root metadata index in Phase 1. It keeps reads simple, avoids touching imported assets, and leaves room for adapter metadata later.

2. **Should `CLAUDE.md` inspection be in Phase 1 or removed from the Explorer until supported?**
   - What we know: The Explorer sidebar already exposes a `claude-md` section, but there is no implemented route or UI.
   - What's unclear: Whether the product requirement for "Claude-related configuration" includes `CLAUDE.md` or only plugins/settings/hooks/MCP/LSP.
   - Recommendation: Decide this during planning. If included, add a read-only endpoint and renderer. If excluded, hide the section in Phase 1 to avoid a dead-end UI.

3. **How should the `enabledPlugins` settings mismatch be contained in Phase 1?**
   - What we know: AGENT_HOME plugin logic uses a top-level object map; shared settings schema models a different nested shape.
   - What's unclear: Whether schema unification belongs in this phase or should be deferred.
   - Recommendation: Do not broaden Phase 1 into a full settings-model refactor. Normalize at the AGENT_HOME boundary or document the mismatch explicitly in tasks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `2.1.9` |
| Config file | `packages/cli/vitest.config.ts` |
| Quick run command | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/store.test.ts src/server/routes/__tests__/agents.test.ts src/server/routes/__tests__/skills.test.ts src/server/routes/__tests__/commands.test.ts src/server/routes/__tests__/plugins.test.ts src/server/routes/__tests__/configs.test.ts src/server/services/__tests__/storeService.test.ts` |
| Full suite command | `pnpm --filter @claudeui/cli test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-01 | Import agents into store from external directory | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ |
| STORE-02 | Import skills into store from external directory | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ |
| STORE-03 | Import commands into store from external directory | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ |
| STORE-04 | Browse store components grouped by type with search/filter | UI component | `pnpm --filter @claudeui/ui test -- StoreComponentList` | ❌ Wave 0 |
| STORE-05 | Create/edit/delete store-managed components from UI | backend + UI | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/store.test.ts` | ✅ backend / ❌ UI |
| STORE-06 | Show import path/time for imported store component | service + route + UI | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ❌ provenance cases |
| INV-01 | Show AGENT_HOME source labels for local/profile/plugin items | route + UI | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/agents.test.ts src/server/routes/__tests__/skills.test.ts src/server/routes/__tests__/commands.test.ts` | ✅ backend / ❌ UI |
| INV-02 | Inspect installed plugins and Claude-related configuration | route + UI | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/plugins.test.ts src/server/routes/__tests__/configs.test.ts` | ✅ backend / ❌ UI |

### Sampling Rate
- **Per task commit:** `pnpm --filter @claudeui/cli test -- <targeted test files>`
- **Per wave merge:** `pnpm --filter @claudeui/cli test`
- **Phase gate:** Full CLI suite green plus manual verification of store/inventory UI states before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` — covers STORE-04 search/type filtering and STORE-06 provenance surfacing
- [ ] `packages/ui/src/components/store/__tests__/StoreComponentEditor.test.tsx` — covers STORE-05 create/edit/delete UI flows
- [ ] `packages/ui/src/components/__tests__/SourceBadge.test.tsx` — covers INV-01 explicit `local/profile/plugin` rendering
- [ ] `packages/ui/src/__tests__/Explorer.inventory.test.tsx` — covers INV-02 plugin/config rendering and placeholder removal
- [ ] UI test runner/config in `packages/ui` — no UI test infrastructure is currently present

## Sources

### Primary (HIGH confidence)
- Local code: `packages/cli/src/server/services/storeService.ts`, `packages/cli/src/server/routes/store.ts`, `packages/cli/src/server/routes/agents.ts`, `packages/cli/src/server/routes/skills.ts`, `packages/cli/src/server/routes/commands.ts`, `packages/cli/src/server/routes/plugins.ts`, `packages/cli/src/server/routes/configs.ts`, `packages/ui/src/components/store/StoreComponentList.tsx`, `packages/ui/src/Explorer.tsx`
- Local tests: `packages/cli/src/server/services/__tests__/storeService.test.ts`, `packages/cli/src/server/routes/__tests__/store.test.ts`, `packages/cli/src/server/routes/__tests__/agents.test.ts`, `packages/cli/src/server/routes/__tests__/skills.test.ts`, `packages/cli/src/server/routes/__tests__/commands.test.ts`, `packages/cli/src/server/routes/__tests__/plugins.test.ts`, `packages/cli/src/server/routes/__tests__/configs.test.ts`
- Product spec: `docs/superpowers/specs/2026-03-25-profiler-design.md`
- Fastify testing guide: https://fastify.dev/docs/v5.7.x/Guides/Testing/
- TanStack Query invalidation guide: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

### Secondary (MEDIUM confidence)
- Fastify principles/reference discovery: https://fastify.dev/docs/v5.1.x/Reference/Principles/
- Vitest environment docs: https://vitest.dev/guide/environment.html
- npm registry verification via terminal `npm view` on 2026-03-29 for `fastify`, `@tanstack/react-query`, `react`, `vitest`, `zod`, `@fastify/static`, and `lucide-react`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing repo stack is explicit and current package versions were verified from the registry
- Architecture: MEDIUM - Local code strongly supports the direction, but provenance storage shape and `CLAUDE.md` scope still need a planning decision
- Pitfalls: HIGH - Each major pitfall is directly visible in current code or current UI/backend gaps

**Research date:** 2026-03-29
**Valid until:** 2026-04-28
