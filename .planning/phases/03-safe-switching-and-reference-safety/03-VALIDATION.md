---
phase: 3
slug: safe-switching-and-reference-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/cli/vitest.config.ts, packages/ui/vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ACT-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ACT-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | ACT-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | INV-03, ACT-04 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | ACT-05, ACT-06 | unit + component | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/cli/src/__tests__/services/profileService.transaction.test.ts` — stubs for ACT-03 (transactional activate/rollback)
- [ ] `packages/cli/src/__tests__/services/profileService.deactivate.test.ts` — stubs for ACT-03 (full cleanup deactivation)
- [ ] `packages/cli/src/__tests__/services/profileService.lock.test.ts` — stubs for ACT-03 (file-based locking)
- [ ] `packages/cli/src/__tests__/services/profileService.preflight.test.ts` — stubs for ACT-04 (pre-flight checks)
- [ ] `packages/ui/src/__tests__/components/profiles/ConfirmSwitchDialog.test.tsx` — stubs for INV-03 (switch confirmation)
- [ ] `packages/ui/src/__tests__/components/store/StoreComponentList.refcount.test.tsx` — stubs for ACT-05 (reference display)
- [ ] `packages/ui/src/__tests__/components/store/DeleteWithRefWarning.test.tsx` — stubs for ACT-06 (delete reference warning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmation dialog visual design | INV-03 | Subjective visual correctness | Activate a second profile while one is active, verify modal layout, button order, and messaging |
| Reference count inline display | ACT-05 | Visual integration in store browser | Open store browser, verify "Used by N profiles" badges appear on referenced components |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
