---
status: complete
phase: 12-cu-rebrand
source: 12-01-SUMMARY.md
started: 2026-04-18T12:00:00Z
updated: 2026-04-18T12:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Managed Data Paths Resolve to ~/.cui/
expected: Run ConfigLocator tests — baseDir, agentsDir, skillsDir, commandsDir, settingsPath all resolve to ~/.cui/ paths. 18/18 tests pass.
result: pass

### 2. Plugin Reads Still Resolve to ~/.claude/plugins/
expected: pluginsDir getter returns a path under ~/.claude/plugins/ (NOT ~/.cui/plugins/). Confirmed by test assertions in configLocator.test.ts.
result: pass

### 3. AGENT_HOME Override — Corrected Behavior
expected: ORIGINAL: AGENT_HOME overrides both writeBaseDir and claudeCodeDir to same directory. CORRECTED: writeBaseDir always defaults to ~/.cui/, only overridable by CUI_HOME env var. AGENT_HOME only affects claudeCodeDir and project discovery.
result: issue
reported: "AGENT_HOME was incorrectly overriding writeBaseDir. Fixed: writeBaseDir now always defaults to ~/.cui/, only overridable by CUI_HOME. AGENT_HOME only affects claudeCodeDir and project discovery. Tests updated, 20 pass."
severity: major
resolution: fixed_inline
corrected_expected: writeBaseDir always defaults to ~/.cui/, only overridable by CUI_HOME env var. AGENT_HOME only affects claudeCodeDir (plugins) and project discovery. 20/20 tests pass.
retest_result: pass

### 4. Project Discovery Unchanged
expected: ConfigLocator still checks cwd/.claude/ for project config. Project discovery tests pass unchanged — no regression in project-scoped path resolution.
result: pass

### 5. Full Test Suite — Zero Regressions
expected: Run full test suite (cd packages/cli && npx vitest run). All tests pass. ProfileService, StoreService, route tests, and server tests unaffected because they use temp dirs or receive paths as parameters.
result: pass

### 6. No Scattered Path Literals
expected: No .cui or .claude string literals exist outside configLocator.ts (except AGENT_DIR_NAME usage in settings.ts and .claude-plugin manifest convention in profileService/pluginService). server/index.ts uses only ConfigLocator getters.
result: pass

## Summary

total: 6
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "AGENT_HOME only overrides claudeCodeDir and project discovery, not writeBaseDir; writeBaseDir defaults to ~/.cui/ and is only overridable by CUI_HOME"
  status: fixed_inline
  reason: "User reported: AGENT_HOME was incorrectly overriding writeBaseDir. Fixed: writeBaseDir always defaults to ~/.cui/, only overridable by CUI_HOME. AGENT_HOME only affects claudeCodeDir and project discovery."
  severity: major
  test: 3
  root_cause: "AGENT_HOME was applied to both writeBaseDir and claudeCodeDir, but writeBaseDir should be independent — only CUI_HOME overrides it"
  artifacts:
    - path: "packages/cli/src/server/services/configLocator.ts"
      issue: "AGENT_HOME applied to writeBaseDir"
    - path: "packages/cli/src/server/services/__tests__/configLocator.test.ts"
      issue: "Tests assumed AGENT_HOME overrides both bases"
  missing: []
  resolution: "Fixed inline — writeBaseDir now uses CUI_HOME (or defaults to ~/.cui/), AGENT_HOME only affects claudeCodeDir and project discovery. 20 tests pass."
