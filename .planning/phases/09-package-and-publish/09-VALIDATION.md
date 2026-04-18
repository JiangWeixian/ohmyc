---
phase: 9
slug: package-and-publish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (workspace root) |
| **Quick run command** | `pnpm --filter @claudeui/cli test -- --run` |
| **Full suite command** | `pnpm -r test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claudeui/cli test -- --run`
- **After every plan wave:** Run `pnpm -r test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | PKG-01 | — | N/A | unit | `pnpm --filter @claudeui/cli test -- --run` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | PKG-02 | — | N/A | unit | `pnpm --filter @claudeui/cli test -- --run` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | PKG-03 | — | N/A | integration | `pnpm --filter @claudeui/cli test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/cli/__tests__/build.test.ts` — verify dist output structure
- [ ] `packages/cli/__tests__/publish-dry-run.test.ts` — verify tarball contents

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm pack --dry-run` tarball contents | PKG-02 | Requires built artifacts | Run `npm pack --dry-run` in packages/cli and inspect output |
| Global install + `cu` on PATH | PKG-03 | Requires npm global install | `npm i -g` then verify `cu --help` |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
