# Phase 11: Project-Local Loading - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 11-project-local-loading
**Areas discussed:** Source field model, Same-name display, Project read-only UI, Config merging

---

## Source field model

| Option | Description | Selected |
|--------|-------------|----------|
| Add `scope` field alongside `source` | Keep `source` as local/profile/plugin/project for UI attribution. Add `scope: 'global' \| 'project'` for merge logic. SourceBadge uses `source`, merge logic uses `scope`. | ✓ |
| Replace with scope-level only | Use `global` for all ~/.claude items (replaces local/profile) and `project` for project items. Loses profile/plugin attribution. | |
| Map sources to scopes in API | Keep `source` in services, add `scope` computed field in route responses. Dual fields at different layers. | |

**User's choice:** Add `scope` field alongside `source`
**Notes:** Cleanest separation — no data loss, SourceBadge keeps existing rendering, merge logic gets a simple binary scope.

---

## Same-name display

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side with badges | Both items listed together, project first, distinguished only by SourceBadge color. No dimming, no override label. | ✓ |
| Dimmed global + active project | Global item shown dimmed/grayed with 'overridden by project' badge. Project item rendered normally. | |
| Grouped under one card | Single card for the name, expandable to show both versions. Requires new UI component. | |

**User's choice:** Side-by-side with badges
**Notes:** SourceBadge already distinguishes project (green) from local/profile. Project items sorted first when names collide. No special styling needed.

---

## Project read-only UI

| Option | Description | Selected |
|--------|-------------|----------|
| View-only with notice | Click project item → detail view shows content. Edit/delete buttons hidden. Small notice: "From project directory — view only." | ✓ |
| View-only, no notice | Same as above without notice text. SourceBadge already tells origin. | |
| Disabled edit buttons | Show edit/delete grayed out with tooltip "Project items cannot be edited here." | |

**User's choice:** View-only with notice
**Notes:** Buttons hidden (not grayed out). Notice text: "From project directory — view only."

---

## Config merging

| Option | Description | Selected |
|--------|-------------|----------|
| Per-key override | Project entries replace global entries by name. Both versions in response with scope badges. Project entry is the active one. Consistent with agent/skill behavior. | ✓ |
| Per-key replace, global hidden | Project entry replaces global — only project version in response. No global version visible. | |
| Deep merge | Merge individual config properties within the same key. Complex and error-prone for arbitrary JSON. | |

**User's choice:** Per-key override
**Notes:** Both versions appear in merged response. For MCP/Hooks/LSP, project entry overrides global entry by name. Non-overlapping keys pass through unchanged. Matches agent/skill/command pattern.

---

## Agent's Discretion

- Exact merge implementation in each service/route
- How scope field is computed in route handlers
- Test structure for merged inventory scenarios
- Error handling for unreadable project subdirectories

## Deferred Ideas

None — discussion stayed within phase scope.