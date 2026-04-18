# Phase 2: Profile Composition - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users compose reusable Claude profiles from store-managed components and inspect what each profile contains before activation. This phase covers profile creation/editing, profile detail readability, active-state presentation, and activation-ready visibility of included components plus runtime artifacts. It does not add full activation safety, rollback, or preview diff workflows beyond what is needed to understand a profile before activation.

</domain>

<decisions>
## Implementation Decisions

### Profile detail layout
- Profile detail should use a two-column structure rather than a single summary card
- The left side should focus on profile summary and primary actions
- The right side should be split into two major sections:
  - `Components`: `Agents`, `Skills`, `Commands`, `Plugins`
  - `Runtime config`: `Hooks`, `MCP`, `LSP`, `Settings`
- The detail view must optimize for pre-activation scanability, not just counts

### Profile editing structure
- The editor should remain a single-page flow rather than tabs or a stepper
- The editor should be organized into three sections:
  - `Basics`
  - `Selections`
  - `Runtime config`
- `Selections` should include both store components and plugins
- The phase should improve clarity of the existing editor structure without expanding into a new multi-step workflow

### Active profile semantics
- The API should expose a stable active profile name rather than forcing the UI to infer activeness from a filesystem path
- Active state should be expressed consistently in the profile list, profile detail, and activation feedback surfaces
- The primary active indicator should be the profile name, not a path
- Filesystem path details may exist as secondary technical information, but they are not the main UX surface for activeness in Phase 2

### Pre-activation visibility
- Before activation, profile detail should show both included components and a runtime configuration summary
- Runtime configuration summary should surface key names rather than only counts or full raw JSON
- The summary should make it clear which hooks, MCP servers, LSP servers, and settings top-level keys will be involved
- This phase should not expand into a full diff preview system; it is a readability layer for activation readiness, not a change comparison engine

### Claude's Discretion
- Exact visual hierarchy inside the two-column detail layout
- Exact component treatment for runtime config summaries, as long as they stay key-name level and scan-friendly
- Exact microcopy for empty states and helper text inside profile editing sections
- Exact placement of secondary technical metadata such as generated profile path, if shown at all

</decisions>

<specifics>
## Specific Ideas

- The user wants data-type rendering to stay consistent across `Profiles` and `Explorer`, which should carry into Phase 2 profile detail and composition surfaces
- “Runtime config” in this phase specifically means the non-component configuration blocks stored on the profile model: `hooks`, `mcpServers`, `lspServers`, and `settings`, with plugins treated as part of selections and runtime enablement
- The user explicitly does not want full preview-diff scope pulled into this phase; key-name summaries are enough before activation

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap scope
- `.planning/PROJECT.md` — Claude-first product direction and local-store-centered profile workflow
- `.planning/REQUIREMENTS.md` — Phase 2 requirements `PROF-01..04` and `ACT-01..02`
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown target
- `.planning/STATE.md` — Current project position and Phase 1 decisions that must carry forward

### Prior phase decisions
- `.planning/phases/01-store-and-inventory-foundation/01-CONTEXT.md` — Canonical store positioning, read-only inventory boundary, and component taxonomy decisions
- `.planning/phases/01-store-and-inventory-foundation/01-VERIFICATION.md` — Verified Phase 1 store/inventory behavior and current route semantics after human validation

### Existing profiler design
- `docs/superpowers/specs/2026-03-25-profiler-design.md` — Existing profile/store model, activation expectations, and profile management direction

### Existing implementation anchors
- `packages/cli/src/server/services/profileService.ts` — Current profile persistence and activation behavior
- `packages/cli/src/server/routes/profiles.ts` — Current profile API surface
- `packages/ui/src/ProfilesView.tsx` — Profile routing and current detail/editor surface selection
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Current profile detail summary treatment
- `packages/ui/src/components/profiles/ProfileEditor.tsx` — Current profile editing form
- `packages/ui/src/components/profiles/ComponentPicker.tsx` — Existing component selection UI
- `packages/ui/src/components/profiles/PluginPicker.tsx` — Existing plugin selection UI
- `packages/ui/src/hooks/useProfiles.ts` — Current active-state and CRUD client behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProfileService`: already handles profile create/update/delete/list plus activation and deactivation, so Phase 2 can evolve semantics without inventing a new backend foundation
- `ProfileEditor`: already covers the full profile data model, including runtime JSON fields, which makes restructuring more about usability than raw capability
- `ProfileCard`: already has action wiring and summary stats, making it a useful base for a richer detail layout rather than a throwaway implementation
- `ComponentPicker` and `PluginPicker`: existing reusable selectors can be reorganized into clearer sections instead of replaced outright

### Established Patterns
- Profiles currently live inside the same shell as store-backed component management, so Phase 2 should preserve that navigation model
- Store-backed composition already uses the `agents`, `skills`, `commands`, and `plugins` taxonomy established in Phase 1
- Current frontend data fetching is React Query based, with query invalidation already wired for profile CRUD and activation actions

### Integration Points
- Active-state semantics need coordinated changes across `ProfileService.list()`, `profilesRoutes`, `useProfiles`, `ProfilesSidebar`, `ProfilesView`, and profile detail UI
- Detail readability work should connect `ProfilesView`, `ProfileCard`, and any new detail subcomponents with the existing profile data model rather than introduce a parallel DTO
- Runtime summary visibility should be derived from the existing profile shape in `@claudeui/shared`, not from activation-time filesystem inspection

</code_context>

<deferred>
## Deferred Ideas

- Full activation diff preview and profile-vs-profile comparison remain v2 preview work, not Phase 2 scope
- Activation rollback, partial-failure handling, and stronger switching safety remain Phase 3 concerns
- Broader cross-agent profile abstractions remain outside scope; Phase 2 should stay Claude-first

</deferred>

---
*Phase: 02-profile-composition*
*Context gathered: 2026-03-31*
