# Milestones

## v1.3 CLI MVP (Shipped: 2026-04-16)

**Phases completed:** 2 phases, 5 plans, 9 tasks

**Key accomplishments:**

- Fastify server resolves packaged UI assets from dist/ui/ at runtime, serves SPA with fallback routing, and auto-selects open ports when the requested one is occupied
- One `cu` command starts the packaged server, prints startup phases, opens the browser to the actual running URL, and exits non-zero with an actionable error on failure
- CLI package configured as zero-dependency @aiou/cu with all 9 runtime deps bundled into single dist/index.js, prepublish name rewrite, and scoped npm registry routing
- 9-test suite verifying bin config, files allowlist, prepublishOnly, publishConfig, noExternal coverage, and self-contained bundle with no external npm imports
- CJS bundle format with esbuild import.meta.url shim, prepublishOnly build step, and runtime smoke test -- fixes dynamic require crash and adds 2 new verification tests

---

## v1.2 Model Config (Shipped: 2026-04-13)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.1 Bugfixes (Shipped: 2026-04-08)

**Phases completed:** 1 phases, 2 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.0 ClaudeUI MVP (Shipped: 2026-04-07)

**Phases completed:** 3 phases, 9 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---
