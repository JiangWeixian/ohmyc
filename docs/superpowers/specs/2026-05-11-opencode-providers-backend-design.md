# Opencode provider abstraction (backend)

Status: SPEC
Branch target: `feat/opencode-providers` (off `develop`)
Pairs with: `2026-05-11-opencode-source-switcher-ui-design.md` (UI half)
Source: `~/.gstack/projects/JiangWeixian-claudeui/jiangwei-hotfix-issue-9-design-20260509-232405.md`

## Problem

OhMyC's Explorer scans only `~/.claude/` and `<cwd>/.claude/` via `ConfigLocator`. To support opencode (and a neutral `.agents/` namespace for shared skills), the read layer needs to be extended so that multiple tools can contribute agents, skills, and commands through a uniform interface — without bloating route handlers or the UI with per-tool branching.

## Scope

This spec covers the **server / read-layer** only:

- Provider interface and core types.
- `ClaudeProvider`, `OpencodeProvider`, `AgentsSharedProvider`.
- `ProviderRegistry` aggregation, dedup, filter.
- Route changes (`?origins=` query param).
- Backend tests.

The UI shell (header source switcher, origin chips on `EntityCard`, store wiring) lives in the paired UI spec.

## Goals (v1)

- Read-only discovery of opencode agents, skills, commands alongside Claude's.
- Skills shared between tools surfaced as a single entry with multi-origin metadata.
- Existing `/api/agents`, `/api/skills`, `/api/commands` keep their response shapes; optional `?origins=` filter.
- Zero regression for existing Claude-only flows: existing test suite passes unchanged after PR #1.

## Non-Goals (v1)

- No write/edit of opencode files.
- No support for `opencode.json` inline `agents` block (file-based only).
- No support for `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT` single-file overrides.
- No project-dir walk-up. Matches existing Claude `cwd`-only behavior in `config-locator.ts:34-38`.
- No new badges for opencode `permission` (consumed only as a metadata row in the detail panel — see UI spec).

## Constraints

- Must respect existing `OHMYC_HOME` / `AGENT_HOME` env conventions in `ConfigLocator`.
- Provider interface lives in `@ohmyc/shared` and must remain types-only (no runtime `node:fs` imports — providers themselves live in `@ohmyc/cli`).
- Ships in the existing `@ohmyc/cli` server bundle. No new pipeline.

## Core types (`packages/shared`)

```ts
// packages/shared/src/provider.ts
export type Origin = 'claude' | 'opencode' | 'agents'

export interface ProviderEntity<T> {
  /**
   * Every tool that reads this file, in registration order.
   * Length >= 1. `origins[0]` is the highest-priority provider that
   * discovered the file (used wherever a single label is needed).
   * Skills are the only kind that commonly have length > 1.
   */
  origins: Origin[]
  sourceFile: string        // canonicalized absolute path on disk
  scope: 'global' | 'project'
  data: T                   // schema-validated payload
}

export interface RenderBadge {
  kind: 'mono' | 'pill'
  label: string
  tone?: 'neutral' | 'warn'
}

export interface ConfigProvider {
  readonly id: Origin
  readonly displayName: string

  agentsDirs(): string[]      // ordered: global, project
  commandsDirs(): string[]
  skillsDirs(): string[]

  parseAgent(file: string): unknown
  parseCommand(file: string): unknown
  parseSkill(file: string): unknown

  // Render hints surfaced to EntityCard. Keep small; detail panel covers the rest.
  agentBadges(agent: unknown): RenderBadge[]
  commandBadges(cmd: unknown): RenderBadge[]
}
```

## Providers

### `ClaudeProvider`

Wraps existing `ConfigLocator` Claude paths. `agentBadges` returns `tools`, `model` (preserves current behavior). Skill schema = current `SkillSchema`. This provider is a behavior-preserving refactor of the existing scanners.

### `OpencodeProvider`

New. Path resolution:

- **Global, Linux:** `~/.config/opencode/{agents,commands,skills}/`
- **Global, macOS:** `~/Library/Application Support/opencode/{agents,commands,skills}/`
- **Project:** `<cwd>/.opencode/{agents,commands,skills}/` (no walk-up — symmetric with Claude)
- **Env override:** `OPENCODE_CONFIG_DIR` overrides the global config dir entirely. `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT` are single-file overrides and are ignored in v1.
- Platform detection via `os.platform()`.

Badges:

- `agentBadges` returns `mode` (primary / subagent / all) only.
- `commandBadges` returns `agent`, `subtask` flag.
- `permission` is **not** badge-rendered. It flows through the parsed frontmatter and is picked up by the existing detail-panel metadata harvest in `explorer.tsx:250-264` (UI spec covers display).

### `AgentsSharedProvider`

Skills-only. Paths: `<cwd>/.agents/skills/`, `~/.agents/skills/`. Reuses Claude's `SkillSchema`. No agents/commands directories.

## Registry

```ts
// packages/cli/src/server/services/provider-registry.ts
export class ProviderRegistry {
  constructor(private providers: ConfigProvider[]) {}

  async listAgents(filter?: { origins?: Origin[] }): Promise<ProviderEntity<Agent>[]>
  async listCommands(filter?: { origins?: Origin[] }): Promise<ProviderEntity<Command>[]>
  async listSkills(filter?: { origins?: Origin[] }): Promise<ProviderEntity<Skill>[]>
}
```

Behaviors:

- **Agents / commands:** straightforward concat across providers, filtered by `origins` if supplied.
- **Skills dedup:** by **canonicalized absolute path** (`fs.realpathSync`). When two providers produce the same file, the second appends to `origins[]` instead of creating a new entry. Symlinks therefore don't double-count.
- **Filter semantics:** `filter.origins` is matched against `entity.origins` (`some` overlap) so a shared skill stays visible when *any* of its origins is selected.
- **Single-label uses** (e.g. legacy `source` field in route responses) read `entity.origins[0]`.
- Registry is constructed once at server boot in `packages/cli/src/server/index.ts` and injected into routes.

## Routes

`packages/cli/src/server/routes/{agents,skills,commands}.ts`:

- Response shapes unchanged.
- New optional query param: `?origins=claude,opencode` (comma-joined). Empty / absent = all registered providers.
- Routes delegate to the injected `ProviderRegistry`.

## Migration order

This backend ships as two PRs:

1. **PR #1 — Types + Claude refactor.** Land `Origin`, `ProviderEntity`, `ConfigProvider`, `RenderBadge` in `@ohmyc/shared`. Refactor existing scanners into `ClaudeProvider`. Wire `ProviderRegistry` with one provider. Existing routes go through registry. **Pre-existing test suite passes unchanged** = checkpoint.
2. **PR #2 — Opencode + Agents providers.** Add `OpencodeProvider` and `AgentsSharedProvider` with their tests. Skill dedup-by-realpath landed here.

PR #3 (UI half) lives in the paired UI spec.

## Testing

New tests under `packages/cli/tests/server/services/`:

- **`provider-registry.test.ts`**
  - Skills dedup by realpath with a symlink fixture.
  - Origin filter query param honored (single, multi, missing).
  - Filter matches against `origins[]` for shared skills.
- **`opencode-provider.test.ts`**
  - macOS vs Linux global-path resolution (mock `os.platform()` and `os.homedir()`).
  - `OPENCODE_CONFIG_DIR` env override.
  - Empty / missing opencode dirs (silent fallback).
  - Frontmatter parse edge cases: missing `mode`, malformed `permission`, missing `description`.
- **`agents-shared-provider.test.ts`**
  - Skills only — no agents/commands listed.
  - Project + global path resolution.
- **Existing suite:** must pass unchanged after PR #1.

## Success criteria

- `/api/agents` with both `~/.claude/agents/foo.md` and `~/.config/opencode/agents/bar.md` present returns two entries with correct `origins` (each length 1).
- `/api/skills` with a `SKILL.md` reachable via Claude and Agents providers returns one entry with `origins: ['claude', 'agents']`.
- `/api/agents?origins=claude` returns only Claude-origin agents.
- Pre-existing tests pass unchanged after PR #1.
- New tests cover dedup-by-realpath, origin filter, opencode frontmatter edge cases.
- README and AGENTS.md updated with one paragraph: "OhMyC reads opencode config from `~/.config/opencode/` (or `~/Library/Application Support/opencode/` on macOS) and `<cwd>/.opencode/`."

## Risks & mitigations

- **`@ohmyc/shared` import cycle.** Provider interface lives in `shared`, providers live in `cli`. Mitigation: keep `shared/provider.ts` types-only — no runtime imports of `node:fs`.
- **Symlink farms.** Heavy symlink use under `~/.agents/skills/` could blow up dedup. Mitigation: realpath dedup + reuse existing scanner recursion-depth limit.
- **Opencode schema drift.** Opencode is younger than Claude Code; frontmatter shape may evolve. Mitigation: tolerant parsing — unknown fields pass through to the detail-panel metadata harvest, not rejected.

## Distribution

Ships in existing `@ohmyc/cli` via the same release pipeline that shipped the `OHMYC_HOME` migration (commit 8798403). No new artifact. CHANGELOG entry under `feat(explorer)`.

## Open questions deferred to v2

- Inline `agents` block in `opencode.json`.
- Project-dir walk-up to git-worktree-root for opencode (matches opencode's real behavior; deferred for symmetry with current Claude behavior).
- Single-file overrides via `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT`.
