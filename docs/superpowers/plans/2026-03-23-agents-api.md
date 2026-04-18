# Agents API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a CRUD API for Claude Code agent files with TDD using vitest.

**Architecture:** Service layer (AgentService) handles file I/O and frontmatter parsing, thin Fastify route layer delegates to it. Zod schemas in shared package define the data model.

**Tech Stack:** TypeScript, Fastify, vitest, gray-matter, Zod

**Spec:** `docs/superpowers/specs/2026-03-23-agents-api-design.md`

**Note:** The spec defines `update(name, frontmatter, content)` as separate params. This plan uses `update(name, changes)` with a single object — it aligns better with `UpdateAgentBodySchema` and simplifies the route handler.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/agentSchema.ts` | Zod schemas for AgentFrontmatter and Agent |
| Modify | `packages/shared/src/index.ts` | Re-export agent schemas |
| Create | `packages/cli/vitest.config.ts` | vitest configuration |
| Modify | `packages/cli/package.json` | Add vitest + gray-matter deps, test script |
| Create | `packages/cli/src/server/services/agentService.ts` | AgentService class |
| Create | `packages/cli/src/server/services/__tests__/agentService.test.ts` | Service unit tests |
| Create | `packages/cli/src/server/routes/agents.ts` | Fastify route handlers |
| Create | `packages/cli/src/server/routes/__tests__/agents.test.ts` | Route integration tests |
| Modify | `packages/cli/src/server/index.ts` | Register agentsRoutes |

---

### Task 1: Install dependencies and configure vitest

**Files:**
- Modify: `packages/cli/package.json`
- Create: `packages/cli/vitest.config.ts`

- [ ] **Step 1: Install vitest and gray-matter**

```bash
cd . && pnpm add -D vitest --filter @claudeui/cli && pnpm add gray-matter --filter @claudeui/cli
```

- [ ] **Step 2: Verify gray-matter imports in ESM context**

Create a quick check file and run it:
```bash
cd ./packages/cli && node -e "import('gray-matter').then(m => console.log('OK:', typeof (m.default || m)))"
```
Expected: `OK: function`. If it fails, use `import matter from 'gray-matter'` with tsup's `--shims` flag or `createRequire`.

- [ ] **Step 3: Add test script to packages/cli/package.json**

In `packages/cli/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// packages/cli/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create a smoke test to verify vitest works**

Create `packages/cli/src/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/cli/package.json packages/cli/vitest.config.ts packages/cli/src/__tests__/smoke.test.ts pnpm-lock.yaml
git commit -m "chore: configure vitest and add gray-matter dependency"
```

---

### Task 2: Define Zod schemas in shared package

**Files:**
- Create: `packages/shared/src/agentSchema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create agentSchema.ts**

```typescript
// packages/shared/src/agentSchema.ts
import { z } from 'zod';

export const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan']).optional(),
  maxTurns: z.number().optional(),
  skills: z.array(z.string()).optional(),
  memory: z.enum(['user', 'project', 'local']).optional(),
  background: z.boolean().optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  isolation: z.enum(['worktree']).optional(),
  mcpServers: z.any().optional(),
  hooks: z.any().optional(),
}).passthrough();

export const AgentSchema = z.object({
  id: z.string(),
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
  raw: z.string(),
  filename: z.string(),
  source: z.enum(['user', 'project', 'plugin']),
});

export const CreateAgentBodySchema = z.object({
  frontmatter: AgentFrontmatterSchema,
  content: z.string(),
});

export const UpdateAgentBodySchema = z.object({
  frontmatter: AgentFrontmatterSchema.partial().optional(),
  content: z.string().optional(),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type CreateAgentBody = z.infer<typeof CreateAgentBodySchema>;
export type UpdateAgentBody = z.infer<typeof UpdateAgentBodySchema>;
```

- [ ] **Step 2: Update index.ts to re-export**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './agentSchema.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/agentSchema.ts packages/shared/src/index.ts
git commit -m "feat: add agent Zod schemas to shared package"
```

---

### Task 3: AgentService — list() with empty directory

**Files:**
- Create: `packages/cli/src/server/services/__tests__/agentService.test.ts`
- Create: `packages/cli/src/server/services/agentService.ts`

- [ ] **Step 1: Write failing test for list() with empty directory**

```typescript
// packages/cli/src/server/services/__tests__/agentService.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { AgentService } from '../agentService.js';

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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ./packages/cli && pnpm test
```
Expected: FAIL — cannot find `../agentService.js`

- [ ] **Step 3: Write minimal AgentService implementation**

```typescript
// packages/cli/src/server/services/agentService.ts
import { readdir, readFile, writeFile, mkdir, unlink, access } from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { Agent, AgentFrontmatter } from '@claudeui/shared';
import { SAFE_NAME_PATTERN } from '@claudeui/shared';

export class AgentService {
  constructor(private agentsDir: string) {}

  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Agent name "${name}" is invalid: must match [a-zA-Z0-9_-]`);
    }
  }

  private parseAgentFile(filename: string, raw: string): Agent | null {
    const parsed = matter(raw);
    const frontmatter = parsed.data as AgentFrontmatter;
    if (!frontmatter.name || !frontmatter.description) return null;
    return {
      id: filename.replace(/\.md$/, ''),
      frontmatter,
      content: parsed.content.trim(),
      raw,
      filename,
      source: 'user',
    };
  }

  async list(): Promise<Agent[]> {
    try {
      await access(this.agentsDir);
    } catch {
      return [];
    }

    const files = await readdir(this.agentsDir);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();

    const agents: Agent[] = [];
    for (const filename of mdFiles) {
      const filePath = path.join(this.agentsDir, filename);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const agent = this.parseAgentFile(filename, raw);
        if (agent) agents.push(agent);
      } catch {
        continue;
      }
    }

    return agents;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/agentService.ts packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "feat: AgentService.list() with empty directory support"
```

---

### Task 4: AgentService — list() with multiple agents and edge cases

**Files:**
- Modify: `packages/cli/src/server/services/__tests__/agentService.test.ts`

- [ ] **Step 1: Write tests for list() with data**

Add `writeFileSync` to the imports:
```typescript
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
```

Add to the `describe('list()')` block:
```typescript
    it('returns parsed agents sorted alphabetically', async () => {
      writeFileSync(path.join(tmpDir, 'zebra-agent.md'), [
        '---',
        'name: zebra-agent',
        'description: Z agent',
        'model: sonnet',
        'tools:',
        '  - Read',
        '  - Grep',
        '---',
        'You are a zebra agent.',
      ].join('\n'));

      writeFileSync(path.join(tmpDir, 'alpha-agent.md'), [
        '---',
        'name: alpha-agent',
        'description: A agent',
        '---',
        'You are an alpha agent.',
      ].join('\n'));

      const agents = await service.list();
      expect(agents).toHaveLength(2);
      expect(agents[0].id).toBe('alpha-agent');
      expect(agents[1].id).toBe('zebra-agent');
      expect(agents[1].frontmatter.tools).toEqual(['Read', 'Grep']);
      expect(agents[0].content).toBe('You are an alpha agent.');
      expect(agents[0].raw).toContain('---');
    });

    it('ignores non-.md files', async () => {
      writeFileSync(path.join(tmpDir, 'notes.txt'), 'not an agent');
      writeFileSync(path.join(tmpDir, 'agent.md'), [
        '---',
        'name: agent',
        'description: An agent',
        '---',
        'prompt',
      ].join('\n'));

      const agents = await service.list();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent');
    });

    it('skips files with malformed frontmatter', async () => {
      writeFileSync(path.join(tmpDir, 'bad.md'), 'no frontmatter here');
      writeFileSync(path.join(tmpDir, 'good.md'), [
        '---',
        'name: good',
        'description: Good agent',
        '---',
        'prompt',
      ].join('\n'));

      const agents = await service.list();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('good');
    });

    it('returns empty array when directory does not exist', async () => {
      const noDir = new AgentService('/tmp/nonexistent-agents-dir-xyz');
      const agents = await noDir.list();
      expect(agents).toEqual([]);
    });
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS (implementation from Task 3 already handles these cases)

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "test: add list() edge case tests for AgentService"
```

---

### Task 5: AgentService — get()

**Files:**
- Modify: `packages/cli/src/server/services/__tests__/agentService.test.ts`
- Modify: `packages/cli/src/server/services/agentService.ts`

- [ ] **Step 1: Write failing tests for get()**

Add new `describe('get()')` block after `describe('list()')`:
```typescript
  describe('get()', () => {
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
      expect(agent!.frontmatter.name).toBe('my-agent');
      expect(agent!.frontmatter.model).toBe('opus');
      expect(agent!.content).toBe('You are my agent.');
      expect(agent!.source).toBe('user');
    });

    it('returns null when agent does not exist', async () => {
      const agent = await service.get('nonexistent');
      expect(agent).toBeNull();
    });

    it('returns null when directory does not exist', async () => {
      const noDir = new AgentService('/tmp/nonexistent-agents-dir-xyz');
      const agent = await noDir.get('anything');
      expect(agent).toBeNull();
    });

    it('returns null for invalid name', async () => {
      const agent = await service.get('../evil');
      expect(agent).toBeNull();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ./packages/cli && pnpm test
```
Expected: FAIL — `service.get is not a function`

- [ ] **Step 3: Implement get()**

Add to `AgentService` class in `agentService.ts`:
```typescript
  async get(name: string): Promise<Agent | null> {
    if (!SAFE_NAME_PATTERN.test(name)) return null;
    const filePath = path.join(this.agentsDir, `${name}.md`);
    try {
      const raw = await readFile(filePath, 'utf-8');
      return this.parseAgentFile(`${name}.md`, raw);
    } catch {
      return null;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/agentService.ts packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "feat: AgentService.get() to retrieve agent by name"
```

---

### Task 6: AgentService — create()

**Files:**
- Modify: `packages/cli/src/server/services/__tests__/agentService.test.ts`
- Modify: `packages/cli/src/server/services/agentService.ts`

- [ ] **Step 1: Write failing tests for create()**

Add `readFileSync, existsSync` to the `fs` import:
```typescript
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
```

Add new `describe('create()')` block:
```typescript
  describe('create()', () => {
    it('creates agent file and returns agent', async () => {
      const agent = await service.create(
        { name: 'new-agent', description: 'A new agent' },
        'You are a new agent.'
      );

      expect(agent.id).toBe('new-agent');
      expect(agent.frontmatter.name).toBe('new-agent');
      expect(agent.content).toBe('You are a new agent.');
      expect(agent.filename).toBe('new-agent.md');
      expect(agent.source).toBe('user');

      // Verify file was written
      const written = readFileSync(path.join(tmpDir, 'new-agent.md'), 'utf-8');
      expect(written).toContain('name: new-agent');
      expect(written).toContain('You are a new agent.');
    });

    it('round-trips correctly (create then get returns same data)', async () => {
      const created = await service.create(
        { name: 'roundtrip', description: 'Roundtrip test' },
        'prompt content'
      );
      const fetched = await service.get('roundtrip');
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.frontmatter.name).toBe(created.frontmatter.name);
      expect(fetched!.content).toBe(created.content);
    });

    it('auto-creates directory if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'agents');
      const nestedService = new AgentService(nestedDir);

      const agent = await nestedService.create(
        { name: 'test', description: 'Test' },
        'prompt'
      );

      expect(agent.id).toBe('test');
      expect(existsSync(path.join(nestedDir, 'test.md'))).toBe(true);
    });

    it('throws when agent with same name already exists', async () => {
      writeFileSync(path.join(tmpDir, 'existing.md'), [
        '---',
        'name: existing',
        'description: Existing agent',
        '---',
        'prompt',
      ].join('\n'));

      await expect(
        service.create({ name: 'existing', description: 'Duplicate' }, 'prompt')
      ).rejects.toThrow('already exists');
    });

    it('throws when name contains invalid characters', async () => {
      await expect(
        service.create({ name: '../evil', description: 'Bad' }, 'prompt')
      ).rejects.toThrow('invalid');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ./packages/cli && pnpm test
```
Expected: FAIL — `service.create is not a function`

- [ ] **Step 3: Implement create()**

Add to `AgentService` class:
```typescript
  async create(frontmatter: AgentFrontmatter, content: string): Promise<Agent> {
    this.validateName(frontmatter.name);

    await mkdir(this.agentsDir, { recursive: true });

    const filename = `${frontmatter.name}.md`;
    const filePath = path.join(this.agentsDir, filename);

    try {
      await access(filePath);
      throw new Error(`Agent "${frontmatter.name}" already exists`);
    } catch (err: any) {
      if (err.message.includes('already exists')) throw err;
    }

    const raw = matter.stringify(content, frontmatter);
    await writeFile(filePath, raw, 'utf-8');

    return {
      id: frontmatter.name,
      frontmatter,
      content: content.trim(),
      raw,
      filename,
      source: 'user',
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/agentService.ts packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "feat: AgentService.create() with validation and conflict detection"
```

---

### Task 7: AgentService — update()

**Files:**
- Modify: `packages/cli/src/server/services/__tests__/agentService.test.ts`
- Modify: `packages/cli/src/server/services/agentService.ts`

- [ ] **Step 1: Write failing tests for update()**

Add new `describe('update()')` block:
```typescript
  describe('update()', () => {
    beforeEach(() => {
      writeFileSync(path.join(tmpDir, 'updatable.md'), [
        '---',
        'name: updatable',
        'description: Original description',
        'model: sonnet',
        '---',
        'Original prompt.',
      ].join('\n'));
    });

    it('updates frontmatter fields with shallow merge', async () => {
      const agent = await service.update('updatable', {
        frontmatter: { description: 'Updated description' },
      });

      expect(agent).not.toBeNull();
      expect(agent!.frontmatter.description).toBe('Updated description');
      expect(agent!.frontmatter.model).toBe('sonnet');
      expect(agent!.content).toBe('Original prompt.');
    });

    it('updates content only', async () => {
      const agent = await service.update('updatable', {
        content: 'New prompt.',
      });

      expect(agent).not.toBeNull();
      expect(agent!.content).toBe('New prompt.');
      expect(agent!.frontmatter.description).toBe('Original description');
    });

    it('updates both frontmatter and content', async () => {
      const agent = await service.update('updatable', {
        frontmatter: { description: 'New desc' },
        content: 'New prompt.',
      });

      expect(agent).not.toBeNull();
      expect(agent!.frontmatter.description).toBe('New desc');
      expect(agent!.content).toBe('New prompt.');
    });

    it('returns null when agent does not exist', async () => {
      const agent = await service.update('nonexistent', {
        frontmatter: { description: 'nope' },
      });
      expect(agent).toBeNull();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ./packages/cli && pnpm test
```
Expected: FAIL — `service.update is not a function`

- [ ] **Step 3: Implement update()**

Add to `AgentService` class:
```typescript
  async update(
    name: string,
    changes: { frontmatter?: Partial<AgentFrontmatter>; content?: string }
  ): Promise<Agent | null> {
    const existing = await this.get(name);
    if (!existing) return null;

    const mergedFrontmatter = changes.frontmatter
      ? { ...existing.frontmatter, ...changes.frontmatter }
      : existing.frontmatter;

    const mergedContent = changes.content !== undefined ? changes.content : existing.content;

    const raw = matter.stringify(mergedContent, mergedFrontmatter);
    const filePath = path.join(this.agentsDir, `${name}.md`);
    await writeFile(filePath, raw, 'utf-8');

    return {
      id: name,
      frontmatter: mergedFrontmatter as AgentFrontmatter,
      content: mergedContent.trim(),
      raw,
      filename: `${name}.md`,
      source: 'user',
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/agentService.ts packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "feat: AgentService.update() with shallow merge"
```

---

### Task 8: AgentService — delete()

**Files:**
- Modify: `packages/cli/src/server/services/__tests__/agentService.test.ts`
- Modify: `packages/cli/src/server/services/agentService.ts`

- [ ] **Step 1: Write failing tests for delete()**

Add new `describe('delete()')` block:
```typescript
  describe('delete()', () => {
    it('deletes existing agent file', async () => {
      writeFileSync(path.join(tmpDir, 'doomed.md'), [
        '---',
        'name: doomed',
        'description: To be deleted',
        '---',
        'goodbye',
      ].join('\n'));

      const result = await service.delete('doomed');
      expect(result).toBe(true);
      expect(existsSync(path.join(tmpDir, 'doomed.md'))).toBe(false);
    });

    it('returns false when agent does not exist', async () => {
      const result = await service.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false for invalid name', async () => {
      const result = await service.delete('../evil');
      expect(result).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ./packages/cli && pnpm test
```
Expected: FAIL — `service.delete is not a function`

- [ ] **Step 3: Implement delete()**

Add to `AgentService` class:
```typescript
  async delete(name: string): Promise<boolean> {
    if (!SAFE_NAME_PATTERN.test(name)) return false;
    const filePath = path.join(this.agentsDir, `${name}.md`);
    try {
      await access(filePath);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ./packages/cli && pnpm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/agentService.ts packages/cli/src/server/services/__tests__/agentService.test.ts
git commit -m "feat: AgentService.delete() with name validation"
```

---

### Task 9: Fastify route handlers

**Files:**
- Create: `packages/cli/src/server/routes/agents.ts`
- Modify: `packages/cli/src/server/index.ts`

- [ ] **Step 1: Create route file**

```typescript
// packages/cli/src/server/routes/agents.ts
import { FastifyPluginAsync } from 'fastify';
import { AgentService } from '../services/agentService.js';
import {
  SAFE_NAME_PATTERN,
  CreateAgentBodySchema,
  UpdateAgentBodySchema,
} from '@claudeui/shared';

interface AgentsRoutesOptions {
  agentsDir: string;
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir);

  function validateName(name: string): string | null {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return 'Invalid agent name: must match [a-zA-Z0-9_-]';
    }
    return null;
  }

  // GET /api/agents
  fastify.get('/api/agents', async () => {
    const agents = await service.list();
    return { agents };
  });

  // GET /api/agents/:name
  fastify.get<{ Params: { name: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params;
    const error = validateName(name);
    if (error) return reply.status(400).send({ error });

    const agent = await service.get(name);
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    return { agent };
  });

  // POST /api/agents
  fastify.post('/api/agents', async (request, reply) => {
    const parsed = CreateAgentBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const { frontmatter, content } = parsed.data;

    try {
      const agent = await service.create(frontmatter, content);
      return reply.status(201).send({ agent });
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        return reply.status(409).send({ error: err.message });
      }
      if (err.message.includes('invalid')) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // PUT /api/agents/:name
  fastify.put<{ Params: { name: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params;
    const nameError = validateName(name);
    if (nameError) return reply.status(400).send({ error: nameError });

    const parsed = UpdateAgentBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const agent = await service.update(name, parsed.data);
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    return { agent };
  });

  // DELETE /api/agents/:name
  fastify.delete<{ Params: { name: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params;
    const error = validateName(name);
    if (error) return reply.status(400).send({ error });

    const deleted = await service.delete(name);
    if (!deleted) return reply.status(404).send({ error: 'Agent not found' });
    return { success: true };
  });
};
```

- [ ] **Step 2: Register route in server/index.ts**

Add import at top of `packages/cli/src/server/index.ts`:
```typescript
import { agentsRoutes } from './routes/agents.js';
import os from 'os';
```

Note: `path` is already imported.

Add registration after existing routes (after `await fastify.register(settingsRoutes);`):
```typescript
  const agentsDir = path.join(os.homedir(), '.claude', 'agents');
  await fastify.register(agentsRoutes, { agentsDir });
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/server/routes/agents.ts packages/cli/src/server/index.ts
git commit -m "feat: add agents CRUD route handlers"
```

---

### Task 10: Route integration tests

**Files:**
- Create: `packages/cli/src/server/routes/__tests__/agents.test.ts`

- [ ] **Step 1: Write route integration tests**

```typescript
// packages/cli/src/server/routes/__tests__/agents.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { agentsRoutes } from '../agents.js';

describe('agents routes', () => {
  let tmpDir: string;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agents-route-test-'));
    app = Fastify();
    await app.register(agentsRoutes, { agentsDir: tmpDir });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/agents', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ agents: [] });
    });

    it('returns agents list', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(200);
      expect(res.json().agents).toHaveLength(1);
    });
  });

  describe('GET /api/agents/:name', () => {
    it('returns 404 for nonexistent agent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/nope' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid name with special chars', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/agent%40home' });
      expect(res.statusCode).toBe(400);
    });

    it('returns agent', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt');
      const res = await app.inject({ method: 'GET', url: '/api/agents/test' });
      expect(res.statusCode).toBe(200);
      expect(res.json().agent.id).toBe('test');
    });
  });

  describe('POST /api/agents', () => {
    it('creates agent and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: {
          frontmatter: { name: 'new-agent', description: 'New' },
          content: 'prompt',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().agent.id).toBe('new-agent');
    });

    it('returns 409 for duplicate', async () => {
      writeFileSync(path.join(tmpDir, 'dup.md'), '---\nname: dup\ndescription: Dup\n---\nprompt');
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: {
          frontmatter: { name: 'dup', description: 'Duplicate' },
          content: 'prompt',
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 for invalid body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents',
        payload: { frontmatter: { name: 'x' } },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/agents/:name', () => {
    it('updates agent', async () => {
      writeFileSync(path.join(tmpDir, 'up.md'), '---\nname: up\ndescription: Old\n---\nold');
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agents/up',
        payload: { frontmatter: { description: 'New' } },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().agent.frontmatter.description).toBe('New');
    });

    it('returns 404 for nonexistent', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agents/nope',
        payload: { content: 'x' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/agents/:name', () => {
    it('deletes agent', async () => {
      writeFileSync(path.join(tmpDir, 'del.md'), '---\nname: del\ndescription: Del\n---\nprompt');
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/del' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });

    it('returns 404 for nonexistent', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/nope' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid name', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/agent%40home' });
      expect(res.statusCode).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd ./packages/cli && pnpm test
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/server/routes/__tests__/agents.test.ts
git commit -m "test: add agents route integration tests"
```

---

### Task 11: Clean up smoke test and final verification

**Files:**
- Delete: `packages/cli/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Remove smoke test**

```bash
rm packages/cli/src/__tests__/smoke.test.ts && rmdir packages/cli/src/__tests__ 2>/dev/null || true
```

- [ ] **Step 2: Run full test suite**

```bash
cd ./packages/cli && pnpm test
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove smoke test, all agents API tests passing"
```
