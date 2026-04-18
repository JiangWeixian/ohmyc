# Phase 10: Config Foundation - Research

**Researched:** 2026-04-18
**Domain:** Server-side path centralization, project directory discovery, UI badge extension
**Confidence:** HIGH

## Summary

Phase 10 centralizes all `.claude`/`.cu` path resolution into a single ConfigLocator service class, adds project-local `.claude/` directory discovery at server startup, and extends the SourceBadge UI component with a `project` variant. The current codebase has exactly one location where the global base directory is resolved (`server/index.ts` line 91-93) and a handful of path string literals that need to migrate into ConfigLocator. The existing service class pattern (constructor-injected paths, class methods) makes ConfigLocator a natural fit.

**Primary recommendation:** Build ConfigLocator as a class-based service following the AgentService/SkillService pattern, instantiate it in `createServer()`, and pass resolved directory strings into route option objects (no route signature changes). Add the `project` variant to SourceBadge and the `source` enum in shared schemas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Server checks `${cwd()}/.claude` only -- no walk-up, no env var override. If absent, silent fallback to global-only (no log message).
- **D-02:** Project path exposed to route handlers so services can read from both global and project directories in Phase 11.
- **D-03:** Class-based service (matches existing AgentService, SkillService pattern). Encapsulates `globalDir` and `projectDir` state.
- **D-04:** ConfigLocator resolves all paths and passes subdirectory strings to routes -- routes don't depend on ConfigLocator directly. This keeps route signatures unchanged.
- **D-05:** ConfigLocator is the single source of truth for all `.claude`/`.cu` path resolution. No path string literals outside this service. Success criterion: grepping for `.claude` or `.cu` outside ConfigLocator returns zero hits.
- **D-06:** New `project` variant in SourceBadge component with green color (#22c55e), matching existing pattern of one color per source type.
- **D-07:** Label text is "project" (uppercase, like existing badges). No project folder name display.
- **D-08:** Merge policy defined as: "Project items override global items when both provide the same component name. Both remain visible." Phase 11 planner reads this as a locked decision.
- **D-09:** No separate policy document needed -- policy is simple enough for inline capture.

### Claude's Discretion
- Exact ConfigLocator method signatures and internal structure
- How project path is threaded to services (Fastify decorate, options object, etc.)
- Test file organization for ConfigLocator
- Error handling for unreadable project `.claude/` directories

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Server discovers project-local `.claude/` directory via walk-up from CWD at startup | ConfigLocator checks `${cwd()}/.claude` at construction time (D-01). `process.cwd()` + `existsSync` pattern verified in existing codebase. |
| FOUND-02 | All path resolution centralized through ConfigLocator -- no scattered `.claude`/`.cu` string literals | Audit found exactly 6 files with `.claude` literals. All consolidate into ConfigLocator. Route option pattern (D-04) keeps signatures unchanged. |
| FOUND-03 | SourceBadge UI renders `project` variant for project-scoped inventory items | SourceBadge.tsx has a clear if-block pattern per variant. Adding `project` follows identical structure with green accent (#22c55e per D-06). Shared schema z.enum needs `'project'` added. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 4.29.1 (installed) | HTTP server framework | Already in use, provides `decorate` for request-scoped state [VERIFIED: node_modules] |
| vitest | 2.1.9 (installed) | Test runner | Already in use for all packages [VERIFIED: package.json] |
| zod | (via shared) | Schema validation | Source enums use `z.enum`, need `'project'` added [VERIFIED: agentSchema.ts] |
| path (Node built-in) | - | Path resolution | Standard for all directory operations [VERIFIED: used throughout] |
| fs (Node built-in) | - | File system checks | `existsSync` for project discovery [VERIFIED: used throughout] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/static | 7.0.3 | Static file serving | Already in use, no changes needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Class-based ConfigLocator | Function module with exports | Class matches existing service pattern (AgentService, SkillService, PluginResolver). Keeps state encapsulation clear. |
| Options object threading | Fastify `decorate` | D-04 locks this: routes receive directory strings via options, not via Fastify request decorator. Decorate is overkill since Phase 10 only needs paths at registration time, not per-request. |

**Installation:**
No new packages needed. Phase 10 uses only existing dependencies.

**Version verification:**
```
fastify: 4.29.1 (installed, verified from node_modules)
vitest: 2.1.9 (installed, verified from package.json)
```

## Architecture Patterns

### Recommended Project Structure
```
packages/cli/src/server/
├── services/
│   ├── configLocator.ts          # NEW: centralized path resolution
│   └── __tests__/
│       └── configLocator.test.ts # NEW: unit tests
├── routes/
│   ├── inventorySource.ts        # EXISTS: may need minor update for 'project' source
│   └── settings.ts              # EXISTS: path literals migrate to ConfigLocator
└── index.ts                      # EXISTS: ConfigLocator instantiation here

packages/shared/src/
├── agentSchema.ts                # EXISTS: z.enum needs 'project' added
├── skillSchema.ts                # EXISTS: z.enum needs 'project' added
└── commandSchema.ts              # EXISTS: z.enum needs 'project' added

packages/ui/src/components/
└── SourceBadge.tsx               # EXISTS: add 'project' variant
```

### Pattern 1: Class-Based Service with Constructor-Injected Paths
**What:** ConfigLocator follows the same class pattern as AgentService, SkillService, PluginResolver.
**When to use:** This is the locked decision (D-03).
**Example:**
```typescript
// Source: existing AgentService pattern (packages/cli/src/server/services/agentService.ts)
export class AgentService {
  constructor(private agentsDir: string) {}
  // methods...
}

// ConfigLocator follows same pattern:
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export class ConfigLocator {
  private readonly globalDir: string;
  private readonly projectDir: string | null;

  constructor(cwd?: string) {
    const agentHome = process.env.AGENT_HOME || '.claude';
    this.globalDir = path.join(os.homedir(), agentHome);
    const checkDir = cwd ?? process.cwd();
    const candidateProject = path.join(checkDir, '.claude');
    this.projectDir = existsSync(candidateProject) ? candidateProject : null;
  }

  get agentsDir(): string { return path.join(this.globalDir, 'agents'); }
  get skillsDir(): string { return path.join(this.globalDir, 'skills'); }
  get commandsDir(): string { return path.join(this.globalDir, 'commands'); }
  get pluginsDir(): string { return path.join(this.globalDir, 'plugins'); }
  get settingsPath(): string { return path.join(this.globalDir, 'settings.json'); }
  get baseDir(): string { return this.globalDir; }
  get projectPath(): string | null { return this.projectDir; }
  // ... project-scoped getters for Phase 11
}
```

### Pattern 2: Route Registration via Options Object
**What:** Routes receive directory paths as typed options at registration time. ConfigLocator provides the values.
**When to use:** This is the locked decision (D-04). Routes never import or depend on ConfigLocator.
**Example:**
```typescript
// Source: existing pattern (packages/cli/src/server/index.ts lines 96-102)
// BEFORE:
const agentHome = process.env.AGENT_HOME || '.claude';
const baseDir = path.join(os.homedir(), agentHome);
const pluginsDir = path.join(baseDir, 'plugins');
const settingsPath = path.join(baseDir, 'settings.json');

await fastify.register(agentsRoutes, { agentsDir: path.join(baseDir, 'agents'), pluginsDir, settingsPath, baseDir });

// AFTER:
const config = new ConfigLocator();
await fastify.register(agentsRoutes, {
  agentsDir: config.agentsDir,
  pluginsDir: config.pluginsDir,
  settingsPath: config.settingsPath,
  baseDir: config.baseDir,
});
```

### Pattern 3: SourceBadge Variant Addition
**What:** Add a new `project` variant to the existing if-block pattern in SourceBadge.
**When to use:** Rendering project-scoped items (Phase 11 will pass `source: 'project'`).
**Example:**
```typescript
// Source: existing pattern (packages/ui/src/components/SourceBadge.tsx)
// Each variant is an if-block with consistent styling:
// local: surface-overlay bg, text-tertiary
// profile: accent-blue/10 bg, accent-blue text
// plugin: accent-purple/10 bg, accent-purple text
// project (NEW): #22c55e/10 bg, #22c55e text (green per D-06)

if (source === 'project') {
  return (
    <span className="rounded-[var(--radius-sm)] bg-[#22c55e]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#22c55e]">
      project
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **Fastify `decorate` for ConfigLocator itself:** D-04 explicitly says routes get directory strings via options, not ConfigLocator via decorate. Using decorate would couple routes to ConfigLocator and break the existing options pattern.
- **Walk-up directory traversal:** D-01 explicitly says `${cwd()}/.claude` only -- no walk-up like git's discovery. Walking up could find unrelated `.claude/` directories in parent projects.
- **Adding `project` to `InventorySource` type in SourceBadge.tsx only:** The type must also be updated in shared schemas (agentSchema, skillSchema, commandSchema) so the API responses type-check. Otherwise TypeScript compilation fails.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path resolution | Custom path builder per route | ConfigLocator class | Single source of truth, D-05 requires zero `.claude` literals outside it |
| Project discovery | Walk-up traversal with caching | `existsSync(path.join(cwd, '.claude'))` | D-01 locks this to CWD-only check. Walk-up adds complexity with no benefit for this phase. |
| Source type system | String union in UI only | z.enum in shared schemas | Existing pattern uses zod enums. Adding `'project'` there ensures type safety end-to-end. |

**Key insight:** The codebase already has a well-established pattern for services (constructor injection) and for route options (typed interfaces). ConfigLocator is a structural refactoring, not a new paradigm. The main risk is missing a `.claude` literal during cleanup.

## Common Pitfalls

### Pitfall 1: Missing `.claude` Literals in Non-Obvious Files
**What goes wrong:** The grep audit found `.claude` in 6 files across packages, including `settings.ts` (constructs paths dynamically), `Explorer.tsx` (UI display strings like `~/.claude/agents/`), and `ImportComponentsDialog.tsx` (placeholder text). Missing any of these fails the D-05 success criterion.
**Why it happens:** String literals appear in comments, UI text, test fixtures, and dynamic path construction -- not just obvious `path.join` calls.
**How to avoid:** Grep for both `.claude` and `.cu` across all `.ts` and `.tsx` files. Categorize each hit: (a) path construction to move to ConfigLocator, (b) UI display text to keep but extract as constant, (c) test fixtures that are fine as-is, (d) comments to update.
**Warning signs:** CI grep check (`grep -rn '\.claude' packages/ --include='*.ts' --exclude-dir=__tests__`) returns hits after implementation.

### Pitfall 2: Forgetting to Update All Three Schema Files
**What goes wrong:** Adding `'project'` to the source enum in `agentSchema.ts` but not in `skillSchema.ts` or `commandSchema.ts`. TypeScript compiles but API responses from skills/commands routes won't type-check when Phase 11 adds `source: 'project'`.
**Why it happens:** Three separate files (`agentSchema.ts`, `skillSchema.ts`, `commandSchema.ts`) each have `z.enum(['local', 'profile', 'plugin'])`. It's easy to miss one.
**How to avoid:** Consider extracting the enum to a shared constant in `schemas.ts`: `export const InventorySources = z.enum(['local', 'profile', 'plugin', 'project'])` and referencing it from each schema. This is Claude's discretion per D-03/D-04 but reduces risk.
**Warning signs:** TypeScript errors in Phase 11 when assigning `source: 'project'` to skill or command types.

### Pitfall 3: Settings Route Uses Different `.claude` Construction
**What goes wrong:** The `settings.ts` route constructs its own `.claude` path from `request.query.project` (line 17: `path.join(project, '.claude', 'settings.json')`). This is a *different* `.claude` -- it's the user's project-local settings, not the global ClaudeUI data. Moving it into ConfigLocator's global scope would be wrong.
**Why it happens:** Two different `.claude` concepts: (1) global `~/.claude/` for ClaudeUI data, (2) project-local `<project>/.claude/settings.json` for Claude Code settings. They look identical in grep results.
**How to avoid:** ConfigLocator owns the *global* base directory path and the *discovered project* path. The settings route reads project-local settings from arbitrary project paths passed via query parameter. This route should NOT use ConfigLocator for its project path -- it receives the project path from the client. However, the `.claude` string literal should still be extracted into a constant (e.g., `AGENT_DIR_NAME = '.claude'`) defined in ConfigLocator and imported where needed.
**Warning signs:** Settings route breaks because it starts reading from the wrong directory.

### Pitfall 4: `process.env.AGENT_HOME` Override Gets Lost
**What goes wrong:** Current code (line 91) supports `AGENT_HOME` env var override: `process.env.AGENT_HOME || '.claude'`. Moving this into ConfigLocator without preserving the env var check breaks the override mechanism.
**Why it happens:** ConfigLocator encapsulation hides the env var check. If the constructor hardcodes `.claude`, the override stops working.
**How to avoid:** ConfigLocator constructor must check `process.env.AGENT_HOME` exactly as the current code does. This is the single place where the env var is read -- centralization makes it *more* reliable, not less.
**Warning signs:** Tests that set `AGENT_HOME` env var start failing, or users who rely on the override report regression.

## Code Examples

### ConfigLocator Core (Reference Implementation)
```typescript
// packages/cli/src/server/services/configLocator.ts
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

/** Centralized directory name -- single definition point */
export const AGENT_DIR_NAME = '.claude';

export class ConfigLocator {
  private readonly globalDir: string;
  private readonly projectDir: string | null;

  constructor(options?: { cwd?: string }) {
    const agentHome = process.env.AGENT_HOME || AGENT_DIR_NAME;
    this.globalDir = path.join(os.homedir(), agentHome);

    const cwd = options?.cwd ?? process.cwd();
    const candidateProject = path.join(cwd, AGENT_DIR_NAME);
    this.projectDir = existsSync(candidateProject) ? candidateProject : null;
    // D-01: silent fallback -- no log message when absent
  }

  // Global paths
  get agentsDir(): string { return path.join(this.globalDir, 'agents'); }
  get skillsDir(): string { return path.join(this.globalDir, 'skills'); }
  get commandsDir(): string { return path.join(this.globalDir, 'commands'); }
  get pluginsDir(): string { return path.join(this.globalDir, 'plugins'); }
  get settingsPath(): string { return path.join(this.globalDir, 'settings.json'); }
  get baseDir(): string { return this.globalDir; }

  // Project discovery
  get projectPath(): string | null { return this.projectDir; }
  get hasProject(): boolean { return this.projectDir !== null; }

  // Project-scoped subdirectories (for Phase 11)
  get projectAgentsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'agents') : null;
  }
  get projectSkillsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'skills') : null;
  }
  get projectCommandsDir(): string | null {
    return this.projectDir ? path.join(this.projectDir, 'commands') : null;
  }
}
```

### Server Integration
```typescript
// packages/cli/src/server/index.ts -- createServer() modification
import { ConfigLocator } from './services/configLocator';

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true });

  // ... health check, static assets ...

  const config = new ConfigLocator();

  await fastify.register(configRoutes);
  await fastify.register(settingsRoutes);

  // All paths from ConfigLocator -- no .claude literals here
  await fastify.register(agentsRoutes, {
    agentsDir: config.agentsDir,
    pluginsDir: config.pluginsDir,
    settingsPath: config.settingsPath,
    baseDir: config.baseDir,
  });
  await fastify.register(skillsRoutes, {
    skillsDir: config.skillsDir,
    pluginsDir: config.pluginsDir,
    settingsPath: config.settingsPath,
    baseDir: config.baseDir,
  });
  await fastify.register(commandsRoutes, {
    commandsDir: config.commandsDir,
    pluginsDir: config.pluginsDir,
    settingsPath: config.settingsPath,
    baseDir: config.baseDir,
  });
  await fastify.register(pluginsRoutes, {
    pluginsDir: config.pluginsDir,
    settingsPath: config.settingsPath,
  });
  await fastify.register(configsRoutes, {
    baseDir: config.baseDir,
    pluginsDir: config.pluginsDir,
    settingsPath: config.settingsPath,
  });
  await fastify.register(profilesRoutes, { baseDir: config.baseDir });
  await fastify.register(storeRoutes, { baseDir: config.baseDir });

  // ... SPA fallback ...
  return fastify;
}
```

### SourceBadge Project Variant
```typescript
// packages/ui/src/components/SourceBadge.tsx -- addition
type InventorySource = 'local' | 'profile' | 'plugin' | 'project';

// Add before the final `return null`:
if (source === 'project') {
  return (
    <span className="rounded-[var(--radius-sm)] bg-[#22c55e]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#22c55e]">
      project
    </span>
  );
}
```

### Test Pattern for ConfigLocator
```typescript
// Following existing test pattern (agentService.test.ts)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigLocator } from '../configLocator';

describe('ConfigLocator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'config-locator-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers project .claude/ when present in cwd', () => {
    mkdirSync(path.join(tmpDir, '.claude'));
    const locator = new ConfigLocator({ cwd: tmpDir });
    expect(locator.hasProject).toBe(true);
    expect(locator.projectPath).toBe(path.join(tmpDir, '.claude'));
  });

  it('returns null projectPath when .claude/ absent', () => {
    const locator = new ConfigLocator({ cwd: tmpDir });
    expect(locator.hasProject).toBe(false);
    expect(locator.projectPath).toBeNull();
  });

  it('resolves global paths from homedir', () => {
    const locator = new ConfigLocator({ cwd: tmpDir });
    expect(locator.agentsDir).toContain('agents');
    expect(locator.baseDir).toContain(os.homedir());
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scattered `AGENT_HOME` / `.claude` literals | Centralized ConfigLocator | Phase 10 (this phase) | Single point of truth for all path resolution |
| `process.env.AGENT_HOME` read in server/index.ts | Same check, moved into ConfigLocator | Phase 10 | Same behavior, better encapsulation |
| 3-value source enum (`local`, `profile`, `plugin`) | 4-value source enum (+ `project`) | Phase 10 | API responses can carry project source for Phase 11 |

**No deprecations:** This phase is additive. Nothing is removed -- the existing 3 source values continue to work identically.

## Audit Results: Current `.claude` Literal Locations

### Files requiring path literal extraction into ConfigLocator:
| File | Line | Literal | Context | Action |
|------|------|---------|---------|--------|
| `server/index.ts` | 91 | `'.claude'` | `AGENT_HOME` fallback | Move to ConfigLocator constructor |
| `server/routes/settings.ts` | 17 | `'.claude'` | project settings path | Import `AGENT_DIR_NAME` from configLocator |
| `server/routes/settings.ts` | 47 | `'.claude'` | project settings dir | Import `AGENT_DIR_NAME` from configLocator |

### Files with UI display strings (not path construction):
| File | Line | Literal | Context | Action |
|------|------|---------|---------|--------|
| `ui/Explorer.tsx` | 170 | `'~/.claude/agents/'` | Empty state message | Keep as display string (user-facing path hint) |
| `ui/Explorer.tsx` | 179 | `'~/.claude/skills/'` | Empty state message | Keep as display string |
| `ui/Explorer.tsx` | 188 | `'~/.claude/commands/'` | Empty state message | Keep as display string |
| `ui/ImportComponentsDialog.tsx` | 76 | `'/path/to/.claude'` | Input placeholder | Keep as display string |

### Files with `.claude-plugin` (Claude Code plugin convention -- NOT ours):
| File | Context | Action |
|------|---------|--------|
| `services/profileService.ts` | `.claude-plugin/` directory handling | No change needed -- this is a plugin manifest convention, not our data dir |
| `services/pluginService.ts` | `.claude-plugin/plugin.json` manifest path | No change needed -- same reason |

### Test files (fixtures and test data):
| File | Context | Action |
|------|---------|--------|
| `__tests__/profileService.test.ts` | Test fixture assertions | No change needed |
| `__tests__/ImportComponentsDialog.test.tsx` | Test input paths | No change needed |

**Key finding:** Only 3 path construction literals need to move to ConfigLocator. The UI display strings are user-facing hints and should remain. The `.claude-plugin` references are a different convention entirely.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.claude-plugin/` references in profileService and pluginService are Claude Code's plugin convention, not ClaudeUI data paths -- they should NOT be moved to ConfigLocator | Audit Results | Low: if wrong, we'd need to centralize those paths too |
| A2 | UI display strings (`~/.claude/agents/` etc. in Explorer.tsx) are acceptable to keep as-is since they're user-facing documentation, not path construction | Audit Results | Low: D-05 says "no path string literals outside ConfigLocator" but display strings serve a different purpose |
| A3 | The settings route's project-local `.claude/settings.json` path should use `AGENT_DIR_NAME` imported from ConfigLocator rather than having ConfigLocator construct the full path | Architecture Patterns | Low: either approach works, but importing the constant is cleaner |
| A4 | Fastify's `decorate` is not needed in Phase 10 because ConfigLocator provides all values at registration time (not per-request) | Architecture Patterns | Low: Phase 11 may need per-request access to project path, but that can be added then |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions

1. **Should UI display strings (`~/.claude/agents/`) in Explorer.tsx be exempted from the D-05 "no literals" rule?**
   - What we know: D-05 says grepping for `.claude` outside ConfigLocator should return zero hits. But these are display strings showing users where to find files, not path construction.
   - What's unclear: Whether D-05 was intended to cover user-facing documentation strings.
   - Recommendation: Keep display strings but extract them as constants (e.g., `AGENT_DIR_NAME` import) so the grep check can be scoped to `path.join` calls only. Alternatively, update the empty state messages to say "No agents found" without the path hint.

2. **Should the `InventorySource` type in SourceBadge.tsx be a shared type from `@claudeui/shared`?**
   - What we know: Currently it's defined locally in SourceBadge.tsx as `type InventorySource = 'local' | 'profile' | 'plugin'`. The shared schemas define the same values via `z.enum`.
   - What's unclear: Whether to keep the local type and just add `'project'`, or to derive the type from the shared schema.
   - Recommendation: Add `'project'` to the local type now. Extracting to shared can be done as a cleanup in Claude's discretion.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified)

This phase is purely code/config changes using existing project dependencies. No external tools, services, or databases need to be available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | packages/cli/vitest.config.ts |
| Quick run command | `cd packages/cli && pnpm test` |
| Full suite command | `cd packages/cli && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | ConfigLocator discovers `.claude/` when present in CWD | unit | `cd packages/cli && pnpm test -- configLocator` | No -- Wave 0 |
| FOUND-01 | ConfigLocator returns null when `.claude/` absent | unit | `cd packages/cli && pnpm test -- configLocator` | No -- Wave 0 |
| FOUND-02 | No `.claude`/`.cu` literals outside ConfigLocator | grep check | `grep -rn '\.claude' packages/cli/src/server/ --include='*.ts' --exclude-dir=__tests__` | N/A -- manual/grep |
| FOUND-02 | ConfigLocator provides all path getters | unit | `cd packages/cli && pnpm test -- configLocator` | No -- Wave 0 |
| FOUND-02 | server/index.ts uses ConfigLocator for paths | unit (integration) | `cd packages/cli && pnpm test -- launcherServer` | Yes -- exists |
| FOUND-03 | SourceBadge renders project variant with green color | unit | `cd packages/ui && pnpm test -- SourceBadge` | No -- Wave 0 |
| FOUND-03 | Shared schemas include 'project' in source enum | unit | `cd packages/cli && pnpm test` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/cli && pnpm test`
- **Per wave merge:** `cd packages/cli && pnpm test && cd ../ui && pnpm test`
- **Phase gate:** Full suite green + grep check passes

### Wave 0 Gaps
- [ ] `packages/cli/src/server/services/__tests__/configLocator.test.ts` -- covers FOUND-01, FOUND-02 (ConfigLocator unit tests)
- [ ] `packages/ui/src/components/__tests__/SourceBadge.test.tsx` -- covers FOUND-03 (badge rendering)
- [ ] Update `packages/cli/src/server/__tests__/launcherServer.test.ts` -- verify ConfigLocator integration

## Security Domain

> Minimal security surface for this phase. Changes are internal refactoring.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | yes | ConfigLocator validates CWD exists (implicitly via existsSync). `process.cwd()` is trusted system call. |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns for ConfigLocator

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via manipulated CWD | Tampering | `process.cwd()` returns absolute path. `existsSync` check prevents injection. ConfigLocator uses `path.join` which normalizes paths. |
| ENV var injection (AGENT_HOME) | Spoofing | AGENT_HOME is already in use. Centralization doesn't change attack surface. |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/cli/src/server/index.ts` -- current path resolution pattern
- Codebase analysis: `packages/cli/src/server/services/agentService.ts` -- class-based service pattern
- Codebase analysis: `packages/ui/src/components/SourceBadge.tsx` -- badge variant pattern
- Codebase analysis: `packages/shared/src/agentSchema.ts` -- z.enum source pattern
- Codebase grep audit for `.claude` literals across all `.ts` and `.tsx` files

### Secondary (MEDIUM confidence)
- CONTEXT.md canonical references -- confirmed against actual codebase files
- Existing test files -- confirmed test patterns and vitest configuration

### Tertiary (LOW confidence)
None -- all findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified from installed packages
- Architecture: HIGH -- follows existing patterns exactly, verified in 4+ service files
- Pitfalls: HIGH -- grep audit verified all `.claude` literal locations, 3 code patterns identified

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable -- no fast-moving dependencies)
