# Stack Research

**Domain:** Claude-focused local extension and profile manager
**Researched:** 2026-04-16 (v1.4 update: project-local config + .cu rebrand)
**Confidence:** HIGH

## Recommended Stack

### Core Technologies (unchanged from v1.3)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20 LTS+ | Local runtime for filesystem, symlink, and process orchestration | Local-first, CLI-backed; stable `fs/promises`, symlink support, cross-platform |
| TypeScript | 5.x | Shared type-safe domain model across UI, server, and file schemas | Profile composition and config overlay are easy to break with loose typing |
| Fastify | 4.x | Local API layer for store/profile orchestration | I/O-heavy routes, already in use, no reason to change |
| React + Vite | React 18 / Vite 5 | Responsive local web UI | Rich stateful desktop-like interface; matches current codebase |
| Zod | 3.x | Validation for metadata, profiles, API payloads | Trust boundary before anything touches disk |

### v1.4 New Addition: Project-Local Config Discovery

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `find-up` | 8.0.0 | Walk up from CWD to discover `.claude/` project directory | Standard solution for "find closest ancestor directory." ESM-only but tsup bundles it cleanly (same pattern as `get-port` and `open` which are already ESM-only and working in CJS output). Provides both async `findUp()` and sync `findUpSync()`. |

### v1.4 Internal Changes (no new library needed)

| Capability | Approach | Why No New Library |
|------------|----------|--------------------|
| Deep merge (global + project settings) | Existing `ProfileService.deepMerge()` method | Already implemented at `profileService.ts:159`. Handles nested objects, skips arrays. Sufficient for merging global user settings with project overrides. |
| Source attribution (global vs project) | Extend existing `InventorySource` type union | `SourceBadge` already supports `'local' | 'profile' | 'plugin'`. Add `'project'` variant following the same pattern. No library needed. |
| Directory rebrand (`.claude` to `.cu` for writes) | Replace `AGENT_HOME` default + update path construction | Currently `process.env.AGENT_HOME || '.claude'`. Change default to `.cu`, update all `baseDir`-dependent paths. Pure code change, no new dependency. |
| Migration of existing `.claude/` data to `.cu/` | Simple `fs.rename` or `fs.cpSync` at startup | ClaudeUI's own store/profiles live inside the base directory. A one-time migration script on first run handles the move. No migration library needed. |

### Supporting Libraries (unchanged)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | 5.x | Client cache and mutation coordination | Store CRUD, profile activation, active-state refresh |
| `gray-matter` | 4.0.3 | Parse Claude-style markdown metadata for agents/commands | Importing and normalizing markdown-defined component files |
| `proper-lockfile` | 4.1.2 | Inter-process file locking for activation | Prevents race conditions during concurrent profile switches |
| `cac` | 6.7.14 | CLI argument parsing | Already used in `index.ts` for the `cu` command |
| `open` | 11.0.0 | Open browser on launch | Already used in `launcher.ts` |
| `get-port` | 7.1.0 | Port conflict resolution | Already used in `startServer()` |
| `zod-to-json-schema` | 3.23.5 | Settings schema export | Already used in settings route |
| `vitest` | 2.x | Service and route verification | Activation rollback, import conflict, schema tests |

### Development Tools (unchanged)

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm workspace | Monorepo package management | Keep boundaries between `ui`, `cli`, `shared` |
| tsup | 8.x | CJS self-contained bundle | Must add `find-up` to `noExternal` list |
| ESLint + TypeScript rules | Prevent drift in file-manipulation code | Activation logic is side-effect heavy |

## Installation

```bash
# v1.4 addition (only new dependency)
cd packages/cli && pnpm add find-up

# No other new packages needed
```

## tsup Configuration Change

`find-up` must be added to the `noExternal` list in `packages/cli/tsup.config.ts`:

```typescript
noExternal: [
  '@claudeui/shared',
  '@fastify/static',
  'cac',
  'fastify',
  'find-up',        // <-- NEW: project-local config discovery
  'get-port',
  'gray-matter',
  'open',
  'proper-lockfile',
  'zod-to-json-schema',
],
```

This is required because `find-up` is ESM-only (`"type": "module"` in its package.json). tsup must inline it during bundling. This is the same approach already used for `get-port`, `open`, and `cac` which are all ESM-only.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `find-up@8` for project discovery | Hand-rolled `while` loop walking `path.dirname` up | `find-up` handles edge cases (root reached, permissions, symlinks) and is 20 lines of battle-tested code vs. a naive loop that misses edge cases. The 7KB bundled cost is negligible. |
| `find-up@8` for project discovery | `pkg-dir` (finds nearest `package.json`) | Not every Claude project has a `package.json`. We need `.claude/` directory specifically, not a generic project root. |
| `find-up@8` for project discovery | `env-paths` or XDG conventions | Claude Code uses `.claude/` not XDG. Must follow Claude's convention. |
| Existing `deepMerge` for settings merge | `deepmerge@4` npm package | The existing merge is 12 lines, handles our exact use case (objects deep, arrays overwrite). Adding a 15KB library for identical behavior is not justified. |
| `.cu` for new write path | Keep `.claude` for everything | The PROJECT.md explicitly requires the rebrand. `.cu` distinguishes ClaudeUI-managed data from Claude Code's own `~/.claude/` contents, preventing conflicts and making ownership clear. |
| `.cu` for new write path | `.claudeui` as directory name | Shorter, matches the `cu` CLI command name, easier to type. The `cu` brand is already established as the binary name. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chokidar` or file watchers for project config | Unnecessary complexity; project config is loaded once at startup, not watched in real-time. The CLI is short-lived (start, configure, close). | Load project config at server start, expose via API, refresh on explicit user action. |
| A database for merged config views | Project config is 1-2 small JSON files. Merging at read time is trivial and keeps the source of truth on disk. | In-memory merge at API boundary using existing `deepMerge`. |
| `glob` or `fast-glob` for `.claude/` discovery | We know the exact path: `<project>/.claude/`. No pattern matching needed. | Direct `existsSync` or `findUp('.claude', { type: 'directory' })`. |
| Symlinks for `.cu` pointing to `.claude` | Creates ambiguity about which is canonical, breaks `lstat`/`readlink` source detection. | Clean migration: copy/move `.claude/` contents to `.cu/` once, then use `.cu/` exclusively. |
| Environment variable per-project config | `AGENT_HOME` is already the override mechanism. Adding more env vars per project would conflict with the CLI's single-process model. | Project config discovered from CWD, global config from `AGENT_HOME`. |

## Integration Points for v1.4

### 1. Server Startup (`packages/cli/src/server/index.ts`)

Current state:
```typescript
const agentHome = process.env.AGENT_HOME || '.claude';
const baseDir = path.join(os.homedir(), agentHome);
```

Required change:
- Global baseDir changes default from `.claude` to `.cu`
- New: discover project local `.claude/` from `process.cwd()` using `findUp`
- Pass both `globalBaseDir` and `projectBaseDir` to route registration

### 2. Route Handlers (`packages/cli/src/server/routes/*.ts`)

Current: every route receives a single `baseDir` string.

Required change: routes that display merged views (agents, skills, commands, configs, settings) must receive both global and project paths and merge results. Routes that write (profiles, store) write to the global base dir only (`.cu`).

### 3. Source Attribution (`packages/cli/src/server/routes/inventorySource.ts`)

Current: resolves `'local' | 'profile'` by checking symlinks.

Required change: add `'project'` to the resolution logic. Items found in `<project>/.claude/` get tagged as `source: 'project'`.

### 4. UI SourceBadge (`packages/ui/src/components/SourceBadge.tsx`)

Current: renders `'local' | 'profile' | 'plugin'` badges.

Required change: add `'project'` badge with distinct styling (e.g., green/teal).

### 5. ProfileService (`packages/cli/src/server/services/profileService.ts`)

Current: `constructor(private baseDir: string)` -- single directory.

Required change: activation writes go to `.cu` (already via baseDir). Reading for preflight/merge should consider project-level overrides. The `deepMerge` method already exists and works.

### 6. Settings Route (`packages/cli/src/server/routes/settings.ts`)

Current: already has project-aware read/write via `?project=<path>` query param.

Required change: merge global `~/.cu/settings.json` with `<project>/.claude/settings.json` for read endpoint. Write endpoint behavior depends on target scope.

## Claude Code Settings Hierarchy (verified from official docs)

Claude Code's own settings precedence (lowest to highest):
1. User: `~/.claude/settings.json`
2. Project shared: `.claude/settings.json`
3. Project local: `.claude/settings.local.json`
4. Managed: server/MDM/registry

ClaudeUI should mirror this pattern for merged views: global base is the foundation, project overlays on top. Arrays concatenate (like Claude's own behavior for `permissions.allow`), objects deep-merge, scalars from project override global.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `find-up@8` | tsup 8.x + CJS output | ESM-only source, but tsup inlines it. Same pattern as existing `get-port@7` and `open@11`. |
| `find-up@8` | `findUpSync` available | Sync version useful for startup discovery before async server init. |
| `fastify@4.x` | `zod@3.x` | Stable, already in use |
| `react@18.x` | `@tanstack/react-query@5.x` | Already in use |

## Sources

- [Context7 /sindresorhus/find-up] -- API verified: `findUp()`, `findUpSync()`, `type: 'directory'` option, ESM-only module type
- [Claude Code Settings Docs](https://code.claude.com/docs/en/settings) -- Settings hierarchy (user > project > local > managed), file locations, merge semantics
- [GitHub Issue #11626](https://github.com/anthropics/claude-code/issues/11626) -- Feature request for auto-merge of global and project settings
- npm registry -- Version verification: `find-up@8.0.0` (ESM-only), `fastify@5.8.5`, `@fastify/static@9.1.1`, `proper-lockfile@4.1.2`, `zod@4.3.6`
- Source code analysis -- `packages/cli/src/server/index.ts` (AGENT_HOME resolution), `profileService.ts` (deepMerge, baseDir usage), `settings.ts` (project query param), `inventorySource.ts` (source resolution), `SourceBadge.tsx` (badge rendering)

---
*Stack research for: Claude-focused local extension and profile manager*
*Updated: 2026-04-16 for v1.4 milestone (project-local loading + .cu rebrand)*
