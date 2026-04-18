# Phase 02: Profile Composition - Research

**Researched:** 2026-04-01
**Domain:** Profile composition, activation-ready profile inspection, active-state semantics, and Claude-compatible profile activation in a brownfield TypeScript monorepo
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Profile detail layout
- Profile detail should use a two-column structure rather than a single summary card
- The left side should focus on profile summary and primary actions
- The right side should be split into two major sections:
  - `Components`: `Agents`, `Skills`, `Commands`, `Plugins`
  - `Runtime config`: `Hooks`, `MCP`, `LSP`, `Settings`
- The detail view must optimize for pre-activation scanability, not just counts

#### Profile editing structure
- The editor should remain a single-page flow rather than tabs or a stepper
- The editor should be organized into three sections:
  - `Basics`
  - `Selections`
  - `Runtime config`
- `Selections` should include both store components and plugins
- The phase should improve clarity of the existing editor structure without expanding into a new multi-step workflow

#### Active profile semantics
- The API should expose a stable active profile name rather than forcing the UI to infer activeness from a filesystem path
- Active state should be expressed consistently in the profile list, profile detail, and activation feedback surfaces
- The primary active indicator should be the profile name, not a path
- Filesystem path details may exist as secondary technical information, but they are not the main UX surface for activeness in Phase 2

#### Pre-activation visibility
- Before activation, profile detail should show both included components and a runtime configuration summary
- Runtime configuration summary should surface key names rather than only counts or full raw JSON
- The summary should make it clear which hooks, MCP servers, LSP servers, and settings top-level keys will be involved
- This phase should not expand into a full diff preview system; it is a readability layer for activation readiness, not a change comparison engine

#### Claude's Discretion
- Exact visual hierarchy inside the two-column detail layout
- Exact component treatment for runtime config summaries, as long as they stay key-name level and scan-friendly
- Exact microcopy for empty states and helper text inside profile editing sections
- Exact placement of secondary technical metadata such as generated profile path, if shown at all

### Deferred Ideas (OUT OF SCOPE)
- Full activation diff preview and profile-vs-profile comparison remain v2 preview work, not Phase 2 scope
- Activation rollback, partial-failure handling, and stronger switching safety remain Phase 3 concerns
- Broader cross-agent profile abstractions remain outside scope; Phase 2 should stay Claude-first
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | User can create a named profile from store-managed agents, skills, commands, and plugins | Reuse existing `ProfileSchema`, `ProfileService.create/update`, `ComponentPicker`, and `PluginPicker`; plan should focus on editor restructuring into `Basics`/`Selections`/`Runtime config` sections, not new persistence primitives |
| PROF-02 | User can edit a profile's description, component selections, settings overlay, hooks, MCP servers, and LSP servers | Existing profile model and CRUD already support all fields; plan should reorganize the single-page editor into the mandated three sections with section headings and helper text |
| PROF-03 | User can see which components are included in a profile before activation | Detail view must evolve from count cards to explicit component name lists plus runtime key-name summaries derived from the persisted profile object |
| PROF-04 | User can see which profile is currently active | Change backend list contract to expose active profile name (not path); remove UI `active?.includes(profile.name)` inference; drive list/detail/toast state from the normalized name |
| ACT-01 | User can activate a profile and have Claude-compatible profile files generated in the expected directory structure | Existing `ProfileService.activate()` already generates `.claude-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, and settings overlay output; plan should preserve this flow and verify artifact structure end to end |
| ACT-02 | User can activate a profile and have referenced store components linked into the profile through filesystem links compatible with the current platform | Existing activation path already creates symlinks for agents (file), skills (directory), and commands (file); plan should preserve this and verify link targets and warning behavior end to end |
</phase_requirements>

## Summary

Phase 02 should be planned as a brownfield composition pass over existing working code, not a new subsystem. The repo already has the core data model (`ProfileSchema` in `@claudeui/shared`), full API endpoints (Fastify routes in `packages/cli`), activation flow with symlink generation and settings merge (`ProfileService`), and major profile UI surfaces (`ProfileCard`, `ProfileEditor`, `ComponentPicker`, `PluginPicker`, `ProfilesSidebar`, `ProfilesView`). React Query hooks already handle CRUD mutations and cache invalidation correctly. The missing work is contract normalization and UX restructuring.

The largest backend gap is active-state semantics. Today `ProfileService.list()` reads `profiles/.active` (an absolute path) and returns it verbatim as the `active` field. The UI compensates with brittle `active?.includes(profile.name)` checks in both `ProfilesView` and `ProfilesSidebar`. This violates the locked decision that active state should be a stable profile name. The planner should normalize at the service boundary by extracting `path.basename()` from the stored path, then propagate the simpler contract through all consumer surfaces.

The largest frontend gap is readability. `ProfileEditor` already edits every required field, but the current screen is a flat sequence of cards and raw JSON editors with no section grouping. `ProfileCard` shows counts and raw settings JSON, not enumerated components or key-name summaries. Phase 02 should reorganize the editor into `Basics`, `Selections`, and `Runtime config` sections, and replace the detail card with a two-column activation-readiness view that enumerates selected components and summarizes runtime config by top-level keys rather than raw payloads.

Activation behavior (`ACT-01`, `ACT-02`) is already fully implemented and tested. The planner should preserve it intact and add end-to-end verification around generated artifacts and symlink targets, not modify the activation flow itself.

**Primary recommendation:** Keep the current stack and profile model unchanged. Normalize `active` to the profile name in the backend. Restructure the editor and detail views to match the locked UX decisions. Verify activation artifacts and link behavior end to end.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | `^18.2.0` in repo | UI composition | Existing UI is already React-based; Phase 2 is a view restructuring task |
| `react-router-dom` | `^6.22.3` in repo; latest `7.13.2` published 2026-03-18 | Route-driven profile and store selection | Current `ProfilesView` uses route parsing for `/profiles/*`; preserve route-driven surface selection |
| `@tanstack/react-query` | `^5.28.4` in repo; latest `5.96.1` published 2026-04-01 | Profile/store/plugin data fetching and mutation invalidation | Existing hooks already use query invalidation correctly; Phase 2 should extend that pattern |
| Fastify | `^4.26.2` in repo; latest `5.8.4` published 2026-03-23 | API routes for profiles and store | Existing server routes are Fastify plugins; contract changes belong here |
| Zod | repo uses v3 API surface; package latest `4.3.6` published 2026-01-22 | Shared profile schema and request validation | Shared schema is the source of truth for profile payloads; continue deriving contracts from it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | `^12.38.0` in repo | Existing transitions for profile surfaces | Reuse current transition vocabulary only where it already exists; do not widen scope into animation work |
| Lucide React | `^0.363.0` in repo; latest `1.7.0` | Existing icon system | Reuse for component/runtime summary sections |
| CodeMirror 6 | `^6.0.2` in repo (`codemirror` + plugins) | JSON editor for runtime config fields | Existing `JsonEditor` component wraps CodeMirror; reuse as-is for runtime config editing |
| Vitest | `^2.1.9` in repo; latest `4.1.2` published 2026-03-26 | CLI and UI automated tests | Use existing node/jsdom split rather than adding another test runner |
| Testing Library | `@testing-library/react` `^16.3.0` in repo | UI behavior verification | Standard for route-driven rendering and interaction tests in `packages/ui` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing React Query hooks + route-driven state | New local state store | Adds duplication and drift for no Phase 2 benefit |
| Existing shared `Profile` DTO | Activation-specific DTO/view model | Increases mapping code and risks divergence from persisted data |
| Existing JSON editors for runtime config | Schema-specific form builders | Too much scope for a readability-focused phase; defer unless runtime config editing becomes a bottleneck |

**Installation:**
```bash
pnpm install
```

**Version verification:** Current registry versions verified on 2026-04-01 with `npm view <package> version`.

| Package | Repo Pin | Latest Verified | Notes |
|---------|----------|-----------------|-------|
| `@tanstack/react-query` | `^5.28.4` | `5.96.1` | No breaking changes in 5.x range |
| `fastify` | `^4.26.2` | `5.8.4` | Do not upgrade during Phase 2 |
| `zod` | v3 API | `4.3.6` | Repo uses v3 syntax; do not upgrade |
| `react-router-dom` | `^6.22.3` | `7.13.2` | Do not upgrade during Phase 2 |
| `vitest` | `^2.1.9` | `4.1.2` | Do not upgrade during Phase 2 |
| `framer-motion` | `^12.38.0` | `12.38.0` | Already at latest |
| `lucide-react` | `^0.363.0` | `1.7.0` | API-compatible; do not upgrade during Phase 2 |

**Guidance:** Do not turn Phase 2 into a dependency upgrade phase. Use existing repo versions unless a specific implementation task proves blocked.

## Architecture Patterns

### Recommended Project Structure
```text
packages/shared/src/
  profileSchema.ts            # Persisted profile contract and request schemas

packages/cli/src/server/
  services/profileService.ts  # Profile persistence + activation behavior
  routes/profiles.ts          # API contract normalization for active state and CRUD

packages/ui/src/
  hooks/useProfiles.ts        # React Query contract boundary
  ProfilesView.tsx            # Route-driven profile/store shell
  components/profiles/
    ProfilesSidebar.tsx        # Active-state presentation in list
    ProfileEditor.tsx          # Single-page create/edit flow (3 sections)
    ProfileCard.tsx            # Two-column detail view (replace current implementation)
    ComponentPicker.tsx        # Reusable selection UI for store assets
    PluginPicker.tsx           # Reusable selection UI for installed plugins
```

### Pattern 1: Normalize active profile semantics at the server boundary
**What:** Convert `.active` file contents (an absolute path) into an API-friendly active profile name before returning list responses.
**When to use:** For all list/detail/sidebar/activation feedback surfaces.
**Example:**
```typescript
// Source: local code pattern in packages/cli/src/server/services/profileService.ts
async list(): Promise<{ profiles: Profile[]; active: string | null }> {
  // Currently reads raw path from profiles/.active
  // Phase 2 should normalize:
  const activeName = activePathValue ? path.basename(activePathValue) : null;
  return { profiles, active: activeName };
}
```

### Pattern 2: Treat the persisted `Profile` object as the single source of truth for pre-activation visibility
**What:** Build detail summaries directly from the stored profile fields, not from generated files or filesystem inspection.
**When to use:** Profile detail, active badges, and activation-readiness summaries.
**Example:**
```typescript
// Source: local code pattern in packages/shared/src/profileSchema.ts
// Profile shape: { name, description, agents[], skills[], commands[], plugins[],
//                 hooks?, mcpServers?, lspServers?, settings? }

// Derived summary for detail view:
const runtimeSummary = {
  hooks: profile.hooks ? Object.keys(profile.hooks) : [],
  mcpServers: profile.mcpServers ? Object.keys(profile.mcpServers) : [],
  lspServers: profile.lspServers ? Object.keys(profile.lspServers) : [],
  settings: profile.settings ? Object.keys(profile.settings) : [],
};
```

### Pattern 3: Keep the editor single-page, but group fields by intent
**What:** Reorganize the existing form into `Basics`, `Selections`, and `Runtime config` sections without changing the underlying mutations or data model.
**When to use:** Create and edit flows for the Phase 2 UI.
**Example:**
```tsx
// Source: local code pattern in packages/ui/src/components/profiles/ProfileEditor.tsx
// Current: flat sequence of cards
// Phase 2: three sections with headings and helper text
<>
  <Section heading="Basics" helper="Name and description for this profile">
    {/* name + description inputs */}
  </Section>
  <Section heading="Selections" helper="Choose store components and plugins to include">
    {/* ComponentPicker x3 + PluginPicker */}
  </Section>
  <Section heading="Runtime config" helper="Hooks, MCP servers, LSP servers, and settings overlay">
    {/* JsonEditor x4 with labeled blocks */}
  </Section>
</>
```

### Pattern 4: Keep React Query invalidation as the mutation sync mechanism
**What:** Invalidate `['profiles']` after create/update/delete/activate/deactivate and let queries refetch authoritative state.
**When to use:** Every profile mutation hook.
**Example:**
```typescript
// Source: packages/ui/src/hooks/useProfiles.ts
export function useActivateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}
```

### Pattern 5: Preserve activation flow integrity
**What:** Do not modify `ProfileService.activate()` internals during Phase 2. The method already correctly handles deactivate-previous, symlink creation, plugin file generation, settings backup/merge, and `.active` writing. Phase 2 should only normalize what the `list()` method returns, not change how activation works.
**When to use:** Any task that touches `profileService.ts`.

### Anti-Patterns to Avoid
- **UI inference from filesystem paths:** `active?.includes(profile.name)` is brittle and violates locked semantics; must be replaced with exact-name comparison.
- **Filesystem-derived detail rendering:** Do not inspect generated runtime files to render the profile detail page; use persisted profile data.
- **A second profile DTO for the UI:** Phase 2 does not need a separate "preview" model; use the existing `Profile` type.
- **Editor workflow expansion:** Do not turn this into tabs, steppers, or a preview-diff workflow.
- **Raw JSON dumps as primary detail UI:** The user asked for scanable key-name summaries, not activation diffs or full payload blocks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side server state sync | Custom global store for profiles/plugins/store items | Existing React Query hooks | Query invalidation and route-driven reads already cover this cleanly |
| Profile contract parsing | Ad hoc runtime shape checks | Shared Zod schemas in `packages/shared` | Prevents frontend/backend drift |
| Component selection controls | New bespoke pickers per type | `ComponentPicker` and `PluginPicker` | Existing controls already match the current data sources |
| Activation-time visibility | Custom preview filesystem scanner | Persisted profile object summaries | Generated files are downstream artifacts and can drift from what the user expects to edit |
| Settings overlay merge | New merge implementation in UI | Existing server-side `deepMerge` activation path | Merge semantics belong at activation time on the backend |
| JSON editing for runtime fields | New textarea or custom form fields | Existing `JsonEditor` with CodeMirror | Already themed, validated, and wired into the editor form |

**Key insight:** Phase 2 does not need new primitives. The repo already has the hard parts: persistence, activation, symlink generation, request validation, and query invalidation. Planning should target contract cleanup and view composition.

## Common Pitfalls

### Pitfall 1: Returning the raw `.active` path from the API
**What goes wrong:** Every UI surface must infer activeness by substring matching (`active?.includes(profile.name)`), and profile names become coupled to filesystem details.
**Why it happens:** `ProfileService.list()` currently reads `.active` and returns the absolute path verbatim.
**How to avoid:** Normalize the active profile to a stable name using `path.basename()` in `ProfileService.list()`. Update the response field so consumers compare by exact name equality.
**Warning signs:** `includes(profile.name)` checks in the UI, active-state bugs after renamed directories, or path text leaking into UX copy.

### Pitfall 2: Building detail UI from counts only
**What goes wrong:** The user still cannot inspect what a profile contains before activation.
**Why it happens:** `ProfileCard` currently emphasizes counts (grid of 4 stat cards) and only dumps raw settings JSON.
**How to avoid:** Enumerate selected component names and summarize runtime config by top-level keys. Replace the count-first grid with a two-column layout showing explicit items.
**Warning signs:** Detail UI still answers "how many?" better than "which ones?".

### Pitfall 3: Treating runtime config as four unrelated raw JSON fields
**What goes wrong:** The editor technically supports all fields but remains hard to scan and easy to misconfigure.
**Why it happens:** `ProfileEditor` currently renders four flat `JsonEditor` blocks after the selection cards, with no section grouping.
**How to avoid:** Group the runtime editors under one `Runtime config` section with explicit helper text and section-level hierarchy.
**Warning signs:** Users must scroll through unlabeled JSON blocks to understand what will activate.

### Pitfall 4: Adding a preview/diff system by accident
**What goes wrong:** Scope expands into v2 preview work and Phase 3 safety work.
**Why it happens:** Runtime config visibility and activation behavior can tempt the planner into full comparisons or rollback design.
**How to avoid:** Keep Phase 2 summaries to included names and top-level keys only. No diffs, no comparisons, no rollback.
**Warning signs:** Tasks mention profile-vs-profile compare, settings diffs, or rollback semantics.

### Pitfall 5: Breaking existing activation behavior while polishing semantics
**What goes wrong:** UX improves but `ACT-01` and `ACT-02` regress.
**Why it happens:** Activation currently spans symlink creation, generated plugin files, settings backup/merge, and `.active` writes in one method. Changing one part risks breaking another.
**How to avoid:** Keep activation logic intact unless a requirement forces a change, and add end-to-end assertions around generated files and symlink targets.
**Warning signs:** Tests only assert HTTP success, not file outputs.

### Pitfall 6: Active state mismatch between sidebar and detail after activation
**What goes wrong:** User activates a profile in the detail view, the sidebar shows the old active state, or the toast names the wrong profile.
**Why it happens:** If active-name normalization is done in only one place (e.g., only the hook response type), other surfaces may still parse the old path format.
**How to avoid:** Normalize once at the backend boundary, then trust the React Query refetch to propagate the new name to all surfaces simultaneously.
**Warning signs:** After activation, the star badge appears on the wrong sidebar row, or the toast says a path instead of a name.

## Code Examples

Verified patterns from local implementation and official docs:

### Current active-state inference that must be replaced
```typescript
// Source: packages/ui/src/ProfilesView.tsx line 149
// WRONG: substring matching on filesystem path
isActive={active?.includes(selectedProfile.name) ?? false}

// Source: packages/ui/src/components/profiles/ProfilesSidebar.tsx line 41
// WRONG: same pattern in sidebar
const isActive = active?.includes(p.name);

// CORRECT after normalization: exact name equality
isActive={active === selectedProfile.name}
```

### Mutation invalidation after profile changes
```typescript
// Source: packages/ui/src/hooks/useProfiles.ts
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateProfileBody }) =>
      updateProfile(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}
```

### Activation generates derived runtime artifacts from persisted profile data
```typescript
// Source: packages/cli/src/server/services/profileService.ts
// Already implemented - preserve this flow
if (profile.hooks) {
  const hooksDir = path.join(dir, 'hooks');
  await mkdir(hooksDir, { recursive: true });
  await writeFile(
    path.join(hooksDir, 'hooks.json'),
    JSON.stringify({ hooks: profile.hooks }, null, 2),
    'utf-8',
  );
}
```

### Existing render helper for route + query driven UI tests
```tsx
// Source: packages/ui/src/test/renderWithProviders.tsx
renderWithProviders(
  <Routes>
    <Route path="/profiles/*" element={<ProfilesView />} />
  </Routes>,
  { route: '/profiles/daily' },
);
```

### Profile data model (from shared schema)
```typescript
// Source: packages/shared/src/profileSchema.ts
export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Infer active profile from filesystem path in the UI | Expose stable active profile name from the API | Needed now for Phase 2 | Simplifies list/detail rendering and removes filesystem leakage from UX |
| Summary cards with counts only | Enumerated component lists plus runtime key summaries | Needed now for Phase 2 | Satisfies pre-activation visibility without building full diff tooling |
| Flat single-column editor with repeated cards | Single-page editor grouped by `Basics`, `Selections`, `Runtime config` | Needed now for Phase 2 | Improves scanability without changing workflow complexity |
| `Star` icon as sole active indicator | `Active` text badge plus consistent name-based state | Needed now for Phase 2 | Per UI-SPEC: "Use a text badge labeled Active next to the profile name" |

**Deprecated/outdated:**
- Path-based active-state checks (`active?.includes(profile.name)`): replace with name-based exact equality.
- Raw JSON as primary detail treatment: keep JSON editors for editing, but use key summaries for detail readability.
- Star icon as sole active indicator: per UI-SPEC, replace with text badge `Active`.

## Open Questions

1. **Should the list response rename `active` to `activeProfileName`?**
   - What we know: returning a raw path is wrong for Phase 2.
   - What's unclear: whether the planner wants a breaking response rename or a value-only normalization.
   - Recommendation: normalize the value first (from path to name); rename the field only if it improves clarity without creating unnecessary churn. The UI only needs to change its comparison logic.

2. **Should profile detail show generated profile path at all?**
   - What we know: the user allows it only as secondary metadata, and the UI-SPEC says "render it as muted secondary metadata under the summary rail, never as the primary active-state signal."
   - What's unclear: whether that metadata is helpful enough in Phase 2 to justify visual space.
   - Recommendation: keep it secondary and subdued, or omit it entirely in Phase 2.

3. **Should runtime config summaries show only top-level keys or shallow metadata counts too?**
   - What we know: top-level keys are required; full raw JSON is not; the UI-SPEC says "compact chips or stacked key rows with monospace only for the key name itself."
   - What's unclear: whether counts per section help scanability or clutter it.
   - Recommendation: show key chips/list items first; add counts only as secondary badges per the UI-SPEC guidance.

4. **Should the existing test at line 36-41 of `profileService.test.ts` be updated to assert name instead of path?**
   - What we know: the current test asserts `active.toContain('test')` which passes for both path and name.
   - What's unclear: whether the planner wants a strict equality assertion or is fine with the looser check during normalization.
   - Recommendation: update the test to assert strict equality (`toBe('test')`) after normalizing, to lock in the new contract.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` in repo |
| Config file | `packages/ui/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| Quick run command | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` |
| Full suite command | `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Create named profiles from store agents/skills/commands/plugins | unit + route | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` | Yes |
| PROF-02 | Edit description, selections, and runtime config | UI component + route | `pnpm --filter @claudeui/ui test -- ProfileEditor.test.tsx ProfilesView.test.tsx` | No - Wave 0 |
| PROF-03 | Inspect included components before activation | UI detail | `pnpm --filter @claudeui/ui test -- ProfileCard.test.tsx ProfilesView.test.tsx` | No - Wave 0 |
| PROF-04 | Show active profile consistently by name | unit + route + UI | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts && pnpm --filter @claudeui/ui test -- ProfilesView.test.tsx` | Partial |
| ACT-01 | Activation generates Claude-compatible files | service + route smoke | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` | Yes |
| ACT-02 | Activation creates profile symlinks to store items | service | `pnpm --filter @claudeui/cli test -- profileService.test.ts` | Yes |

### Sampling Rate
- **Per task commit:** `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` or `pnpm --filter @claudeui/ui test -- ProfilesView.test.tsx`
- **Per wave merge:** `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/ui/src/components/profiles/__tests__/ProfileEditor.test.tsx` -- covers section grouping, save payloads, and JSON validation paths for PROF-01/PROF-02
- [ ] `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` -- covers explicit component/runtime summaries for PROF-03/PROF-04
- [ ] Extend `packages/ui/src/__tests__/ProfilesView.test.tsx` -- cover `/profiles/:name`, active badge rendering, and activation/deactivation feedback
- [ ] Update `packages/cli/src/server/services/__tests__/profileService.test.ts` -- assert normalized active profile name instead of raw path semantics
- [ ] Update `packages/cli/src/server/routes/__tests__/profiles.test.ts` -- assert active-name API contract and activation warning passthrough

## Sources

### Primary (HIGH confidence)
- Local code: `packages/cli/src/server/services/profileService.ts`, `packages/cli/src/server/routes/profiles.ts`, `packages/shared/src/profileSchema.ts`, `packages/ui/src/ProfilesView.tsx`, `packages/ui/src/components/profiles/ProfileEditor.tsx`, `packages/ui/src/components/profiles/ProfileCard.tsx`, `packages/ui/src/components/profiles/ProfilesSidebar.tsx`, `packages/ui/src/components/profiles/ComponentPicker.tsx`, `packages/ui/src/components/profiles/PluginPicker.tsx`, `packages/ui/src/components/JsonEditor.tsx`, `packages/ui/src/hooks/useProfiles.ts`
- Local tests: `packages/cli/src/server/services/__tests__/profileService.test.ts`, `packages/cli/src/server/routes/__tests__/profiles.test.ts`
- Local planning: `02-CONTEXT.md`, `02-UI-SPEC.md`, `02-VALIDATION.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`
- Product spec: `docs/superpowers/specs/2026-03-25-profiler-design.md`
- Phase 1 context: `.planning/phases/01-store-and-inventory-foundation/01-CONTEXT.md`, `.planning/phases/01-store-and-inventory-foundation/01-VERIFICATION.md`

### Secondary (MEDIUM confidence)
- npm registry package metadata verified via `npm view` on 2026-04-01: `@tanstack/react-query` 5.96.1, `fastify` 5.8.4, `zod` 4.3.6, `react-router-dom` 7.13.2, `vitest` 4.1.2, `framer-motion` 12.38.0
- TanStack Query invalidation docs: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Linear UI skill: `.claude/skills/linear-ui-skills/SKILL.md`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing repo stack is explicit in package manifests and sufficient for the phase; registry versions were verified on 2026-04-01
- Architecture: HIGH - The current codebase already demonstrates the relevant service, route, React Query, and component boundaries; code was re-read and patterns verified during this research pass
- Pitfalls: HIGH - The largest risks are directly visible in current code, especially path-based active semantics in `ProfilesView.tsx:149` and `ProfilesSidebar.tsx:41`, count-heavy detail rendering in `ProfileCard.tsx`, and flat editor structure in `ProfileEditor.tsx`

**Research date:** 2026-04-01
**Valid until:** 2026-05-01
