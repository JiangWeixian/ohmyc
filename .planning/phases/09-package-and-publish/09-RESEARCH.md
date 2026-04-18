# Phase 9: Package and Publish - Research

**Researched:** 2026-04-13
**Domain:** npm packaging, bundling, global CLI distribution
**Confidence:** HIGH

## Summary

Phase 9 takes the working CLI from Phase 8 and makes it globally installable via `npm install -g @aiou/cu`. The CLI already has a working `cu` bin entry, a shebang (`#!/usr/bin/env node`), and a build pipeline (tsup + Vite) that produces `dist/index.js` and `dist/ui/`. The core work is: (1) extending tsup's `noExternal` to bundle all runtime dependencies into a single self-contained JS file, (2) configuring the `files` field in package.json to ship only the essentials, and (3) adjusting the published package name from the internal `@claudeui/cli` to `@aiou/cu`.

The current build produces a 1.5 MB dist directory with external imports to 8 npm packages (fastify, @fastify/static, cac, get-port, open, gray-matter, proper-lockfile, zod-to-json-schema). All are pure JavaScript with no native addons, so tsup can bundle them all. The UI static assets (860 KB) are already copied into `dist/ui/` via the existing tsup `onSuccess` hook.

**Primary recommendation:** Extend the existing tsup `noExternal` array to list all 8 runtime dependencies explicitly, add a `files` field to package.json, add a `prepublishOnly` script, and configure scoped registry for `@aiou` to publish to the public npm registry.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Published as `@aiou/cu` on npm public registry
- **D-02:** Bin entry `cu` points to bundled dist file
- **D-03:** Keep `@claudeui/cli` as internal workspace name -- published package name differs
- **D-04:** Bundle ALL runtime dependencies into a single ESM dist file via tsup `noExternal` -- published package has zero runtime deps
- **D-05:** UI assets pre-built via `prepublishOnly` script: builds UI first, then CLI (which copies UI assets via tsup onSuccess)
- **D-06:** `@claudeui/shared` already inlined (current tsup config); extend `noExternal` to all runtime deps
- **D-07:** Published tarball contains: dist/index.js (+ sourcemap), dist/ui/ (static assets), package.json, README -- nothing else
- **D-08:** Move all current `dependencies` into tsup `noExternal` for bundling
- **D-09:** Published package `dependencies` field is empty -- everything is bundled
- **D-10:** Dev deps stay as devDeps for development only
- **D-11:** Manual `npm publish` -- no CI automation for MVP
- **D-12:** Version bumps done manually in package.json before publish
- **D-13:** `prepublishOnly` script ensures clean build before publish

### Claude's Discretion
- Exact npmignore / files field configuration
- Sourcemap inclusion strategy
- README content for npm landing page

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | `cu` is installable globally via `npm install -g` (or equivalent) | bin field already configured; package name needs changing to @aiou/cu |
| PKG-02 | Package includes built CLI and UI assets ready to run without build step | prepublishOnly + files field + noExternal bundling covers this |
| PKG-03 | CLI works after global install without additional setup or dev dependencies | Zero-dep bundle via tsup noExternal ensures this |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsup | 8.5.1 | CLI bundler (already in use) | Already configured; esbuild-based, fast, handles ESM output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| esbuild | ^0.27.0 (via tsup) | Underlying bundler | Automatic via tsup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsup | tsdown | tsdown is the recommended migration path from unmaintained tsup, but tsup already works and the config change is minimal. Migrating bundlers is out of scope for this phase. |
| tsup | rollup/tsx | Heavier config for same result |

**Installation:**
No new packages needed. All tools already installed in the project.

**Version verification:**
```
tsup: 8.5.1 [VERIFIED: npm registry]
esbuild: ^0.27.0 (bundled with tsup)
```

## Architecture Patterns

### Current Build Output Structure
```
packages/cli/dist/
├── index.js          # CLI entry (80 KB, currently has external imports)
├── chunk-*.js        # Code-split chunks from tsup
├── src-*.js          # Source-mapped chunks
└── ui/               # Copied from packages/ui/dist via onSuccess
    ├── index.html
    └── assets/
        ├── index-*.js
        └── index-*.css
```

### Target Published Tarball Structure
```
@aiou/cu/
├── package.json      # name: @aiou/cu, bin: { cu: dist/index.js }
├── README.md         # Landing page
├── dist/
│   ├── index.js      # Single bundled ESM file with all deps
│   └── ui/
│       ├── index.html
│       └── assets/
│           ├── index-*.js
│           └── index-*.css
```

### Pattern 1: Explicit noExternal List (Recommended)
**What:** List each runtime dependency by name in `noExternal` array rather than using a catch-all regex.
**When to use:** When you have a known, finite set of dependencies to bundle.
**Example:**
```typescript
// packages/cli/tsup.config.ts
import { defineConfig } from 'tsup';
import { cpSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [
    '@claudeui/shared',
    '@fastify/static',
    'cac',
    'fastify',
    'get-port',
    'gray-matter',
    'open',
    'proper-lockfile',
    'zod-to-json-schema',
  ],
  onSuccess: async () => {
    // ... existing UI copy logic
  },
});
```
**Why explicit list over regex `/(.*)/`:** The regex `/(.*)/` was reported as unreliable in tsup versions after 6.2.1 [CITED: github.com/egoist/tsup/issues/619]. Explicit listing is deterministic, auditable, and avoids bundling Node.js built-ins or dev-only packages. The project has only 9 dependencies to list.

### Pattern 2: files Field Allowlist (Recommended over .npmignore)
**What:** Use `package.json` `files` array to explicitly include only what should be published.
**Example:**
```json
{
  "files": ["dist", "README.md"]
}
```
**Why:** `files` is an allowlist -- only listed items ship. `.npmignore` is a blocklist -- everything ships except what's listed. Allowlists are safer: you can't accidentally publish secrets, source code, or test files. `package.json` and `LICENSE` are always included automatically by npm. [CITED: docs.npmjs.com/cli/v9/using-npm/developers] [CITED: github.com/nodejs/package-maintenance/issues/164]

### Pattern 3: Scoped Registry Configuration
**What:** Configure `@aiou` scope to publish to public npm registry while keeping default registry unchanged.
**When to use:** When the machine's default npm registry is private (e.g., `https://registry.npmjs.org/`) but you need to publish to the public registry.
**Example (in packages/cli/.npmrc):**
```
@aiou:registry=https://registry.npmjs.org/
```
**Why:** The current machine has `registry=https://registry.npmjs.org//` in `~/.npmrc`. Without scoped registry config, `npm publish` would attempt to publish to the internal registry and fail. This scoped config can live in `packages/cli/.npmrc` (project-local) so it does not affect other packages. [VERIFIED: `npm config get registry` returns https://registry.npmjs.org/]

### Anti-Patterns to Avoid
- **Using `noExternal: [/(.*)/]` regex:** Reported unreliable in tsup v8+ [CITED: github.com/egoist/tsup/issues/619]. Use explicit array instead.
- **Using `.npmignore` instead of `files`:** Blocklist approach risks publishing source, tests, configs. Use `files` allowlist. [CITED: medium.com/@jdxcode/for-the-love-of-god-dont-use-npmignore]
- **Publishing with `dependencies` listed:** If `dependencies` are listed in the published package.json but not installed (because they're bundled), npm will warn or error. The published `dependencies` must be empty per D-09.
- **Leaving `claudeui` bin entry in published package:** The CONTEXT.md does not restrict this, but having both `cu` and `claudeui` bin entries in the published package is fine for discovery. Per D-02, `cu` is the primary entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency bundling | Custom esbuild/rollup config | tsup `noExternal` array | Already configured, one-line change per dep |
| Tarball content filtering | Custom publish script or .npmignore | `files` field in package.json | npm built-in, allowlist approach |
| Pre-publish build | Custom shell script | `prepublishOnly` npm lifecycle hook | Standard npm convention, runs automatically |
| Version management | Custom version bump script | `npm version patch|minor|major` | Built-in, creates git tag automatically |

**Key insight:** This phase is almost entirely configuration changes, not new code. The build pipeline already works; we're extending it.

## Runtime State Inventory

> This is a greenfield packaging phase. No existing runtime state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- CLI reads from `~/.claude/` at runtime, no data embedded | None |
| Live service config | None -- no external services configured by the package | None |
| OS-registered state | None -- npm global install handles PATH registration via bin field | None |
| Secrets/env vars | None -- no secrets in package. AGENT_HOME env var is runtime, not publish-time | None |
| Build artifacts | packages/cli/dist/ -- will be rebuilt before publish | `prepublishOnly` handles clean rebuild |

## Common Pitfalls

### Pitfall 1: npm publish goes to wrong registry
**What goes wrong:** `npm publish` uses the default registry (`https://registry.npmjs.org/`) instead of the public npm registry, causing a 404 or auth error.
**Why it happens:** The global `~/.npmrc` sets `registry=https://registry.npmjs.org//`.
**How to avoid:** Add a project-local `.npmrc` at `packages/cli/.npmrc` with `@aiou:registry=https://registry.npmjs.org/`. This overrides the default for the `@aiou` scope only. [VERIFIED: current registry confirmed as https://registry.npmjs.org/]
**Warning signs:** `npm publish` returns 404, or `npm pack` output shows wrong registry URL.

### Pitfall 2: tsup produces multiple chunks instead of single file
**What goes wrong:** tsup code-splits, producing `chunk-*.js` and `src-*.js` files alongside `index.js`, which may not all be included in the published tarball or may have cross-import issues.
**Why it happens:** tsup's default code-splitting behavior for dynamic imports (e.g., `await import('zod-to-json-schema')` in settings route).
**How to avoid:** Consider adding `splitting: false` to tsup config, or ensure all chunks are included in the `files` field. Test with `npm pack --dry-run` and verify the extracted tarball works by running `node dist/index.js` from a temp directory.
**Warning signs:** Published package throws "Cannot find module" for chunk files.

### Pitfall 3: zod-to-json-schema peer dependency not satisfied
**What goes wrong:** `zod-to-json-schema` has `peerDependencies: { "zod": "^3.25.28 || ^4" }`. If zod is not available at runtime, the package fails.
**Why it happens:** When bundling, tsup resolves peer deps differently. If zod is bundled through `@claudeui/shared` (already in `noExternal`), it should be included.
**How to avoid:** Verify the final bundle includes zod code by grepping the built output. Since `@claudeui/shared` is already in `noExternal` and it depends on `zod`, the zod code should be transitively bundled. [VERIFIED: @claudeui/shared has `zod: ^3.23.8` as dependency]
**Warning signs:** Runtime error "Cannot find module 'zod'" when using settings route.

### Pitfall 4: Proper-lockfile's graceful-fs wrapper breaks bundling
**What goes wrong:** `proper-lockfile` depends on `graceful-fs`, which wraps Node's `fs` module. Bundlers sometimes struggle with this pattern.
**Why it happens:** `graceful-fs` patches `fs` at runtime.
**How to avoid:** Test that the bundled CLI correctly locks files by running the existing test suite after bundling. The lockService tests cover this. [VERIFIED: proper-lockfile deps are all pure JS: graceful-fs, retry, signal-exit]
**Warning signs:** Lock-related operations fail silently or throw.

### Pitfall 5: package.json name mismatch in workspace
**What goes wrong:** Changing `packages/cli/package.json` `name` from `@claudeui/cli` to `@aiou/cu` breaks the pnpm workspace resolution. Other packages that import from `@claudeui/cli` would fail.
**Why it happens:** pnpm resolves workspace packages by name.
**How to avoid:** Per D-03, keep `name: "@claudeui/cli"` in the workspace package.json. Create a separate mechanism for the published name. Options: (a) a build step that rewrites the name in the dist output, or (b) use `publishConfig` in package.json to override the name at publish time.
**Warning signs:** `pnpm install` fails after name change, or workspace imports break.

## Code Examples

### Verified pattern: publishConfig override for package name

npm supports a `publishConfig` field that can override `name` during publish without changing the workspace name. [ASSUMED -- needs verification with current npm version]

```json
{
  "name": "@claudeui/cli",
  "version": "0.1.0",
  "publishConfig": {
    "name": "@aiou/cu",
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

**Note:** The `publishConfig.name` field is NOT a standard npm feature. npm only supports `publishConfig.access`, `publishConfig.registry`, and `publishConfig.tag`. To change the published name, you need to either:
1. Actually rename the package.json `name` field (which would break workspace), OR
2. Use a publish script that temporarily changes the name before publish, OR
3. Keep `@claudeui/cli` as the published name and accept the constraint

**Recommended approach:** Since this is a monorepo, the cleanest solution is to use a `prepublishOnly` script that handles the name override. However, the simplest working approach per D-03 is:

```json
{
  "name": "@claudeui/cli",
  "scripts": {
    "prepublishOnly": "node scripts/prepublish.mjs",
    "build:full": "pnpm --filter @claudeui/ui build && tsup",
    "build": "tsup"
  }
}
```

Where `scripts/prepublish.mjs` would:
1. Run `build:full` (UI then CLI)
2. Optionally modify the dist package.json if needed

**Simpler alternative:** Just use the workspace name `@claudeui/cli` as the published name and add a second `cu` bin. But D-01 explicitly says `@aiou/cu`. This needs explicit planning. [ASSUMED -- `publishConfig.name` is not standard npm]

### Verified pattern: files field for CLI package

```json
{
  "files": [
    "dist/index.js",
    "dist/ui/"
  ]
}
```

npm always includes `package.json`, `README.md`, `CHANGELOG.md`, and `LICENSE`/`LICENCE` automatically. The `files` array is additive on top of these. [CITED: docs.npmjs.com/cli/v9/using-npm/developers]

### Verified pattern: tsup noExternal for self-contained bundles

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [
    // List every runtime dependency that should be bundled
    '@claudeui/shared',
    '@fastify/static',
    'cac',
    'fastify',
    'get-port',
    'gray-matter',
    'open',
    'proper-lockfile',
    'zod-to-json-schema',
  ],
});
```

[CITED: github.com/egoist/tsup -- "dependencies and peerDependencies from your package.json are always excluded. You can use noExternal to override"]

### Verified pattern: npm pack dry-run for verification

```bash
# From packages/cli directory:
npm pack --dry-run 2>&1
# Lists every file that would be included in the tarball

# Full verification flow:
cd packages/cli
pnpm build:full
npm pack --dry-run
tar -tzf *.tgz  # List contents of the generated tarball
```

[CITED: docs.npmjs.com -- npm pack creates a tarball from a package]

### Verified pattern: Testing the published package locally

```bash
# Method 1: npm pack + global install from tarball
cd packages/cli
npm pack
npm install -g @aiou/cu-0.1.0.tgz
cu  # Should start the server

# Method 2: npm link (uses current directory)
cd packages/cli
npm link
cu  # Should work via symlink
```

[CITED: docs.npmjs.com -- npm link creates a symlink for local testing]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.npmignore` blocklist | `files` allowlist in package.json | Long-standing best practice | Safer publishing, smaller tarballs |
| tsup | tsdown (successor) | tsup marked unmaintained Nov 2025 | tsup still works but consider tsdown for future phases |
| `noExternal: [/(.*)/]` | Explicit `noExternal` array | tsup v7+ | Regex unreliable; list packages explicitly |

**Deprecated/outdated:**
- `tsup` is no longer actively maintained as of November 2025. The maintainer recommends [tsdown](https://tsdown.dev/) as a migration path. [VERIFIED: github.com/egoist/tsup README states "This project is not actively maintained anymore"]
- For this phase, staying on tsup is the right call -- the config change is minimal and tsup works. A tsdown migration could be a future improvement.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `publishConfig.name` is not a standard npm field -- cannot override published name without changing `package.json` `name` | Architecture Patterns | Medium: If it IS supported, we don't need the prepublishOnly script workaround. If it isn't, we need the script or must actually change the name. |
| A2 | All transitive dependencies of the 9 listed packages will be bundled by tsup when the direct deps are in `noExternal` | Architecture Patterns | Low: tsup/esbuild transitively bundle imports of noExternal packages. This is standard bundler behavior. |
| A3 | The `open` package's platform-specific logic (macOS, Windows, Linux, WSL) works correctly when bundled | Common Pitfalls | Medium: `open` v11 uses dynamic imports internally. Should work with bundling but needs testing on target platforms. |
| A4 | The user has npm credentials configured for the public registry under the `@aiou` scope | Architecture Patterns | High: If no npm account or org exists for `@aiou`, publishing will fail. User must create the org/account before publish. |

## Open Questions

1. **How to handle the package name mismatch between workspace (`@claudeui/cli`) and published name (`@aiou/cu`)?**
   - What we know: D-03 says keep `@claudeui/cli` as internal name; D-01 says publish as `@aiou/cu`.
   - What's unclear: Whether npm's `publishConfig` supports a `name` override (it does not appear to in standard npm).
   - Recommendation: Use a `prepublishOnly` script that builds, then temporarily modifies the name in the dist output, OR accept that the actual package.json `name` must be `@aiou/cu` and update workspace references accordingly. The planner should clarify with the user which approach is preferred.

2. **Does the `@aiou` npm organization exist?**
   - What we know: `@aiou/cu` does not exist on the public npm registry yet (404 response).
   - What's unclear: Whether the user has an npm account with the `@aiou` org created.
   - Recommendation: The user must create the `@aiou` org on npmjs.com before first publish. This should be a manual prerequisite step documented in the plan.

3. **Should `dist/chunk-*.js` and `dist/src-*.js` files be included in the published tarball?**
   - What we know: tsup currently produces multiple chunk files due to code splitting.
   - What's unclear: Whether `noExternal` + `splitting: false` will consolidate into a single file, or if multiple chunks will remain.
   - Recommendation: Test after extending `noExternal`. If chunks remain, include `dist/` directory in `files` (not just `dist/index.js`). The `files` field should use `["dist"]` to include everything under dist, or be specific about expected chunk patterns.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime + build | Yes | v20.19.5 | -- |
| npm | Publishing | Yes | 10.8.2 | -- |
| pnpm | Workspace + build | Yes | 10.17.1 | -- |
| tsup | Bundling | Yes | 8.0.2 (local) / 8.5.1 (latest) | -- |
| Public npm registry access | Publishing @aiou/cu | Unknown | -- | Manual verification needed |
| @aiou npm org | Publishing | Unknown | -- | User must create |

**Missing dependencies with no fallback:**
- Public npm registry authentication for `@aiou` scope -- user must have npm account and org set up before `npm publish` will succeed. This is a manual prerequisite, not a code change.

**Missing dependencies with fallback:**
- None identified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | packages/cli/vitest.config.ts |
| Quick run command | `cd packages/cli && pnpm test` |
| Full suite command | `cd packages/cli && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | `cu` installable globally via npm | manual-only | npm pack + global install + run `cu` | N/A -- manual |
| PKG-02 | Package includes built CLI + UI assets | unit | `npm pack --dry-run` + verify output | Wave 0 |
| PKG-03 | CLI works after global install without deps | manual-only | install from tarball + run `cu` | N/A -- manual |

### Sampling Rate
- **Per task commit:** `cd packages/cli && pnpm test`
- **Per wave merge:** `cd packages/cli && pnpm test && npm pack --dry-run`
- **Phase gate:** Full suite green + `npm pack --dry-run` shows correct files + manual global install test passes

### Wave 0 Gaps
- [ ] `packages/cli/src/__tests__/package.test.ts` -- verifies `files` field includes dist, `bin.cu` points to correct file, `dependencies` is empty in published output
- [ ] Build verification script or test that confirms `noExternal` bundling produces a self-contained file (no external `from` imports except Node built-ins)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | npm handles auth (npm login + tokens) |
| V3 Session Management | no | Not applicable |
| V4 Access Control | no | npm scope/org controls publish permissions |
| V5 Input Validation | yes | zod schemas already validate all API inputs |
| V6 Cryptography | no | No crypto in the CLI package |

### Known Threat Patterns for npm Publishing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental secret publishing | Information Disclosure | `files` allowlist prevents publishing source, `.env`, etc. |
| Supply chain via dependencies | Tampering | All deps bundled at publish time; no runtime resolution |
| Namespace squatting | Spoofing | `@aiou` org controls who can publish under scope |
| Tarball tampering | Tampering | npm registry provides integrity hashes |

## Sources

### Primary (HIGH confidence)
- npm registry -- verified versions of all dependencies (fastify 5.8.4, @fastify/static 9.1.0, cac 7.0.0, get-port 7.2.0, open 11.0.0, gray-matter 4.0.3, proper-lockfile 4.1.2, zod-to-json-schema 3.25.2)
- tsup GitHub README -- "not actively maintained, consider tsdown" [VERIFIED: github.com/egoist/tsup]
- npm docs -- `files` field behavior [CITED: docs.npmjs.com/cli/v9/using-npm/developers]

### Secondary (MEDIUM confidence)
- github.com/egoist/tsup/issues/619 -- `noExternal` regex unreliable after v6.2.1
- github.com/nodejs/package-maintenance/issues/164 -- `files` field recommended over `.npmignore`
- Node.js package maintenance working group -- baseline practices for publishing

### Tertiary (LOW confidence)
- `publishConfig.name` not being a standard npm field [ASSUMED -- not found in official docs, needs user verification]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified on npm registry, versions confirmed
- Architecture: HIGH -- patterns verified against npm docs and tsup docs
- Pitfalls: MEDIUM -- tsup chunk splitting behavior needs empirical verification after noExternal change

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain -- npm packaging conventions change slowly)
