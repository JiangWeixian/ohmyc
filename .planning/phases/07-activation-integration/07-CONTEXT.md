# Phase 7: Activation Integration - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

When a profile with a model config is activated, inject the model config's fields (API key, base URL, model name) as environment variables into `settings.json`'s `env` field. Deactivation restores prior state via existing backup mechanism. Preflight preview shows exactly which env vars will change before the user confirms activation. Does not add new model config CRUD, UI, or profile editor features (Phase 5/6 complete).

</domain>

<decisions>
## Implementation Decisions

### Env variable mapping
- Always use `ANTHROPIC_*` env var names regardless of provider — `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`
- No provider flag env var — the three vars above are sufficient; Claude Code reads baseUrl and model to determine behavior
- Skip env var if the corresponding model config field is empty/undefined — e.g., if `modelName` is empty, do not write `ANTHROPIC_MODEL`
- `apiKey` and `baseUrl` are required fields on model config schema, so `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` will always be written when a model config exists
- `modelName` is optional, so `ANTHROPIC_MODEL` is conditional

### Preflight preview UX
- Add a "Model Config" section inline to existing activation dialogs (`ActivateConfirmDialog`, `ConfirmSwitchDialog`) — no new dialog
- Use action prefixes per env var: `SET` (new key), `CHANGE` (overwriting existing value), `REMOVE` (key will be removed)
- Show masked API key value (`****1234`) in preview, never the full key — reuse Phase 6 masking utility
- If profile has no model config, hide the model config section entirely — no "Model Config: None" placeholder
- Header line shows model config name: "Model Config: work-anthropic"

### Cross-profile switching
- Follow existing deactivate-then-activate pattern from Phase 3 — no change to flow
- Preview shows both phases: "Deactivating A: REMOVE lines" then "Activating B: SET lines"
- Switching from profile WITH model config to profile WITHOUT: deactivation restores backup (removing env vars), activation adds nothing — preview shows only REMOVE lines
- Switching from profile WITHOUT to profile WITH: preview shows only SET lines

### Deactivation cleanup scope
- Trust the per-profile backup mechanism from Phase 3 (`settings.backup.{profileName}.json`)
- No special selective env var removal logic needed — backup restore handles it
- Matches Phase 3 decision: deactivation is lightweight, restores pre-activation state

### Claude's Discretion
- Exact visual styling of the model config section within existing dialogs
- Spacing and alignment of SET/CHANGE/REMOVE lines
- How to handle very long baseUrl values in preview (truncate, wrap, or scroll)
- Error state if model config is deleted between preflight and activation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap scope
- `.planning/PROJECT.md` — Claude-first product direction, activation writes to settings.json env field
- `.planning/REQUIREMENTS.md` — Phase 7 requirements ACTV-03, ACTV-04, ACTV-05
- `.planning/ROADMAP.md` — Phase 7 goal, success criteria, dependency on Phase 6

### Prior phase decisions
- `.planning/phases/03-safe-switching-and-reference-safety/03-CONTEXT.md` — Transactional activation, per-profile backup (`settings.backup.{profileName}.json`), preflight check pattern, confirmation dialog UX, deactivate-then-activate switching
- `.planning/phases/06-model-config-ui-and-profile-integration/06-CONTEXT.md` — Profile modelConfig optional string field, API key masking format (`****1234`), single model config per profile
- `.planning/phases/05-model-config-store-backend/05-CONTEXT.md` — Model config schema (5 fields), ModelConfigService CRUD, store file structure

### Existing implementation anchors
- `packages/cli/src/server/services/profileService.ts` — Activation (`activate()`), deactivation (`deactivateInternal()`), preflight (`preflight()`), settings merge step, per-profile backup, undo stack
- `packages/shared/src/profileSchema.ts` — ProfileSchema with `modelConfig?: string` field
- `packages/shared/src/modelConfigSchema.ts` — ModelConfigSchema with `name`, `apiKey`, `baseUrl`, `modelName?`, `provider?`
- `packages/shared/src/settingsSchema.ts` — SettingsSchema with `env?: Record<string, string>` field
- `packages/cli/src/server/services/modelConfigService.ts` — Model config CRUD service (read model config from store)
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Activation flow with `ConfirmSwitchDialog`, `ActivateConfirmDialog`, `ActivationBlockedDialog`
- `packages/ui/src/hooks/useProfiles.ts` — `usePreflight`, `useActivateProfile`, `useDeactivateProfile` hooks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProfileService.activate()` Step 10 (settings merge): already has `merged` settings object and writes to `settings.json` — inject env vars here
- `ProfileService.preflight()`: already checks component existence and computes settings warnings — extend with model config existence check and env var change computation
- `ProfileService.deactivateInternal()`: already restores per-profile backup — no changes needed for env cleanup
- Per-profile backup mechanism: `settings.backup.{profileName}.json` — handles env var restoration on deactivation
- API key masking utility from Phase 6: reuse `****1234` format for preflight preview
- `ConfirmSwitchDialog` and `ActivateConfirmDialog`: existing confirmation dialogs — extend with model config section
- `ModelConfigService.read()`: load model config from store by name

### Established Patterns
- Activation is transactional with undo stack — env var injection should register an undo action
- Preflight runs before any filesystem changes — env var preview must be computed from model config data, not from filesystem state
- React Query mutations invalidate queries on success — preflight hook already returns structured data
- Per-profile backup naming: `settings.backup.{profileName}.json` — env vars restored automatically
- Settings merge uses deep merge — env field should be merged, not replaced entirely

### Integration Points
- `ProfileService.activate()` Step 10: after merging `profile.settings`, before writing `settings.json` — inject model config env vars into `merged.env`
- `ProfileService.preflight()`: add model config existence check + compute env var changes for preview
- `ConfirmSwitchDialog`: add model config env var section showing REMOVE + SET lines
- `ActivateConfirmDialog`: add model config env var section showing SET/CHANGE lines
- Preflight API response: add `modelConfigChanges` field alongside existing `warnings` and `missing`

</code_context>

<specifics>
## Specific Ideas

- Three env vars only: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` — no provider flag
- API key shown as `****1234` in preview, matching Phase 6 masking format
- Preflight preview uses SET/CHANGE/REMOVE prefixes for each env var line
- No model config section in dialogs when profile has no model config
- Deactivation cleanup fully handled by existing backup mechanism — no new cleanup code needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-activation-integration*
*Context gathered: 2026-04-10*
