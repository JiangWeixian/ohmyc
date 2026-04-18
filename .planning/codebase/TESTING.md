# Testing Patterns

**Analysis Date:** 2026-03-29

## Test Framework

**Runner:**
- Framework: Vitest [Version: 2.1.9]
- Config: `[packages/cli/vitest.config.ts]`
- Environment: Node.js (configured in vitest.config.ts)

**Assertion Library:**
- Framework: Vitest built-in expect
- No separate assertion library used

**Run Commands:**
```bash
pnpm test        # Run all tests (packages/cli package)
pnpm test:watch  # Run tests in watch mode
```

## Test File Organization

**Location:**
- Tests co-located with source files
- Pattern: `src/__tests__/` directory within each package
- Separate test files for each module/service

**Naming:**
- Pattern: `[filename].test.ts` (e.g., `agentService.test.ts`)
- Plural for test files matching service modules
- No test suffix for integration tests

**Structure:**
```
packages/cli/src/
├── server/
│   ├── routes/
│   │   ├── __tests__/
│   │   │   ├── agents.test.ts
│   │   │   ├── skills.test.ts
│   │   │   └── commands.test.ts
│   │   └── agents.ts
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── agentService.test.ts
│   │   │   ├── skillService.test.ts
│   │   │   └── commandService.test.ts
│   │   └── agentService.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { AgentService } from '../agentService';

describe('AgentService', () => {
  let tmpDir: string;
  let service: AgentService;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agents-test-'));
    service = new AgentService(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('list()', () => {
    it('returns empty array for empty directory', async () => {
      const agents = await service.list();
      expect(agents).toEqual([]);
    });

    it('returns parsed agents sorted alphabetically', async () => {
      // Test implementation
    });
  });

  // More describe blocks...
});
```

**Patterns:**
- Test lifecycle: `beforeEach`/`afterEach` for setup/teardown
- Describe blocks organized by method/class
- it blocks describe specific test scenarios
- Async tests use async/await syntax
- File system operations use temporary directories

## Mocking

**Framework:** No formal mocking framework - manual mocks

**Patterns:**
- File system operations: Real files in temporary directories
- API calls: No mocking in current tests
- Fastify server integration: Real server instance
- File system utilities used directly

**What to Mock:**
- No formal mocking patterns observed
- Tests use real file system for service testing
- API integration tests use real Fastify server

**What NOT to Mock:**
- File system operations (services work with real files)
- Fastify framework
- Node.js built-ins (fs, path, os)

## Fixtures and Factories

**Test Data:**
```typescript
// Creating test agents
writeFileSync(path.join(tmpDir, 'test.md'), [
  '---',
  'name: test',
  'description: Test',
  'model: sonnet',
  '---',
  'You are a test agent.',
].join('\n'));

// Creating skills directories
function createSkillDir(name: string, content: string) {
  const dir = path.join(tmpDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), content);
}
```

**Location:**
- Test data created inline in test files
- No separate test fixtures directory
- Data creation mixed with test setup
- Temporary directories used for isolation

## Coverage

**Requirements:** No coverage configuration found

**View Coverage:**
```bash
# No coverage command configured
# No coverage reporting in package.json
```

## Test Types

**Unit Tests:**
- Scope: Individual service methods
- Examples: `AgentService.list()`, `AgentService.create()`
- Pattern: Test with real file system, temporary directories
- Focus: Method behavior, validation, edge cases

**Integration Tests:**
- Scope: API routes with Fastify
- Examples: `/api/agents` endpoint testing
- Pattern: Real Fastify server with test routes
- Focus: HTTP response codes, route logic

**E2E Tests:**
- Framework: Not used
- Pattern: No E2E tests found

## Common Patterns

**Async Testing:**
```typescript
// Async function tests
it('returns agent by name', async () => {
  writeFileSync(path.join(tmpDir, 'my-agent.md'), [
    '---',
    'name: my-agent',
    'description: My agent',
    'model: opus',
    '---',
    'You are my agent.',
  ].join('\n'));

  const agent = await service.get('my-agent');
  expect(agent).not.toBeNull();
  expect(agent!.id).toBe('my-agent');
});
```

**Error Testing:**
```typescript
// Error case testing
it('throws when agent with same name already exists', async () => {
  writeFileSync(path.join(tmpDir, 'existing.md'), 'content');

  await expect(
    service.create({ name: 'existing', description: 'Duplicate' }, 'prompt')
  ).rejects.toThrow('already exists');
});
```

**Service Pattern:**
```typescript
describe('ServiceName', () => {
  beforeEach(() => {
    // Setup temporary directory
  });

  afterEach(() => {
    // Cleanup
  });

  describe('method()', () => {
    it('happy path', async () => {
      // Test implementation
    });

    it('edge case', async () => {
      // Test implementation
    });

    it('error case', async () => {
      // Test implementation
    });
  });
});
```

**HTTP Testing:**
```typescript
// Fastify route testing
describe('agents routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(agentsRoutes, { agentsDir: tmpDir, ... });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ agents: [] });
  });
});
```

## Test Data Management

**File System:**
- Temporary directories for each test suite
- Manual file creation with writeFileSync
- Directory cleanup with rmSync
- Isolated test environments

**Test Files:**
- Frontmatter parsing tests with YAML headers
- Markdown content integration tests
- Symlink testing for profile detection
- File permission and existence testing

**Test Naming:**
- Descriptive it names (e.g., 'returns empty array for empty directory')
- Grouped by method/feature in describe blocks
- Clear positive/negative case distinction

---

*Testing analysis: 2026-03-29*
```