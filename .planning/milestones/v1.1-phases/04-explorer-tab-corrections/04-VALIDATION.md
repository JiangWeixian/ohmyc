---
phase: 4
slug: explorer-tab-corrections
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (root) |
| **Quick run command** | `pnpm --filter ui test -- --run` |
| **Full suite command** | `pnpm -r test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter ui test -- --run`
- **After every plan wave:** Run `pnpm -r test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TAB-01, TAB-02, TAB-03 | unit | `pnpm --filter ui test -- --run` | ⬜ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | TAB-01, TAB-02, TAB-03 | unit | `pnpm --filter ui test -- --run` | ⬜ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | TAB-04 | unit | `pnpm --filter ui test -- --run` | ⬜ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | PLUG-01 | unit | `pnpm --filter ui test -- --run` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for config source badge rendering (hooks/MCP/LSP)
- [ ] Test stubs for CLAUDE.md tab removal
- [ ] Test stubs for plugin profile references display

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual badge rendering (local vs plugin) | TAB-01, TAB-02, TAB-03 | UI visual verification | Open Explorer → Hooks/MCP/LSP tabs → verify badges appear per entry |
| CLAUDE.md tab not in sidebar | TAB-04 | DOM verification | Open Explorer sidebar → verify CLAUDE.md not listed |
| Plugin profile reference display | PLUG-01 | UI visual verification | Open Explorer → Plugins tab → verify profile names shown |

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
