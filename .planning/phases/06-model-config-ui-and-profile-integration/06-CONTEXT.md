# Phase 6: Model Config UI and Profile Integration - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage model configs through the web UI and assign exactly one model config to a profile. This phase covers the store listing tab, model config editor with API key masking, profile editor integration with a model config picker, profile detail display of assigned model config, and delete protection in the UI. It does not cover activation/env-var injection (Phase 7) or backend CRUD/service work (Phase 5, complete).

</domain>

<decisions>
## Implementation Decisions

### Store listing presentation
- Add a "Model Configs" tab alongside Agents/Skills/Commands in the existing StoreComponentList
- List columns: Name, Provider, Base URL, masked API Key, Profiles count
- Simple empty state: "No model configs yet" with a Create button
- API key shown as `****1234` in the list view (last 4 chars only, no inline reveal toggle)
- Consistent card-based layout matching existing store tabs

### API key masking & editing
- Mask format: `****1234` — fixed 4 asterisks + last 4 characters (does not leak key length)
- Edit form: API key field pre-filled with masked value; user must clear and retype to change
- Unchanged masked value means "keep existing key" — do not send the masked value to the API
- Create form: also masked (password-style input), not plain text
- Masking is purely a frontend concern — backend stores and returns the full key

### Profile integration UX
- Profile editor: dropdown select in the Selections section, alongside agents/skills/commands pickers
- Dropdown lists model config names with a "None" option at the top to deselect
- Profile detail: clickable badge in the Components section showing name + provider + masked key
- Clicking the badge in profile detail navigates to the model config in the store view
- Delete protection: reuse existing DeleteConfirmDialog pattern — show "Cannot delete: referenced by profiles [X, Y]" with profile names

### Model config editor form
- Single-page form following the StoreComponentEditor pattern
- Field order: Name (locked when editing) → API Key → Base URL → Model Name → Provider
- Required fields: Name, API Key, Base URL — normal labels
- Optional fields: Model Name, Provider — labeled with "(optional)" suffix
- Inline editor view when clicking a config in the store list (same pattern as agents/skills/commands)
- Name field locked on edit (model config names are immutable per Phase 05)

### Claude's Discretion
- Exact visual styling of the dropdown picker in profile editor
- Exact badge styling for model config in profile detail
- Animation and transition details
- Error state styling for form validation
- Save success feedback mechanism (toast vs inline)
- Cancel/discard behavior (confirm or just close)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap scope
- `.planning/PROJECT.md` — Claude-first product direction, local-store-centered profile workflow
- `.planning/REQUIREMENTS.md` — Phase 6 requirements STORE-09, STORE-10, PROF-05, PROF-06, PROF-07
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, and dependency on Phase 5

### Prior phase decisions
- `.planning/phases/05-model-config-store-backend/05-CONTEXT.md` — Model config schema (5 fields), service structure, API routes, delete protection backend, ProfileSchema modelConfig field
- `.planning/phases/02-profile-composition/02-CONTEXT.md` — Profile editor single-page layout, Selections section, ComponentPicker pattern, profile detail two-column layout, ComponentGroup badges
- `.planning/phases/01-store-and-inventory-foundation/01-CONTEXT.md` — Store listing tab structure, search/filter patterns, card-based display, profile reference counting

### Existing implementation anchors
- `packages/ui/src/components/store/StoreComponentList.tsx` — Tab-based store listing with search, filter, card layout, delete handling, profile reference display
- `packages/ui/src/components/store/StoreComponentEditor.tsx` — Editor form pattern for create/edit with name locking
- `packages/ui/src/components/store/DeleteConfirmDialog.tsx` — Reusable delete confirmation with reference listing
- `packages/ui/src/components/profiles/ProfileEditor.tsx` — Profile editor with Selections section containing ComponentPicker and PluginPicker
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Profile detail with ComponentGroup badges for component display
- `packages/ui/src/components/profiles/ComponentPicker.tsx` — Multi-select checkbox picker pattern
- `packages/ui/src/hooks/useStore.ts` — React Query hooks for store CRUD operations
- `packages/cli/src/server/routes/store.ts` — Model config API routes (GET/POST/PUT/DELETE at /api/store/model-configs)
- `packages/cli/src/server/services/modelConfigService.ts` — Model config CRUD service
- `packages/shared/src/modelConfigSchema.ts` — ModelConfigSchema with 5 fields
- `packages/shared/src/profileSchema.ts` — ProfileSchema with modelConfig optional string field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StoreComponentList`: tab-based listing with search/filter/cards — extend with model-configs tab
- `StoreComponentEditor`: form pattern with name locking, save/cancel/delete — adapt for model config fields
- `DeleteConfirmDialog`: already handles reference-based delete blocking — reuse directly
- `ProfileEditor`: Selections section with pickers — add model config dropdown
- `ProfileCard` ComponentGroup: badge display for component lists — adapt for single model config display
- `ComponentPicker`: multi-select checkbox pattern — reference for single-select dropdown variant
- `useStore.ts`: React Query hook pattern (useQuery/useMutation with query invalidation) — replicate for model configs

### Established Patterns
- Store tabs: agents/skills/commands rendered as cards with Type/Name/Description/Profiles columns
- Profile editor: single-page form with Basics/Selections/Runtime config sections
- Profile detail: two-column layout (35% summary rail + 65% detail panel) with ComponentGroup badges
- API routes: Fastify routes with service injection, Zod validation, 409 on delete conflict
- Frontend data fetching: React Query with queryKey invalidation after mutations
- Animations: Framer Motion for list items and transitions

### Integration Points
- `StoreComponentList`: add model-configs tab and model-config-specific column rendering
- `ProfileEditor`: add dropdown select in Selections section, bound to profile.modelConfig field
- `ProfileCard`: add model config badge rendering in Components section
- `useStore.ts` (or new hook file): add useStoreModelConfigs, useCreateStoreModelConfig, useUpdateStoreModelConfig, useDeleteStoreModelConfig
- Backend routes already complete — no server changes needed

</code_context>

<specifics>
## Specific Ideas

- API key mask format is `****1234` — fixed 4 asterisks, does not reveal key length
- Model config names are immutable — name field locked in editor when editing (per Phase 05)
- Single model config per profile — dropdown with "None" option, not multi-select checkboxes
- The profile `modelConfig` field is an optional string on ProfileSchema (not an array)
- No backend changes needed — all API routes and services are complete from Phase 5

</specifics>

<deferred>
## Deferred Ideas

- Cross-view navigation from profile detail model config badge to store view — Claude's discretion on implementation
- API key reveal/hide toggle in forms — user chose always-masked, but this could be revisited
- Full activation/env-var injection — Phase 7
- STORE-11 URL and model name validation — deferred per Phase 05
- API key encryption at rest — out of scope per PROJECT.md

</deferred>

---

*Phase: 06-model-config-ui-and-profile-integration*
*Context gathered: 2026-04-09*
