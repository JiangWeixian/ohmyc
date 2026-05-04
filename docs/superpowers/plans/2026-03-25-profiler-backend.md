# Profiler Backend Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ProfileService with CRUD + activate/deactivate, Store routes (reusing existing services), and AGENT_HOME read-only migration.

**Architecture:** ProfileService manages profile.json files and handles activation (symlinks, plugin file generation, settings merge). Store routes reuse existing AgentService/SkillService/CommandService pointed at store directory. AGENT_HOME routes become read-only with source tagging via lstat.

**Tech Stack:** TypeScript, Fastify, vitest, Zod, gray-matter, symlinks

**Spec:** `docs/superpowers/specs/2026-03-25-profiler-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/profileSchema.ts` | Profile Zod schema + types |
| Modify | `packages/shared/src/index.ts` | Re-export profile schema |
| Create | `packages/cli/src/server/services/profileService.ts` | Profile CRUD + activate/deactivate |
| Create | `packages/cli/src/server/services/__tests__/profileService.test.ts` | ProfileService tests |
| Create | `packages/cli/src/server/routes/profiles.ts` | Profile API routes |
| Create | `packages/cli/src/server/routes/__tests__/profiles.test.ts` | Profile route tests |
| Create | `packages/cli/src/server/services/storeService.ts` | Store import + delete-with-reference-check |
| Create | `packages/cli/src/server/services/__tests__/storeService.test.ts` | StoreService tests |
| Create | `packages/cli/src/server/routes/store.ts` | Store CRUD routes (agents/skills/commands) |
| Create | `packages/cli/src/server/routes/__tests__/store.test.ts` | Store route tests |
| Modify | `packages/cli/src/server/routes/agents.ts` | Remove POST/PUT/DELETE, add lstat source tagging |
| Modify | `packages/cli/src/server/routes/skills.ts` | Same |
| Modify | `packages/cli/src/server/routes/commands.ts` | Same |
| Modify | `packages/cli/src/server/index.ts` | Register new routes, pass baseDir |

---

### Task 1: Profile Schema

**Files:**
- Create: `packages/shared/src/profileSchema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create profileSchema.ts**

```typescript
// packages/shared/src/profileSchema.ts
import { z } from 'zod'

export const RESERVED_PROFILE_NAMES = ['store', '.active', 'plugins', 'agents', 'skills', 'commands']

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})

export const CreateProfileBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agents: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  plugins: z.array(z.string()).optional(),
  hooks: z.any().optional(),
  mcpServers: z.any().optional(),
  lspServers: z.any().optional(),
  settings: z.record(z.any()).optional(),
})

export const UpdateProfileBodySchema = CreateProfileBodySchema.partial().omit({ name: true })

export type Profile = z.infer<typeof ProfileSchema>
export type CreateProfileBody = z.infer<typeof CreateProfileBodySchema>
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>
```

- [ ] **Step 2: Re-export from index.ts**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './profileSchema'
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/profileSchema.ts packages/shared/src/index.ts
git commit -m "feat: add Profile Zod schema to shared package"
```

---

### Task 2: ProfileService — CRUD (create, list, get, update, delete)

**Files:**
- Create: `packages/cli/src/server/services/profileService.ts`
- Create: `packages/cli/src/server/services/__tests__/profileService.test.ts`

- [ ] **Step 1: Write failing tests for CRUD**

```typescript
// packages/cli/src/server/services/__tests__/profileService.test.ts
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { ProfileService } from '../profileService'

describe('ProfileService', () => {
  let tmpDir: string
  let service: ProfileService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'profile-test-'))
    service = new ProfileService(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('list()', () => {
    it('returns empty array when no profiles', async () => {
      const { profiles, active } = await service.list()
      expect(profiles).toEqual([])
      expect(active).toBeNull()
    })

    it('returns profiles sorted by name', async () => {
      await service.create({ name: 'zebra', description: 'Z' })
      await service.create({ name: 'alpha', description: 'A' })
      const { profiles } = await service.list()
      expect(profiles).toHaveLength(2)
      expect(profiles[0].name).toBe('alpha')
      expect(profiles[1].name).toBe('zebra')
    })

    it('returns active profile path', async () => {
      await service.create({ name: 'test' })
      await service.activate('test')
      const { active } = await service.list()
      expect(active).toContain('test')
    })
  })

  describe('get()', () => {
    it('returns profile by name', async () => {
      await service.create({ name: 'my-profile', description: 'Test', agents: ['reviewer'] })
      const profile = await service.get('my-profile')
      expect(profile).not.toBeNull()
      expect(profile!.name).toBe('my-profile')
      expect(profile!.agents).toEqual(['reviewer'])
    })

    it('returns null when not found', async () => {
      expect(await service.get('nope')).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates profile directory with profile.json', async () => {
      const profile = await service.create({ name: 'new-prof', description: 'New' })
      expect(profile.name).toBe('new-prof')
      expect(existsSync(path.join(tmpDir, 'profiles', 'new-prof', 'profile.json'))).toBe(true)
    })

    it('throws for duplicate name', async () => {
      await service.create({ name: 'dup' })
      await expect(service.create({ name: 'dup' })).rejects.toThrow('already exists')
    })

    it('throws for reserved name', async () => {
      await expect(service.create({ name: 'store' })).rejects.toThrow('reserved')
    })

    it('throws for invalid name', async () => {
      await expect(service.create({ name: '../evil' })).rejects.toThrow('invalid')
    })
  })

  describe('update()', () => {
    it('merges updates into profile.json', async () => {
      await service.create({ name: 'up', description: 'Old', agents: ['a'] })
      const updated = await service.update('up', { description: 'New', skills: ['s'] })
      expect(updated!.description).toBe('New')
      expect(updated!.agents).toEqual(['a']) // preserved
      expect(updated!.skills).toEqual(['s'])
    })

    it('returns null when not found', async () => {
      expect(await service.update('nope', { description: 'x' })).toBeNull()
    })
  })

  describe('delete()', () => {
    it('deletes profile directory', async () => {
      await service.create({ name: 'del' })
      expect(await service.delete('del')).toBe(true)
      expect(existsSync(path.join(tmpDir, 'profiles', 'del'))).toBe(false)
    })

    it('returns false when not found', async () => {
      expect(await service.delete('nope')).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests — should FAIL**

```bash
cd ./packages/cli && pnpm test
```

- [ ] **Step 3: Implement ProfileService CRUD**

```typescript
// packages/cli/src/server/services/profileService.ts
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import {
  ProfileSchema,
  RESERVED_PROFILE_NAMES,
  SAFE_NAME_PATTERN,
} from '@ohmyc/shared'

import type { Profile } from '@ohmyc/shared'

export class ProfileService {
  private profilesDir: string

  constructor(private baseDir: string) {
    this.profilesDir = path.join(baseDir, 'profiles')
  }

  private validateName(name: string): void {
    if (!SAFE_NAME_PATTERN.test(name)) {
      throw new Error(`Profile name "${name}" is invalid: must match [a-zA-Z0-9_-]`)
    }
    if (RESERVED_PROFILE_NAMES.includes(name)) {
      throw new Error(`Profile name "${name}" is reserved`)
    }
  }

  private profileDir(name: string): string {
    return path.join(this.profilesDir, name)
  }

  private profileJsonPath(name: string): string {
    return path.join(this.profileDir(name), 'profile.json')
  }

  private activePath(): string {
    return path.join(this.profilesDir, '.active')
  }

  async list(): Promise<{ profiles: Profile[]; active: string | null }> {
    let active: string | null = null
    try {
      active = (await readFile(this.activePath(), 'utf-8')).trim()
    } catch { /* no active */ }

    try {
      await access(this.profilesDir)
    } catch {
      return { profiles: [], active }
    }

    const entries = await readdir(this.profilesDir)
    const profiles: Profile[] = []

    for (const entry of entries) {
      if (entry.startsWith('.')) {
        continue
      }
      try {
        const raw = await readFile(path.join(this.profilesDir, entry, 'profile.json'), 'utf-8')
        const profile = ProfileSchema.parse(JSON.parse(raw))
        profiles.push(profile)
      } catch {
        continue
      }
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name))
    return { profiles, active }
  }

  async get(name: string): Promise<Profile | null> {
    try {
      const raw = await readFile(this.profileJsonPath(name), 'utf-8')
      return ProfileSchema.parse(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async create(data: Partial<Profile> & { name: string }): Promise<Profile> {
    this.validateName(data.name)

    const dir = this.profileDir(data.name)
    try {
      await access(dir)
      throw new Error(`Profile "${data.name}" already exists`)
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        throw error
      }
    }

    const profile = ProfileSchema.parse(data)
    await mkdir(dir, { recursive: true })
    await writeFile(this.profileJsonPath(data.name), JSON.stringify(profile, null, 2), 'utf-8')
    return profile
  }

  async update(name: string, changes: Partial<Omit<Profile, 'name'>>): Promise<Profile | null> {
    const existing = await this.get(name)
    if (!existing) {
      return null
    }

    const merged = { ...existing, ...changes }
    const profile = ProfileSchema.parse(merged)
    await writeFile(this.profileJsonPath(name), JSON.stringify(profile, null, 2), 'utf-8')
    return profile
  }

  async delete(name: string): Promise<boolean> {
    const dir = this.profileDir(name)
    try {
      await access(dir)
      await rm(dir, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  async activate(name: string): Promise<{ warnings: string[] }> {
    // Placeholder — will be implemented in Task 3
    const profile = await this.get(name)
    if (!profile) {
      throw new Error(`Profile "${name}" not found`)
    }

    const warnings: string[] = []
    const dir = this.profileDir(name)

    // Write .active
    await mkdir(this.profilesDir, { recursive: true })
    await writeFile(this.activePath(), path.resolve(dir), 'utf-8')

    return { warnings }
  }

  async deactivate(): Promise<void> {
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(this.activePath())
    } catch { /* no active profile */ }
  }
}
```

- [ ] **Step 4: Run tests — should PASS**

```bash
cd ./packages/cli && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/profileService.ts packages/cli/src/server/services/__tests__/profileService.test.ts
git commit -m "feat: ProfileService CRUD with tests"
```

---

### Task 3: ProfileService — activate/deactivate

**Files:**
- Modify: `packages/cli/src/server/services/profileService.ts`
- Modify: `packages/cli/src/server/services/__tests__/profileService.test.ts`

- [ ] **Step 1: Write failing tests for activation**

Add to profileService.test.ts after delete tests:

```typescript
describe('activate()', () => {
  beforeEach(async () => {
    // Create store with components
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Review\n---\nprompt')
    mkdirSync(path.join(tmpDir, 'store', 'skills', 'deploy'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'skills', 'deploy', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
    mkdirSync(path.join(tmpDir, 'store', 'commands'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'commands', 'push.md'), '---\nname: push\n---\nprompt')

    // Create settings.json
    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  })

  it('creates symlinks to store components', async () => {
    await service.create({ name: 'test', agents: ['reviewer'], skills: ['deploy'], commands: ['push'] })
    await service.activate('test')

    const { lstatSync } = await import('node:fs')
    const agentLink = path.join(tmpDir, 'profiles', 'test', 'agents', 'reviewer.md')
    expect(existsSync(agentLink)).toBe(true)
    expect(lstatSync(agentLink).isSymbolicLink()).toBe(true)

    const skillLink = path.join(tmpDir, 'profiles', 'test', 'skills', 'deploy')
    expect(existsSync(skillLink)).toBe(true)
    expect(lstatSync(skillLink).isSymbolicLink()).toBe(true)
  })

  it('generates plugin files', async () => {
    await service.create({
      name: 'test',
      hooks: { PreToolUse: [] },
      mcpServers: { db: { command: 'node' } },
    })
    await service.activate('test')

    const profileDir = path.join(tmpDir, 'profiles', 'test')
    expect(existsSync(path.join(profileDir, '.claude-plugin', 'plugin.json'))).toBe(true)
    expect(existsSync(path.join(profileDir, 'hooks', 'hooks.json'))).toBe(true)
    expect(existsSync(path.join(profileDir, '.mcp.json'))).toBe(true)
  })

  it('backs up and merges settings.json', async () => {
    await service.create({
      name: 'test',
      plugins: ['gitlab@market'],
      settings: { effort: 'high' },
    })
    await service.activate('test')

    expect(existsSync(path.join(tmpDir, 'settings.backup.json'))).toBe(true)

    const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.model).toBe('sonnet') // preserved
    expect(settings.effort).toBe('high') // merged
    expect(settings.enabledPlugins['gitlab@market']).toBe(true)
  })

  it('writes .active with absolute path', async () => {
    await service.create({ name: 'test' })
    await service.activate('test')

    const active = readFileSync(path.join(tmpDir, 'profiles', '.active'), 'utf-8').trim()
    expect(path.isAbsolute(active)).toBe(true)
    expect(active).toContain('test')
  })

  it('returns warnings for missing store components', async () => {
    await service.create({ name: 'test', agents: ['nonexistent'] })
    const { warnings } = await service.activate('test')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('nonexistent')
  })

  it('deactivates previous profile before activating new one', async () => {
    await service.create({ name: 'first' })
    await service.create({ name: 'second' })
    await service.activate('first')
    await service.activate('second')

    const active = readFileSync(path.join(tmpDir, 'profiles', '.active'), 'utf-8').trim()
    expect(active).toContain('second')

    // settings.json should be merged from original backup, not from first's merge
    const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.model).toBe('sonnet')
  })
})

describe('deactivate()', () => {
  it('restores settings.json and removes .active', async () => {
    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    await service.create({ name: 'test', settings: { effort: 'high' } })
    await service.activate('test')
    await service.deactivate()

    const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.model).toBe('sonnet')
    expect(settings.effort).toBeUndefined()
    expect(existsSync(path.join(tmpDir, 'profiles', '.active'))).toBe(false)
  })

  it('does nothing when no active profile', async () => {
    await expect(service.deactivate()).resolves.not.toThrow()
  })
})
```

Add `lstatSync` to fs import at top:
```typescript
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
```

- [ ] **Step 2: Run tests — should FAIL (activate not fully implemented)**

- [ ] **Step 3: Implement full activate/deactivate**

Replace the `activate` and `deactivate` methods in profileService.ts:

```typescript
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
          && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  async activate(name: string): Promise<{ warnings: string[] }> {
    const profile = await this.get(name);
    if (!profile) throw new Error(`Profile "${name}" not found`);

    // Deactivate current if any
    const currentActive = await this.getActive();
    if (currentActive) {
      await this.deactivate();
    }

    const warnings: string[] = [];
    const dir = this.profileDir(name);
    const storeDir = path.join(this.baseDir, 'store');
    const { symlink, lstat } = await import('fs/promises');

    // Create symlinks for agents
    if (profile.agents.length > 0) {
      const agentsDir = path.join(dir, 'agents');
      await mkdir(agentsDir, { recursive: true });
      for (const agent of profile.agents) {
        const src = path.join(storeDir, 'agents', `${agent}.md`);
        const dest = path.join(agentsDir, `${agent}.md`);
        try {
          await access(src);
          try { await lstat(dest); await (await import('fs/promises')).unlink(dest); } catch {}
          await symlink(src, dest);
        } catch {
          warnings.push(`Agent "${agent}" not found in store, skipped`);
        }
      }
    }

    // Create symlinks for skills (directory symlinks)
    if (profile.skills.length > 0) {
      const skillsDir = path.join(dir, 'skills');
      await mkdir(skillsDir, { recursive: true });
      for (const skill of profile.skills) {
        const src = path.join(storeDir, 'skills', skill);
        const dest = path.join(skillsDir, skill);
        try {
          await access(src);
          try { await lstat(dest); await rm(dest, { force: true }); } catch {}
          await symlink(src, dest);
        } catch {
          warnings.push(`Skill "${skill}" not found in store, skipped`);
        }
      }
    }

    // Create symlinks for commands
    if (profile.commands.length > 0) {
      const commandsDir = path.join(dir, 'commands');
      await mkdir(commandsDir, { recursive: true });
      for (const cmd of profile.commands) {
        const src = path.join(storeDir, 'commands', `${cmd}.md`);
        const dest = path.join(commandsDir, `${cmd}.md`);
        try {
          await access(src);
          try { await lstat(dest); await (await import('fs/promises')).unlink(dest); } catch {}
          await symlink(src, dest);
        } catch {
          warnings.push(`Command "${cmd}" not found in store, skipped`);
        }
      }
    }

    // Generate plugin files
    const pluginDir = path.join(dir, '.claude-plugin');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(path.join(pluginDir, 'plugin.json'), JSON.stringify({
      name: `profile-${name}`,
      version: '1.0.0',
      description: `OhMyC profile: ${profile.description || name}`,
    }, null, 2), 'utf-8');

    if (profile.hooks) {
      const hooksDir = path.join(dir, 'hooks');
      await mkdir(hooksDir, { recursive: true });
      await writeFile(path.join(hooksDir, 'hooks.json'), JSON.stringify({ hooks: profile.hooks }, null, 2), 'utf-8');
    }

    if (profile.mcpServers) {
      await writeFile(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: profile.mcpServers }, null, 2), 'utf-8');
    }

    if (profile.lspServers) {
      await writeFile(path.join(dir, '.lsp.json'), JSON.stringify(profile.lspServers, null, 2), 'utf-8');
    }

    // Backup and merge settings.json
    const settingsPath = path.join(this.baseDir, 'settings.json');
    const backupPath = path.join(this.baseDir, 'settings.backup.json');
    let currentSettings: any = {};
    try {
      currentSettings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    } catch {}

    await writeFile(backupPath, JSON.stringify(currentSettings, null, 2), 'utf-8');

    let merged = { ...currentSettings };
    if (profile.settings) {
      merged = this.deepMerge(merged, profile.settings);
    }

    // Set enabledPlugins
    const enabledPlugins: Record<string, boolean> = merged.enabledPlugins || {};
    for (const pluginId of profile.plugins) {
      enabledPlugins[pluginId] = true;
    }
    // Add profile itself as plugin
    enabledPlugins[`profile-${name}`] = true;
    merged.enabledPlugins = enabledPlugins;

    await writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');

    // Write .active
    await writeFile(this.activePath(), path.resolve(dir), 'utf-8');

    return { warnings };
  }

  private async getActive(): Promise<string | null> {
    try {
      return (await readFile(this.activePath(), 'utf-8')).trim();
    } catch {
      return null;
    }
  }

  async deactivate(): Promise<void> {
    const settingsPath = path.join(this.baseDir, 'settings.json');
    const backupPath = path.join(this.baseDir, 'settings.backup.json');

    // Restore settings from backup
    try {
      const backup = await readFile(backupPath, 'utf-8');
      await writeFile(settingsPath, backup, 'utf-8');
    } catch { /* no backup */ }

    // Remove .active
    try {
      const { unlink } = await import('fs/promises');
      await unlink(this.activePath());
    } catch {}
  }
```

- [ ] **Step 4: Run tests — should PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/profileService.ts packages/cli/src/server/services/__tests__/profileService.test.ts
git commit -m "feat: ProfileService activate/deactivate with symlinks and settings merge"
```

---

### Task 4: Profile routes

**Files:**
- Create: `packages/cli/src/server/routes/profiles.ts`
- Create: `packages/cli/src/server/routes/__tests__/profiles.test.ts`

- [ ] **Step 1: Create profile routes**

```typescript
// packages/cli/src/server/routes/profiles.ts
import {
  CreateProfileBodySchema,
  SAFE_NAME_PATTERN,
  UpdateProfileBodySchema,
} from '@ohmyc/shared'
import { FastifyPluginAsync } from 'fastify'

import { ProfileService } from '../services/profileService'

interface ProfilesRoutesOptions {
  baseDir: string
}

export const profilesRoutes: FastifyPluginAsync<ProfilesRoutesOptions> = async (fastify, options) => {
  const service = new ProfileService(options.baseDir)

  fastify.get('/api/profiles', async () => {
    return service.list()
  })

  fastify.get<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const profile = await service.get(request.params.name)
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { profile }
  })

  fastify.post('/api/profiles', async (request, reply) => {
    const parsed = CreateProfileBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    try {
      const profile = await service.create(parsed.data)
      return reply.status(201).send({ profile })
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message })
      }
      if (error.message.includes('invalid') || error.message.includes('reserved')) {
        return reply.status(400).send({ error: error.message })
      }
      throw error
    }
  })

  fastify.put<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const parsed = UpdateProfileBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    const profile = await service.update(request.params.name, parsed.data)
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { profile }
  })

  fastify.delete<{ Params: { name: string } }>('/api/profiles/:name', async (request, reply) => {
    const deleted = await service.delete(request.params.name)
    if (!deleted) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return { success: true }
  })

  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/activate', async (request, reply) => {
    try {
      const result = await service.activate(request.params.name)
      return { success: true, warnings: result.warnings }
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message })
      }
      throw error
    }
  })

  fastify.post<{ Params: { name: string } }>('/api/profiles/:name/deactivate', async (request, reply) => {
    await service.deactivate()
    return { success: true }
  })
}
```

- [ ] **Step 2: Write route integration tests**

```typescript
// packages/cli/src/server/routes/__tests__/profiles.test.ts
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { profilesRoutes } from '../profiles'

describe('profiles routes', () => {
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'profiles-route-test-'))
    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({}))
    app = Fastify()
    await app.register(profilesRoutes, { baseDir: tmpDir })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/profiles returns empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(res.statusCode).toBe(200)
    expect(res.json().profiles).toEqual([])
    expect(res.json().active).toBeNull()
  })

  it('POST /api/profiles creates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profiles',
      payload: { name: 'test', description: 'Test profile' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().profile.name).toBe('test')
  })

  it('POST /api/profiles returns 409 for duplicate', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'dup' } })
    const res = await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'dup' } })
    expect(res.statusCode).toBe(409)
  })

  it('GET /api/profiles/:name returns profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'GET', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(200)
    expect(res.json().profile.name).toBe('test')
  })

  it('PUT /api/profiles/:name updates profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'PUT', url: '/api/profiles/test', payload: { description: 'Updated' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().profile.description).toBe('Updated')
  })

  it('DELETE /api/profiles/:name deletes profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'DELETE', url: '/api/profiles/test' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/profiles/:name/activate activates profile', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    const res = await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })
    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)

    const list = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(list.json().active).toContain('test')
  })

  it('POST /api/profiles/:name/deactivate deactivates', async () => {
    await app.inject({ method: 'POST', url: '/api/profiles', payload: { name: 'test' } })
    await app.inject({ method: 'POST', url: '/api/profiles/test/activate' })
    const res = await app.inject({ method: 'POST', url: '/api/profiles/test/deactivate' })
    expect(res.statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/profiles' })
    expect(list.json().active).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests — should PASS**

- [ ] **Step 4: Register in server/index.ts**

Add import:
```typescript
import { profilesRoutes } from './routes/profiles'
```

Add registration (before SPA fallback):
```typescript
await fastify.register(profilesRoutes, { baseDir })
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/routes/profiles.ts packages/cli/src/server/routes/__tests__/profiles.test.ts packages/cli/src/server/index.ts
git commit -m "feat: add profile CRUD + activate/deactivate routes"
```

---

### Task 5: Store routes + import + delete reference check

**Files:**
- Create: `packages/cli/src/server/services/storeService.ts`
- Create: `packages/cli/src/server/services/__tests__/storeService.test.ts`
- Create: `packages/cli/src/server/routes/store.ts`
- Create: `packages/cli/src/server/routes/__tests__/store.test.ts`

- [ ] **Step 1: Create StoreService (import + reference check)**

```typescript
// packages/cli/src/server/services/storeService.ts
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
} from 'node:fs/promises'
import path from 'node:path'

import { ProfileSchema } from '@ohmyc/shared'

import type { Profile } from '@ohmyc/shared'

export class StoreService {
  constructor(
    private storeDir: string,
    private profilesDir: string,
  ) {}

  async import(sourceDir: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0; let skipped = 0
    const errors: string[] = []

    // Import agents
    try {
      const agentsSrc = path.join(sourceDir, 'agents')
      const agentsDest = path.join(this.storeDir, 'agents')
      await mkdir(agentsDest, { recursive: true })
      const files = await readdir(agentsSrc)
      for (const f of files.filter(f => f.endsWith('.md'))) {
        const dest = path.join(agentsDest, f)
        try {
          await access(dest); skipped++
        } catch {
          try {
            await copyFile(path.join(agentsSrc, f), dest); imported++
          } catch (error: any) {
            errors.push(`agent ${f}: ${error.message}`)
          }
        }
      }
    } catch { /* no agents dir */ }

    // Import skills
    try {
      const skillsSrc = path.join(sourceDir, 'skills')
      const skillsDest = path.join(this.storeDir, 'skills')
      await mkdir(skillsDest, { recursive: true })
      const entries = await readdir(skillsSrc)
      for (const entry of entries) {
        const srcSkill = path.join(skillsSrc, entry)
        const s = await stat(srcSkill)
        if (!s.isDirectory()) {
          continue
        }
        try {
          await access(path.join(srcSkill, 'SKILL.md'))
        } catch {
          continue
        }
        const destSkill = path.join(skillsDest, entry)
        try {
          await access(destSkill); skipped++
        } catch {
          try {
            await mkdir(destSkill, { recursive: true })
            // Copy all files in skill directory
            const skillFiles = await readdir(srcSkill)
            for (const sf of skillFiles) {
              await copyFile(path.join(srcSkill, sf), path.join(destSkill, sf))
            }
            imported++
          } catch (error: any) {
            errors.push(`skill ${entry}: ${error.message}`)
          }
        }
      }
    } catch { /* no skills dir */ }

    // Import commands
    try {
      const cmdsSrc = path.join(sourceDir, 'commands')
      const cmdsDest = path.join(this.storeDir, 'commands')
      await mkdir(cmdsDest, { recursive: true })
      const files = await readdir(cmdsSrc)
      for (const f of files.filter(f => f.endsWith('.md'))) {
        const dest = path.join(cmdsDest, f)
        try {
          await access(dest); skipped++
        } catch {
          try {
            await copyFile(path.join(cmdsSrc, f), dest); imported++
          } catch (error: any) {
            errors.push(`command ${f}: ${error.message}`)
          }
        }
      }
    } catch { /* no commands dir */ }

    return { imported, skipped, errors }
  }

  async getReferencingProfiles(type: 'agents' | 'commands' | 'skills', name: string): Promise<string[]> {
    const refs: string[] = []
    try {
      const entries = await readdir(this.profilesDir)
      for (const entry of entries) {
        if (entry.startsWith('.')) {
          continue
        }
        try {
          const raw = await readFile(path.join(this.profilesDir, entry, 'profile.json'), 'utf-8')
          const profile = ProfileSchema.parse(JSON.parse(raw))
          if (profile[type].includes(name)) {
            refs.push(profile.name)
          }
        } catch {
          continue
        }
      }
    } catch { /* no profiles dir */ }
    return refs
  }
}
```

- [ ] **Step 2: Write StoreService tests**

```typescript
// packages/cli/src/server/services/__tests__/storeService.test.ts
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { StoreService } from '../storeService'

describe('StoreService', () => {
  let tmpDir: string
  let storeDir: string
  let profilesDir: string
  let service: StoreService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'store-test-'))
    storeDir = path.join(tmpDir, 'store')
    profilesDir = path.join(tmpDir, 'profiles')
    service = new StoreService(storeDir, profilesDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('import()', () => {
    it('imports agents, skills, commands from source', async () => {
      const src = path.join(tmpDir, 'source')
      mkdirSync(path.join(src, 'agents'), { recursive: true })
      writeFileSync(path.join(src, 'agents', 'a.md'), 'agent')
      mkdirSync(path.join(src, 'skills', 'sk'), { recursive: true })
      writeFileSync(path.join(src, 'skills', 'sk', 'SKILL.md'), 'skill')
      mkdirSync(path.join(src, 'commands'), { recursive: true })
      writeFileSync(path.join(src, 'commands', 'c.md'), 'command')

      const result = await service.import(src)
      expect(result.imported).toBe(3)
      expect(result.skipped).toBe(0)
      expect(existsSync(path.join(storeDir, 'agents', 'a.md'))).toBe(true)
      expect(existsSync(path.join(storeDir, 'skills', 'sk', 'SKILL.md'))).toBe(true)
      expect(existsSync(path.join(storeDir, 'commands', 'c.md'))).toBe(true)
    })

    it('skips existing components', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true })
      writeFileSync(path.join(storeDir, 'agents', 'a.md'), 'existing')

      const src = path.join(tmpDir, 'source')
      mkdirSync(path.join(src, 'agents'), { recursive: true })
      writeFileSync(path.join(src, 'agents', 'a.md'), 'new')

      const result = await service.import(src)
      expect(result.skipped).toBe(1)
      expect(result.imported).toBe(0)
    })

    it('handles empty source', async () => {
      const src = path.join(tmpDir, 'empty')
      mkdirSync(src)
      const result = await service.import(src)
      expect(result.imported).toBe(0)
    })
  })

  describe('getReferencingProfiles()', () => {
    it('returns profiles referencing a component', async () => {
      mkdirSync(path.join(profilesDir, 'prof-a'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-a', 'profile.json'), JSON.stringify({
        name: 'prof-a', agents: ['reviewer'], skills: [], commands: [],
      }))
      mkdirSync(path.join(profilesDir, 'prof-b'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-b', 'profile.json'), JSON.stringify({
        name: 'prof-b', agents: [], skills: [], commands: [],
      }))

      const refs = await service.getReferencingProfiles('agents', 'reviewer')
      expect(refs).toEqual(['prof-a'])
    })

    it('returns empty array when no references', async () => {
      const refs = await service.getReferencingProfiles('agents', 'nobody')
      expect(refs).toEqual([])
    })
  })
})
```

- [ ] **Step 3: Create store routes**

```typescript
// packages/cli/src/server/routes/store.ts
import path from 'node:path'

import {
  CreateAgentBodySchema,
  CreateCommandBodySchema,
  CreateSkillBodySchema,
  SAFE_NAME_PATTERN,
  UpdateAgentBodySchema,
  UpdateCommandBodySchema,
  UpdateSkillBodySchema,
} from '@ohmyc/shared'
import { FastifyPluginAsync } from 'fastify'

import { AgentService } from '../services/agentService'
import { CommandService } from '../services/commandService'
import { SkillService } from '../services/skillService'
import { StoreService } from '../services/storeService'

interface StoreRoutesOptions {
  baseDir: string
}

export const storeRoutes: FastifyPluginAsync<StoreRoutesOptions> = async (fastify, options) => {
  const storeDir = path.join(options.baseDir, 'store')
  const profilesDir = path.join(options.baseDir, 'profiles')

  const agentService = new AgentService(path.join(storeDir, 'agents'))
  const skillService = new SkillService(path.join(storeDir, 'skills'))
  const commandService = new CommandService(path.join(storeDir, 'commands'))
  const storeService = new StoreService(storeDir, profilesDir)

  function validateName(name: string): string | null {
    if (!SAFE_NAME_PATTERN.test(name)) {
      return 'Invalid name: must match [a-zA-Z0-9_-]'
    }
    return null
  }

  // --- Store Agents ---
  fastify.get('/api/store/agents', async () => ({ agents: await agentService.list() }))

  fastify.get<{ Params: { name: string } }>('/api/store/agents/:name', async (request, reply) => {
    const error = validateName(request.params.name)
    if (error) {
      return reply.status(400).send({ error })
    }
    const agent = await agentService.get(request.params.name)
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' })
    }
    return { agent }
  })

  fastify.post('/api/store/agents', async (request, reply) => {
    const parsed = CreateAgentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    try {
      const agent = await agentService.create(parsed.data.frontmatter, parsed.data.content)
      return reply.status(201).send({ agent })
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message })
      }
      if (error.message.includes('invalid')) {
        return reply.status(400).send({ error: error.message })
      }
      throw error
    }
  })

  fastify.put<{ Params: { name: string } }>('/api/store/agents/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    const parsed = UpdateAgentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    const agent = await agentService.update(request.params.name, parsed.data)
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' })
    }
    return { agent }
  })

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/agents/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('agents', request.params.name)
      if (refs.length > 0) {
        return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs })
      }
    }
    const deleted = await agentService.delete(request.params.name)
    if (!deleted) {
      return reply.status(404).send({ error: 'Agent not found' })
    }
    return { success: true }
  })

  // --- Store Skills ---
  fastify.get('/api/store/skills', async () => ({ skills: await skillService.list() }))

  fastify.get<{ Params: { name: string } }>('/api/store/skills/:name', async (request, reply) => {
    const error = validateName(request.params.name)
    if (error) {
      return reply.status(400).send({ error })
    }
    const skill = await skillService.get(request.params.name)
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' })
    }
    return { skill }
  })

  fastify.post('/api/store/skills', async (request, reply) => {
    const parsed = CreateSkillBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    try {
      const skill = await skillService.create(parsed.data.frontmatter, parsed.data.content)
      return reply.status(201).send({ skill })
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message })
      }
      if (error.message.includes('invalid')) {
        return reply.status(400).send({ error: error.message })
      }
      throw error
    }
  })

  fastify.put<{ Params: { name: string } }>('/api/store/skills/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    const parsed = UpdateSkillBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    const skill = await skillService.update(request.params.name, parsed.data)
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' })
    }
    return { skill }
  })

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/skills/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('skills', request.params.name)
      if (refs.length > 0) {
        return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs })
      }
    }
    const deleted = await skillService.delete(request.params.name)
    if (!deleted) {
      return reply.status(404).send({ error: 'Skill not found' })
    }
    return { success: true }
  })

  // --- Store Commands ---
  fastify.get('/api/store/commands', async () => ({ commands: await commandService.list() }))

  fastify.get<{ Params: { name: string } }>('/api/store/commands/:name', async (request, reply) => {
    const error = validateName(request.params.name)
    if (error) {
      return reply.status(400).send({ error })
    }
    const command = await commandService.get(request.params.name)
    if (!command) {
      return reply.status(404).send({ error: 'Command not found' })
    }
    return { command }
  })

  fastify.post('/api/store/commands', async (request, reply) => {
    const parsed = CreateCommandBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    try {
      const command = await commandService.create(parsed.data.frontmatter, parsed.data.content)
      return reply.status(201).send({ command })
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message })
      }
      if (error.message.includes('invalid')) {
        return reply.status(400).send({ error: error.message })
      }
      throw error
    }
  })

  fastify.put<{ Params: { name: string } }>('/api/store/commands/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    const parsed = UpdateCommandBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }
    const command = await commandService.update(request.params.name, parsed.data)
    if (!command) {
      return reply.status(404).send({ error: 'Command not found' })
    }
    return { command }
  })

  fastify.delete<{ Params: { name: string }; Querystring: { force?: string } }>('/api/store/commands/:name', async (request, reply) => {
    const nameErr = validateName(request.params.name)
    if (nameErr) {
      return reply.status(400).send({ error: nameErr })
    }
    if (request.query.force !== 'true') {
      const refs = await storeService.getReferencingProfiles('commands', request.params.name)
      if (refs.length > 0) {
        return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs })
      }
    }
    const deleted = await commandService.delete(request.params.name)
    if (!deleted) {
      return reply.status(404).send({ error: 'Command not found' })
    }
    return { success: true }
  })

  // --- Import ---
  fastify.post<{ Body: { sourceDir: string } }>('/api/store/import', async (request, reply) => {
    const { sourceDir } = request.body || {}
    if (!sourceDir || typeof sourceDir !== 'string') {
      return reply.status(400).send({ error: 'sourceDir is required' })
    }
    return storeService.import(sourceDir)
  })
}
```

- [ ] **Step 4: Write store route tests**

```typescript
// packages/cli/src/server/routes/__tests__/store.test.ts
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { storeRoutes } from '../store'

describe('store routes', () => {
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'store-route-test-'))
    app = Fastify()
    await app.register(storeRoutes, { baseDir: tmpDir })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/store/agents returns empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/store/agents' })
    expect(res.statusCode).toBe(200)
    expect(res.json().agents).toEqual([])
  })

  it('POST /api/store/agents creates agent in store', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/store/agents',
      payload: { frontmatter: { name: 'test', description: 'Test' }, content: 'prompt' },
    })
    expect(res.statusCode).toBe(201)
    expect(existsSync(path.join(tmpDir, 'store', 'agents', 'test.md'))).toBe(true)
  })

  it('DELETE /api/store/agents/:name returns 409 when referenced', async () => {
    // Create agent in store
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'ref.md'), '---\nname: ref\ndescription: Ref\n---\np')
    // Create profile referencing it
    mkdirSync(path.join(tmpDir, 'profiles', 'prof'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'profiles', 'prof', 'profile.json'), JSON.stringify({
      name: 'prof', agents: ['ref'], skills: [], commands: [],
    }))

    const res = await app.inject({ method: 'DELETE', url: '/api/store/agents/ref' })
    expect(res.statusCode).toBe(409)
    expect(res.json().referencedBy).toEqual(['prof'])
  })

  it('DELETE /api/store/agents/:name?force=true bypasses reference check', async () => {
    mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'store', 'agents', 'ref.md'), '---\nname: ref\ndescription: Ref\n---\np')
    mkdirSync(path.join(tmpDir, 'profiles', 'prof'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'profiles', 'prof', 'profile.json'), JSON.stringify({
      name: 'prof', agents: ['ref'], skills: [], commands: [],
    }))

    const res = await app.inject({ method: 'DELETE', url: '/api/store/agents/ref?force=true' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/store/import imports from directory', async () => {
    const src = path.join(tmpDir, 'source')
    mkdirSync(path.join(src, 'agents'), { recursive: true })
    writeFileSync(path.join(src, 'agents', 'imported.md'), 'agent')

    const res = await app.inject({
      method: 'POST',
      url: '/api/store/import',
      payload: { sourceDir: src },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().imported).toBe(1)
  })
})
```

- [ ] **Step 5: Register in server/index.ts**

Add import:
```typescript
import { storeRoutes } from './routes/store'
```

Add registration:
```typescript
await fastify.register(storeRoutes, { baseDir })
```

- [ ] **Step 6: Run all tests**

```bash
cd ./packages/cli && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add store routes with import and reference-check delete"
```

---

### Task 6: Make AGENT_HOME routes read-only + source tagging

**Files:**
- Modify: `packages/cli/src/server/routes/agents.ts`
- Modify: `packages/cli/src/server/routes/skills.ts`
- Modify: `packages/cli/src/server/routes/commands.ts`
- Modify: `packages/cli/src/server/routes/__tests__/agents.test.ts`
- Modify: `packages/cli/src/server/routes/__tests__/skills.test.ts`
- Modify: `packages/cli/src/server/routes/__tests__/commands.test.ts`

- [ ] **Step 1: Update agents.ts — remove POST/PUT/DELETE, add lstat source tagging**

Replace `packages/cli/src/server/routes/agents.ts` with:

```typescript
import { lstat } from 'node:fs/promises'
import path from 'node:path'

import { FastifyPluginAsync } from 'fastify'

import { AgentService } from '../services/agentService'
import { PluginResolver } from '../services/pluginResolver'

interface AgentsRoutesOptions {
  agentsDir: string
  pluginsDir: string
  settingsPath: string
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const service = new AgentService(options.agentsDir)
  const resolver = new PluginResolver(options.pluginsDir, options.settingsPath)

  fastify.get('/api/agents', async () => {
    const agents = await service.list()

    // Tag source: check if symlink (profile) or regular file (local)
    for (const agent of agents) {
      try {
        const filePath = path.join(options.agentsDir, agent.filename)
        const stats = await lstat(filePath)
        agent.source = stats.isSymbolicLink() ? 'profile' as any : 'local' as any
      } catch {
        agent.source = 'local' as any
      }
    }

    // Aggregate from enabled plugins
    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'))
      const pluginAgents = await pluginService.list()
      for (const agent of pluginAgents) {
        agents.push({ ...agent, source: 'plugin', pluginId: id })
      }
    }

    agents.sort((a, b) => a.id.localeCompare(b.id))
    return { agents }
  })

  fastify.get<{ Params: { name: string } }>('/api/agents/:name', async (request, reply) => {
    const agent = await service.get(request.params.name)
    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' })
    }
    return { agent }
  })
}
```

- [ ] **Step 2: Do the same for skills.ts and commands.ts**

Same pattern: keep only GET routes, add lstat source tagging in list(), remove all write endpoints.

- [ ] **Step 3: Update route tests — remove POST/PUT/DELETE tests, add source tagging tests**

Update agents.test.ts, skills.test.ts, commands.test.ts:
- Remove tests for POST, PUT, DELETE
- Add test: regular file → source: 'local'
- Add test: symlink → source: 'profile'

- [ ] **Step 4: Update AgentSchema/SkillSchema/CommandSchema source enum**

In `packages/shared/src/agentSchema.ts`, `skillSchema.ts`, `commandSchema.ts`, update source enum:
```typescript
source: z.enum(['local', 'profile', 'plugin']),
```
(replacing `'user'` and `'project'` with `'local'` and `'profile'`)

- [ ] **Step 5: Run all tests**

```bash
cd ./packages/cli && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: make AGENT_HOME routes read-only, add source tagging via lstat"
```

---

### Task 7: Wire up server/index.ts

**Files:**
- Modify: `packages/cli/src/server/index.ts`

- [ ] **Step 1: Update server registration**

```typescript
// REST API
await fastify.register(configRoutes)
await fastify.register(settingsRoutes)

const agentHome = process.env.AGENT_HOME || '.claude'
const baseDir = path.join(os.homedir(), agentHome)
const pluginsDir = path.join(baseDir, 'plugins')
const settingsPath = path.join(baseDir, 'settings.json')

// AGENT_HOME read-only routes
await fastify.register(agentsRoutes, { agentsDir: path.join(baseDir, 'agents'), pluginsDir, settingsPath })
await fastify.register(skillsRoutes, { skillsDir: path.join(baseDir, 'skills'), pluginsDir, settingsPath })
await fastify.register(commandsRoutes, { commandsDir: path.join(baseDir, 'commands'), pluginsDir, settingsPath })
await fastify.register(pluginsRoutes, { pluginsDir, settingsPath })
await fastify.register(configsRoutes, { baseDir })

// Store + Profile routes
await fastify.register(storeRoutes, { baseDir })
await fastify.register(profilesRoutes, { baseDir })
```

- [ ] **Step 2: Run all tests**

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/server/index.ts
git commit -m "chore: register store and profile routes in server"
```
