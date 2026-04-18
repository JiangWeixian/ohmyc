# Phase 12: .cu Rebrand - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 12-cu-rebrand
**Areas discussed:** Scope boundary, Read fallback strategy, Migration approach, AGENT_HOME interaction

---

## Scope Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| All except plugins | store/, profiles/, settings.json, .active, backups to ~/.cui/. Plugins stay at ~/.claude/. | ✓ |
| Only store and profiles | store/ and profiles/ to ~/.cui/. settings.json stays at ~/.claude/. | |
| Everything including plugins | All paths move. Riskier — may break Claude Code. | |

**User's choice:** All except plugins (recommended)
**Notes:** Plugin installs are managed by Claude Code, not ClaudeUI. Out of Scope in REQUIREMENTS.md confirms plugin path migration is deferred.

## Read Fallback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| ~/.cui/ first, fallback to ~/.claude/ | New writes to ~/.cui/, reads check both. Backward compat. | |
| ~/.cui/ only — no fallback | Only read from ~/.cui/. Simpler. Existing data invisible. | ✓ |
| Dual-read always | Always read both and merge. Most complex. | |

**User's choice:** ~/.cui/ only — no fallback
**Notes:** User explicitly chose simplicity over backward compat. No fallback code needed.

## Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-migrate on first startup | Copy ~/.claude/ data to ~/.cui/ on first run. | |
| Manual cu migrate command | User runs 'cu migrate' explicitly. | |
| No migration — fresh start | ~/.cui/ starts empty. Existing data stays on disk. | ✓ |

**User's choice:** No migration — fresh start
**Notes:** Clean break. Simplest implementation. Users with existing data start fresh.

## AGENT_HOME Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| AGENT_HOME overrides both read and write | Consistent with existing behavior. | ✓ |
| Remove AGENT_HOME support | Drop env var. ~/.cui/ is always base. | |
| AGENT_HOME overrides write only | Split brain — confusing. | |

**User's choice:** AGENT_HOME overrides both read and write (recommended)
**Notes:** Preserves existing behavior for users who set AGENT_HOME.

## Directory Name Change

User changed from `~/.cu/` (in ROADMAP.md) to `~/.cui/` during discussion. All decisions above use `.cui`.

---

## Agent's Discretion

- How writeBaseDir and readBaseDir are exposed to routes
- Whether to add legacyBaseDir getter for future migration support
- Error handling for unreadable ~/.cui/ directories
- Test structure for rebranded path scenarios

## Deferred Ideas

None — discussion stayed within phase scope.
