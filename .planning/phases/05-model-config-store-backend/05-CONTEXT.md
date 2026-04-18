# Phase 5: Model Config Store Backend - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Schema, service, API routes, and persistence for model config CRUD with reference protection. Users can create, read, update, and delete model configs through the API. Deletion is blocked when referenced by profiles. No UI work — that is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Schema shape & fields
- Five fields: `name`, `apiKey`, `baseUrl`, `modelName`, `provider`
- Required on create: `name`, `apiKey`, `baseUrl`
- Optional on create: `modelName`, `provider` (both default to empty/absent)
- Single provider per config — if users want different providers, they create separate configs
- `provider` is a free-form string (no enum, no validation)
- No description, tags, version, or metadata fields — just the 5 core fields

### Storage & persistence
- One JSON file per config: `store/model-configs/{name}.json`
- API keys stored as plain text in the JSON file — no encryption (out of scope for v1.2)
- Masking is a UI concern handled in Phase 6
- Extend the existing `StoreComponentTypeSchema` enum to include `model-configs` as a fourth type
- Model config CRUD follows the established separate-service pattern (AgentService, SkillService, CommandService) — extend `StoreService` only for reference checking and provenance
- Model configs participate in the same provenance tracking system as agents/skills/commands

### Validation
- No validation beyond basic schema parsing via Zod
- No URL format validation for `baseUrl`
- No model name alias checking or allowlist
- No required-field enforcement beyond what the Zod schema defines
- STORE-11 (URL and model name validation) is deferred — accept any input
- Same permissive approach on both create and edit

### Delete protection
- Hard block when model config is referenced by any profile (consistent with Phase 3 reference safety)
- Reuse the existing `StoreService.getReferencingProfiles()` pattern — extend it to check the profile's `modelConfig` field
- API returns 409 Conflict with JSON body: `{ error: string, referencedBy: string[] }` listing referencing profiles (matches existing convention in store.ts)
- Model config names are unique and immutable — no rename, delete and recreate instead

### Claude's Discretion
- Exact Zod schema structure for model config types
- API endpoint paths and route organization
- Error response formatting details beyond the 409 structure
- Provenance tracking specifics for model configs
- Test file organization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap scope
- `.planning/PROJECT.md` — Claude-first product direction, local-store-centered profile workflow, API key encryption explicitly out of scope
- `.planning/REQUIREMENTS.md` — Phase 5 requirements STORE-06, STORE-07, STORE-08, STORE-11
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, and dependency on Phase 4

### Prior phase decisions
- `.planning/phases/01-store-and-inventory-foundation/01-CONTEXT.md` — Canonical store positioning, file-based storage pattern, import/provenance tracking, component taxonomy
- `.planning/phases/03-safe-switching-and-reference-safety/03-CONTEXT.md` — Reference safety patterns, hard-block semantics, 409 response pattern

### Existing implementation anchors
- `packages/shared/src/storeSchema.ts` — StoreComponentTypeSchema enum and provenance schemas to extend
- `packages/shared/src/profileSchema.ts` — ProfileSchema needs `modelConfig` field added
- `packages/shared/src/schemas.ts` — Shared schema barrel exports
- `packages/cli/src/server/services/storeService.ts` — StoreService with CRUD, import, provenance, and getReferencingProfiles to extend
- `packages/cli/src/server/routes/store.ts` — Existing store API routes
- `packages/cli/src/server/services/agentService.ts` — Reference pattern for service structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StoreService`: already handles import, provenance tracking, and reference checking for agents/skills/commands — extend for model configs
- `StoreComponentTypeSchema`: Zod enum (`agents`, `skills`, `commands`) — add `model-configs`
- `ProfileSchema`: already has arrays for agents/skills/commands — add `modelConfig` field (string, optional)
- Store routes: existing CRUD pattern at `/api/store` can be extended with model config endpoints
- `getReferencingProfiles()`: existing method that scans profile.json files — extend to check modelConfig field

### Established Patterns
- File-based storage: one entity per file in `store/{type}/` directory
- Zod schema validation for API request/response bodies
- Fastify routes with service injection via options object
- Provenance tracking via `.metadata/imports.json` index
- Reference safety via scanning all profile.json files on delete

### Integration Points
- `ProfileSchema` needs a new `modelConfig` field (string, optional) for Phase 6 profile picker
- `StoreComponentTypeSchema` enum needs `model-configs` value
- `StoreService.getReferencingProfiles()` needs overloading or extension to check profile.modelConfig
- Store routes need new endpoints: POST/GET/PUT/DELETE for model configs
- `packages/shared/src/index.ts` needs new type exports

</code_context>

<specifics>
## Specific Ideas

- The user explicitly does not want URL or model name validation — accept any input
- Model configs are simpler than other store types — no file content to manage, just a JSON blob
- This is purely backend — no UI changes in this phase

</specifics>

<deferred>
## Deferred Ideas

- STORE-11 URL and model name validation — user explicitly deferred, accept any input
- API key encryption at rest — out of scope per PROJECT.md
- Import model configs from external directories — not a core workflow
- UI for model config management — Phase 6

</deferred>

---
*Phase: 05-model-config-store-backend*
*Context gathered: 2026-04-09*
