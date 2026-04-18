# Phase 9: Package and Publish - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `cu` installable globally via npm with zero additional setup. Users run `npm i -g @aiou/cu` and `cu` works immediately — no build, no dev dependencies, no configuration. This phase takes the working CLI from Phase 8 and makes it distributable.

</domain>

<decisions>
## Implementation Decisions

### Package naming & registry
- **D-01:** Published as `@aiou/cu` on npm public registry
- **D-02:** Bin entry `cu` points to bundled dist file
- **D-03:** Keep `@claudeui/cli` as internal workspace name — published package name differs

### Build & bundling strategy
- **D-04:** Bundle ALL runtime dependencies into a single ESM dist file via tsup `noExternal` — published package has zero runtime deps
- **D-05:** UI assets pre-built via `prepublishOnly` script: builds UI first, then CLI (which copies UI assets via tsup onSuccess)
- **D-06:** `@claudeui/shared` already inlined (current tsup config); extend `noExternal` to all runtime deps
- **D-07:** Published tarball contains: dist/index.js (+ sourcemap), dist/ui/ (static assets), package.json, README — nothing else

### Dependency packaging
- **D-08:** Move all current `dependencies` (fastify, @fastify/static, cac, get-port, open, gray-matter, proper-lockfile, zod-to-json-schema) into tsup `noExternal` for bundling
- **D-09:** Published package `dependencies` field is empty — everything is bundled
- **D-10:** Dev deps (tsup, vitest, typescript, tsx, @types/*) stay as devDeps for development only

### Publish workflow
- **D-11:** Manual `npm publish` — no CI automation for MVP
- **D-12:** Version bumps done manually in package.json before publish
- **D-13:** `prepublishOnly` script ensures clean build before publish

### Claude's Discretion
- Exact npmignore / files field configuration
- Sourcemap inclusion strategy
- README content for npm landing page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Package configuration
- `packages/cli/package.json` — Current bin entries, deps, scripts
- `packages/cli/tsup.config.ts` — Current bundling config, UI asset copy logic

### Phase 8 outputs
- `.planning/phases/08-cli-launcher/08-01-SUMMARY.md` — What Phase 8 built (server contract, asset bundling)
- `.planning/phases/08-cli-launcher/08-02-SUMMARY.md` — What Phase 8 built (launcher flow, cu bin mapping)

### Project requirements
- `.planning/REQUIREMENTS.md` § Packaging — PKG-01, PKG-02, PKG-03
- `.planning/ROADMAP.md` § Phase 9 — Goal, success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/cli/tsup.config.ts`: Already does ESM bundling with `noExternal: ['@claudeui/shared']` and UI asset copy via `onSuccess`. Extend `noExternal` to bundle all deps.
- `packages/cli/package.json`: Already has `bin.cu` and `bin.claudeui` entries, `build:full` script that builds UI then CLI.
- `packages/ui/vite.config.ts`: React app build — outputs to `packages/ui/dist`.

### Established Patterns
- Monorepo with pnpm workspaces: `@claudeui/cli`, `@claudeui/ui`, `@claudeui/shared`
- ESM-only output (type: module)
- tsup for CLI bundling, Vite for UI bundling

### Integration Points
- `packages/cli/package.json` — name, version, bin, scripts, dependencies, files field
- `packages/cli/tsup.config.ts` — noExternal list, onSuccess UI copy
- `.npmignore` or `package.json.files` — control what's in the tarball

</code_context>

<specifics>
## Specific Ideas

- Package name is `@aiou/cu` (user's org on npm), not `@anthropic/claudeui`
- `cu` must work immediately after `npm i -g @aiou/cu` — PKG-03 is the hard requirement

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-package-and-publish*
*Context gathered: 2026-04-13*
