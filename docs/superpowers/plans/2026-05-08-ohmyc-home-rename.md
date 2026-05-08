# OHMYC_HOME Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `CUI_HOME` env var to `OHMYC_HOME` and move the default managed-data directory from `~/.cui/` to `~/.config/ohmyc/`, with one-shot automatic migration of existing data on CLI startup.

**Architecture:** Three runtime modules (`config-locator`, `logger`, `timeline/db`) plus two plugin entry points (`hooks/ingest.sh`, `opencode.ts`) each read `OHMYC_HOME` directly. A new `migrate-home.ts` module runs once at CLI launch — if `OHMYC_HOME` is unset, `~/.config/ohmyc/` is missing, and `~/.cui/` exists, it `fs.renameSync`s the legacy directory. The `ingest.sh` hook keeps a path-existence fallback to `~/.cui` for the window between data being written by the old hook and the user next launching the CLI; no other component honors the legacy name.

**Tech Stack:** Node.js (`node:fs`, `node:os`, `node:path`), TypeScript, Vitest, Bash, jq, better-sqlite3, Pino.

**Spec:** `docs/superpowers/specs/2026-05-08-ohmyc-home-rename-design.md`

---

## File Structure

**Modify:**
- `packages/cli/src/server/services/config-locator.ts` — read `OHMYC_HOME`, default to `~/.config/ohmyc`, drop `WRITE_DIR_NAME` constant.
- `packages/cli/src/logger.ts` — read `OHMYC_HOME`, default log dir to `~/.config/ohmyc/logs`.
- `packages/cli/src/launcher.ts` — call new migration helper before `startServer`.
- `packages/timeline/src/db.ts` — read `OHMYC_HOME`, default to `~/.config/ohmyc/timeline.db`.
- `plugins/timeline/hooks/ingest.sh` — read `OHMYC_HOME` with `~/.cui` legacy-path fallback.
- `plugins/timeline/opencode.ts` — read `OHMYC_HOME`, default `~/.config/ohmyc`.
- `packages/cli/src/server/routes/store.ts` — update doc comment only.
- `packages/cli/README.md` — env var table + directory layout block.
- `plugins/timeline/README.md` — replace path mentions.
- `docs/USER_GUIDE.md` — replace path/env mentions.
- `docs/DEVELOPER_GUIDE.md` — replace path/env mentions.
- `packages/cli/tests/server/services/config-locator.test.ts` — rewrite for new env/path.
- `packages/cli/tests/server/routes/timeline.test.ts` — switch env var.
- `packages/timeline/tests/db.test.ts` — switch env var.
- `plugins/timeline/tests/ingest.sh.test.ts` — switch env var; add fallback test.

**Create:**
- `packages/cli/src/migrate-home.ts` — one-shot migration helper.
- `packages/cli/tests/migrate-home.test.ts` — tests for the helper.
- `.changeset/ohmyc-home-rename.md` — user-facing changeset entry.

---

## Task 1: Rename env var + default path in `ConfigLocator`

**Files:**
- Modify: `packages/cli/src/server/services/config-locator.ts:5-30`
- Modify: `packages/cli/src/server/routes/store.ts:26`
- Test: `packages/cli/tests/server/services/config-locator.test.ts`

- [ ] **Step 1: Rewrite `config-locator.test.ts` to assert the new env/path**

Replace the file contents with:

```ts
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
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

import {
  AGENT_DIR_NAME,
  ConfigLocator,
} from '@/server/services/config-locator'

describe('ConfigLocator', () => {
  let tmpDir: string
  let savedAgentHome: string | undefined
  let savedOhmycHome: string | undefined

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'config-locator-test-'))
    savedAgentHome = process.env.AGENT_HOME
    savedOhmycHome = process.env.OHMYC_HOME
    delete process.env.AGENT_HOME
    delete process.env.OHMYC_HOME
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    if (savedAgentHome === undefined) delete process.env.AGENT_HOME
    else process.env.AGENT_HOME = savedAgentHome
    if (savedOhmycHome === undefined) delete process.env.OHMYC_HOME
    else process.env.OHMYC_HOME = savedOhmycHome
  })

  describe('constants', () => {
    it('AGENT_DIR_NAME equals .claude', () => {
      expect(AGENT_DIR_NAME).toBe('.claude')
    })
  })

  describe('project discovery', () => {
    it('discovers .claude/ when present in cwd', () => {
      mkdirSync(path.join(tmpDir, '.claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(true)
      expect(locator.projectPath).toBe(path.join(tmpDir, '.claude'))
    })

    it('returns null projectPath when .claude/ is absent', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(false)
      expect(locator.projectPath).toBeNull()
    })

    it('project discovery uses AGENT_HOME override dir when set', () => {
      process.env.AGENT_HOME = '.custom-claude'
      mkdirSync(path.join(tmpDir, '.custom-claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(true)
      expect(locator.projectPath).toBe(path.join(tmpDir, '.custom-claude'))
    })
  })

  describe('write path defaults to ~/.config/ohmyc/', () => {
    const expectedBase = path.join(os.homedir(), '.config', 'ohmyc')

    it('baseDir resolves to ~/.config/ohmyc/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(expectedBase)
    })

    it('agentsDir resolves to ~/.config/ohmyc/agents/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.agentsDir).toBe(path.join(expectedBase, 'agents'))
    })

    it('skillsDir resolves to ~/.config/ohmyc/skills/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.skillsDir).toBe(path.join(expectedBase, 'skills'))
    })

    it('commandsDir resolves to ~/.config/ohmyc/commands/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.commandsDir).toBe(path.join(expectedBase, 'commands'))
    })

    it('settingsPath resolves to ~/.config/ohmyc/settings.json', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.settingsPath).toBe(path.join(expectedBase, 'settings.json'))
    })

    it('pluginsDir resolves to ~/.claude/plugins/ (unchanged) per D-03', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'))
    })

    it('readBaseDir equals writeBaseDir per D-04', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.readBaseDir).toBe(locator.baseDir)
    })
  })

  describe('OHMYC_HOME env var override', () => {
    it('OHMYC_HOME (absolute) overrides writeBaseDir', () => {
      const custom = path.join(tmpDir, 'custom-home')
      process.env.OHMYC_HOME = custom
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(custom)
      expect(locator.agentsDir).toBe(path.join(custom, 'agents'))
      expect(locator.settingsPath).toBe(path.join(custom, 'settings.json'))
    })

    it('OHMYC_HOME does not affect claudeCodeDir (plugins still from ~/.claude/)', () => {
      process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'))
    })

    it('OHMYC_HOME and AGENT_HOME can be set independently', () => {
      process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
      process.env.AGENT_HOME = '.custom-claude'
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(path.join(tmpDir, 'custom-home'))
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.custom-claude', 'plugins'))
    })

    it('CUI_HOME is no longer read', () => {
      process.env.CUI_HOME = path.join(tmpDir, 'should-be-ignored')
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.config', 'ohmyc'))
      delete process.env.CUI_HOME
    })
  })

  describe('project subdirectories', () => {
    it('returns null for project subdirectories when no project', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.projectAgentsDir).toBeNull()
      expect(locator.projectSkillsDir).toBeNull()
      expect(locator.projectCommandsDir).toBeNull()
    })

    it('returns project subdirectories when project exists', () => {
      mkdirSync(path.join(tmpDir, '.claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.projectAgentsDir).toBe(path.join(tmpDir, '.claude', 'agents'))
      expect(locator.projectSkillsDir).toBe(path.join(tmpDir, '.claude', 'skills'))
      expect(locator.projectCommandsDir).toBe(path.join(tmpDir, '.claude', 'commands'))
    })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @ohmyc/cli test config-locator -- --run`
Expected: FAIL — tests reference `OHMYC_HOME` and `~/.config/ohmyc` but the source still uses `CUI_HOME` and `~/.cui`. The `WRITE_DIR_NAME` import was also removed; expect either a TS error or a runtime mismatch.

- [ ] **Step 3: Rewrite `ConfigLocator` to use `OHMYC_HOME` and `~/.config/ohmyc`**

Edit `packages/cli/src/server/services/config-locator.ts`:

Replace lines 5–9:
```ts
/** Centralized directory name — single definition point for all .claude references */
export const AGENT_DIR_NAME = '.claude'
```
(Remove the `WRITE_DIR_NAME` constant entirely.)

Replace the constructor body lines 24–42 with:
```ts
constructor(options?: { cwd?: string }) {
  const agentHome = process.env.AGENT_HOME

  // D-01: writeBaseDir defaults to ~/.config/ohmyc/, overridden by OHMYC_HOME (not AGENT_HOME).
  // OHMYC_HOME, when set, is treated as an absolute path.
  const ohmycHome = process.env.OHMYC_HOME
  this.writeBaseDir = ohmycHome
    ? ohmycHome
    : path.join(os.homedir(), '.config', 'ohmyc')

  // D-03: claudeCodeDir defaults to ~/.claude/ for plugin reads, overridden by AGENT_HOME
  const claudeDirName = agentHome || AGENT_DIR_NAME
  this.claudeCodeDir = path.join(os.homedir(), claudeDirName)

  // D-01: project discovery checks cwd/.claude/ only (or AGENT_HOME override dir)
  const cwd = options?.cwd ?? process.cwd()
  const projectDirName = agentHome || AGENT_DIR_NAME
  const candidateProject = path.join(cwd, projectDirName)
  this.projectDir = existsSync(candidateProject) ? candidateProject : null
}
```

Update the doc comments throughout the file:
- Line 13: `~/.cui/` → `~/.config/ohmyc/`
- Line 17: `Respects the CUI_HOME and AGENT_HOME` → `Respects the OHMYC_HOME and AGENT_HOME`
- Line 44 comment: `(~/.cui/)` → `(~/.config/ohmyc/)`
- Line 46 JSDoc: `(`~/.cui/agents/`)` → `(`~/.config/ohmyc/agents/`)`
- Line 51, 56, 61, 66 JSDocs: same pattern
- Line 99 comment: `(both ~/.cui/)` → `(both ~/.config/ohmyc/)`

- [ ] **Step 4: Update the `store.ts` doc comment**

Edit `packages/cli/src/server/routes/store.ts:26`:

```ts
  /** Root directory for OhMyC managed data (typically `~/.config/ohmyc/`). */
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm --filter @ohmyc/cli test config-locator -- --run`
Expected: PASS — all `ConfigLocator` tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/server/services/config-locator.ts \
        packages/cli/src/server/routes/store.ts \
        packages/cli/tests/server/services/config-locator.test.ts
git commit -m "refactor(cli): read OHMYC_HOME and default to ~/.config/ohmyc in ConfigLocator"
```

---

## Task 2: Switch logger output to `~/.config/ohmyc/logs`

**Files:**
- Modify: `packages/cli/src/logger.ts:1-14`

The logger currently writes to `~/.cui/logs`. It must agree with `ConfigLocator` (same `OHMYC_HOME` semantics) so a user with `OHMYC_HOME` set has all writes co-located.

- [ ] **Step 1: Read the current logger to confirm context**

Run: `cat packages/cli/src/logger.ts | head -20`
Expected: see `~/.cui/logs` hardcoded around lines 13–14.

- [ ] **Step 2: Update the logger to honor `OHMYC_HOME`**

Edit `packages/cli/src/logger.ts`. Replace the file header comment and the log directory resolution so it looks like:

```ts
// Pino logger setup — daily-rotated file logs under $OHMYC_HOME/logs (defaults to ~/.config/ohmyc/logs) with optional console output.
```

And replace the log dir computation (around lines 13–14) with:

```ts
const ohmycHome = process.env.OHMYC_HOME ?? path.join(homedir(), '.config', 'ohmyc')
const logBaseDir = process.env.NODE_ENV === 'test' || process.env.CI === 'true'
  ? path.join(ohmycHome, 'logs', `test-${process.pid}`)
  : path.join(ohmycHome, 'logs')
```

(If the existing variable is named `logDir` or similar, keep that name and only change the right-hand-side expression.)

- [ ] **Step 3: Run the CLI test suite to confirm nothing regresses**

Run: `pnpm --filter @ohmyc/cli test -- --run`
Expected: PASS — logger doesn't have a dedicated test file; the broader suite must stay green.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/logger.ts
git commit -m "refactor(cli): write logs under \$OHMYC_HOME/logs"
```

---

## Task 3: Switch `@ohmyc/timeline` DB default to `OHMYC_HOME`

**Files:**
- Modify: `packages/timeline/src/db.ts:18-26`
- Test: `packages/timeline/tests/db.test.ts:55-69`

- [ ] **Step 1: Update the failing test to use `OHMYC_HOME`**

Edit `packages/timeline/tests/db.test.ts`. Replace lines 55–69 with:

```ts
  it('getDefaultDbPath respects OHMYC_HOME', () => {
    const originalOhmycHome = process.env.OHMYC_HOME
    process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
    try {
      const dbPath = getDefaultDbPath()
      expect(dbPath).toContain('custom-home')
      expect(dbPath).toMatch(/timeline\.db$/)
    } finally {
      if (originalOhmycHome === undefined) {
        delete process.env.OHMYC_HOME
      } else {
        process.env.OHMYC_HOME = originalOhmycHome
      }
    }
  })

  it('getDefaultDbPath ignores CUI_HOME', () => {
    const originalCuiHome = process.env.CUI_HOME
    const originalOhmycHome = process.env.OHMYC_HOME
    delete process.env.OHMYC_HOME
    process.env.CUI_HOME = path.join(tmpDir, 'should-be-ignored')
    try {
      const dbPath = getDefaultDbPath()
      expect(dbPath).not.toContain('should-be-ignored')
      expect(dbPath).toContain(path.join('.config', 'ohmyc'))
    } finally {
      if (originalCuiHome === undefined) delete process.env.CUI_HOME
      else process.env.CUI_HOME = originalCuiHome
      if (originalOhmycHome === undefined) delete process.env.OHMYC_HOME
      else process.env.OHMYC_HOME = originalOhmycHome
    }
  })
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @ohmyc/timeline test db -- --run`
Expected: FAIL — `getDefaultDbPath` still reads `CUI_HOME`.

- [ ] **Step 3: Update `getDefaultDbPath`**

Edit `packages/timeline/src/db.ts`. Replace lines 18–26 with:

```ts
/**
 * Returns the default database path: `$OHMYC_HOME/timeline.db` (defaults to `~/.config/ohmyc/timeline.db`).
 *
 * @returns Absolute path to the database file.
 */
export function getDefaultDbPath(): string {
  const home = process.env.OHMYC_HOME ?? path.join(os.homedir(), '.config', 'ohmyc')
  return path.join(home, 'timeline.db')
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @ohmyc/timeline test db -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timeline/src/db.ts packages/timeline/tests/db.test.ts
git commit -m "refactor(timeline): default DB to ~/.config/ohmyc/timeline.db"
```

---

## Task 4: Update `timeline.test.ts` route fixture

**Files:**
- Modify: `packages/cli/tests/server/routes/timeline.test.ts:18-37`

- [ ] **Step 1: Switch the env var used by route tests**

Edit `packages/cli/tests/server/routes/timeline.test.ts`. Replace `originalCuiHome` / `process.env.CUI_HOME` references (lines 18, 23–24, 32–36) with `originalOhmycHome` / `process.env.OHMYC_HOME`. Final state for the relevant lines:

```ts
  let originalOhmycHome: string | undefined
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-route-test-'))
    originalOhmycHome = process.env.OHMYC_HOME
    process.env.OHMYC_HOME = tmpDir
    app = Fastify()
    await app.register(timelineRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    if (originalOhmycHome === undefined) {
      delete process.env.OHMYC_HOME
    } else {
      process.env.OHMYC_HOME = originalOhmycHome
    }
    rmSync(tmpDir, { recursive: true, force: true })
  })
```

- [ ] **Step 2: Run the test file**

Run: `pnpm --filter @ohmyc/cli test timeline -- --run`
Expected: PASS — these tests were green before because `CUI_HOME` worked; they must remain green now under `OHMYC_HOME` because `getDefaultDbPath` was updated in Task 3.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/tests/server/routes/timeline.test.ts
git commit -m "test(cli): switch timeline route tests to OHMYC_HOME"
```

---

## Task 5: Add the auto-migration helper

**Files:**
- Create: `packages/cli/src/migrate-home.ts`
- Create: `packages/cli/tests/migrate-home.test.ts`

The helper runs once at startup. It is a single function with no class state.

- [ ] **Step 1: Write failing tests for `migrateLegacyHome`**

Create `packages/cli/tests/migrate-home.test.ts` with:

```ts
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

import { migrateLegacyHome } from '@/migrate-home'

describe('migrateLegacyHome', () => {
  let tmpHome: string
  let savedOhmycHome: string | undefined

  beforeEach(() => {
    tmpHome = mkdtempSync(path.join(os.tmpdir(), 'migrate-home-test-'))
    savedOhmycHome = process.env.OHMYC_HOME
    delete process.env.OHMYC_HOME
  })

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true })
    if (savedOhmycHome === undefined) delete process.env.OHMYC_HOME
    else process.env.OHMYC_HOME = savedOhmycHome
  })

  it('moves ~/.cui to ~/.config/ohmyc when target is missing and source exists', () => {
    const legacy = path.join(tmpHome, '.cui')
    const target = path.join(tmpHome, '.config', 'ohmyc')
    mkdirSync(legacy, { recursive: true })
    writeFileSync(path.join(legacy, 'settings.json'), '{"ok":true}')

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('migrated')
    expect(existsSync(legacy)).toBe(false)
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(path.join(target, 'settings.json'), 'utf8')).toBe('{"ok":true}')
  })

  it('does nothing when target already exists', () => {
    const legacy = path.join(tmpHome, '.cui')
    const target = path.join(tmpHome, '.config', 'ohmyc')
    mkdirSync(legacy, { recursive: true })
    mkdirSync(target, { recursive: true })
    writeFileSync(path.join(legacy, 'legacy.txt'), 'legacy')
    writeFileSync(path.join(target, 'new.txt'), 'new')

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('skipped-target-exists')
    expect(existsSync(path.join(legacy, 'legacy.txt'))).toBe(true)
    expect(existsSync(path.join(target, 'new.txt'))).toBe(true)
  })

  it('does nothing when legacy ~/.cui does not exist', () => {
    const result = migrateLegacyHome({ home: tmpHome })
    expect(result).toBe('skipped-no-legacy')
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(false)
  })

  it('does nothing when OHMYC_HOME is set (user chose a custom location)', () => {
    process.env.OHMYC_HOME = path.join(tmpHome, 'custom')
    const legacy = path.join(tmpHome, '.cui')
    mkdirSync(legacy, { recursive: true })

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('skipped-env-set')
    expect(existsSync(legacy)).toBe(true)
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(false)
  })

  it('creates ~/.config parent directory if it does not exist', () => {
    const legacy = path.join(tmpHome, '.cui')
    mkdirSync(legacy, { recursive: true })
    expect(existsSync(path.join(tmpHome, '.config'))).toBe(false)

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('migrated')
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @ohmyc/cli test migrate-home -- --run`
Expected: FAIL — module does not exist (`Cannot find module '@/migrate-home'`).

- [ ] **Step 3: Implement the helper**

Create `packages/cli/src/migrate-home.ts`:

```ts
import {
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { logger } from './logger'

export type MigrationResult =
  | 'migrated'
  | 'skipped-env-set'
  | 'skipped-target-exists'
  | 'skipped-no-legacy'

export interface MigrateLegacyHomeOptions {
  /** Override the home directory. Defaults to `os.homedir()`. */
  home?: string
}

/**
 * One-shot migration from `~/.cui/` to `~/.config/ohmyc/`.
 *
 * Skipped if `OHMYC_HOME` is set (user chose a custom location), if the new
 * directory already exists, or if `~/.cui/` does not exist. On success, the
 * legacy directory is renamed atomically.
 *
 * Throws if the rename fails for any reason other than the skip conditions
 * above — callers are expected to surface the error and exit.
 */
export function migrateLegacyHome(options: MigrateLegacyHomeOptions = {}): MigrationResult {
  if (process.env.OHMYC_HOME) {
    return 'skipped-env-set'
  }

  const home = options.home ?? os.homedir()
  const target = path.join(home, '.config', 'ohmyc')
  const legacy = path.join(home, '.cui')

  if (existsSync(target)) {
    return 'skipped-target-exists'
  }
  if (!existsSync(legacy)) {
    return 'skipped-no-legacy'
  }

  mkdirSync(path.dirname(target), { recursive: true })
  renameSync(legacy, target)
  logger.info({ from: legacy, to: target }, 'Migrated legacy ~/.cui directory')
  return 'migrated'
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm --filter @ohmyc/cli test migrate-home -- --run`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/migrate-home.ts packages/cli/tests/migrate-home.test.ts
git commit -m "feat(cli): add one-shot migration helper for legacy ~/.cui directory"
```

---

## Task 6: Wire migration into `launchApp`

**Files:**
- Modify: `packages/cli/src/launcher.ts:20-35`

- [ ] **Step 1: Add the migration call before `startServer`**

Edit `packages/cli/src/launcher.ts`. Add an import near the existing imports:

```ts
import { migrateLegacyHome } from './migrate-home'
```

And call it at the very top of `launchApp` (before `serverOptions` is built):

```ts
export async function launchApp(options: LaunchOptions = {}): Promise<void> {
  try {
    migrateLegacyHome()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(
      { error: message },
      'Could not migrate ~/.cui to ~/.config/ohmyc automatically. Please move it manually and restart.',
    )
    throw new Error(`Migration failed: ${message}`)
  }

  const serverOptions: StartServerOptions = {
    defaultPort: options.defaultPort ?? 3000,
    apiOnly: options.apiOnly,
    cwd: options.cwd,
  }

  logger.info('Starting OhMyC server...')
  // ... rest unchanged
```

- [ ] **Step 2: Run the full CLI test suite**

Run: `pnpm --filter @ohmyc/cli test -- --run`
Expected: PASS — no existing test should break, and the new migration helper still passes.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/launcher.ts
git commit -m "feat(cli): run legacy home migration on launch"
```

---

## Task 7: Update `ingest.sh` hook with fallback chain

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh:3,17-18`
- Modify: `plugins/timeline/tests/ingest.sh.test.ts:85-91`

The hook fires from Claude Code's hook system; it must read from `~/.cui/` until the CLI migrates, but it must NOT honor `CUI_HOME`.

- [ ] **Step 1: Update the test fixture to use `OHMYC_HOME` and add a fallback test**

Edit `plugins/timeline/tests/ingest.sh.test.ts`. Replace the env block at lines 85–91 with:

```ts
    const env = {
      ...process.env,
      PATH: `${tmpDir}:${process.env.PATH}`,
      AGENT_HOME: path.join(tmpDir, '.claude'),
      OHMYC_HOME: path.join(tmpDir, '.ohmyc-data'),
      ...opts?.env,
    }
```

Then append a new `describe` block at the end of the file (before the final closing `})` of the outer `describe`):

```ts
  // ---------------------------------------------------------------------------
  // OHMYC_HOME / legacy ~/.cui fallback
  // ---------------------------------------------------------------------------

  describe('home directory resolution', () => {
    it('uses ~/.cui as fallback when OHMYC_HOME unset and ~/.config/ohmyc missing', () => {
      writeTranscript(fakeClaudeDir, 'test-legacy-home', FIXTURES.minimal)
      const legacyHome = path.join(tmpDir, '.cui')
      mkdirSync(legacyHome, { recursive: true })

      const capturePath = path.join(tmpDir, 'captured-path.txt')
      const cli = path.join(tmpDir, 'ohmyc')
      writeFileSync(
        cli,
        `#!/bin/bash\necho "OHMYC_DIR=$OHMYC_DIR" > "${capturePath}"\nif [ "$1" = "dashboard" ] && [ "$2" = "--ingest-raw" ]; then cat > /dev/null; fi\n`,
      )
      chmodSync(cli, 0o755)

      const result = spawnSync('bash', [INGEST_SH, 'test-legacy-home'], {
        env: {
          ...process.env,
          PATH: `${tmpDir}:${process.env.PATH}`,
          AGENT_HOME: path.join(tmpDir, '.claude'),
          HOME: tmpDir,
          OHMYC_HOME: '',
        },
        encoding: 'utf8',
      })

      expect(result.status).toBe(0)
      const captured = readFileSync(capturePath, 'utf8')
      expect(captured).toContain(legacyHome)
    })
  })
```

(The test relies on `ingest.sh` exporting `OHMYC_DIR` to the CLI subprocess so the fake CLI can echo it back. We add that export in the next step.)

- [ ] **Step 2: Run tests to confirm the new test fails**

Run: `pnpm --filter @ohmyc/timeline-plugin test ingest.sh -- --run`
(If the plugin package does not have its own filter, run from the repo root: `pnpm vitest run plugins/timeline/tests/ingest.sh.test.ts`.)
Expected: FAIL — old `CUI_HOME` env in test was renamed; hook still reads `CUI_HOME`.

- [ ] **Step 3: Rewrite the configuration block in `ingest.sh`**

Edit `plugins/timeline/hooks/ingest.sh`. Replace line 3 (the file header comment about `~/.cui/timeline.db`) with:

```sh
# Extracts session data from transcript and ingests into $OHMYC_HOME/timeline.db (defaults to ~/.config/ohmyc/timeline.db)
```

Replace lines 17–18 with:

```sh
if [ -n "${OHMYC_HOME:-}" ]; then
  OHMYC_DIR="$OHMYC_HOME"
elif [ -d "$HOME/.config/ohmyc" ]; then
  OHMYC_DIR="$HOME/.config/ohmyc"
elif [ -d "$HOME/.cui" ]; then
  OHMYC_DIR="$HOME/.cui"
else
  OHMYC_DIR="$HOME/.config/ohmyc"
fi
export OHMYC_DIR
DB_PATH="$OHMYC_DIR/timeline.db"
```

- [ ] **Step 4: Run hook tests and verify pass**

Run: `pnpm vitest run plugins/timeline/tests/ingest.sh.test.ts`
Expected: PASS — all existing tests + the new fallback test green.

- [ ] **Step 5: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh plugins/timeline/tests/ingest.sh.test.ts
git commit -m "refactor(timeline-plugin): hook reads OHMYC_HOME with ~/.cui fallback"
```

---

## Task 8: Update `opencode.ts` plugin entry

**Files:**
- Modify: `plugins/timeline/opencode.ts:3,30`

- [ ] **Step 1: Read the current code**

Run: `grep -n "CUI_HOME\|\.cui" plugins/timeline/opencode.ts`
Expected: matches at lines 3 and 30 (file header comment and env var read).

- [ ] **Step 2: Update the file**

Edit `plugins/timeline/opencode.ts:3`:
```ts
// SQLite database at ~/.config/ohmyc/timeline.db.
```

Edit line 30:
```ts
  const home = process.env.OHMYC_HOME ?? path.join(os.homedir(), '.config', 'ohmyc')
```

- [ ] **Step 3: Run any existing tests for the plugin**

Run: `pnpm vitest run plugins/timeline/tests`
Expected: PASS — existing OpenCode tests (if any cover this path) still green.

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/opencode.ts
git commit -m "refactor(timeline-plugin): opencode entry reads OHMYC_HOME"
```

---

## Task 9: Update documentation

**Files:**
- Modify: `packages/cli/README.md` (env var table at ~line 130, directory layout block at ~line 138)
- Modify: `plugins/timeline/README.md:25,29`
- Modify: `docs/USER_GUIDE.md`
- Modify: `docs/DEVELOPER_GUIDE.md`

- [ ] **Step 1: Update `packages/cli/README.md` env var table**

In the configuration table (currently lines 129–134), replace the `CUI_HOME` row with:

```md
| `OHMYC_HOME` | `string` | `~/.config/ohmyc` | `OHMYC_HOME=/path/to/dir` | Absolute path to the managed-data directory |
```

(Drop the previous `.cui` short-form default — `OHMYC_HOME` is now an absolute path, not a name under `$HOME`.)

- [ ] **Step 2: Update the directory layout block in `packages/cli/README.md`**

Replace the `~/.cui/` block (lines 139–146) with:

```md
~/.config/ohmyc/                 # managed data (OHMYC_HOME)
├── agents/                      # user-managed agent definitions
├── skills/                      # user-managed skill definitions
├── commands/                    # user-managed command definitions
├── profiles/<name>/profile.json
├── store/                       # agents, skills, commands, model-configs
├── settings.json
├── timeline.db                  # session timeline database
└── logs/                        # daily-rotated pino logs
```

- [ ] **Step 3: Update `plugins/timeline/README.md`**

Replace `~/.cui/timeline.db` with `~/.config/ohmyc/timeline.db` on lines 25 and 29 (use Edit tool with `replace_all: true` if straightforward).

- [ ] **Step 4: Update `docs/USER_GUIDE.md` and `docs/DEVELOPER_GUIDE.md`**

For each file:
- Find `CUI_HOME` references with `grep -n "CUI_HOME" docs/USER_GUIDE.md docs/DEVELOPER_GUIDE.md`.
- Replace `CUI_HOME` → `OHMYC_HOME`.
- Replace `~/.cui` → `~/.config/ohmyc`.
- Where docs describe the default value as `.cui` (a short directory name), reword to `~/.config/ohmyc` (an absolute path) to match the new semantics.

If you find references that describe migration behavior, mention the auto-migration: "On first launch, the CLI moves an existing `~/.cui/` directory to `~/.config/ohmyc/` automatically."

- [ ] **Step 5: Verify no stale references remain in non-historical files**

Run:
```bash
grep -rn "CUI_HOME\|~/\.cui\|/\.cui/" packages plugins docs \
  --exclude-dir=node_modules --exclude-dir=dist \
  | grep -v "docs/superpowers/specs\|docs/superpowers/plans\|docs/superpowers/debug\|\.changeset/"
```
Expected: only the legacy `~/.cui` paths inside `migrate-home.ts`, `ingest.sh` (fallback branch), and tests asserting the migration. No `CUI_HOME` references anywhere outside historical docs.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/README.md plugins/timeline/README.md docs/USER_GUIDE.md docs/DEVELOPER_GUIDE.md
git commit -m "docs: update env var and directory paths to OHMYC_HOME / ~/.config/ohmyc"
```

---

## Task 10: Add changeset

**Files:**
- Create: `.changeset/ohmyc-home-rename.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/ohmyc-home-rename.md`:

```md
---
"@ohmyc/cli": minor
"@ohmyc/timeline": minor
---

Rename `CUI_HOME` to `OHMYC_HOME` and move the default managed-data directory from `~/.cui/` to `~/.config/ohmyc/`.

- New env var: `OHMYC_HOME` (absolute path). The old `CUI_HOME` is no longer read by the CLI or `@ohmyc/timeline`.
- New default directory: `~/.config/ohmyc/`. Profiles, store, settings, timeline DB, and logs all live here.
- Existing users: on first launch of the new CLI, `~/.cui/` is automatically renamed to `~/.config/ohmyc/`. No manual action needed unless `~/.config/ohmyc/` already exists, in which case the CLI leaves both alone — move data manually if desired.
- The `timeline` plugin hook keeps reading from `~/.cui/` as a final fallback (only when `OHMYC_HOME` is unset and neither `~/.config/ohmyc/` nor `~/.cui/` was migrated yet).
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/ohmyc-home-rename.md
git commit -m "chore: add changeset for OHMYC_HOME rename"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the full repo test suite**

Run: `pnpm test`
Expected: PASS — all tests across `@ohmyc/cli`, `@ohmyc/timeline`, and `plugins/timeline` green.

- [ ] **Step 2: Type-check / lint the changed packages**

Run: `pnpm --filter @ohmyc/cli build && pnpm --filter @ohmyc/timeline build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Smoke-test the migration manually**

In a scratch shell with a writable temp HOME:
```bash
TMP_HOME=$(mktemp -d)
mkdir -p "$TMP_HOME/.cui/store"
echo '{"marker":true}' > "$TMP_HOME/.cui/settings.json"
HOME="$TMP_HOME" node packages/cli/dist/index.mjs start --api-only --port 0 &
PID=$!
sleep 2
ls "$TMP_HOME/.config/ohmyc/" && cat "$TMP_HOME/.config/ohmyc/settings.json"
kill $PID 2>/dev/null
rm -rf "$TMP_HOME"
```
Expected: `~/.config/ohmyc/` exists, contains `settings.json` with `{"marker":true}`, and `~/.cui/` is gone.

- [ ] **Step 4: Final commit (if smoke-test required any fixes)**

If the smoke test surfaced anything, fix it in a focused follow-up commit. Otherwise, the branch is ready for review.

---

## Self-Review Notes

- **Spec coverage:** All five runtime call sites in the (amended) spec have a dedicated task: ConfigLocator (Task 1), logger (Task 2), timeline DB (Task 3), `ingest.sh` (Task 7), `opencode.ts` (Task 8). Migration helper covered in Tasks 5–6. Docs in Task 9. Changeset in Task 10. Verification in Task 11.
- **No legacy CUI_HOME compat:** Tasks 1, 3, and 7 explicitly assert `CUI_HOME` is ignored.
- **Hook fallback to `~/.cui`:** Task 7's new test asserts this behavior end-to-end.
- **Type / name consistency:** `OHMYC_HOME` is treated everywhere as an absolute path. `migrateLegacyHome` returns a discriminated union of literal strings, used identically across helper, tests, and launcher (launcher only checks for thrown errors, not the return value).
