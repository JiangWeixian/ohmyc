---
phase: 7
slug: activation-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ACTV-03 | unit | `npx vitest run src/test/profileService.preflight.modelconfig.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | ACTV-03 | unit | `npx vitest run src/test/profileService.preflight.modelconfig.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | ACTV-04 | unit | `npx vitest run src/test/profileService.activate.modelconfig.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | ACTV-04 | unit | `npx vitest run src/test/profileService.activate.modelconfig.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | ACTV-05 | integration | `npx vitest run src/test/profileService.deactivate.modelconfig.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/profileService.preflight.modelconfig.test.ts` — stubs for ACTV-03
- [ ] `src/test/profileService.activate.modelconfig.test.ts` — stubs for ACTV-04
- [ ] `src/test/profileService.deactivate.modelconfig.test.ts` — stubs for ACTV-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preflight dialog shows masked API keys | ACTV-03 | Visual rendering of dialog | Manual UI inspection |
| Switch dialog shows both deactivation and activation changes | ACTV-03 | Complex dialog state rendering | Manual UI inspection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
