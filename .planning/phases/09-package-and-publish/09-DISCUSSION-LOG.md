# Phase 9: Package and Publish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 09-package-and-publish
**Areas discussed:** Package naming & registry, Build & bundling strategy, Dependency packaging, Publish workflow

---

## Package naming & registry

| Option | Description | Selected |
|--------|-------------|----------|
| npm public | Standard npm publish, public access | ✓ |
| npm private | Scoped but private, org members only | |
| Other registry | GitHub Packages or private registry | |

**User's choice:** npm public, package name `@aiou/cu`
**Notes:** ROADMAP originally said `@anthropic/claudeui` but user's org is `@aiou` on npm

---

## Build & bundling strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle everything | tsup bundles all deps, prepublishOnly builds UI first | ✓ |
| Ship source + deps | Unbundled source with node_modules | |

**User's choice:** Bundle everything into single ESM file, prepublishOnly script builds UI then CLI

---

## Dependency packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle all, zero runtime deps | All deps in noExternal, published package has empty dependencies | ✓ |
| Mixed approach | Bundle some, ship others as peerDeps | |

**User's choice:** Bundle all runtime deps — published package has zero runtime dependencies

---

## Publish workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Manual publish | `npm publish` when ready | ✓ |
| CI on tag push | GitHub Actions on v* tag | |
| Claude's Discretion | Skip automation for now | |

**User's choice:** Manual `npm publish` — simplest for MVP

---

## Claude's Discretion

- npmignore / files field configuration
- Sourcemap inclusion strategy
- README content for npm landing page

## Deferred Ideas

None — discussion stayed within phase scope.
