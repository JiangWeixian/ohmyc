---
phase: 02
slug: profile-composition
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-01
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `packages/ui/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` |
| **Full suite command** | `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` or `pnpm --filter @claudeui/ui test -- ProfilesView.test.tsx`
- **After every plan wave:** Run `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROF-01 | unit + route | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | PROF-02 | UI component + route | `pnpm --filter @claudeui/ui test -- ProfileEditor.test.tsx ProfilesView.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | PROF-03 | UI detail | `pnpm --filter @claudeui/ui test -- ProfileCard.test.tsx ProfilesView.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | PROF-04 | unit + route + UI | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts && pnpm --filter @claudeui/ui test -- ProfilesView.test.tsx` | ⚠️ partial | ⬜ pending |
| 02-03-01 | 03 | 3 | ACT-01 | service + route smoke | `pnpm --filter @claudeui/cli test -- profileService.test.ts profiles.test.ts` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 3 | ACT-02 | service | `pnpm --filter @claudeui/cli test -- profileService.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/ui/src/components/profiles/__tests__/ProfileEditor.test.tsx` — section grouping, save payloads, and JSON validation paths for `PROF-01` / `PROF-02`
- [ ] `packages/ui/src/components/profiles/__tests__/ProfileCard.test.tsx` — explicit component/runtime summaries for `PROF-03` / `PROF-04`
- [ ] `packages/ui/src/__tests__/ProfilesView.test.tsx` — active badge rendering, `/profiles/:name`, and activation/deactivation feedback coverage
- [ ] `packages/cli/src/server/services/__tests__/profileService.test.ts` — normalized active profile name contract
- [ ] `packages/cli/src/server/routes/__tests__/profiles.test.ts` — active-name API contract and activation warning passthrough

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Profile detail scanability | PROF-03 | Visual hierarchy and readability need human judgment | Open a populated profile detail view and confirm the name + `Active` badge anchors the page, with `Components` and `Runtime config` readable without opening raw JSON |
| Editor section clarity | PROF-02 | Section grouping and helper-copy usefulness are UX judgments | Open create/edit profile flows and confirm `Basics`, `Selections`, and `Runtime config` read as one single-page workflow without ambiguity |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-01
