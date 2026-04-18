---
phase: 10
slug: config-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | FOUND-01 | — | Path traversal protection in project discovery | unit | `npx vitest run ConfigLocator` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | FOUND-02 | T-10-01 | No path literals outside ConfigLocator | grep | `grep -rn '\.claude\|\.cu' src/ --include='*.ts' \| grep -v ConfigLocator \| grep -v test` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | FOUND-03 | — | N/A | unit | `npx vitest run SourceBadge` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | FOUND-03 | — | N/A | unit | `npx vitest run merge` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/__tests__/ConfigLocator.test.ts` — stubs for FOUND-01, FOUND-02
- [ ] `src/ui/__tests__/SourceBadge.test.tsx` — stubs for FOUND-03
- [ ] `src/server/__tests__/merge.test.ts` — stubs for merge policy (FOUND-03)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SourceBadge renders `project` variant visually distinct | FOUND-03 | Visual rendering requires human inspection | Launch UI, navigate to explorer, verify green badge appears for project-sourced items |

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
