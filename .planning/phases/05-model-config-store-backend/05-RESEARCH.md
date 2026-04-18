# Phase 5: Model Config Store Backend - Research

**Researched:** 2026-04-09
**Domain:** Store component CRUD with Zod schema, Fastify routes, file-based persistence, reference protection
**Confidence:** HIGH

## Summary

Phase 5 adds model configs as a fourth store component type alongside agents, skills, and commands. Model configs are simpler than the other types: they store flat JSON data (no markdown/frontmatter), have no file content to manage, and use plain JSON files for persistence. The implementation extends three existing systems: the shared Zod schemas (new `model-configs` enum value plus model config schemas), the `StoreService` (extending `getReferencingProfiles` to check the `modelConfig` field on profiles), and the store API routes (new CRUD endpoints).

The primary complexity is that model configs differ structurally from existing store types. Agents, skills, and commands are markdown files with frontmatter parsed via `gray-matter`. Model configs are plain JSON blobs. This means the existing service pattern (AgentService, SkillService, CommandService) cannot be copied exactly -- a new `ModelConfigService` needs to read/write JSON directly instead of parsing markdown. The route pattern and provenance integration remain identical.

**Primary recommendation:** Create a dedicated `ModelConfigService` for JSON-based CRUD, extend `StoreComponentTypeSchema` to include `model-configs`, extend `StoreService.getReferencingProfiles()` to handle the singular `modelConfig` field, and add standard CRUD routes following the established pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Five fields: `name`, `apiKey`, `baseUrl`, `modelName`, `provider`
- Required on create: `name`, `apiKey`, `baseUrl`
- Optional on create: `modelName`, `provider` (both default to empty/absent)
- Single provider per config -- separate configs for different providers
- `provider` is a free-form string (no enum, no validation)
- No description, tags, version, or metadata fields -- just the 5 core fields
- One JSON file per config: `store/model-configs/{name}.json`
- API keys stored as plain text in JSON -- no encryption
- Extend `StoreComponentTypeSchema` enum to include `model-configs`
- Extend `StoreService` to handle model config CRUD -- do not create a separate service
- Model configs participate in same provenance tracking system
- No validation beyond basic schema parsing via Zod
- No URL format validation for `baseUrl`
- No model name alias checking or allowlist
- STORE-11 (URL and model name validation) is deferred -- accept any input
- Same permissive approach on both create and edit
- Hard block when model config is referenced by any profile
- Reuse existing `StoreService.getReferencingProfiles()` pattern -- extend to check profile's `modelConfig` field
- API returns 409 Conflict with JSON body: `{ error: string, profiles: string[] }` listing referencing profiles
- Model config names are unique and immutable -- no rename, delete and recreate instead

### Claude's Discretion
- Exact Zod schema structure for model config types
- API endpoint paths and route organization
- Error response formatting details beyond the 409 structure
- Provenance tracking specifics for model configs
- Test file organization

### Deferred Ideas (OUT OF SCOPE)
- STORE-11 URL and model name validation -- user explicitly deferred, accept any input
- API key encryption at rest -- out of scope per PROJECT.md
- Import model configs from external directories -- not a core workflow
- UI for model config management -- Phase 6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STORE-06 | User can create a model config with name, API key, base URL, model name, and provider fields | Zod schema design (ModelConfigSchema), ModelConfigService.create(), POST route |
| STORE-07 | User can edit an existing model config's fields | UpdateModelConfigBodySchema (partial), ModelConfigService.update(), PUT route |
| STORE-08 | User can delete a model config (blocked if referenced by a profile) | Extended getReferencingProfiles() checking profile.modelConfig, DELETE route with 409 response |
| STORE-11 | Base URL is validated as a proper URL format, model name is validated against known aliases | DEFERRED per user decision -- Zod schema accepts any string for both fields |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.23.8 | Schema validation for API request/response bodies | Already in use across entire shared package |
| fastify | ^4.26.2 | HTTP route handlers | Existing API framework |
| vitest | (dev) | Test runner | Existing test framework, 243 tests pass |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs/promises | (node built-in) | File read/write for JSON persistence | All ModelConfigService operations |
| @claudeui/shared | workspace:* | Shared schemas and types | Schema definitions, SAFE_NAME_PATTERN |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated ModelConfigService | Extend StoreService with inline CRUD | CONTEXT.md says "extend StoreService" but the existing StoreService only handles import/provenance/reference -- individual CRUD is in separate services. A ModelConfigService follows the established pattern while StoreService gets reference checking extended. |
| JSON file per config | Single JSON array file | One-file-per-config follows existing store pattern, enables safe concurrent access, and aligns with provenance tracking |

**Version verification:** zod ^3.23.8 confirmed in packages/shared/package.json. fastify ^4.26.2 confirmed in packages/cli/package.json.

## Architecture Patterns

### Recommended Project Structure
```
packages/shared/src/
  modelConfigSchema.ts        # NEW: Zod schemas + types for model config
  storeSchema.ts              # MODIFY: add 'model-configs' to enum
  profileSchema.ts            # MODIFY: add modelConfig field
  index.ts                    # MODIFY: re-export modelConfigSchema

packages/cli/src/server/
  services/
    modelConfigService.ts     # NEW: JSON-based CRUD service
    storeService.ts           # MODIFY: extend getReferencingProfiles for modelConfig
    __tests__/
      modelConfigService.test.ts  # NEW: service unit tests
      storeService.test.ts        # MODIFY: add modelConfig reference tests
  routes/
    store.ts                  # MODIFY: add model config CRUD endpoints
    __tests__/
      store.test.ts           # MODIFY: add model config route tests
```

### Pattern 1: JSON-based Store Service (differs from markdown services)
**What:** Model configs use plain JSON files instead of markdown with frontmatter.
**When to use:** This is the model config service specifically -- simpler than agents/skills/commands.
**Example:**
```typescript
// packages/cli/src/server/services/modelConfigService.ts
import { readFile, writeFile, mkdir, unlink, access, readdir } from 'fs/promises';
import path from 'path';
import { SAFE_NAME_PATTERN } from '@claudeui/shared';

export class ModelConfigService {
  constructor(private configsDir: string) {}

  async get(name: string): Promise<ModelConfig | null> {
    if (!SAFE_NAME_PATTERN.test(name)) return null;
    try {
      const raw = await readFile(path.join(this.configsDir, `${name}.json`), 'utf-8');
      return JSON.parse(raw) as ModelConfig;
    } catch { return null; }
  }

  async create(data: CreateModelConfigBody): Promise<ModelConfig> {
    // validate name, check for existing, mkdir, writeFile as JSON
  }

  async update(name: string, changes: UpdateModelConfigBody): Promise<ModelConfig | null> {
    // read existing, merge, write back
  }

  async delete(name: string): Promise<boolean> {
    // unlink the JSON file
  }

  async list(): Promise<ModelConfig[]> {
    // readdir *.json, parse each, return sorted
  }
}
```

### Pattern 2: Zod Schema for Model Config
**What:** Flat schema with 5 fields, following the Create/Update body pattern from agentSchema.ts.
**When to use:** Defining the shared types for model config API bodies.
**Example:**
```typescript
// packages/shared/src/modelConfigSchema.ts
import { z } from 'zod';
import { StoreComponentProvenanceSchema } from './storeSchema';

export const ModelConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  modelName: z.string().default(''),
  provider: z.string().default(''),
});

export const CreateModelConfigBodySchema = ModelConfigSchema;

export const UpdateModelConfigBodySchema = ModelConfigSchema.partial().omit({ name: true });

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type CreateModelConfigBody = z.infer<typeof CreateModelConfigBodySchema>;
export type UpdateModelConfigBody = z.infer<typeof UpdateModelConfigBodySchema>;
```

### Pattern 3: Extended Reference Checking
**What:** Extend `getReferencingProfiles` to handle the `modelConfig` scalar field.
**When to use:** Delete protection for model configs.
**Example:**
```typescript
// Extending StoreService.getReferencingProfiles() signature
async getReferencingProfiles(
  type: 'agents' | 'skills' | 'commands' | 'model-configs',
  name: string
): Promise<string[]> {
  const refs: string[] = [];
  // ... scan profiles ...
  for (const profile of profiles) {
    if (type === 'model-configs') {
      if (profile.modelConfig === name) refs.push(profile.name);
    } else {
      if (profile[type].includes(name)) refs.push(profile.name);
    }
  }
  return refs;
}
```

### Pattern 4: Route Registration (mirrors existing)
**What:** Standard CRUD routes at `/api/store/model-configs` following the established pattern.
**When to use:** Adding model config endpoints to store routes.
**Example:**
```typescript
// In store.ts, after command routes:
const modelConfigService = new ModelConfigService(path.join(storeDir, 'model-configs'));

fastify.get('/api/store/model-configs', async () => ({
  modelConfigs: await attachProvenanceList('model-configs', await modelConfigService.list()),
}));

fastify.post('/api/store/model-configs', async (request, reply) => {
  const parsed = CreateModelConfigBodySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
  // create, return 201
});

fastify.delete<{ Params: { name: string } }>('/api/store/model-configs/:name', async (request, reply) => {
  // reference check via storeService.getReferencingProfiles('model-configs', name)
  // return 409 with { error, profiles } if referenced
});
```

### Anti-Patterns to Avoid
- **Using gray-matter for model configs:** Agents/skills/commands use markdown with frontmatter. Model configs are plain JSON. Do not wrap JSON in markdown.
- **Validating URL format or provider enum:** CONTEXT.md explicitly forbids this. Accept any string.
- **Creating a separate top-level service for references:** Extend the existing `StoreService.getReferencingProfiles()` method rather than creating parallel reference-checking logic.
- **Using array for profile.modelConfig:** It is a single string reference (one model config per profile), unlike agents/skills/commands which are arrays.
- **Adding `model-configs` to RESERVED_PROFILE_NAMES:** This list is for profile name collision prevention, not store types. Model configs are in `store/model-configs/`, not top-level directories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name validation | Custom regex or validation function | `SAFE_NAME_PATTERN` from `@claudeui/shared` | Already standardized across all services |
| Schema validation | Manual field checks | Zod `.safeParse()` | Consistent error format, type inference |
| Reference checking | New method with separate profile scanning | `StoreService.getReferencingProfiles()` extended | Same scanning logic, same profile directory traversal |
| Provenance tracking | New metadata format | Existing `StoreService` provenance index | Same `.metadata/imports.json` structure |
| 409 response format | Ad-hoc error body | `{ error: string, profiles: string[] }` | Matches existing delete conflict responses |

**Key insight:** Model configs are structurally simpler than other store types. No markdown parsing, no frontmatter, no directory-per-entity (skills), no content field. The service is mostly JSON read/write with the standard name-exists check and safe-name validation.

## Common Pitfalls

### Pitfall 1: Provenance Index Missing model-configs Key
**What goes wrong:** `readProvenanceIndex()` returns `{ agents: {}, skills: {}, commands: {} }` -- adding `model-configs` requires updating the default empty index AND the read fallback.
**Why it happens:** The hardcoded keys in `readProvenanceIndex()` don't include the new type.
**How to avoid:** Add `model-configs` key to both the `try` path's parsed result fallback and the `catch` path's empty return:
```typescript
return {
  agents: parsed.agents ?? {},
  skills: parsed.skills ?? {},
  commands: parsed.commands ?? {},
  'model-configs': parsed['model-configs'] ?? {},
};
```
**Warning signs:** Provenance lookup returns `undefined` for model configs. Tests pass but provenance data is silently lost.

### Pitfall 2: getReferencingProfiles Type Signature
**What goes wrong:** The method signature is `getReferencingProfiles(type: 'agents' | 'skills' | 'commands', name: string)` -- adding `'model-configs'` requires updating the TypeScript type AND the runtime check logic.
**Why it happens:** The current implementation does `profile[type].includes(name)` which works for array fields but not for the scalar `modelConfig` field.
**How to avoid:** Branch on type: if `model-configs`, check `profile.modelConfig === name`; otherwise use `profile[type].includes(name)`.
**Warning signs:** TypeScript compilation fails, or reference checking silently returns empty for model configs at runtime.

### Pitfall 3: ProfileSchema Missing modelConfig Field
**What goes wrong:** Profiles loaded during reference checking fail Zod parse because they don't have a `modelConfig` field, OR the field is not optional and breaks existing profiles that lack it.
**Why it happens:** Adding a required field to `ProfileSchema` would break parsing of all existing profile.json files.
**How to avoid:** Make `modelConfig` optional with `z.string().optional()` in `ProfileSchema`. The `CreateProfileBodySchema` and `UpdateProfileBodySchema` should also include the field as optional.
**Warning signs:** All existing tests that create profiles break with Zod validation errors.

### Pitfall 4: attachProvenance Type Mismatch
**What goes wrong:** `attachProvenance` and `attachProvenanceList` in `store.ts` are typed as `T extends { id: string }` but model configs use `name` as the identifier (not `id`).
**Why it happens:** Agents/skills/commands return objects with an `id` field. Model configs return objects with `name` as the identifier (they are flat JSON, not parsed from markdown).
**How to avoid:** Either (a) make ModelConfigService return objects that include an `id` field set to the config name, or (b) add a separate provenance attachment helper for model configs. Option (a) is simpler and aligns with the existing provenance pattern.
**Warning signs:** TypeScript type errors in store.ts when calling `attachProvenance('model-configs', config)`.

### Pitfall 5: JSON File Extension vs .md
**What goes wrong:** The `scanAgents`/`scanCommands` methods filter for `.md` files. If model config scanning is added to import later, it would need `.json` filtering instead.
**Why it happens:** Import scanning is out of scope for this phase, but the provenance index structure should still accommodate it.
**How to avoid:** Not blocking for this phase (import is deferred). Just ensure the provenance index has the `model-configs` key ready.
**Warning signs:** None in this phase -- only relevant if import is added later.

### Pitfall 6: Enum Extension Breaking Zod Parses
**What goes wrong:** Changing `StoreComponentTypeSchema` from `z.enum(['agents', 'skills', 'commands'])` to `z.enum(['agents', 'skills', 'commands', 'model-configs'])` could break code that does equality checks against the three original values.
**Why it happens:** TypeScript exhaustiveness checks and switch statements may not handle the new value.
**How to avoid:** Search for all usages of `StoreComponentType` and verify they handle the new value. The import scanning methods in `StoreService` should be safe since they are additive.
**Warning signs:** TypeScript errors in storeService.ts or store.ts after enum change.

## Code Examples

### Model Config Schema (packages/shared/src/modelConfigSchema.ts)
```typescript
// Following the pattern from agentSchema.ts, skillSchema.ts, commandSchema.ts
import { z } from 'zod';

export const ModelConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  modelName: z.string().default(''),
  provider: z.string().default(''),
});

// The stored/persisted form includes provenance when returned by API
// (provenance is attached at route level, not stored in the JSON file)

export const CreateModelConfigBodySchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
});

export const UpdateModelConfigBodySchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  modelName: z.string().optional(),
  provider: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type CreateModelConfigBody = z.infer<typeof CreateModelConfigBodySchema>;
export type UpdateModelConfigBody = z.infer<typeof UpdateModelConfigBodySchema>;
```

### Model Config Service (packages/cli/src/server/services/modelConfigService.ts)
```typescript
// Simplified version of agentService.ts pattern, but JSON instead of markdown
import { readdir, readFile, writeFile, mkdir, unlink, access } from 'fs/promises';
import path from 'path';
import { SAFE_NAME_PATTERN } from '@claudeui/shared';
import type { ModelConfig, CreateModelConfigBody, UpdateModelConfigBody } from '@claudeui/shared';

export class ModelConfigService {
  constructor(private configsDir: string) {}

  async get(name: string): Promise<ModelConfig | null> {
    if (!SAFE_NAME_PATTERN.test(name)) return null;
    try {
      const raw = await readFile(path.join(this.configsDir, `${name}.json`), 'utf-8');
      return JSON.parse(raw) as ModelConfig;
    } catch { return null; }
  }

  async list(): Promise<ModelConfig[]> {
    try { await access(this.configsDir); } catch { return []; }
    const files = await readdir(this.configsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
    const configs: ModelConfig[] = [];
    for (const filename of jsonFiles) {
      try {
        const raw = await readFile(path.join(this.configsDir, filename), 'utf-8');
        const config = JSON.parse(raw) as ModelConfig;
        if (config.name) configs.push(config);
      } catch { continue; }
    }
    return configs;
  }

  async create(data: CreateModelConfigBody): Promise<ModelConfig> {
    if (!SAFE_NAME_PATTERN.test(data.name)) {
      throw new Error(`Model config name "${data.name}" is invalid: must match [a-zA-Z0-9_-]`);
    }
    await mkdir(this.configsDir, { recursive: true });
    const filePath = path.join(this.configsDir, `${data.name}.json`);
    try {
      await access(filePath);
      throw new Error(`Model config "${data.name}" already exists`);
    } catch (err: any) {
      if (err.message.includes('already exists')) throw err;
    }
    const config: ModelConfig = {
      name: data.name,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      modelName: data.modelName ?? '',
      provider: data.provider ?? '',
    };
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  async update(name: string, changes: UpdateModelConfigBody): Promise<ModelConfig | null> {
    const existing = await this.get(name);
    if (!existing) return null;
    const updated: ModelConfig = { ...existing, ...changes };
    // name is omitted from UpdateModelConfigBody, so it cannot change
    await writeFile(
      path.join(this.configsDir, `${name}.json`),
      JSON.stringify(updated, null, 2),
      'utf-8',
    );
    return updated;
  }

  async delete(name: string): Promise<boolean> {
    if (!SAFE_NAME_PATTERN.test(name)) return false;
    const filePath = path.join(this.configsDir, `${name}.json`);
    try {
      await access(filePath);
      await unlink(filePath);
      return true;
    } catch { return false; }
  }
}
```

### StoreComponentTypeSchema Extension (packages/shared/src/storeSchema.ts)
```typescript
// Change from:
export const StoreComponentTypeSchema = z.enum(['agents', 'skills', 'commands']);
// To:
export const StoreComponentTypeSchema = z.enum(['agents', 'skills', 'commands', 'model-configs']);
```

### ProfileSchema Extension (packages/shared/src/profileSchema.ts)
```typescript
export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  modelConfig: z.string().optional(),        // NEW: single model config reference
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
});
```

### Test Pattern (packages/cli/src/server/services/__tests__/modelConfigService.test.ts)
```typescript
// Following the pattern from storeService.test.ts and agentService.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { ModelConfigService } from '../modelConfigService';

describe('ModelConfigService', () => {
  let tmpDir: string;
  let service: ModelConfigService;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'model-config-test-'));
    service = new ModelConfigService(tmpDir);
  });

  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates a model config as JSON file', async () => {
    const config = await service.create({
      name: 'claude-pro', apiKey: 'sk-123', baseUrl: 'https://api.anthropic.com',
    });
    expect(config.name).toBe('claude-pro');
    expect(existsSync(path.join(tmpDir, 'claude-pro.json'))).toBe(true);
  });

  it('rejects duplicate name', async () => {
    await service.create({ name: 'test', apiKey: 'k', baseUrl: 'http://x' });
    await expect(service.create({ name: 'test', apiKey: 'k', baseUrl: 'http://x' }))
      .rejects.toThrow('already exists');
  });

  it('updates fields without changing name', async () => {
    await service.create({ name: 'test', apiKey: 'old', baseUrl: 'http://old' });
    const updated = await service.update('test', { apiKey: 'new' });
    expect(updated?.apiKey).toBe('new');
    expect(updated?.baseUrl).toBe('http://old'); // unchanged
  });

  it('deletes existing config', async () => {
    await service.create({ name: 'test', apiKey: 'k', baseUrl: 'http://x' });
    expect(await service.delete('test')).toBe(true);
    expect(existsSync(path.join(tmpDir, 'test.json'))).toBe(false);
  });

  it('returns null for nonexistent config', async () => {
    expect(await service.get('nope')).toBeNull();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | This phase extends established patterns, no paradigm shifts |

**Deprecated/outdated:**
- None applicable. The existing store service patterns are current and stable.

## Open Questions

1. **ModelConfig `id` field for provenance attachment**
   - What we know: `attachProvenance<T extends { id: string }>` in store.ts requires objects with an `id` field. Model configs use `name` as the identifier.
   - What's unclear: Whether to add a computed `id` field to the returned ModelConfig objects or create a separate provenance helper.
   - Recommendation: Add `id` to the returned object (set `id = name`) for consistency with the provenance attachment pattern. The JSON file on disk stores `name` only.

2. **UpdateModelConfigBody empty body guard**
   - What we know: The update endpoint should not accept an empty body. Agents/skills/commands don't guard against this because they always have content/frontmatter fields.
   - What's unclear: Whether to use Zod `.refine()` to enforce at-least-one-field, or just let it silently succeed (no-op update).
   - Recommendation: Use `.refine()` to return a 400 error for empty bodies, as it's better UX. But this is Claude's discretion.

3. **Provenance for model configs in attachProvenance type signature**
   - What we know: The current `attachProvenance` function type parameter is `T extends { id: string }`.
   - What's unclear: Whether the type constraint should be loosened or whether model configs should conform.
   - Recommendation: Have model configs conform by including `id: name` in the returned object.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via packages/cli) |
| Config file | packages/cli/vitest.config.ts |
| Quick run command | `cd packages/cli && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| Full suite command | `cd packages/cli && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORE-06 | Create model config with all fields persisted as JSON | unit | `cd packages/cli && npx vitest run services/__tests__/modelConfigService.test.ts -t "creates"` | Wave 0 |
| STORE-06 | POST /api/store/model-configs returns 201 | integration | `cd packages/cli && npx vitest run routes/__tests__/store.test.ts -t "POST.*model-config"` | Wave 0 |
| STORE-07 | Update any field and verify persistence | unit | `cd packages/cli && npx vitest run services/__tests__/modelConfigService.test.ts -t "updates"` | Wave 0 |
| STORE-07 | PUT /api/store/model-configs/:name returns updated config | integration | `cd packages/cli && npx vitest run routes/__tests__/store.test.ts -t "PUT.*model-config"` | Wave 0 |
| STORE-08 | Delete unreferenced config succeeds | unit | `cd packages/cli && npx vitest run services/__tests__/modelConfigService.test.ts -t "deletes"` | Wave 0 |
| STORE-08 | Delete referenced config returns 409 with profiles list | integration | `cd packages/cli && npx vitest run routes/__tests__/store.test.ts -t "DELETE.*model-config.*409"` | Wave 0 |
| STORE-11 | DEFERRED -- no validation tests needed | N/A | N/A | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/cli && npx vitest run`
- **Per wave merge:** `cd packages/cli && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cli/src/server/services/__tests__/modelConfigService.test.ts` -- covers STORE-06, STORE-07, STORE-08 service-level CRUD
- [ ] `packages/cli/src/server/routes/__tests__/store.test.ts` -- extend with model config route tests (file exists, needs new describe block)
- [ ] `packages/cli/src/server/services/__tests__/storeService.test.ts` -- extend with model-config reference checking tests (file exists, needs new tests)

## Sources

### Primary (HIGH confidence)
- `packages/shared/src/storeSchema.ts` -- current StoreComponentTypeSchema enum (3 values), provenance schemas
- `packages/shared/src/profileSchema.ts` -- current ProfileSchema fields, CreateProfileBodySchema
- `packages/cli/src/server/services/storeService.ts` -- getReferencingProfiles implementation, readProvenanceIndex structure
- `packages/cli/src/server/routes/store.ts` -- route registration pattern, attachProvenance helpers, delete reference check
- `packages/cli/src/server/services/agentService.ts` -- service CRUD pattern, SAFE_NAME_PATTERN usage
- `packages/shared/src/agentSchema.ts` -- SAFE_NAME_PATTERN definition, Create/Update body schema patterns
- `.planning/phases/05-model-config-store-backend/05-CONTEXT.md` -- locked user decisions

### Secondary (MEDIUM confidence)
- `packages/cli/src/server/services/__tests__/storeService.test.ts` -- test patterns for service
- `packages/cli/src/server/routes/__tests__/store.test.ts` -- test patterns for routes
- `packages/cli/package.json` -- vitest configuration, dependency versions
- `packages/cli/vitest.config.ts` -- vitest config (minimal, node environment)

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries are already in use, verified in package.json
- Architecture: HIGH - pattern is established across 3 existing store types, verified in source
- Pitfalls: HIGH - identified from reading actual source code, not theoretical
- Schema design: HIGH - follows exact pattern from agentSchema.ts, skillSchema.ts
- Reference checking: HIGH - extends existing getReferencingProfiles, verified in source

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable codebase, no external dependency changes expected)
