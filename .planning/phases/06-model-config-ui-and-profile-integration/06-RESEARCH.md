# Phase 6: Model Config UI and Profile Integration - Research

**Researched:** 2026-04-09
**Domain:** Frontend UI components, React Query hooks, API integration
**Confidence:** HIGH

## Summary

Phase 6 adds a complete model config management UI to the store view and integrates model config selection into the profile editor and detail views. The backend API is fully complete from Phase 5 (CRUD routes at `/api/store/model-configs`, delete protection with 409 + `referencedBy`, profile `modelConfig` optional string field). The frontend needs: (1) new React Query hooks for model config CRUD, (2) a new `ModelConfigEditor` component, (3) extensions to `StoreComponentList` for model-config tab rendering, (4) a dropdown picker in `ProfileEditor`, (5) model config badge in `ProfileCard`, and (6) `DeleteConfirmDialog` reuse for delete protection.

This phase is a pure frontend extension phase. Every pattern needed already exists in the codebase -- no new libraries or architectural decisions required. The work is straightforwardly following existing patterns with model-config-specific field rendering.

**Primary recommendation:** Follow the established StoreComponentList/StoreComponentEditor/useStore patterns exactly, adding model config as a new category alongside agents/skills/commands. The only novel concern is the API key masking logic, which is a simple frontend-only utility function.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add a "Model Configs" tab alongside Agents/Skills/Commands in the existing StoreComponentList
- List columns: Name, Provider, Base URL, masked API Key, Profiles count
- Simple empty state: "No model configs yet" with a Create button
- API key shown as `****1234` in the list view (last 4 chars only, no inline reveal toggle)
- Consistent card-based layout matching existing store tabs
- Mask format: `****1234` -- fixed 4 asterisks + last 4 characters (does not leak key length)
- Edit form: API key field pre-filled with masked value; user must clear and retype to change
- Unchanged masked value means "keep existing key" -- do not send the masked value to the API
- Create form: also masked (password-style input), not plain text
- Masking is purely a frontend concern -- backend stores and returns the full key
- Profile editor: dropdown select in the Selections section, alongside agents/skills/commands pickers
- Dropdown lists model config names with a "None" option at the top to deselect
- Profile detail: clickable badge in the Components section showing name + provider + masked key
- Clicking the badge in profile detail navigates to the model config in the store view
- Delete protection: reuse existing DeleteConfirmDialog pattern -- show "Cannot delete: referenced by profiles [X, Y]" with profile names
- Single-page form following the StoreComponentEditor pattern
- Field order: Name (locked when editing) -> API Key -> Base URL -> Model Name -> Provider
- Required fields: Name, API Key, Base URL -- normal labels
- Optional fields: Model Name, Provider -- labeled with "(optional)" suffix
- Inline editor view when clicking a config in the store list (same pattern as agents/skills/commands)
- Name field locked on edit (model config names are immutable per Phase 05)

### Claude's Discretion
- Exact visual styling of the dropdown picker in profile editor
- Exact badge styling for model config in profile detail
- Animation and transition details
- Error state styling for form validation
- Save success feedback mechanism (toast vs inline)
- Cancel/discard behavior (confirm or just close)

### Deferred Ideas (OUT OF SCOPE)
- Cross-view navigation from profile detail model config badge to store view -- Claude's discretion on implementation
- API key reveal/hide toggle in forms -- user chose always-masked, but this could be revisited
- Full activation/env-var injection -- Phase 7
- STORE-11 URL and model name validation -- deferred per Phase 05
- API key encryption at rest -- out of scope per PROJECT.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STORE-09 | User sees model configs listed in the store UI alongside agents, skills, and commands | Extend StoreComponentList with model-configs category; add React Query hooks; update ProfilesSidebar and ProfilesView routing |
| STORE-10 | API key is masked in list and edit views (only last 4 characters visible) | Frontend masking utility `maskApiKey(key)` returns `****` + last 4 chars; edit form uses password-type input with masked pre-fill |
| PROF-05 | User can select exactly one model config in the profile editor via a picker | Add single-select dropdown in ProfileEditor Selections section; bind to profile.modelConfig string field |
| PROF-06 | Profile detail view shows the assigned model config name and key fields | Extend ProfileCard ComponentGroup section with model config badge showing name, provider, masked key, base URL |
| PROF-07 | User cannot delete a model config that is referenced by any profile | Backend already returns 409 with referencedBy array; frontend reuses DeleteConfirmDialog pattern from existing store delete flow |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version (project) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.28.4 | Data fetching and mutation hooks | Established pattern in useStore.ts and useProfiles.ts |
| react | ^18.2.0 | UI framework | Project standard |
| react-router-dom | ^6.22.3 | Routing and navigation | Used in ProfilesView, App.tsx |
| framer-motion | ^12.38.0 | Animations for list items | Used throughout StoreComponentList, ProfileCard |
| lucide-react | ^0.363.0 | Icons | Used for all icon needs |
| @claudeui/shared | workspace:* | Zod schemas and types | ModelConfig, ModelConfigSchema, Profile types |
| zod | (via shared) | Runtime validation | Schema validation on API routes |

### Testing (already installed)
| Library | Version (project) | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^2.1.9 | Test runner | All unit tests |
| @testing-library/react | ^16.3.0 | Component testing | UI component tests |
| @testing-library/user-event | ^14.6.1 | User interaction simulation | Form interactions, button clicks |
| jsdom | ^26.1.0 | DOM environment | vitest environment config |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<select>` dropdown | Radix UI Select / shadcn | Project uses native selects throughout (see typeFilter in StoreComponentList); introducing a component library now would break consistency |

**Installation:** No new packages needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
packages/ui/src/
  hooks/
    useStore.ts                    # ADD: model config hooks (useStoreModelConfigs, etc.)
    useProfiles.ts                 # NO CHANGES (profile hooks already support modelConfig field)
  components/
    store/
      StoreComponentList.tsx       # MODIFY: add model-configs tab support
      StoreComponentEditor.tsx     # MODIFY: extend category type to include 'model-configs'
      DeleteConfirmDialog.tsx      # REUSE: unchanged, already handles referencedBy
      ModelConfigEditor.tsx        # NEW: dedicated editor for model config fields
    profiles/
      ProfileEditor.tsx            # MODIFY: add model config dropdown in Selections section
      ProfileCard.tsx              # MODIFY: add model config badge in Components section
      ProfilesSidebar.tsx          # MODIFY: add model-configs category to sidebar
  ProfilesView.tsx                 # MODIFY: add model-configs route parsing
  utils/
    maskApiKey.ts                  # NEW: utility for API key masking
```

### Pattern 1: React Query Hooks for Store CRUD
**What:** Each store entity type has list/get/create/update/delete hooks using useQuery and useMutation with queryKey invalidation.
**When to use:** Adding model config data fetching.
**Example:**
```typescript
// Source: packages/ui/src/hooks/useStore.ts (existing pattern)
export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => fetchJson<{ modelConfigs: ModelConfig[] }>('/api/store/model-configs').then(d => d.modelConfigs),
  });
}

export function useStoreModelConfig(name: string | null) {
  return useQuery({
    queryKey: ['store', 'model-configs', name],
    queryFn: () => fetchJson<{ modelConfig: ModelConfig }>(`/api/store/model-configs/${encodeURIComponent(name!)}`).then(d => d.modelConfig),
    enabled: !!name,
  });
}

export function useCreateStoreModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateModelConfigBody) => mutateJson<{ modelConfig: ModelConfig }>('/api/store/model-configs', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  });
}

export function useUpdateStoreModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: UpdateModelConfigBody }) =>
      mutateJson<{ modelConfig: ModelConfig }>(`/api/store/model-configs/${encodeURIComponent(name)}`, 'PUT', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  });
}

export function useDeleteStoreModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/model-configs/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  });
}
```

### Pattern 2: API Key Masking Utility
**What:** Frontend-only function to mask API keys for display.
**When to use:** In list view rendering and edit form pre-fill.
**Example:**
```typescript
// NEW: packages/ui/src/utils/maskApiKey.ts
export function maskApiKey(key: string): string {
  if (!key || key.length < 4) return '****';
  return `****${key.slice(-4)}`;
}

// Sentinel value to detect unchanged API key in edit form
export const MASKED_SENTINEL_PREFIX = '****';

export function isMaskedValue(value: string): boolean {
  return value.startsWith(MASKED_SENTINEL_PREFIX);
}
```

### Pattern 3: Model Config Editor with Masked API Key Handling
**What:** Edit form pre-fills masked key; unchanged masked value is not sent to API.
**When to use:** In ModelConfigEditor component save handler.
**Example:**
```typescript
const handleSave = () => {
  // When editing, if API key still has masked value, omit it from the update body
  const body: UpdateModelConfigBody = {};
  if (!isMaskedValue(apiKey)) {
    body.apiKey = apiKey;
  }
  body.baseUrl = baseUrl;
  if (modelName) body.modelName = modelName;
  if (provider) body.provider = provider;
  // API validates non-empty via UpdateModelConfigBodySchema.refine()
};
```

### Pattern 4: Single-Select Dropdown for Model Config in Profile
**What:** Unlike agents/skills/commands (multi-select checkbox ComponentPicker), model config uses a single-select dropdown with "None" option.
**When to use:** ProfileEditor Selections section.
**Example:**
```typescript
// Native select element matching existing select style in StoreComponentList typeFilter
<select
  value={modelConfig ?? ''}
  onChange={(e) => setModelConfig(e.target.value || undefined)}
  className={cn(
    "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[13px]",
    "text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]",
    "transition-colors duration-150"
  )}
>
  <option value="">None</option>
  {modelConfigs.map(mc => (
    <option key={mc.name} value={mc.name}>{mc.name}</option>
  ))}
</select>
```

### Pattern 5: Reference Counting for Model Configs
**What:** Profile's `modelConfig` field is an optional string (not an array), so reference checking uses scalar equality.
**When to use:** Building the referencedByMap in StoreComponentList.
**Example:**
```typescript
// In referencedByMap construction, add model-configs:
if (p.modelConfig) {
  const key = `model-configs:${p.modelConfig}`;
  const existing = referencedByMap.get(key) ?? [];
  existing.push(p.name);
  referencedByMap.set(key, existing);
}
```

### Anti-Patterns to Avoid
- **Do NOT send masked API key to backend:** The `****1234` value is a display artifact. If the user does not change it, omit `apiKey` from the update body entirely.
- **Do NOT create a separate page for model configs:** They integrate into the existing store tab system (sidebar navigation + StoreComponentList routing).
- **Do NOT use ComponentPicker for model config selection:** ComponentPicker is multi-select checkboxes. Model config is a single-select dropdown with a "None" option.
- **Do NOT forget to invalidate profile queries:** Creating/updating/deleting model configs can change profile display, so invalidate `['profiles']` query key alongside `['store', 'model-configs']`.
- **Do NOT make the model config card columns match agents/skills/commands exactly:** Model configs have different fields (no description, no content body, has Provider/Base URL/API Key columns).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete protection UI | Custom dialog | DeleteConfirmDialog | Already handles referencedBy display, confirm/cancel flow |
| API error handling | Custom error parsing | mutateJson helper in useStore.ts | Already throws with `.data` attached for `referencedBy` extraction |
| Reference counting | Custom map builder | Extend existing referencedByMap pattern | Same scalar check pattern, just add `model-configs` key |
| Form validation | Custom validation | Zod schemas from @claudeui/shared | CreateModelConfigBodySchema, UpdateModelConfigBodySchema |
| Component test setup | Custom render wrapper | renderWithProviders from test/ | Already wraps QueryClient + Router |

**Key insight:** Every piece of infrastructure for this phase already exists. The work is exclusively: (1) new hooks following the exact useStore.ts pattern, (2) new components following existing editor/card patterns, (3) extensions to existing components to add model-config-specific rendering.

## Common Pitfalls

### Pitfall 1: Sending Masked API Key to Backend
**What goes wrong:** The edit form pre-fills the API key field with `****1234`. If the user saves without changing it, the masked value gets sent to the API, overwriting the real key with asterisks.
**Why it happens:** The backend stores the full key and returns it in GET responses. The frontend needs to detect that the masked value is unchanged and omit it from the update payload.
**How to avoid:** Check if `apiKey` starts with `****` before including it in the update body. If unchanged, omit the field. The UpdateModelConfigBodySchema `.refine()` requires at least one field, so always send at least `baseUrl`.
**Warning signs:** After editing a model config without changing the API key, the key becomes `****1234` literally.

### Pitfall 2: Forgetting to Extend SidebarSelection Type
**What goes wrong:** The ProfilesSidebar `SidebarSelection` type only allows `'agents' | 'skills' | 'commands'` for component categories. Adding model configs requires extending this union type.
**Why it happens:** The type is narrowly defined and used in routing/parsing logic in ProfilesView.tsx.
**How to avoid:** Update `SidebarSelection` to include `{ type: 'components'; category: 'agents' | 'skills' | 'commands' | 'model-configs' }` and update `parseSelection` in ProfilesView.tsx.
**Warning signs:** Clicking the model configs sidebar item does not navigate, or TypeScript compile errors.

### Pitfall 3: Model Config List Item Structure Mismatch
**What goes wrong:** Using the same 4-column grid (type/name/description/profiles) as agents/skills/commands for model configs, which have no description and have different fields (provider, base URL, API key).
**Why it happens:** StoreComponentList uses a shared card template with fixed column layout.
**How to avoid:** Model config cards need a custom column layout: Name, Provider, Base URL, masked API Key, Profiles count. Detect `item.type === 'model-configs'` and render a different grid layout.
**Warning signs:** Model config cards show "No description" and omit provider/URL columns.

### Pitfall 4: API Key Mask Leaking Key Length
**What goes wrong:** Using a variable number of asterisks proportional to key length (e.g., `***...****1234`).
**Why it happens:** Simple substring masking like `'*'.repeat(key.length - 4) + key.slice(-4)`.
**How to avoid:** Always use exactly 4 asterisks: `****${key.slice(-4)}`. This does not reveal key length.
**Warning signs:** API key display shows different asterisk counts for different keys.

### Pitfall 5: Profile Editor Not Including modelConfig in Save Body
**What goes wrong:** Adding the model config dropdown to the UI but forgetting to include `modelConfig` in the CreateProfileBody/UpdateProfileBody when saving.
**Why it happens:** The ProfileEditor manually constructs the body object. The `modelConfig` field must be explicitly added.
**How to avoid:** Add `modelConfig` state variable and include it in both create and update mutation bodies. The schema already supports it (`modelConfig: z.string().optional()`).
**Warning signs:** Selecting a model config in the profile editor, saving, and seeing it not persisted.

### Pitfall 6: Query Invalidation Scope
**What goes wrong:** After creating/updating/deleting a model config, profile detail views do not refresh because `['profiles']` queries are not invalidated.
**Why it happens:** Model config mutations only invalidate `['store', 'model-configs']` queries, but profile data includes the modelConfig reference which may need re-display.
**How to avoid:** In the model config mutation `onSuccess`, also invalidate `['profiles']` queries: `qc.invalidateQueries({ queryKey: ['profiles'] })`.
**Warning signs:** After editing a model config's name fields (provider, model name), profile detail still shows old data.

## Code Examples

### API Key Masking Utility
```typescript
// Source: New file to create
// packages/ui/src/utils/maskApiKey.ts
export function maskApiKey(key: string): string {
  if (!key || key.length < 4) return '****';
  return `****${key.slice(-4)}`;
}
```

### Model Config Hooks (to add to useStore.ts)
```typescript
// Source: Pattern from existing useStore.ts
// --- Store Model Configs ---
export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => fetchJson<{ modelConfigs: ModelConfig[] }>('/api/store/model-configs').then(d => d.modelConfigs),
  });
}

export function useDeleteStoreModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) =>
      mutateJson(`/api/store/model-configs/${encodeURIComponent(name)}${force ? '?force=true' : ''}`, 'DELETE'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store', 'model-configs'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
```

### Model Config Card Rendering (within StoreComponentList)
```typescript
// Source: Pattern from existing StoreComponentList card rendering
// For model-config items, use different columns:
{
  item.type === 'model-configs' ? (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_100px_80px]">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">name</div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.name}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">provider</div>
        <div className="text-[13px] text-[var(--text-secondary)]">{item.provider || '-'}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">base url</div>
        <div className="text-[13px] text-[var(--text-secondary)] truncate">{item.baseUrl}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">api key</div>
        <div className="text-[13px] font-mono text-[var(--text-secondary)]">{maskApiKey(item.apiKey)}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">profiles</div>
        {/* reuse existing profile ref count pattern */}
      </div>
    </div>
  ) : (
    // existing agents/skills/commands card rendering
  );
}
```

### Profile Editor Model Config Dropdown
```typescript
// Source: Pattern from existing ProfileEditor Selections section
const modelConfigsQ = useStoreModelConfigs();
const [modelConfig, setModelConfig] = useState<string | undefined>(profile?.modelConfig);

// In Selections section grid, add:
<div className="panel p-5">
  <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Model Config</div>
  <select
    value={modelConfig ?? ''}
    onChange={(e) => setModelConfig(e.target.value || undefined)}
    className={cn(
      "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[13px]",
      "text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]",
      "transition-colors duration-150 w-full"
    )}
  >
    <option value="">None</option>
    {(modelConfigsQ.data ?? []).map(mc => (
      <option key={mc.name} value={mc.name}>{mc.name}</option>
    ))}
  </select>
</div>
```

### Profile Card Model Config Badge
```typescript
// Source: Pattern from existing ProfileCard ComponentGroup
// After existing ComponentGroup entries, add:
{profile.modelConfig && (
  <div>
    <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">Model Config</div>
    <span
      className="inline-block rounded bg-white/[0.04] px-2 py-0.5 text-[12px] text-[var(--text-secondary)] border border-[var(--border-default)]"
    >
      {profile.modelConfig}
      {/* Additional detail could show provider + masked key if resolved */}
    </span>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | All patterns established in Phases 1-5 | N/A | This phase is pure extension |

**Deprecated/outdated:**
- None relevant. This project uses established patterns that are current.

## API Contract (Backend Complete from Phase 5)

All routes return full `apiKey` in responses. Frontend must mask for display.

| Method | Route | Request Body | Response | Error Codes |
|--------|-------|-------------|----------|-------------|
| GET | `/api/store/model-configs` | - | `{ modelConfigs: ModelConfig[] }` | - |
| GET | `/api/store/model-configs/:name` | - | `{ modelConfig: ModelConfig }` | 400, 404 |
| POST | `/api/store/model-configs` | `CreateModelConfigBody` | `{ modelConfig: ModelConfig }` | 400, 409 |
| PUT | `/api/store/model-configs/:name` | `UpdateModelConfigBody` | `{ modelConfig: ModelConfig }` | 400, 404 |
| DELETE | `/api/store/model-configs/:name` | - | `{ success: true }` | 400, 404, 409 |

Delete 409 response body: `{ error: 'Referenced by profiles', referencedBy: string[] }`

### Schema Types (from @claudeui/shared)

```typescript
// ModelConfigSchema
{ name: string, apiKey: string, baseUrl: string, modelName: string, provider: string }

// CreateModelConfigBodySchema
{ name: string, apiKey: string, baseUrl: string, modelName?: string, provider?: string }

// UpdateModelConfigBodySchema
{ apiKey?: string, baseUrl?: string, modelName?: string, provider?: string }
// .refine(data => Object.keys(data).length > 0) -- at least one field required

// ProfileSchema.modelConfig: z.string().optional()
```

## Open Questions

1. **Profile detail model config resolution**
   - What we know: ProfileSchema.modelConfig is a string (name reference). ProfileCard needs to show provider, model name, masked key -- but profile data only has the name.
   - What's unclear: Whether to fetch model config details separately in ProfileCard or rely on the model config list already being in cache.
   - Recommendation: Use the `useStoreModelConfigs()` hook in ProfileCard and look up the config by name from the cached list. This avoids an extra API call per profile and React Query caches the list.

2. **StoreComponentList category type extension**
   - What we know: StoreComponentList currently accepts `'agents' | 'skills' | 'commands'`. Model configs have a different data shape (no `frontmatter`, no `content`, flat fields).
   - What's unclear: Whether to extend StoreComponentEditor to handle model-configs or create a dedicated ModelConfigEditor.
   - Recommendation: Create a dedicated `ModelConfigEditor` component since the form fields are completely different (no description, no content markdown editor, has API key masking logic). The StoreComponentList switches to ModelConfigEditor when `item.type === 'model-configs'`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | packages/ui/vitest.config.ts |
| Quick run command | `cd packages/ui && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/ui && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-09 | Model configs appear in store list tab | unit | `cd packages/ui && npx vitest run src/components/store/__tests__/StoreComponentList.test.tsx` | Needs extension |
| STORE-10 | API key masked in list and edit views | unit | `cd packages/ui && npx vitest run src/utils/__tests__/maskApiKey.test.ts` | Wave 0 |
| PROF-05 | Model config dropdown in profile editor | unit | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileEditor.test.tsx` | Needs extension |
| PROF-06 | Profile detail shows model config badge | unit | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileCard.test.tsx` | Needs extension |
| PROF-07 | Delete blocked when referenced by profiles | unit | `cd packages/ui && npx vitest run src/components/store/__tests__/StoreComponentList.test.tsx` | Needs extension |

### Sampling Rate
- **Per task commit:** `cd packages/ui && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/ui && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/ui/src/utils/__tests__/maskApiKey.test.ts` -- covers STORE-10 masking logic
- [ ] Extend `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` -- add model-configs mock data and rendering assertions
- [ ] Extend `packages/ui/src/components/profiles/__tests__/ProfileEditor.test.tsx` -- add model config dropdown test
- [ ] Extend `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` -- add model config badge test

## Sources

### Primary (HIGH confidence)
- Direct code reading: `packages/ui/src/hooks/useStore.ts` -- React Query hook patterns
- Direct code reading: `packages/ui/src/components/store/StoreComponentList.tsx` -- tab/card rendering patterns
- Direct code reading: `packages/ui/src/components/store/StoreComponentEditor.tsx` -- editor form pattern
- Direct code reading: `packages/ui/src/components/store/DeleteConfirmDialog.tsx` -- delete protection pattern
- Direct code reading: `packages/ui/src/components/profiles/ProfileEditor.tsx` -- Selections section pattern
- Direct code reading: `packages/ui/src/components/profiles/ProfileCard.tsx` -- ComponentGroup badge pattern
- Direct code reading: `packages/ui/src/components/profiles/ProfilesSidebar.tsx` -- sidebar navigation pattern
- Direct code reading: `packages/ui/src/ProfilesView.tsx` -- routing and selection parsing
- Direct code reading: `packages/shared/src/modelConfigSchema.ts` -- ModelConfig types
- Direct code reading: `packages/shared/src/profileSchema.ts` -- Profile types with modelConfig field
- Direct code reading: `packages/cli/src/server/routes/store.ts` -- Model config API routes
- Direct code reading: `packages/ui/vitest.config.ts` -- Test configuration

### Secondary (MEDIUM confidence)
- Package version verification via npm registry -- confirmed project versions match current ecosystem

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all patterns already exist in codebase, read directly
- Architecture: HIGH - extending established patterns, no new architecture
- Pitfalls: HIGH - identified from direct code analysis of existing patterns
- API contract: HIGH - backend complete, routes verified by reading store.ts

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable patterns, no dependency changes expected)
