# Phase 7: Activation Integration - Research

**Researched:** 2026-04-10
**Domain:** Profile activation env var injection, preflight preview, dialog UI extension
**Confidence:** HIGH

## Summary

Phase 7 extends the existing transactional activation pipeline in `ProfileService` to inject model config environment variables into `settings.json`'s `env` field, and extends the preflight/confirmation dialogs to preview these changes before the user commits. The implementation is well-scoped: three specific insertion points in existing code, no new services, no new API endpoints, and deactivation requires zero new code because the per-profile backup mechanism from Phase 3 already restores the entire `settings.json` (including `env`) to its pre-activation state.

The backend change is a ~15-line addition to `ProfileService.activate()` Step 10 (after settings merge, before write). The preflight change adds a `modelConfigChanges` field to the `PreflightResult` interface with a new computation method. The frontend changes add a "Model Config" section to two existing dialog components (`ActivateConfirmDialog`, `ConfirmSwitchDialog`) and pass the new preflight data through.

**Primary recommendation:** Extend `ProfileService` in-place at three known insertion points (preflight computation, activate Step 10, PreflightResult type). Add `modelConfigChanges` to the preflight API response. Extend existing dialogs with a conditional section. No new files, services, or API routes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Always use `ANTHROPIC_*` env var names regardless of provider -- `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`
- No provider flag env var -- the three vars above are sufficient; Claude Code reads baseUrl and model to determine behavior
- Skip env var if the corresponding model config field is empty/undefined -- e.g., if `modelName` is empty, do not write `ANTHROPIC_MODEL`
- `apiKey` and `baseUrl` are required fields on model config schema, so `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` will always be written when a model config exists
- `modelName` is optional, so `ANTHROPIC_MODEL` is conditional
- Add a "Model Config" section inline to existing activation dialogs (`ActivateConfirmDialog`, `ConfirmSwitchDialog`) -- no new dialog
- Use action prefixes per env var: `SET` (new key), `CHANGE` (overwriting existing value), `REMOVE` (key will be removed)
- Show masked API key value (`****1234`) in preview, never the full key -- reuse Phase 6 masking utility
- If profile has no model config, hide the model config section entirely -- no "Model Config: None" placeholder
- Header line shows model config name: "Model Config: work-anthropic"
- Follow existing deactivate-then-activate pattern from Phase 3 -- no change to flow
- Preview shows both phases: "Deactivating A: REMOVE lines" then "Activating B: SET lines"
- Switching from profile WITH model config to profile WITHOUT: deactivation restores backup (removing env vars), activation adds nothing -- preview shows only REMOVE lines
- Switching from profile WITHOUT to profile WITH: preview shows only SET lines
- Trust the per-profile backup mechanism from Phase 3 (`settings.backup.{profileName}.json`)
- No special selective env var removal logic needed -- backup restore handles it
- Matches Phase 3 decision: deactivation is lightweight, restores pre-activation state

### Claude's Discretion
- Exact visual styling of the model config section within existing dialogs
- Spacing and alignment of SET/CHANGE/REMOVE lines
- How to handle very long baseUrl values in preview (truncate, wrap, or scroll)
- Error state if model config is deleted between preflight and activation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACTV-03 | Activating a profile with a model config writes ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL, and provider flags to settings.json env field | ProfileService.activate() Step 10 injects env vars into merged.env before write; ModelConfigService.read() loads config; env var mapping locked to ANTHROPIC_* names |
| ACTV-04 | Deactivating a profile removes model-related env vars from settings.json and restores previous values | Existing per-profile backup mechanism restores entire settings.json including env field; no new deactivation code needed |
| ACTV-05 | Preflight check shows which environment variables the model config will set or change before activation | PreflightResult extended with modelConfigChanges; preflight() computes SET/CHANGE/REMOVE by comparing current settings.env against model config fields; dialogs render the changes inline |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 (latest) | Schema validation for env var types | Already in use for PreflightResult, ModelConfig, SettingsJson schemas |
| vitest | 2.1.9 (installed) | Test framework | Project standard; both cli and ui packages use it |
| @tanstack/react-query | 5.97.0 (latest) | Data fetching and mutation hooks | Already used for usePreflight, useActivateProfile hooks |
| fastify | 5.8.4 (latest) | HTTP server framework | Already used for all API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | (installed) | Dialog animation | Already used in ProfileCard and dialogs |

### Alternatives Considered
None needed -- this phase extends existing code, no new dependencies.

**Installation:**
No new packages required. All work uses existing dependencies.

## Architecture Patterns

### Recommended Project Structure
No new files or directories. All changes are in-place extensions to existing files:

```
packages/
  cli/src/server/
    services/
      profileService.ts          # Extend: preflight(), activate(), PreflightResult
  shared/src/
    (no changes needed -- types flow through API response)
  ui/src/
    hooks/
      useProfiles.ts             # Extend: PreflightResult interface
    components/profiles/
      ConfirmSwitchDialog.tsx     # Extend: add model config section
      ActivateConfirmDialog.tsx   # Extend: add model config section
      ProfileCard.tsx             # Minor: pass modelConfigChanges to dialogs
```

### Pattern 1: Transactional Env Var Injection
**What:** Inject model config env vars into the `merged.env` object inside the existing transactional activation pipeline.
**When to use:** During `ProfileService.activate()` Step 10, after merging profile.settings but before writing settings.json.
**Example:**
```typescript
// Inside activate(), after Step 10 settings merge, before write:
if (profile.modelConfig) {
  const modelConfig = await this.modelConfigService.get(profile.modelConfig);
  if (modelConfig) {
    const envVars: Record<string, string> = {};
    envVars['ANTHROPIC_API_KEY'] = modelConfig.apiKey;
    envVars['ANTHROPIC_BASE_URL'] = modelConfig.baseUrl;
    if (modelConfig.modelName) {
      envVars['ANTHROPIC_MODEL'] = modelConfig.modelName;
    }
    merged.env = { ...(merged.env || {}), ...envVars };
  }
}
```

### Pattern 2: Preflight Env Var Change Computation
**What:** Compute the SET/CHANGE/REMOVE actions for each env var by comparing current `settings.env` against model config fields.
**When to use:** Inside `ProfileService.preflight()`, after existing checks.
**Example:**
```typescript
interface ModelConfigEnvChange {
  action: 'SET' | 'CHANGE' | 'REMOVE';
  key: string;
  value: string;       // masked for API key, plain for others
  previousValue?: string; // only for CHANGE
}

// In preflight():
if (profile.modelConfig) {
  const mc = await this.modelConfigService.get(profile.modelConfig);
  if (mc) {
    const currentEnv = currentSettings.env || {};
    const changes: ModelConfigEnvChange[] = [];

    const vars: [string, string][] = [
      ['ANTHROPIC_API_KEY', mc.apiKey],
      ['ANTHROPIC_BASE_URL', mc.baseUrl],
    ];
    if (mc.modelName) {
      vars.push(['ANTHROPIC_MODEL', mc.modelName]);
    }

    for (const [key, val] of vars) {
      if (key in currentEnv) {
        changes.push({ action: 'CHANGE', key, value: key === 'ANTHROPIC_API_KEY' ? maskApiKey(val) : val, previousValue: currentEnv[key] });
      } else {
        changes.push({ action: 'SET', key, value: key === 'ANTHROPIC_API_KEY' ? maskApiKey(val) : val });
      }
    }

    result.modelConfigChanges = { configName: mc.name, changes };
  }
}
```

### Pattern 3: Inline Dialog Section Extension
**What:** Add a conditional "Model Config" section to existing confirmation dialogs.
**When to use:** When rendering `ConfirmSwitchDialog` or `ActivateConfirmDialog` and `modelConfigChanges` is present.
**Example:**
```tsx
{modelConfigChanges && modelConfigChanges.changes.length > 0 && (
  <div className="bg-[#5E6AD2]/8 border border-[#5E6AD2]/15 rounded-[var(--radius-md)] p-3">
    <p className="text-[#5E6AD2] text-[13px] font-medium mb-1">
      Model Config: {modelConfigChanges.configName}
    </p>
    <ul className="text-[13px] text-[var(--text-secondary)] font-mono">
      {modelConfigChanges.changes.map(c => (
        <li key={c.key}>
          <span className="text-[var(--accent-amber)]">{c.action}</span> {c.key}={c.value}
        </li>
      ))}
    </ul>
  </div>
)}
```

### Anti-Patterns to Avoid
- **Creating a new service for env var injection:** The env var injection is 10 lines of code that belong inside the existing `ProfileService.activate()` transaction. A separate service would add unnecessary indirection and break the transactional pattern.
- **Modifying the deactivation flow:** The per-profile backup mechanism already restores `settings.json` completely, including the `env` field. Adding selective env var removal would be redundant and error-prone.
- **Adding a new API endpoint:** The preflight endpoint already exists. Just extend its response shape with `modelConfigChanges`.
- **Adding provider flag env vars:** Per the locked decision, Claude Code reads `ANTHROPIC_BASE_URL` and `ANTHROPIC_MODEL` to determine behavior. No `CLAUDE_PROVIDER` or similar flag is needed.
- **Creating a new dialog component:** Extend `ActivateConfirmDialog` and `ConfirmSwitchDialog` inline. A new dialog would duplicate modal boilerplate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key masking | Custom mask function | `maskApiKey()` from `packages/ui/src/utils/maskApiKey.ts` | Already exists, tested, uses fixed 4-asterisk prefix that does not reveal key length |
| Model config loading | Custom file reading | `ModelConfigService.get(name)` | Handles file not found, validation, caching |
| Settings backup/restore | Custom env var diff/patch | Per-profile backup from Phase 3 | Restores entire settings.json atomically, handles edge cases |
| Preflight check | New validation endpoint | Extend existing `preflight()` method | Already checks components, computes warnings, returns structured result |
| Transactional rollback | Custom undo for env vars | Existing undo stack in `activate()` | Step 10 already happens after backup creation; undo restores backup |

**Key insight:** This phase is primarily about *extending existing mechanisms*, not building new ones. The activation pipeline, preflight system, backup mechanism, and confirmation dialogs are all battle-tested from Phase 3. Adding model config env vars is an additive extension at well-defined insertion points.

## Common Pitfalls

### Pitfall 1: Model Config Deleted Between Preflight and Activation
**What goes wrong:** Preflight sees model config exists and shows preview. User confirms. By the time `activate()` runs, the model config has been deleted from the store.
**Why it happens:** Race condition between preflight and activation (user could delete model config in another tab/window).
**How to avoid:** In `activate()`, treat missing model config as a non-blocking case -- if the profile references a model config that no longer exists, proceed without env var injection (the activation is still valid, just without model config env vars). Log a warning if desired.
**Warning signs:** Profile has `modelConfig: "work-anthropic"` but the file `store/model-configs/work-anthropic.json` does not exist at activation time.

### Pitfall 2: Deep Merge Overwriting Existing env Keys
**What goes wrong:** `deepMerge` replaces the entire `env` object instead of merging individual keys.
**Why it happens:** The existing `deepMerge` method does handle nested object merging, but if `profile.settings` also has an `env` field, it could collide with the model config env vars.
**How to avoid:** Inject model config env vars *after* the deep merge of `profile.settings`, so model config values take precedence. Use spread: `merged.env = { ...(merged.env || {}), ...modelConfigEnvVars }`. This ensures model config always wins over profile settings env keys.
**Warning signs:** Tests show profile.settings.env keys appearing instead of model config values.

### Pitfall 3: Switching Dialog Shows Only New Profile's Changes
**What goes wrong:** `ConfirmSwitchDialog` only shows the target profile's SET/CHANGE lines, not the current profile's REMOVE lines from deactivation.
**Why it happens:** Preflight only computes changes for the target profile, not for the deactivation of the current profile.
**How to avoid:** For the switch case, compute two sets of changes: (1) what the current active profile's model config added that will be REMOVEd on deactivation, and (2) what the target profile's model config will SET/CHANGE on activation. The preflight already has access to `currentActive` and can look up that profile's model config to compute removals.
**Warning signs:** User switches from profile WITH model config to profile WITHOUT, but the dialog shows no REMOVE lines.

### Pitfall 4: Masking API Key in Preflight Response Sent to Frontend
**What goes wrong:** Backend masks the API key in the preflight response, but the actual activation still needs the real key.
**Why it happens:** If you mask the key in the data structure used for both preview and activation, activation writes `****1234` to settings.json.
**How to avoid:** The preflight response returns masked values for display. The activation code reads the model config *again* from the store to get real values. Do not reuse preflight data for activation.
**Warning signs:** settings.json contains `****1234` as the ANTHROPIC_API_KEY value.

### Pitfall 5: PreflightResult Type Mismatch Between Backend and Frontend
**What goes wrong:** Backend `PreflightResult` interface and frontend `PreflightResult` interface in `useProfiles.ts` diverge.
**Why it happens:** The frontend has a duplicate interface definition (not imported from shared).
**How to avoid:** Add `modelConfigChanges` to both `ProfileService.PreflightResult` (backend) and the `PreflightResult` interface in `useProfiles.ts` (frontend). These are intentionally separate types -- the frontend type mirrors the API response shape. Both must be updated.
**Warning signs:** TypeScript error on accessing `result.modelConfigChanges` in the dialog component.

## Code Examples

### Existing Insertion Point: ProfileService.activate() Step 10
```typescript
// packages/cli/src/server/services/profileService.ts lines 395-410
// Step 10: Merge settings
let merged = { ...currentSettings };
if (profile.settings) {
  merged = this.deepMerge(merged, profile.settings);
}

// INSERTION POINT: Inject model config env vars here
// if (profile.modelConfig) { ... }

// Set enabledPlugins
const enabledPlugins: Record<string, boolean> = merged.enabledPlugins || {};
// ...
await writeFile(path.join(this.baseDir, 'settings.json'), JSON.stringify(merged, null, 2), 'utf-8');
```

### Existing PreflightResult Interface (Backend)
```typescript
// packages/cli/src/server/services/profileService.ts lines 22-27
export interface PreflightResult {
  canActivate: boolean;
  missing: string[];
  settingsWarnings: string[];
  currentActive: string | null;
  // ADD: modelConfigChanges field
}
```

### Existing PreflightResult Interface (Frontend)
```typescript
// packages/ui/src/hooks/useProfiles.ts lines 67-72
export interface PreflightResult {
  canActivate: boolean;
  missing: string[];
  settingsWarnings: string[];
  currentActive: string | null;
  // ADD: modelConfigChanges field
}
```

### ModelConfigService.get() -- Already Available
```typescript
// packages/cli/src/server/services/modelConfigService.ts
// Constructor takes configsDir, but ProfileService needs a reference
// Option A: ProfileService creates its own ModelConfigService instance
// Option B: Pass ModelConfigService to ProfileService constructor

// Simplest: ProfileService creates ModelConfigService pointing to store/model-configs
import { ModelConfigService } from './modelConfigService';
// In constructor: this.modelConfigService = new ModelConfigService(path.join(storeDir, 'model-configs'));
```

### Existing Dialog Props Pattern (ConfirmSwitchDialog)
```typescript
// packages/ui/src/components/profiles/ConfirmSwitchDialog.tsx
interface ConfirmSwitchDialogProps {
  currentActive: string;
  targetProfile: string;
  missing: string[];
  settingsWarnings: string[];
  onConfirm: () => void;
  onCancel: () => void;
  // ADD: modelConfigChanges?: ModelConfigPreview;
}
```

### Existing Dialog Props Pattern (ActivateConfirmDialog)
```typescript
// packages/ui/src/components/profiles/ActivateConfirmDialog.tsx
interface ActivateConfirmDialogProps {
  targetProfile: string;
  settingsWarnings: string[];
  onConfirm: () => void;
  onCancel: () => void;
  // ADD: modelConfigChanges?: ModelConfigPreview;
}
```

### maskApiKey Utility -- Reuse As-Is
```typescript
// packages/ui/src/utils/maskApiKey.ts
export function maskApiKey(key: string): string {
  if (key.length >= 4) {
    return `****${key.slice(-4)}`;
  }
  return '****';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (new feature) | Env var injection into settings.json env field | Phase 7 | First time model configs affect Claude Code runtime |

**Deprecated/outdated:**
- Nothing deprecated in this phase -- all mechanisms are current.

## Open Questions

1. **ModelConfigService instantiation in ProfileService**
   - What we know: `ProfileService` has `this.storeDir` already available. Model configs are stored at `store/model-configs/`.
   - What's unclear: Whether to create `ModelConfigService` as a class field in `ProfileService` constructor, or pass it in as a dependency.
   - Recommendation: Create it as a private field in the constructor (`this.modelConfigService = new ModelConfigService(path.join(this.storeDir, 'model-configs'))`). Keeps the change minimal and follows the same pattern as `LockService`.

2. **Backend masking implementation**
   - What we know: The frontend has `maskApiKey()` in `packages/ui/src/utils/maskApiKey.ts`. The backend does not have this utility.
   - What's unclear: Whether to duplicate the masking function in the CLI package or keep masking frontend-only.
   - Recommendation: Implement masking inline in the preflight method (it's a one-liner: `****${key.slice(-4)}`). Do not import from UI package into CLI package -- that would create a cross-package dependency in the wrong direction.

3. **Switch dialog removal preview data source**
   - What we know: Preflight for the target profile has `currentActive` name. The current active profile's model config info is needed to compute REMOVEd env vars.
   - What's unclear: Whether preflight should return both the current profile's env var removals and the target profile's additions in a single call, or if the frontend should make a second preflight call.
   - Recommendation: Compute both in the single preflight call. The backend already has `currentActive` and can look up that profile's model config. Return a structure like `{ activationChanges: [...], deactivationChanges: [...] }` or `{ setChanges: [...], removeChanges: [...] }`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `packages/cli/vitest.config.ts`, `packages/ui/vitest.config.ts` |
| Quick run command (cli) | `cd packages/cli && npx vitest run src/server/services/__tests__/profileService.test.ts` |
| Quick run command (ui) | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileCard.test.tsx` |
| Full suite command (cli) | `cd packages/cli && npx vitest run` |
| Full suite command (ui) | `cd packages/ui && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTV-03 | Activation writes ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL to settings.json env field | unit | `cd packages/cli && npx vitest run src/server/services/__tests__/profileService.test.ts -t "env vars"` | Needs extension |
| ACTV-03 | Skips ANTHROPIC_MODEL when modelName is empty | unit | Same as above | Needs new test |
| ACTV-04 | Deactivation restores settings.json env field to pre-activation state | unit | `cd packages/cli && npx vitest run src/server/services/__tests__/profileService.test.ts -t "deactivate"` | Needs extension |
| ACTV-05 | Preflight returns modelConfigChanges with SET/CHANGE/REMOVE actions | unit | `cd packages/cli && npx vitest run src/server/services/__tests__/profileService.test.ts -t "preflight"` | Needs extension |
| ACTV-05 | Preflight masks API key in modelConfigChanges | unit | Same as above | Needs new test |
| ACTV-05 | Dialogs show model config section when modelConfigChanges present | unit | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileCard.test.tsx` | Needs extension |
| ACTV-05 | Switch dialog shows both REMOVE and SET lines | unit | Same as above | Needs new test |

### Sampling Rate
- **Per task commit:** `cd packages/cli && npx vitest run src/server/services/__tests__/profileService.test.ts && cd ../ui && npx vitest run src/components/profiles/__tests__/`
- **Per wave merge:** `cd packages/cli && npx vitest run && cd ../ui && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- No new test files needed -- extend existing test files:
  - `packages/cli/src/server/services/__tests__/profileService.test.ts` -- add model config env var tests to activate, preflight, and deactivate describe blocks
  - `packages/cli/src/server/routes/__tests__/profiles.test.ts` -- add preflight modelConfigChanges and activate env var integration tests
  - `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` -- extend to verify dialog receives modelConfigChanges

## Sources

### Primary (HIGH confidence)
- Source code analysis of `packages/cli/src/server/services/profileService.ts` -- activation pipeline, preflight, backup mechanism
- Source code analysis of `packages/cli/src/server/services/modelConfigService.ts` -- CRUD operations, file structure
- Source code analysis of `packages/shared/src/settingsSchema.ts` -- env field is `z.record(z.string())`
- Source code analysis of `packages/shared/src/modelConfigSchema.ts` -- fields: name, apiKey, baseUrl, modelName?, provider?
- Source code analysis of `packages/shared/src/profileSchema.ts` -- modelConfig is `z.string().optional()`
- Source code analysis of `packages/ui/src/components/profiles/ConfirmSwitchDialog.tsx` -- existing dialog structure and props
- Source code analysis of `packages/ui/src/components/profiles/ActivateConfirmDialog.tsx` -- existing dialog structure and props
- Source code analysis of `packages/ui/src/hooks/useProfiles.ts` -- PreflightResult interface, mutation hooks
- Source code analysis of `packages/ui/src/utils/maskApiKey.ts` -- masking utility

### Secondary (MEDIUM confidence)
- `.planning/phases/07-activation-integration/07-CONTEXT.md` -- user decisions and canonical references
- `.planning/REQUIREMENTS.md` -- ACTV-03, ACTV-04, ACTV-05 requirement definitions
- `.planning/STATE.md` -- prior phase decisions that constrain this phase

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing code analyzed in full
- Architecture: HIGH -- insertion points identified at exact line numbers, patterns established by prior phases
- Pitfalls: HIGH -- all pitfalls derived from direct source code analysis of the interaction between activation, preflight, and model config services

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase, no external dependencies)
