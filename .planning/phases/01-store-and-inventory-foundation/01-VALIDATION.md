---
phase: 01
slug: store-and-inventory-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `packages/cli/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/store.test.ts src/server/routes/__tests__/agents.test.ts src/server/routes/__tests__/skills.test.ts src/server/routes/__tests__/commands.test.ts src/server/routes/__tests__/plugins.test.ts src/server/routes/__tests__/configs.test.ts src/server/services/__tests__/storeService.test.ts` |
| **Full suite command** | `pnpm --filter @claudeui/cli test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claudeui/cli test -- <targeted test files>`
- **After every plan wave:** Run `pnpm --filter @claudeui/cli test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | STORE-01 | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | STORE-02 | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | STORE-03 | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ✅ | ⬜ pending |
| 01-01-04 | 01 | 1 | STORE-06 | service + route | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/storeService.test.ts src/server/routes/__tests__/store.test.ts` | ❌ W0 provenance cases | ⬜ pending |
| 01-02-01 | 02 | 1 | INV-01 | route + UI | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/agents.test.ts src/server/routes/__tests__/skills.test.ts src/server/routes/__tests__/commands.test.ts` | ✅ backend / ❌ UI | ⬜ pending |
| 01-02-02 | 02 | 1 | INV-02 | route + UI | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/plugins.test.ts src/server/routes/__tests__/configs.test.ts` | ✅ backend / ❌ UI | ⬜ pending |
| 01-03-01 | 03 | 2 | STORE-04 | UI component | `pnpm --filter @claudeui/ui test -- StoreComponentList` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | STORE-05 | backend + UI | `pnpm --filter @claudeui/ui test -- src/components/store/__tests__/StoreComponentEditor.test.tsx src/components/store/__tests__/StoreComponentList.test.tsx src/components/store/__tests__/ImportComponentsDialog.test.tsx && pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/store.test.ts` | ✅ backend / ❌ UI | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` — stubs for STORE-04 search/type filtering and STORE-06 provenance surfacing
- [ ] `packages/ui/src/components/store/__tests__/StoreComponentEditor.test.tsx` — shared coverage for STORE-05 create/edit/delete UI flows
- [ ] `packages/ui/src/components/store/__tests__/ImportComponentsDialog.test.tsx` — overwrite preview, cancel, and `Overwrite All` coverage
- [ ] `packages/ui/src/components/__tests__/SourceBadge.test.tsx` — shared fixtures for INV-01 source badge rendering
- [ ] `packages/ui/src/__tests__/Explorer.inventory.test.tsx` — shared UI verification for INV-02 plugin/config rendering
- [ ] `packages/ui` test runner/config — install and configure UI test infrastructure if absent

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Store provenance remains secondary in the UI | STORE-06 | Visual hierarchy is difficult to enforce automatically | Open a stored component, confirm import path/time are discoverable but not dominant in the main dense row |
| AGENT_HOME inventory remains read-only | INV-01, INV-02 | Action-surface absence is primarily a UX contract | Inspect agent/skill/command/plugin/config views and verify no inline edit affordances are exposed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
