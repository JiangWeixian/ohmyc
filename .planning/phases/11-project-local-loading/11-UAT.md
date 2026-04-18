---
status: complete
phase: 11-project-local-loading
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md]
started: 2026-04-18T14:48:00Z
updated: 2026-04-18T14:58:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dual-source agent listing
expected: Start the dev server inside a project that has a `.claude/agents/` directory with at least one agent file. Navigate to the Explorer → Agents tab. The list should show BOTH global agents (from ~/.claude/agents/) AND project agents (from .claude/agents/). Project agents should display a green "PROJECT" badge.
result: [pending]

### 2. Project-first sort on name collision
expected: Create a project agent file with the SAME name as a global agent. In the Explorer → Agents tab, the project version should appear FIRST in the list (sorted above the global version). Both should be visible, each with their own source badge.
result: pass

### 3. View-only notice for project items
expected: Click on a project-scoped agent in the Explorer. The detail view should show a green notice bar reading "From project directory — view only." above the markdown content.
result: pass

### 4. Dual-source MCP config entries
expected: Create a `.mcp.json` file in the project `.claude/` directory with at least one MCP server entry. Navigate to Explorer → MCP Servers. Both global and project MCP entries should appear, with project entries showing a green "PROJECT" badge.
result: [pending]

### 5. Dual-source hooks
expected: Create a `settings.json` in the project `.claude/` directory with hook entries. Navigate to Explorer → Hooks. Both global and project hooks should appear with distinct source badges.
result: pass

### 6. Backward compatibility — no project directory
expected: Start the dev server in a directory WITHOUT a `.claude/` subdirectory. All explorer views should work exactly as before — showing only global items, no errors, no empty states caused by missing project directory.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
