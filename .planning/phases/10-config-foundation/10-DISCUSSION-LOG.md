# Phase 10: Config Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 10-config-foundation
**Areas discussed:** Project discovery strategy, ConfigLocator design, SourceBadge project variant, Merge policy scope

---

## Project Discovery Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Walk-up from CWD | Like git finds .git -- walk up from CWD checking each parent for .claude/ | |
| Explicit env var only | User sets CU_PROJECT=/path/to/project | |
| Walk-up + env var override | Walk-up from CWD as default, env var as override | |

**User's choice:** Only load CWD's `.claude` (no walk-up, no env var)
**Notes:** User specified "only load cwd's .claude" -- simpler than walk-up. Just check `${cwd()}/.claude`.

**Follow-up -- No project behavior:**

| Option | Description | Selected |
|--------|-------------|----------|
| Silent fallback to global-only | Server runs normally with global-only data | ✓ |
| Log message + global-only | Log 'No project .claude/ found' at startup | |

**User's choice:** Silent fallback to global-only

---

## ConfigLocator Design

| Option | Description | Selected |
|--------|-------------|----------|
| Class-based service | Matches existing services (AgentService, SkillService) | ✓ |
| Module with functions | Exported functions like getGlobalDir(), getProjectDir() | |

**User's choice:** Class-based service

**Follow-up -- Route integration:**

| Option | Description | Selected |
|--------|-------------|----------|
| ConfigLocator feeds routes | ConfigLocator resolves paths, passes subdirs to routes | ✓ |
| Routes depend on ConfigLocator | Routes receive ConfigLocator instance and call methods | |

**User's choice:** ConfigLocator feeds routes (no route signature changes)

---

## SourceBadge Project Variant

| Option | Description | Selected |
|--------|-------------|----------|
| Green (#22c55e) badge | Consistent with existing pattern -- each source type has own color | ✓ |
| Amber/orange (#f59e0b) badge | Warm tone suggesting 'project-specific' | |
| Teal (#14b8a6) badge | Claude's color suggesting 'connected to project' | |

**User's choice:** Green (#22c55e)

**Follow-up -- Label text:**

| Option | Description | Selected |
|--------|-------------|----------|
| Label: 'project' | Simple, matches 'local', 'profile', 'plugin' pattern | ✓ |
| Label: project folder name | Shows actual directory name (e.g. 'my-app') | |

**User's choice:** Label: 'project'

---

## Merge Policy Scope

| Option | Description | Selected |
|--------|-------------|----------|
| In CONTEXT.md decisions | Policy as a locked decision in CONTEXT.md. Simple, no overhead. | ✓ |
| Separate policy document | Separate file like docs/merge-policy.md | |

**User's choice:** In CONTEXT.md decisions

---

## Claude's Discretion

- ConfigLocator method signatures and internal structure
- How project path is threaded to services
- Test file organization
- Error handling for unreadable project directories

## Deferred Ideas

None -- discussion stayed within phase scope.
