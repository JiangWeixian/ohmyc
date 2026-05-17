# Code Review: opencode Providers Backend

**Range:** `234bbac..6ea8d02` (11 implementation commits)
**Branch:** `hotfix/explore-opencode`
**Spec:** [docs/superpowers/specs/2026-05-11-opencode-providers-backend-design.md](../superpowers/specs/2026-05-11-opencode-providers-backend-design.md)
**Plan:** [docs/superpowers/plans/2026-05-11-opencode-providers-backend.md](../superpowers/plans/2026-05-11-opencode-providers-backend.md)
**Test status:** 356/356 passing
**Reviewer:** superpowers:code-reviewer
**Assessment:** Ship-ready for v1. No Critical issues.

---

## Strengths

- Clean `ConfigProvider` interface; `@ohmyc/shared/provider.ts` is types-only (verified — no `node:fs` leakage).
- Singular `origin` field successfully dropped — grep confirms no leftovers across `packages/`.
- Skills dedup tested with a real `symlinkSync` fixture pointing two providers at one canonical `SKILL.md`; assertion checks merged `origins` array.
- macOS / Linux path branching in `OpencodeProvider` covered by tests with mocked `platform`. `OPENCODE_CONFIG_DIR` override and missing-project tolerance also covered.
- Plugin enumeration correctly gated on the Claude origin filter in all three modified routes.
- TDD discipline visible across 11 small commits.
- `?origins=` filter uses `origins.some(...)` so shared skills stay visible whenever any selected source matches.
- Pre-existing route tests still pass — refactor is behavior-preserving for the Claude-only path.

---

## Issues (categorized + discussed)

### Important #1 — Scope label can lie when global dir is omitted

**Files:** `packages/cli/src/server/services/provider-registry.ts:83-85`, `packages/cli/src/server/services/providers/claude-provider.ts:35-55`

**What's wrong.** `ProviderRegistry.listFlat()` assigns `scope` by array position:

```ts
const scope = i === 0 ? 'global' : 'project'
```

But `ClaudeProvider.commandsDirs()` *skips* the global slot when `commandsGlobalDir` is undefined:

```ts
commandsDirs(): string[] {
  const dirs: string[] = []
  if (this.opts.commandsGlobalDir) dirs.push(this.opts.commandsGlobalDir)
  if (this.opts.projectDir) dirs.push(path.join(this.opts.projectDir, 'commands'))
  return dirs
}
```

So `new ClaudeProvider({ projectDir: '/foo' /* commandsGlobalDir omitted */ })` returns `['/foo/commands']` with length 1, and the registry labels it `scope: 'global'` even though the path is the project dir.

**Why it doesn't bite today.** `createServer` always passes all three global dirs from `ConfigLocator`, so `dirs[0]` is always global in production. The bug is dormant — it'll surface the first time a test or future caller omits one.

**Decision: defer.** Discussed but not fixed in this review pass. Recommended fix path when addressed: make all three global dirs required in `ClaudeProviderOptions` (drop the `?` on `commandsGlobalDir`/`skillsGlobalDir`). `scanMdFiles` already tolerates non-existent paths, so passing a path that doesn't exist on disk is safe — the slot order stays stable.

### Important #2 — `AgentsSharedProvider.skillsDirs()` duplicates when `home === cwd`

**File:** `packages/cli/src/server/services/providers/agents-shared-provider.ts:38-44`

**What's wrong.** When `home` and `cwd` resolve to the same directory (test fixture today; possible in CI/dev sandboxes), `globalDir` and `projectDir` are the same path, so `skillsDirs()` returns the same `.agents/skills` path twice.

**Why it doesn't bite today.** Registry realpath dedup catches it in `listSkills` (the second visit hits the Map; `origins.includes(provider.id)` is already true so the array isn't double-appended). End result is correct. But the registry is *masking* a provider-level mistake, and the contract "`*Dirs()` returns distinct directories" is violated.

**Decision: fix test fixtures (option B).** The production code is correct under realpath dedup. The failing party here is the test that exercises a degenerate `home === cwd` scenario. Fix by giving each a distinct tmp dir in `tests/server/services/providers/agents-shared-provider.test.ts:35-42`. Provider code stays as-is.

### Important #3 — `ClaudeProvider.parseCommand` is a regression (stricter than old `CommandService`)

**Files:** `packages/cli/src/server/services/providers/claude-provider.ts:72-85`, compare `packages/cli/src/server/services/command-service.ts:34-42`

**What's wrong.** New code:

```ts
parseCommand(file: string, raw: string): unknown {
  const parsed = matter(raw)
  const fm = parsed.data as CommandFrontmatter
  if (!fm.name && !fm.description) return null   // ← rejects valid commands
  ...
}
```

Old `CommandService.parseCommandFile` had no null guard at all: it accepted any file, falling back `id = filename`, `name = frontmatter.name || id`. Confirmed by:

1. **Schema** (`packages/shared/src/command-schema.ts:6-18`): every command frontmatter field is `.optional()`, including `name` and `description`.
2. **Official Claude Code docs** ([code.claude.com/docs/en/slash-commands](https://code.claude.com/docs/en/slash-commands)): *"All fields are optional. Only `description` is recommended."* Even `name` is optional (falls back to directory/filename).

A command file like:

```yaml
---
argument-hint: [issue-number]
allowed-tools: Bash(gh *)
---
body
```

is valid per the spec, would have been listed before this PR, and is silently dropped after. **This is a regression.**

**Decision: fix.** Drop the `if (!fm.name && !fm.description) return null` guard in `ClaudeProvider.parseCommand`. Match the pre-refactor `CommandService.parseCommandFile`: any file is a valid command; `id` and `name` fall back to the filename (basename minus `.md`). Confirm `OpencodeProvider.parseCommand` has no equivalent guard (it currently doesn't — keep it that way).

### Important #4 — Type erasure via `unknown` and `as any` casts

**Files:** `packages/shared/src/provider.ts:24-29`, `packages/cli/src/server/services/providers/claude-provider.ts:103,112`, `opencode-provider.ts:111,120`, `routes/{agents,skills,commands}.ts`

**What's wrong.** The interface declares:

```ts
// packages/shared/src/provider.ts
parseAgent(file: string, raw: string): unknown
parseCommand(file: string, raw: string): unknown
parseSkill(file: string, raw: string): unknown
agentBadges(agent: unknown): RenderBadge[]
commandBadges(cmd: unknown): RenderBadge[]
```

Every consumer gets an opaque blob it can't read without lying to the type system:

```ts
// claude-provider.ts:103
agentBadges(agent: unknown): RenderBadge[] {
  const fm = (agent as any)?.frontmatter ?? {}   // ← lies
  if (typeof fm.model === 'string') { ... }
}

// routes/agents.ts:44
const data = entry.data as any                    // ← lies
const merged = { ...data, origins: entry.origins, scope: entry.scope }
```

**Why it's like this.** One `ConfigProvider` interface covers three entity kinds (agent, skill, command), each with a different shape. Making `parseAgent` return `Agent` would force the interface to know about every tool's schema, so the author punted with `unknown`.

**Real costs (not just style):**

1. **No autocomplete / no rename safety.** `(x as any).frontmatter.modle` typechecks.
2. **Routes lose the schema** the pre-refactor `AgentService` returned (`Agent`, `Skill`, `Command` from `@ohmyc/shared`). Consumers downstream have to re-cast.
3. **Cross-provider field collisions are invisible.** `routes/agents.ts:44` spreads `data as any` then adds `origins`, `scope`, `source`. If a frontmatter ever contained a field called `origins`, it gets silently overwritten by the registry's value. Compile-time check would catch it; `any` lets it slide.

**Cleaner shape (v2 follow-up):**

```ts
// Three discriminated entity types, named explicitly.
export interface ParsedAgent   { kind: 'agent';   data: Agent }
export interface ParsedSkill   { kind: 'skill';   data: Skill }
export interface ParsedCommand { kind: 'command'; data: Command }

export interface ConfigProvider {
  parseAgent(file: string, raw: string): ParsedAgent | null
  parseSkill(file: string, raw: string): ParsedSkill | null
  parseCommand(file: string, raw: string): ParsedCommand | null

  agentBadges(agent: Agent): RenderBadge[]       // ← typed input
  commandBadges(cmd: Command): RenderBadge[]
}

// ProviderEntity gets generic over a known type:
export interface ProviderEntity<T extends Agent | Skill | Command> { ... }
```

Then `agentBadges` sees `agent.frontmatter.model` with full inference; route spreads preserve field provenance; the entity kind is statically known.

**Decision: defer to v2.**

- Behavior is correct under tests; only type safety is degraded.
- The change ripples through the interface, three providers, the registry's generic signature, and three routes — best done as a focused typing pass.
- Combine with the parseSkill extraction (Minor) and `parseOriginsQuery` extraction (Minor) in one follow-up PR.
- Doesn't block ship — read-only routes don't depend on the entity shape past the spread.

---

## Minor

- `provider-registry.ts:46-47`: `provider.skillsDirs()` is called twice per iteration (once for `.length`, once for `[i]`). Cache to a local `const dirs = provider.skillsDirs()` to mirror the cleaner pattern at line 83.
- `routes/agents.ts:20-28` (duplicated in `skills.ts` and `commands.ts`): `parseOriginsQuery` is identical across the three route files. Extract to a shared helper alongside `inventory-source.ts`.
- `provider-registry.ts:54-56`: in-place mutation of `existing.origins` is fine, but the registry doc says `origins[0]` is the primary provider. Today that's well-defined ("first provider to register the path") because `index.ts:106` constructs providers in order `[claude, opencode, agentsShared]`. Add a comment locking this invariant in.
- `opencode-provider.ts:35`: `process.env.OPENCODE_CONFIG_DIR` is read once at constructor time. Long-running servers won't pick up env changes. Document or read lazily.
- `agents-shared-provider.ts:54-67`: `parseSkill` is identical to `OpencodeProvider.parseSkill`. Extract a `parseGenericSkill(file, raw)` helper.
- `routes/agents.ts:44`, `routes/commands.ts:44`, `routes/skills.ts:49-55`: `data as any` then spreading mixes parsed-frontmatter shape with registry metadata. Type the merge with a named interface so accidental field collisions surface at compile time.

---

## Recommendations

1. Address Important #1 before exposing a public Provider plugin API — easier to change the `*Dirs()` shape now than after external implementers exist.
2. Extract the shared `parseOriginsQuery` (Minor) and shared `parseSkill` (Minor) — small wins, immediate.
3. Add a contract test that constructs a `ClaudeProvider` with only `projectDir` set (no globals) and asserts the project entries come back labeled `scope: 'project'`. Would have caught Important #1.
4. Add an integration test that exercises the full route stack with all three providers wired, covering the `?origins=claude,opencode` matrix. Currently only the registry is multi-provider in tests; the route layer is exercised with a Claude-only registry.

---

## Decisions Summary

| # | Issue | Decision |
| - | ----- | -------- |
| 1 | Scope label position-dependence | Defer (latent; not triggered in production). Fix when `*Dirs()` is touched. |
| 2 | Shared provider duplicate dirs when `home === cwd` | Fix test fixtures only (option B). Provider stays as-is. |
| 3 | `parseCommand` regression vs. pre-refactor | Fix. Drop the null guard; commands are valid with any/no frontmatter. |
| 4 | `unknown`/`as any` type erasure | Defer to v2 (discriminated `Parsed*` types). |
| Minor (all) | Polish | Address opportunistically. |

---

## Files Reviewed

- `packages/shared/src/provider.ts`
- `packages/cli/src/server/services/scanners.ts`
- `packages/cli/src/server/services/provider-registry.ts`
- `packages/cli/src/server/services/providers/{claude,opencode,agents-shared}-provider.ts`
- `packages/cli/src/server/routes/{agents,skills,commands}.ts`
- `packages/cli/src/server/index.ts`
- `packages/cli/tests/server/services/**` (5 new test files)
- `packages/cli/tests/server/routes/{agents,skills,commands}.test.ts`
