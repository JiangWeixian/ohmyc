# Opencode Providers Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `ConfigProvider` abstraction so OhMyC's Explorer can read agents, skills, and commands from Claude Code, opencode, and the shared `.agents/` namespace through a single registry, with read-only API surfaces gated by an `?origins=` filter.

**Architecture:** Three providers (`ClaudeProvider`, `OpencodeProvider`, `AgentsSharedProvider`) each enumerate a known set of directories and parse frontmatter. A `ProviderRegistry` aggregates results, deduping skills by canonicalized real path so a single `SKILL.md` visible to multiple tools renders once with merged `origins[]`. Existing CRUD services (`AgentService`, `SkillService`, `CommandService`) remain the write path; routes layer plugin entries on top of the registry's read result.

**Tech Stack:** TypeScript, Fastify, `gray-matter` for frontmatter, `node:fs/promises`, `node:fs` (`realpathSync`), `vitest`. Workspace uses `@ohmyc/shared` for shared types and `@ohmyc/cli` for server code.

**Spec:** `docs/superpowers/specs/2026-05-11-opencode-providers-backend-design.md`

---

## File Structure

**Create:**
- `packages/shared/src/provider.ts` — `Origin`, `ProviderEntity`, `RenderBadge`, `ConfigProvider` types. **Types only — no runtime imports.**
- `packages/cli/src/server/services/scanners.ts` — shared file-enumeration helpers (`scanMdFiles`, `scanSkillDirs`).
- `packages/cli/src/server/services/providers/claude-provider.ts` — wraps Claude Code paths.
- `packages/cli/src/server/services/providers/opencode-provider.ts` — wraps opencode paths.
- `packages/cli/src/server/services/providers/agents-shared-provider.ts` — `.agents/skills/` only.
- `packages/cli/src/server/services/provider-registry.ts` — aggregation + skills dedup.
- `packages/cli/tests/server/services/scanners.test.ts`
- `packages/cli/tests/server/services/providers/claude-provider.test.ts`
- `packages/cli/tests/server/services/providers/opencode-provider.test.ts`
- `packages/cli/tests/server/services/providers/agents-shared-provider.test.ts`
- `packages/cli/tests/server/services/provider-registry.test.ts`

**Modify:**
- `packages/shared/src/index.ts` — export new types.
- `packages/cli/src/server/routes/agents.ts` — accept `?origins=`, delegate read to registry, layer plugin entries.
- `packages/cli/src/server/routes/skills.ts` — same.
- `packages/cli/src/server/routes/commands.ts` — same.
- `packages/cli/src/server/index.ts` — construct providers + registry once at boot, inject into routes.
- `README.md`, `AGENTS.md` — one paragraph each describing opencode/agents discovery.

---

## Task 1: Add Origin / ProviderEntity / RenderBadge / ConfigProvider types

**Files:**
- Create: `packages/shared/src/provider.ts`
- Modify: `packages/shared/src/index.ts`
- Test: covered by downstream provider tests; no dedicated test file (types-only module)

- [ ] **Step 1: Create `packages/shared/src/provider.ts`**

```ts
// Multi-tool config provider primitives.
// Types only — must NOT import node:fs or any runtime module so that
// browser/UI bundles can import these names without pulling in node deps.

export type Origin = 'claude' | 'opencode' | 'agents'

/** A single discovered entity (agent, skill, or command) along with provenance. */
export interface ProviderEntity<T> {
  /**
   * Every tool that reads this file, in registration order. Length >= 1.
   * `origins[0]` is the highest-priority provider that discovered the file —
   * use it wherever a single label is needed. Skills are the only kind that
   * commonly have length > 1.
   */
  origins: Origin[]
  /** Canonicalized absolute path on disk. */
  sourceFile: string
  scope: 'global' | 'project'
  /** Schema-validated payload (e.g. an Agent or Skill from @ohmyc/shared). */
  data: T
}

/** Render hint emitted by a provider for the `EntityCard` badges row. */
export interface RenderBadge {
  kind: 'mono' | 'pill'
  label: string
  tone?: 'neutral' | 'warn'
}

/** Per-tool source of agents, skills, and commands. */
export interface ConfigProvider {
  readonly id: Origin
  readonly displayName: string

  /** Directories to scan for agents, ordered global → project. */
  agentsDirs(): string[]
  /** Directories to scan for commands, ordered global → project. */
  commandsDirs(): string[]
  /** Directories to scan for skills, ordered global → project. */
  skillsDirs(): string[]

  /** Parse one agent file. May return null if required frontmatter is missing. */
  parseAgent(file: string, raw: string): unknown
  /** Parse one command file. May return null if required frontmatter is missing. */
  parseCommand(file: string, raw: string): unknown
  /** Parse one SKILL.md file. May return null if required frontmatter is missing. */
  parseSkill(file: string, raw: string): unknown

  /** Render hints surfaced to EntityCard for agent cards. */
  agentBadges(agent: unknown): RenderBadge[]
  /** Render hints surfaced to EntityCard for command cards. */
  commandBadges(cmd: unknown): RenderBadge[]
}
```

- [ ] **Step 2: Export the new module from the package index**

Edit `packages/shared/src/index.ts` — append one line:

```ts
export * from './provider'
```

- [ ] **Step 3: Type-check the shared package**

Run: `pnpm --filter @ohmyc/shared build` (or `pnpm -r build` if the workspace lacks a per-package script)
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/provider.ts packages/shared/src/index.ts
git commit -m "feat(shared): add ConfigProvider types"
```

---

## Task 2: Shared scanner utilities

**Files:**
- Create: `packages/cli/src/server/services/scanners.ts`
- Test: `packages/cli/tests/server/services/scanners.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/tests/server/services/scanners.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { scanMdFiles, scanSkillDirs } from '@/server/services/scanners'

describe('scanners', () => {
  let tmp: string
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'scanners-')) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

  it('scanMdFiles returns empty array when the dir does not exist', async () => {
    expect(await scanMdFiles(path.join(tmp, 'missing'))).toEqual([])
  })

  it('scanMdFiles returns absolute paths to .md files only, sorted', async () => {
    writeFileSync(path.join(tmp, 'b.md'), '')
    writeFileSync(path.join(tmp, 'a.md'), '')
    writeFileSync(path.join(tmp, 'note.txt'), '')
    const out = await scanMdFiles(tmp)
    expect(out.map(f => path.basename(f))).toEqual(['a.md', 'b.md'])
    expect(out.every(f => path.isAbsolute(f))).toBe(true)
  })

  it('scanSkillDirs returns paths to SKILL.md inside immediate subdirectories', async () => {
    mkdirSync(path.join(tmp, 'foo'))
    mkdirSync(path.join(tmp, 'bar'))
    writeFileSync(path.join(tmp, 'foo', 'SKILL.md'), '')
    writeFileSync(path.join(tmp, 'bar', 'NOT-SKILL.md'), '')
    const out = await scanSkillDirs(tmp)
    expect(out.map(f => path.basename(path.dirname(f)))).toEqual(['foo'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test scanners`
Expected: FAIL — module `@/server/services/scanners` not found.

- [ ] **Step 3: Implement the scanner module**

Create `packages/cli/src/server/services/scanners.ts`:

```ts
import { access, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

/** Returns absolute paths to all `.md` files directly under `dir`, sorted. Missing dir = []. */
export async function scanMdFiles(dir: string): Promise<string[]> {
  try {
    await access(dir)
  } catch {
    return []
  }
  const entries = await readdir(dir)
  return entries
    .filter(f => f.endsWith('.md'))
    .toSorted()
    .map(f => path.join(dir, f))
}

/** Returns absolute paths to `SKILL.md` files under each immediate subdirectory of `dir`. */
export async function scanSkillDirs(dir: string): Promise<string[]> {
  try {
    await access(dir)
  } catch {
    return []
  }
  const entries = await readdir(dir)
  const out: string[] = []
  for (const name of entries.toSorted()) {
    const sub = path.join(dir, name)
    try {
      const st = await stat(sub)
      if (!st.isDirectory()) {
        continue
      }
      const skillFile = path.join(sub, 'SKILL.md')
      await access(skillFile)
      out.push(skillFile)
    } catch {
      continue
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ohmyc/cli test scanners`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/scanners.ts packages/cli/tests/server/services/scanners.test.ts
git commit -m "feat(cli): add shared file scanners for provider discovery"
```

---

## Task 3: ClaudeProvider

**Files:**
- Create: `packages/cli/src/server/services/providers/claude-provider.ts`
- Test: `packages/cli/tests/server/services/providers/claude-provider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/tests/server/services/providers/claude-provider.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { ClaudeProvider } from '@/server/services/providers/claude-provider'

describe('ClaudeProvider', () => {
  let tmp: string
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'claude-prov-')) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

  it('exposes id and displayName', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    expect(p.id).toBe('claude')
    expect(p.displayName).toMatch(/claude/i)
  })

  it('agentsDirs returns global then project, omitting null', () => {
    const projectDir = path.join(tmp, 'project')
    mkdirSync(projectDir, { recursive: true })
    const p = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'global', 'agents'),
      skillsGlobalDir: path.join(tmp, 'global', 'skills'),
      commandsGlobalDir: path.join(tmp, 'global', 'commands'),
      projectDir,
    })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, 'global', 'agents'),
      path.join(projectDir, 'agents'),
    ])
  })

  it('parseAgent returns null when required frontmatter is missing', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    expect(p.parseAgent('/x.md', '---\n---\nbody')).toBeNull()
  })

  it('parseAgent returns parsed agent with name+description', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    const parsed: any = p.parseAgent('/x.md', '---\nname: foo\ndescription: bar\n---\nbody')
    expect(parsed.frontmatter.name).toBe('foo')
    expect(parsed.frontmatter.description).toBe('bar')
  })

  it('agentBadges emits model when present', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    const badges = p.agentBadges({ frontmatter: { model: 'sonnet' } })
    expect(badges).toEqual([{ kind: 'mono', label: 'sonnet' }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test claude-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ClaudeProvider**

Create `packages/cli/src/server/services/providers/claude-provider.ts`:

```ts
import path from 'node:path'

import type { AgentFrontmatter, CommandFrontmatter, SkillFrontmatter } from '@ohmyc/shared'
import type { ConfigProvider, Origin, RenderBadge } from '@ohmyc/shared'
import matter from 'gray-matter'

export interface ClaudeProviderOptions {
  /** `<HOME>/.claude/agents/` (or AGENT_HOME override). */
  agentsGlobalDir: string
  /** `<HOME>/.claude/skills/`. */
  skillsGlobalDir?: string
  /** `<HOME>/.claude/commands/`. */
  commandsGlobalDir?: string
  /** `<cwd>/.claude/`, or null if no project. */
  projectDir: string | null
}

/** Wraps Claude Code's directory layout. Read-only. */
export class ClaudeProvider implements ConfigProvider {
  readonly id: Origin = 'claude'
  readonly displayName = 'Claude'

  constructor(private opts: ClaudeProviderOptions) {}

  agentsDirs(): string[] {
    const dirs = [this.opts.agentsGlobalDir]
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'agents'))
    }
    return dirs
  }

  commandsDirs(): string[] {
    const dirs: string[] = []
    if (this.opts.commandsGlobalDir) {
      dirs.push(this.opts.commandsGlobalDir)
    }
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'commands'))
    }
    return dirs
  }

  skillsDirs(): string[] {
    const dirs: string[] = []
    if (this.opts.skillsGlobalDir) {
      dirs.push(this.opts.skillsGlobalDir)
    }
    if (this.opts.projectDir) {
      dirs.push(path.join(this.opts.projectDir, 'skills'))
    }
    return dirs
  }

  parseAgent(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as AgentFrontmatter
    if (!fm.name || !fm.description) {
      return null
    }
    return {
      id: path.basename(file).replace(/\.md$/, ''),
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseCommand(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as CommandFrontmatter
    if (!fm.name && !fm.description) {
      return null
    }
    return {
      id: path.basename(file).replace(/\.md$/, ''),
      frontmatter: { name: fm.name ?? path.basename(file).replace(/\.md$/, ''), ...fm },
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseSkill(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as SkillFrontmatter
    if (!fm.name || !fm.description) {
      return null
    }
    return {
      id: fm.name,
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: 'SKILL.md',
    }
  }

  agentBadges(agent: unknown): RenderBadge[] {
    const fm = (agent as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm.model === 'string') {
      out.push({ kind: 'mono', label: fm.model })
    }
    return out
  }

  commandBadges(cmd: unknown): RenderBadge[] {
    const fm = (cmd as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm['argument-hint'] === 'string') {
      out.push({ kind: 'mono', label: fm['argument-hint'] })
    }
    return out
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test claude-provider`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/providers/claude-provider.ts packages/cli/tests/server/services/providers/claude-provider.test.ts
git commit -m "feat(cli): add ClaudeProvider"
```

---

## Task 4: OpencodeProvider

**Files:**
- Create: `packages/cli/src/server/services/providers/opencode-provider.ts`
- Test: `packages/cli/tests/server/services/providers/opencode-provider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/tests/server/services/providers/opencode-provider.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OpencodeProvider } from '@/server/services/providers/opencode-provider'

describe('OpencodeProvider', () => {
  let tmp: string
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'oc-prov-')) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); vi.unstubAllEnvs() })

  it('id is opencode', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.id).toBe('opencode')
  })

  it('agentsDirs on linux defaults to ~/.config/opencode/agents and <cwd>/.opencode/agents', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, '.config', 'opencode', 'agents'),
      path.join(tmp, '.opencode', 'agents'),
    ])
  })

  it('agentsDirs on darwin uses Library/Application Support', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'darwin', cwd: tmp })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, 'Library', 'Application Support', 'opencode', 'agents'),
      path.join(tmp, '.opencode', 'agents'),
    ])
  })

  it('OPENCODE_CONFIG_DIR overrides the global config dir', () => {
    vi.stubEnv('OPENCODE_CONFIG_DIR', '/custom/opencode')
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.agentsDirs()[0]).toBe('/custom/opencode/agents')
  })

  it('project dir is omitted when <cwd>/.opencode/ does not exist', () => {
    const cwd = path.join(tmp, 'no-project')
    mkdirSync(cwd)
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, '.config', 'opencode', 'agents'),
    ])
  })

  it('parseAgent returns null on missing description', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.parseAgent('/x.md', '---\nname: foo\n---\nbody')).toBeNull()
  })

  it('agentBadges emits mode only (not permission)', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    const badges = p.agentBadges({
      frontmatter: { mode: 'subagent', permission: { edit: 'deny' } },
    })
    expect(badges).toEqual([{ kind: 'mono', label: 'subagent' }])
  })

  it('agentBadges tolerates malformed permission (does not throw)', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(() => p.agentBadges({ frontmatter: { permission: 'not-an-object' } })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test opencode-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement OpencodeProvider**

Create `packages/cli/src/server/services/providers/opencode-provider.ts`:

```ts
import { existsSync } from 'node:fs'
import path from 'node:path'

import type { ConfigProvider, Origin, RenderBadge } from '@ohmyc/shared'
import matter from 'gray-matter'

export interface OpencodeProviderOptions {
  /** Override for the OS home directory (used for testing). */
  home: string
  /** Override for `os.platform()` return value. */
  platform: NodeJS.Platform
  /** Working directory used for `.opencode/` discovery. */
  cwd: string
}

const GLOBAL_DIR_NAME = 'opencode'

function defaultGlobalDir(home: string, platform: NodeJS.Platform): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', GLOBAL_DIR_NAME)
  }
  return path.join(home, '.config', GLOBAL_DIR_NAME)
}

/** Wraps opencode's directory layout. Read-only. */
export class OpencodeProvider implements ConfigProvider {
  readonly id: Origin = 'opencode'
  readonly displayName = 'Opencode'

  private readonly globalDir: string
  private readonly projectDir: string | null

  constructor(opts: OpencodeProviderOptions) {
    const override = process.env.OPENCODE_CONFIG_DIR
    this.globalDir = override && override.length > 0
      ? override
      : defaultGlobalDir(opts.home, opts.platform)

    const candidate = path.join(opts.cwd, '.opencode')
    this.projectDir = existsSync(candidate) ? candidate : null
  }

  private dirs(kind: 'agents' | 'commands' | 'skills'): string[] {
    const out = [path.join(this.globalDir, kind)]
    if (this.projectDir) {
      out.push(path.join(this.projectDir, kind))
    }
    return out
  }

  agentsDirs(): string[] { return this.dirs('agents') }
  commandsDirs(): string[] { return this.dirs('commands') }
  skillsDirs(): string[] { return this.dirs('skills') }

  parseAgent(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    if (typeof fm.description !== 'string' || fm.description.length === 0) {
      return null
    }
    const id = (typeof fm.name === 'string' && fm.name)
      || path.basename(file).replace(/\.md$/, '')
    return {
      id,
      frontmatter: { name: id, ...fm },
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseCommand(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    const id = (typeof fm.name === 'string' && fm.name)
      || path.basename(file).replace(/\.md$/, '')
    return {
      id,
      frontmatter: { name: id, ...fm },
      content: parsed.content.trim(),
      raw,
      filename: path.basename(file),
    }
  }

  parseSkill(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    if (typeof fm.name !== 'string' || typeof fm.description !== 'string') {
      return null
    }
    return {
      id: fm.name,
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: 'SKILL.md',
    }
  }

  agentBadges(agent: unknown): RenderBadge[] {
    const fm = (agent as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm.mode === 'string') {
      out.push({ kind: 'mono', label: fm.mode })
    }
    return out
  }

  commandBadges(cmd: unknown): RenderBadge[] {
    const fm = (cmd as any)?.frontmatter ?? {}
    const out: RenderBadge[] = []
    if (typeof fm.agent === 'string') {
      out.push({ kind: 'mono', label: fm.agent })
    }
    if (fm.subtask === true) {
      out.push({ kind: 'pill', label: 'subtask' })
    }
    return out
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test opencode-provider`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/providers/opencode-provider.ts packages/cli/tests/server/services/providers/opencode-provider.test.ts
git commit -m "feat(cli): add OpencodeProvider"
```

---

## Task 5: AgentsSharedProvider

**Files:**
- Create: `packages/cli/src/server/services/providers/agents-shared-provider.ts`
- Test: `packages/cli/tests/server/services/providers/agents-shared-provider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/tests/server/services/providers/agents-shared-provider.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AgentsSharedProvider } from '@/server/services/providers/agents-shared-provider'

describe('AgentsSharedProvider', () => {
  let tmp: string
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'agents-prov-')) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

  it('id is agents and only exposes skills dirs', () => {
    const p = new AgentsSharedProvider({ home: tmp, cwd: tmp })
    expect(p.id).toBe('agents')
    expect(p.agentsDirs()).toEqual([])
    expect(p.commandsDirs()).toEqual([])
  })

  it('skillsDirs lists ~/.agents/skills then <cwd>/.agents/skills when the project dir exists', () => {
    mkdirSync(path.join(tmp, '.agents'))
    const p = new AgentsSharedProvider({ home: tmp, cwd: tmp })
    expect(p.skillsDirs()).toEqual([
      path.join(tmp, '.agents', 'skills'),
      path.join(tmp, '.agents', 'skills'),
    ])
  })

  it('omits project dir when <cwd>/.agents does not exist', () => {
    const cwd = path.join(tmp, 'no-agents')
    mkdirSync(cwd)
    const p = new AgentsSharedProvider({ home: tmp, cwd })
    expect(p.skillsDirs()).toEqual([path.join(tmp, '.agents', 'skills')])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test agents-shared-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AgentsSharedProvider**

Create `packages/cli/src/server/services/providers/agents-shared-provider.ts`:

```ts
import { existsSync } from 'node:fs'
import path from 'node:path'

import type { ConfigProvider, Origin, RenderBadge } from '@ohmyc/shared'
import matter from 'gray-matter'

export interface AgentsSharedProviderOptions {
  home: string
  cwd: string
}

/** Neutral `.agents/skills/` namespace — both Claude and opencode read it. Skills only. */
export class AgentsSharedProvider implements ConfigProvider {
  readonly id: Origin = 'agents'
  readonly displayName = 'Shared'

  private readonly globalDir: string
  private readonly projectDir: string | null

  constructor(opts: AgentsSharedProviderOptions) {
    this.globalDir = path.join(opts.home, '.agents')
    const candidate = path.join(opts.cwd, '.agents')
    this.projectDir = existsSync(candidate) ? candidate : null
  }

  agentsDirs(): string[] { return [] }
  commandsDirs(): string[] { return [] }

  skillsDirs(): string[] {
    const out = [path.join(this.globalDir, 'skills')]
    if (this.projectDir) {
      out.push(path.join(this.projectDir, 'skills'))
    }
    return out
  }

  parseAgent(): unknown { return null }
  parseCommand(): unknown { return null }

  parseSkill(file: string, raw: string): unknown {
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    if (typeof fm.name !== 'string' || typeof fm.description !== 'string') {
      return null
    }
    return {
      id: fm.name,
      frontmatter: fm,
      content: parsed.content.trim(),
      raw,
      filename: 'SKILL.md',
    }
  }

  agentBadges(): RenderBadge[] { return [] }
  commandBadges(): RenderBadge[] { return [] }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test agents-shared-provider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/providers/agents-shared-provider.ts packages/cli/tests/server/services/providers/agents-shared-provider.test.ts
git commit -m "feat(cli): add AgentsSharedProvider (skills-only namespace)"
```

---

## Task 6: ProviderRegistry with skills dedup-by-realpath

**Files:**
- Create: `packages/cli/src/server/services/provider-registry.ts`
- Test: `packages/cli/tests/server/services/provider-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/tests/server/services/provider-registry.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ProviderRegistry } from '@/server/services/provider-registry'
import { ClaudeProvider } from '@/server/services/providers/claude-provider'
import { AgentsSharedProvider } from '@/server/services/providers/agents-shared-provider'

function writeSkill(dir: string, name: string) {
  mkdirSync(path.join(dir, name), { recursive: true })
  writeFileSync(
    path.join(dir, name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test ${name}\n---\nbody`,
  )
}

function writeAgent(dir: string, name: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    path.join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: agent ${name}\n---\nbody`,
  )
}

describe('ProviderRegistry', () => {
  let tmp: string
  beforeEach(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'registry-')) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

  it('listAgents merges entries from all providers and tags origin', async () => {
    const claudeDir = path.join(tmp, 'claude-agents')
    writeAgent(claudeDir, 'alpha')
    const claude = new ClaudeProvider({ agentsGlobalDir: claudeDir, projectDir: null })
    const registry = new ProviderRegistry([claude])

    const agents = await registry.listAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].origins).toEqual(['claude'])
    expect((agents[0].data as any).id).toBe('alpha')
  })

  it('filter.origins narrows results by origin', async () => {
    const claudeDir = path.join(tmp, 'claude-agents')
    writeAgent(claudeDir, 'alpha')
    const claude = new ClaudeProvider({ agentsGlobalDir: claudeDir, projectDir: null })
    const registry = new ProviderRegistry([claude])

    expect(await registry.listAgents({ origins: ['opencode'] })).toEqual([])
    expect(await registry.listAgents({ origins: ['claude'] })).toHaveLength(1)
  })

  it('listSkills dedupes by canonical path and merges origins[]', async () => {
    // One physical SKILL.md, reachable from two providers via a symlink farm.
    const realRoot = path.join(tmp, 'real')
    writeSkill(realRoot, 'shared')
    const realSkill = path.join(realRoot, 'shared', 'SKILL.md')

    // Claude sees it at ~/.claude/skills/shared/SKILL.md
    const claudeSkills = path.join(tmp, 'claude', 'skills')
    mkdirSync(claudeSkills, { recursive: true })
    symlinkSync(path.join(realRoot, 'shared'), path.join(claudeSkills, 'shared'))

    // Agents shared sees it at ~/.agents/skills/shared/SKILL.md
    const agentsHome = path.join(tmp, 'home-agents')
    mkdirSync(path.join(agentsHome, '.agents', 'skills'), { recursive: true })
    symlinkSync(path.join(realRoot, 'shared'), path.join(agentsHome, '.agents', 'skills', 'shared'))

    const claude = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'unused-agents'),
      skillsGlobalDir: claudeSkills,
      projectDir: null,
    })
    const agents = new AgentsSharedProvider({ home: agentsHome, cwd: tmp })

    const registry = new ProviderRegistry([claude, agents])
    const skills = await registry.listSkills()

    expect(skills).toHaveLength(1)
    expect(skills[0].sourceFile).toBe(realSkill) // canonicalized
    expect(skills[0].origins.toSorted()).toEqual(['agents', 'claude'])
  })

  it('listSkills filter matches any origin in origins[]', async () => {
    const claudeSkills = path.join(tmp, 'claude-skills')
    writeSkill(claudeSkills, 'foo')
    const claude = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'unused'),
      skillsGlobalDir: claudeSkills,
      projectDir: null,
    })
    const registry = new ProviderRegistry([claude])
    expect(await registry.listSkills({ origins: ['opencode'] })).toEqual([])
    expect(await registry.listSkills({ origins: ['claude'] })).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test provider-registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ProviderRegistry**

Create `packages/cli/src/server/services/provider-registry.ts`:

```ts
import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import type { ConfigProvider, Origin, ProviderEntity } from '@ohmyc/shared'

import { scanMdFiles, scanSkillDirs } from './scanners'

interface ListFilter {
  origins?: Origin[]
}

function canonicalize(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

function inFilter(entity: ProviderEntity<unknown>, filter?: ListFilter): boolean {
  if (!filter?.origins || filter.origins.length === 0) {
    return true
  }
  return entity.origins.some(o => filter.origins!.includes(o))
}

/** Aggregates entities across providers. Dedupes skills by canonical path. */
export class ProviderRegistry {
  constructor(private providers: ConfigProvider[]) {}

  async listAgents(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    return this.listFlat('agents', filter)
  }

  async listCommands(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    return this.listFlat('commands', filter)
  }

  async listSkills(filter?: ListFilter): Promise<ProviderEntity<unknown>[]> {
    const byPath = new Map<string, ProviderEntity<unknown>>()

    for (const provider of this.providers) {
      for (let i = 0; i < provider.skillsDirs().length; i++) {
        const dir = provider.skillsDirs()[i]
        const scope = i === 0 ? 'global' : 'project'
        const skillFiles = await scanSkillDirs(dir)
        for (const file of skillFiles) {
          const canonical = canonicalize(file)
          const existing = byPath.get(canonical)
          if (existing) {
            if (!existing.origins.includes(provider.id)) {
              existing.origins.push(provider.id)
            }
            continue
          }
          const raw = await readFile(file, 'utf8')
          const data = provider.parseSkill(file, raw)
          if (!data) {
            continue
          }
          byPath.set(canonical, {
            origins: [provider.id],
            sourceFile: canonical,
            scope,
            data,
          })
        }
      }
    }

    return [...byPath.values()].filter(e => inFilter(e, filter))
  }

  private async listFlat(
    kind: 'agents' | 'commands',
    filter?: ListFilter,
  ): Promise<ProviderEntity<unknown>[]> {
    const out: ProviderEntity<unknown>[] = []
    for (const provider of this.providers) {
      const dirs = kind === 'agents' ? provider.agentsDirs() : provider.commandsDirs()
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i]
        const scope = i === 0 ? 'global' : 'project'
        const files = await scanMdFiles(dir)
        for (const file of files) {
          const raw = await readFile(file, 'utf8')
          const data = kind === 'agents'
            ? provider.parseAgent(file, raw)
            : provider.parseCommand(file, raw)
          if (!data) {
            continue
          }
          out.push({
            origins: [provider.id],
            sourceFile: canonicalize(file),
            scope,
            data,
          })
        }
      }
    }
    return out.filter(e => inFilter(e, filter))
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test provider-registry`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/services/provider-registry.ts packages/cli/tests/server/services/provider-registry.test.ts
git commit -m "feat(cli): add ProviderRegistry with skills dedup-by-realpath"
```

---

## Task 7: Wire registry into agents route with `?origins=` filter

**Files:**
- Modify: `packages/cli/src/server/routes/agents.ts`
- Test: `packages/cli/tests/server/routes/agents.test.ts` (add new tests; don't break existing)

- [ ] **Step 1: Write the failing test**

Append to `packages/cli/tests/server/routes/agents.test.ts` (preserve existing imports/setup):

```ts
// Inside the existing describe block — adjust path setup helpers to match the file's style.
it('GET /api/agents tags each agent with origins: ["claude"]', async () => {
  // Use the existing helper that bootstraps the server with a tmp agentsDir.
  // Write one agent file, then fetch /api/agents and assert origin tagging.
  // (Helper name in this file is `buildServer(...)` — reuse it.)
  const { app, agentsDir } = await buildServer()
  writeFileSync(path.join(agentsDir, 'alpha.md'),
    '---\nname: alpha\ndescription: A\n---\nbody')

  const res = await app.inject({ method: 'GET', url: '/api/agents' })
  expect(res.statusCode).toBe(200)
  const body = res.json()
  const alpha = body.agents.find((a: any) => a.id === 'alpha')
  expect(alpha?.origins).toEqual(['claude'])
})

it('GET /api/agents?origins=opencode returns no claude agents', async () => {
  const { app, agentsDir } = await buildServer()
  writeFileSync(path.join(agentsDir, 'alpha.md'),
    '---\nname: alpha\ndescription: A\n---\nbody')
  const res = await app.inject({ method: 'GET', url: '/api/agents?origins=opencode' })
  expect(res.statusCode).toBe(200)
  expect(res.json().agents.find((a: any) => a.id === 'alpha')).toBeUndefined()
})
```

If the existing test file uses a different setup pattern (e.g. it constructs the route module directly with options), mirror that pattern in these tests instead. The behavior under test is the same.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test routes/agents`
Expected: FAIL — `origins` field is absent on response items.

- [ ] **Step 3: Modify the agents route**

Edit `packages/cli/src/server/routes/agents.ts`:

```ts
// Agent inventory routes — merges agents from the provider registry, enabled plugins, and projects.
import path from 'node:path'

import type { Origin, ProviderEntity } from '@ohmyc/shared'

import { AgentService } from '../services/agent-service'
import { PluginResolver } from '../services/plugin-resolver'
import { ProviderRegistry } from '../services/provider-registry'
import { resolveInventorySource } from './inventory-source'

import type { FastifyPluginAsync } from 'fastify'

/** Route registration options for the agents API. */
interface AgentsRoutesOptions {
  agentsDir: string
  projectAgentsDir: string | null | undefined
  pluginsDir: string
  claudeSettingsPaths: readonly string[]
  baseDir?: string
  registry: ProviderRegistry
}

function parseOriginsQuery(value: string | undefined): Origin[] | undefined {
  if (!value) {
    return undefined
  }
  const valid: Origin[] = ['claude', 'opencode', 'agents']
  const parts = value.split(',').map(s => s.trim()).filter(Boolean)
  const filtered = parts.filter((p): p is Origin => (valid as string[]).includes(p))
  return filtered.length > 0 ? filtered : undefined
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOptions> = async (fastify, options) => {
  const resolver = new PluginResolver(options.pluginsDir, options.claudeSettingsPaths)

  fastify.get<{ Querystring: { origins?: string } }>('/api/agents', async (request) => {
    const origins = parseOriginsQuery(request.query.origins)
    const entries = await options.registry.listAgents(origins ? { origins } : undefined)

    const agents: any[] = []
    for (const entry of entries) {
      const data = entry.data as any
      const primary = entry.origins[0]
      const merged = { ...data, origins: entry.origins, scope: entry.scope }
      // Preserve legacy `source` for clients that key on it.
      if (primary === 'claude' && entry.scope === 'global') {
        merged.source = await resolveInventorySource(entry.sourceFile, options.baseDir)
      } else if (primary === 'claude' && entry.scope === 'project') {
        merged.source = 'project'
      } else {
        merged.source = primary
      }
      agents.push(merged)
    }

    // Plugins are a separate axis; treat their entries as Claude origin.
    const includeClaude = !origins || origins.includes('claude')
    if (includeClaude) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      for (const { id, installPath } of pluginPaths) {
        const pluginService = new AgentService(path.join(installPath, 'agents'))
        const pluginAgents = await pluginService.list()
        for (const agent of pluginAgents) {
          agents.push({
            ...agent,
            source: 'plugin' as const,
            scope: 'global' as const,
            pluginId: id,
            origins: ['claude'],
          })
        }
      }
    }

    agents.sort((a, b) => {
      const cmp = a.id.localeCompare(b.id)
      if (cmp !== 0) return cmp
      const aScope = a.scope === 'project' ? 0 : 1
      const bScope = b.scope === 'project' ? 0 : 1
      return aScope - bScope
    })
    return { agents }
  })

  // GET /api/agents/:name is unchanged — keeps the existing single-entity lookup logic.
  fastify.get<{ Params: { name: string }; Querystring: { source?: string; pluginId?: string; scope?: string } }>('/api/agents/:name', async (request, reply) => {
    const { name } = request.params
    const { source, pluginId, scope } = request.query

    if (source === 'plugin' && pluginId) {
      const pluginPaths = await resolver.getEnabledPluginPaths()
      const target = pluginPaths.find(p => p.id === pluginId)
      if (target) {
        const pluginService = new AgentService(path.join(target.installPath, 'agents'))
        const pluginAgent = await pluginService.get(name)
        if (pluginAgent) {
          return { agent: { ...pluginAgent, source: 'plugin' as const, scope: 'global' as const, pluginId } }
        }
      }
      return reply.status(404).send({ error: 'Agent not found' })
    }

    if ((source === 'project' || scope === 'project') && options.projectAgentsDir) {
      const projectService = new AgentService(options.projectAgentsDir)
      const projectAgent = await projectService.get(name)
      if (projectAgent) {
        return { agent: { ...projectAgent, source: 'project' as const, scope: 'project' as const } }
      }
    }

    const service = new AgentService(options.agentsDir)
    const agent = await service.get(name)
    if (agent) {
      const filePath = path.join(options.agentsDir, agent.filename);
      (agent as any).source = await resolveInventorySource(filePath, options.baseDir);
      (agent as any).scope = 'global'
      return { agent }
    }

    const pluginPaths = await resolver.getEnabledPluginPaths()
    for (const { id, installPath } of pluginPaths) {
      const pluginService = new AgentService(path.join(installPath, 'agents'))
      const pluginAgent = await pluginService.get(name)
      if (pluginAgent) {
        return { agent: { ...pluginAgent, source: 'plugin' as const, scope: 'global' as const, pluginId: id } }
      }
    }

    return reply.status(404).send({ error: 'Agent not found' })
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test routes/agents`
Expected: PASS — existing tests still green; new `origin` tagging and `?origins=` filter tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/routes/agents.ts packages/cli/tests/server/routes/agents.test.ts
git commit -m "feat(cli): route /api/agents through provider registry"
```

---

## Task 8: Wire registry into skills route

**Files:**
- Modify: `packages/cli/src/server/routes/skills.ts`
- Test: `packages/cli/tests/server/routes/skills.test.ts`

- [ ] **Step 1: Write the failing test**

Append a test that mirrors Task 7's pattern for skills:

```ts
it('GET /api/skills tags entries with origins[]', async () => {
  const { app, skillsDir } = await buildServer()
  // Write a SKILL.md under skillsDir/foo/SKILL.md (use the test file's existing helper if any)
  mkdirSync(path.join(skillsDir, 'foo'), { recursive: true })
  writeFileSync(path.join(skillsDir, 'foo', 'SKILL.md'),
    '---\nname: foo\ndescription: a skill\n---\nbody')
  const res = await app.inject({ method: 'GET', url: '/api/skills' })
  expect(res.statusCode).toBe(200)
  const body = res.json()
  const foo = body.skills.find((s: any) => s.id === 'foo')
  expect(foo?.origins).toEqual(['claude'])
})

it('GET /api/skills?origins=opencode hides claude skills', async () => {
  const { app, skillsDir } = await buildServer()
  mkdirSync(path.join(skillsDir, 'foo'), { recursive: true })
  writeFileSync(path.join(skillsDir, 'foo', 'SKILL.md'),
    '---\nname: foo\ndescription: a skill\n---\nbody')
  const res = await app.inject({ method: 'GET', url: '/api/skills?origins=opencode' })
  expect(res.json().skills.find((s: any) => s.id === 'foo')).toBeUndefined()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test routes/skills`
Expected: FAIL — `origins` absent.

- [ ] **Step 3: Modify the skills route**

Apply the same pattern as agents:

1. Add `registry: ProviderRegistry` to `SkillsRoutesOptions`.
2. Add the `parseOriginsQuery` helper (copy from `agents.ts` — or extract into `routes/origin-filter.ts` if you prefer DRY; either is fine, but if extracting, also update the agents route to import from there in the same commit).
3. Replace the global+project read path with `await options.registry.listSkills({ origins })`.
4. Keep the plugin enumeration as-is; tag plugin entries with `origins: ['claude']`.
5. Detail route `/api/skills/:name` unchanged.

Show this code in the diff (file is ~similar shape to `routes/agents.ts`):

```ts
fastify.get<{ Querystring: { origins?: string } }>('/api/skills', async (request) => {
  const origins = parseOriginsQuery(request.query.origins)
  const entries = await options.registry.listSkills(origins ? { origins } : undefined)

  const skills: any[] = entries.map(entry => {
    const data = entry.data as any
    const primary = entry.origins[0]
    const source = entry.scope === 'project' ? 'project'
      : primary === 'claude' ? 'local'
      : primary
    return { ...data, origins: entry.origins, scope: entry.scope, source }
  })

  const includeClaude = !origins || origins.includes('claude')
  if (includeClaude) {
    // existing plugin enumeration, tagged origins: ['claude']
  }

  skills.sort((a, b) => a.id.localeCompare(b.id))
  return { skills }
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test routes/skills`
Expected: PASS — existing tests green; new tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/routes/skills.ts packages/cli/tests/server/routes/skills.test.ts
git commit -m "feat(cli): route /api/skills through provider registry"
```

---

## Task 9: Wire registry into commands route

**Files:**
- Modify: `packages/cli/src/server/routes/commands.ts`
- Test: `packages/cli/tests/server/routes/commands.test.ts`

- [ ] **Step 1: Write the failing test**

Same pattern as Task 7/8 — assert `origin: 'claude'` tagging and `?origins=opencode` filter.

```ts
it('GET /api/commands tags entries with origins: ["claude"]', async () => {
  const { app, commandsDir } = await buildServer()
  writeFileSync(path.join(commandsDir, 'hi.md'),
    '---\nname: hi\ndescription: hello\n---\nbody')
  const res = await app.inject({ method: 'GET', url: '/api/commands' })
  expect(res.statusCode).toBe(200)
  expect(res.json().commands.find((c: any) => c.id === 'hi')?.origins).toEqual(['claude'])
})

it('GET /api/commands?origins=opencode hides claude commands', async () => {
  const { app, commandsDir } = await buildServer()
  writeFileSync(path.join(commandsDir, 'hi.md'),
    '---\nname: hi\ndescription: hello\n---\nbody')
  const res = await app.inject({ method: 'GET', url: '/api/commands?origins=opencode' })
  expect(res.json().commands.find((c: any) => c.id === 'hi')).toBeUndefined()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ohmyc/cli test routes/commands`
Expected: FAIL.

- [ ] **Step 3: Modify the commands route**

Same shape as agents/skills:

1. Add `registry: ProviderRegistry` to `CommandsRoutesOptions`.
2. Import `parseOriginsQuery` (from wherever Task 8 placed it).
3. Replace global+project read with `await options.registry.listCommands(...)`.
4. Plugin enumeration unchanged; tag with `origins: ['claude']`.
5. Detail route unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ohmyc/cli test routes/commands`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/server/routes/commands.ts packages/cli/tests/server/routes/commands.test.ts
git commit -m "feat(cli): route /api/commands through provider registry"
```

---

## Task 10: Construct providers + registry at server boot

**Files:**
- Modify: `packages/cli/src/server/index.ts`
- Test: `packages/cli/tests/server/launcher-server.test.ts` (only verify that boot still works; functional coverage lives in route tests)

- [ ] **Step 1: Update `createServer`**

Edit `packages/cli/src/server/index.ts`:

Add imports near the top:

```ts
import os from 'node:os'

import { ProviderRegistry } from './services/provider-registry'
import { AgentsSharedProvider } from './services/providers/agents-shared-provider'
import { ClaudeProvider } from './services/providers/claude-provider'
import { OpencodeProvider } from './services/providers/opencode-provider'
```

In `createServer`, after `const config = new ConfigLocator(...)`, construct the registry:

```ts
const claude = new ClaudeProvider({
  agentsGlobalDir: path.join(os.homedir(), process.env.AGENT_HOME ?? '.claude', 'agents'),
  skillsGlobalDir: path.join(os.homedir(), process.env.AGENT_HOME ?? '.claude', 'skills'),
  commandsGlobalDir: path.join(os.homedir(), process.env.AGENT_HOME ?? '.claude', 'commands'),
  projectDir: config.projectPath,
})
const opencode = new OpencodeProvider({
  home: os.homedir(),
  platform: os.platform(),
  cwd: serverCwd,
})
const agentsShared = new AgentsSharedProvider({ home: os.homedir(), cwd: serverCwd })

const registry = new ProviderRegistry([claude, opencode, agentsShared])
```

Then thread `registry` into the three route registrations:

```ts
await fastify.register(agentsRoutes,   { agentsDir: config.agentsDir,   projectAgentsDir: config.projectAgentsDir,   pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir, registry })
await fastify.register(skillsRoutes,   { skillsDir: config.skillsDir,   projectSkillsDir: config.projectSkillsDir,   pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir, registry })
await fastify.register(commandsRoutes, { commandsDir: config.commandsDir, projectCommandsDir: config.projectCommandsDir, pluginsDir: config.pluginsDir, claudeSettingsPaths, baseDir: config.baseDir, registry })
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm --filter @ohmyc/cli test`
Expected: PASS — all existing tests plus the new ones.

- [ ] **Step 3: Type-check and build**

Run: `pnpm --filter @ohmyc/cli build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/server/index.ts
git commit -m "feat(cli): construct provider registry at server boot"
```

---

## Task 11: Update README + AGENTS.md

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: Append one paragraph to README.md** (find an appropriate section — "What it reads" / "Discovery" — or append near the top of the features list)

```markdown
### Multi-tool discovery

OhMyC also reads opencode config from `~/.config/opencode/` (or
`~/Library/Application Support/opencode/` on macOS) and `<cwd>/.opencode/`,
plus the shared `~/.agents/skills/` and `<cwd>/.agents/skills/` namespace.
Set `OPENCODE_CONFIG_DIR` to override the global opencode config dir.
```

- [ ] **Step 2: Append one paragraph to AGENTS.md** in the discovery section.

```markdown
The server enumerates agents/skills/commands via a `ProviderRegistry` that
wraps three `ConfigProvider`s: `ClaudeProvider`, `OpencodeProvider`, and
`AgentsSharedProvider` (skills only). Read-only routes accept `?origins=`
to filter (`claude`, `opencode`, `agents`).
```

- [ ] **Step 3: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: describe opencode + agents provider discovery"
```

---

## Self-Review Notes

- **Spec coverage:** Types (Task 1), providers (Tasks 3–5), registry with dedup (Task 6), routes with `?origins=` (Tasks 7–9), server wiring (Task 10), docs (Task 11). Every section of the spec maps to a task.
- **Plugin handling:** Spec doesn't reference plugins, but the current routes do. Plan preserves plugin merging in the routes and tags plugin entries `origins: ['claude']` so the source filter behaves coherently. This is a v1 simplification — plugin enumeration via providers is a v2 candidate.
- **Risks called out in the spec:**
  - Import cycle (shared/provider.ts is types-only — verified in Task 1).
  - Symlink farms (Task 6 dedup uses `realpathSync`, tested with a symlink fixture).
  - Schema tolerance (opencode parser accepts unknown fields by spreading `fm` into the frontmatter; Task 4 test asserts malformed `permission` does not throw).
- **Non-goals not implemented:** `opencode.json` inline agents, walk-up project discovery, `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT`, permission badges. All deferred per spec.
