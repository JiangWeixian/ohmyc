# Codebase Concerns

**Analysis Date:** 2026-03-29

## Tech Debt

**Plugin Component Type Safety:**
- Issue: `any` types used for plugin components (hooks, mcpServers, lspServers)
- Files: `packages/cli/src/server/services/pluginService.ts` (lines 9-11)
- Impact: Type safety lost, potential runtime errors
- Fix approach: Define proper interfaces/types for plugin components

**Error Handling Inconsistency:**
- Issue: Some services throw errors, others return null
- Files:
  - `packages/cli/src/server/services/agentService.ts` (line 52: `err: any`)
  - `packages/cli/src/server/services/agentService.ts` (line 31: `return null`)
- Impact: Inconsistent API behavior, unclear error contracts
- Fix approach: Standardize error handling across all services

**Empty Route Handlers:**
- Issue: Config routes are placeholder implementations
- Files: `packages/cli/src/server/routes/config.ts`
- Impact: Missing core functionality, routes will fail in production
- Fix approach: Implement proper config read/write logic

## Known Bugs

**Type Safety Issues:**
- Issue: Excessive use of `any` type throughout codebase
- Files: Multiple hook files and service interfaces
- Symptoms: TypeScript type checking bypassed, potential runtime errors
- Trigger: Any code using undefined plugin component properties
- Workaround: Add runtime validation where possible

**JSON Validation Missing:**
- Issue: No schema validation for plugin manifests or configuration
- Files: `packages/cli/src/server/services/pluginService.ts`
- Symptoms: Malformed JSON could cause crashes
- Trigger: Corrupted plugin files or invalid user input
- Workaround: Add try-catch around JSON parsing

## Security Considerations

**File System Access:**
- Risk: Direct file system operations without input sanitization
- Files: `packages/cli/src/server/services/agentService.ts` (file read/write)
- Current mitigation: Basic name pattern validation
- Recommendations: Add path traversal checks, implement sandboxing for plugins

**External Plugin Loading:**
- Risk: Arbitrary code execution via plugin loading
- Files: `packages/cli/src/server/services/pluginService.ts`
- Current mitigation: Basic manifest validation
- Recommendations: Plugin sandboxing, signature verification, code scanning

## Performance Bottlenecks

**Synchronous File Operations:**
- Problem: Multiple sequential file reads in plugin scanning
- Files: `packages/cli/src/server/services/pluginService.ts` (lines 72-79)
- Cause: No batching or caching of file operations
- Improvement path: Implement caching, batch file operations

**No Pagination:**
- Problem: Loading all agents/skills/commands at once
- Files: Multiple service files (agentService.ts, skillService.ts, etc.)
- Cause: No server-side pagination implemented
- Improvement path: Add pagination endpoints with cursor-based or offset-based loading

## Fragile Areas

**File System Dependencies:**
- Files: All service files that read from filesystem
- Why fragile: Brittle to file system errors, permission changes
- Safe modification: Always check file existence before operations
- Test coverage: Error scenarios missing from tests

**JSON Parsing:**
- Files: Multiple service files using JSON.parse
- Why fragile: Malformed JSON crashes services
- Safe modification: Wrap all JSON.parse in try-catch
- Test coverage: Missing tests for malformed JSON inputs

## Scaling Limits

**Single File Storage:**
- Current capacity: All agents stored as separate .md files
- Limit: Performance degrades with large numbers of files
- Scaling path: Implement database backend or document store

**In-memory State:**
- Current capacity: All plugin state loaded into memory
- Limit: Memory usage grows with plugin count
- Scaling path: Implement lazy loading, database-backed state

## Dependencies at Risk

**gray-matter for Frontmatter:**
- Risk: Potential security vulnerabilities in markdown parsing
- Impact: Could allow arbitrary code execution
- Migration plan: Evaluate alternatives or implement additional safety checks

**No Rate Limiting:**
- Risk: API endpoints vulnerable to abuse
- Impact: Server could be overwhelmed by rapid requests
- Migration plan: Implement rate limiting middleware

## Missing Critical Features

**Plugin Validation:**
- Problem: No validation of plugin source integrity
- Blocks: Secure marketplace installation
- Priority: High

**Data Backup:**
- Problem: No backup mechanism for user data
- Blocks: Data recovery scenarios
- Priority: Medium

## Test Coverage Gaps

**Error Handling:**
- What's not tested: Network failures, file system errors, malformed JSON
- Files: Service files lack error scenario tests
- Risk: Silent failures in production
- Priority: High

**Edge Cases:**
- What's not tested: Large file handling, concurrent operations
- Files: File system operations
- Risk: Race conditions, memory issues
- Priority: Medium

*Concerns audit: 2026-03-29*