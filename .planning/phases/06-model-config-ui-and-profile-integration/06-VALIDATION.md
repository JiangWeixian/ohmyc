---
phase: 06
slug: model-config-ui-and-profile-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | packages/ui/vitest.config.ts |
| **Quick run command** | `cd packages/ui && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/ui && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/ui && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/ui && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | STORE-10 | unit | `cd packages/ui && npx vitest run src/utils/__tests__/maskApiKey.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | STORE-09 | unit | `cd packages/ui && npx vitest run src/components/store/__tests__/StoreComponentList.test.tsx` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | STORE-10 | unit | `cd packages/ui && npx vitest run src/components/store/__tests__/ModelConfigEditor.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | PROF-05 | unit | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileEditor.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | PROF-06 | unit | `cd packages/ui && npx vitest run src/components/profiles/__tests__/ProfileCard.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | PROF-07 | unit | `cd packages/ui && npx vitest run src/components/store/__tests__/StoreComponentList.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/ui/src/utils/__tests__/maskApiKey.test.ts` — covers STORE-10 masking logic
- [ ] Extend `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` — add model-configs mock data and rendering assertions
- [ ] Extend `packages/ui/src/components/profiles/__tests__/ProfileEditor.test.tsx` — add model config dropdown test
- [ ] Extend `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` — add model config badge test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | All phase behaviors have automated verification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
