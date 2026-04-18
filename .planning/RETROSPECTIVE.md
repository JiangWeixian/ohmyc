# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — ClaudeUI MVP

**Shipped:** 2026-04-07
**Phases:** 3 | **Plans:** 9 | **Timeline:** 20 days

### What Was Built
- Store import pipeline with provenance tracking, overwrite preview, and source-aware inventory badges
- Profile composition editor with sectioned layout, activation-readiness detail, and active-profile normalization
- Transactional activation engine with undo stack, file-based locking (proper-lockfile), preflight validation, and rollback on failure
- Safety UX: confirmation dialogs for switch/activate/risky operations, inline profile reference chips in store browser, active-profile delete protection

### What Worked
- Wave-based parallel execution kept context lean — each subagent got fresh 200k context
- Transactional activation pattern (undo stack) prevented any partial-state bugs in testing
- Discriminated union for dialog state machine eliminated impossible UI states at compile time
- Per-profile backup naming convention made deactivation lookup deterministic

### What Was Inefficient
- ROADMAP/STATE drift — phase completion wasn't always reflected in ROADMAP.md, requiring catch-up in the final session
- Plan 02-03 checkbox wasn't checked off in ROADMAP despite being complete (administrative lag)
- Regression gate test runs were slow — needed to run from packages/cli/ not root due to vitest resolution

### Patterns Established
- File-based advisory locking with 10s stale threshold for all profile mutation operations
- Per-field fieldErrors state for JSON validation (not global error strings)
- Discriminated union state machines for multi-state UI flows
- Backup files named after the activating profile for simple deactivation lookup

### Key Lessons
1. Always run `phase complete` immediately after verification — don't defer ROADMAP updates
2. Run vitest from the package directory where it's installed, not from monorepo root
3. Transactional patterns with undo stacks are worth the upfront complexity for filesystem operations
4. Preflight validation endpoints enable richer frontend UX without blocking the main operation path

### Cost Observations
- Model mix: 0% opus, 100% sonnet, 0% haiku (all executor and verifier agents ran sonnet)
- Plans: 9 total, avg ~8 min per plan
- Notable: Phase 3 plan 01 took 19 min (most complex — locking + transactions + rollback) while plan 02 took 6 min (frontend wiring)

---

## Milestone: v1.3 — CLI MVP

**Shipped:** 2026-04-16
**Phases:** 2 | **Plans:** 5

### What Was Built
- Fastify server with packaged static asset resolution and SPA fallback routing
- `cu` CLI command with startup status logging, browser auto-open, and port fallback
- Self-contained CJS bundle via tsup with all 9 runtime deps inlined (2.13 MB)
- Prepublish pipeline: name rewrite to `@aiou/cu`, files allowlist, zero-dep tarball
- CJS compatibility with esbuild banner+define shim for `import.meta.url`

### What Worked
- TDD approach in Phase 8 (RED/GREEN commits) caught issues early
- Explicit noExternal list for tsup was more reliable than regex catch-all
- Files allowlist pattern gave precise control over npm tarball contents
- Phase 9 gap closure plan (09-03) fixed real runtime bugs found during verification

### What Was Inefficient
- ESM→CJS switch in 09-03 caused cascading changes (extensions, import.meta shim, test updates) — could have started with CJS if anticipated
- REQUIREMENTS.md checkboxes never got updated despite all work being done
- ROADMAP.md progress table showed "Not started" / "Gaps found" even after phases completed

### Patterns Established
- Banner+define shim: inject banner variable then use esbuild define to replace import.meta.url
- CJS .cjs extension for type:module packages to avoid module system conflicts
- Prepublish rewrite pattern: modify package.json in-memory, restore on process exit
- Node builtin filtering when checking bundled output for external npm imports

### Key Lessons
1. Start with CJS output when package.json has type:module — avoids downstream extension conflicts
2. REQUIREMENTS.md traceability should be updated during execution, not at milestone completion
3. Gap closure plans are high-value when verification uncovers real runtime issues
4. Prepublish scripts need a restore mechanism to avoid permanently modifying package.json

### Cost Observations
- Model mix: balanced profile (opus/sonnet/haiku)
- Plans: 5 total, avg ~7 min per plan (range 4–11 min)
- Notable: 09-03 gap closure was longest at 11 min due to CJS cascading fixes

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 20 days | 3 | Established GSD workflow from scratch — store, profiles, safety |
| v1.1 | 1 day | 1 | Rapid bugfix cycle — Explorer tab corrections |
| v1.2 | 5 days | 3 | Model config as first-class component with full activation pipeline |
| v1.3 | 1 day | 2 | CLI packaging and publish — self-contained CJS bundle |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 194 | Full | proper-lockfile (1 runtime dep) |
| v1.3 | 275 | Full | open (1 runtime dep, fully bundled) |

### Top Lessons (Verified Across Milestones)

1. Run `phase complete` eagerly — deferred ROADMAP updates create state drift
2. Transactional patterns with undo stacks prevent partial-state bugs in filesystem operations
3. Preflight validation endpoints decouple frontend UX from backend operation paths
4. Start with CJS when package.json has type:module — avoids cascading extension issues
5. Gap closure plans are high-value when verification uncovers real runtime bugs
