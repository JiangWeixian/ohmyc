# Timeline Plugin Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the monorepo-owned `plugins/timeline` source while keeping `ohmyc dashboard --install` as a local install path backed by the published `@ohmyc/timeline-plugin` package.

**Architecture:** `@ohmyc/cli` depends on `@ohmyc/timeline-plugin`, copies that dependency's package contents into `packages/cli/dist/plugins/timeline` during build, and resolves that local copy at install time. Development fallback resolves the installed dependency package root, not the deleted monorepo source tree.

**Tech Stack:** TypeScript, pnpm workspaces, tsup, Vitest, Node 22 ESM, GitHub Actions, Changesets.

---

## File Structure

- `packages/cli/src/commands/dashboard.ts` — owns dashboard install/sync/doctor behavior and plugin source resolution.
- `packages/cli/tests/dashboard.test.ts` — new CLI unit tests for plugin source resolution and install record behavior.
- `packages/cli/tests/build-assets.test.ts` — new test for the CLI build artifact copy contract.
- `packages/cli/tsup.config.ts` — copies plugin package runtime files into the CLI dist folder after build.
- `packages/cli/package.json` — adds the runtime dependency on `@ohmyc/timeline-plugin`.
- `packages/cli/README.md` — updates docs away from the removed `plugins/timeline` source path.
- `packages/cli/src/index.ts` — updates stale source-path comment.
- `pnpm-workspace.yaml` — removes `plugins/timeline` workspace.
- `pnpm-lock.yaml` — updates after dependency/workspace changes.
- `.github/workflows/ci.yml` — removes the plugin coverage job that points at deleted `plugins/timeline`.
- `.agents/plugins/marketplace.json` — remove this monorepo-local marketplace file because it points at deleted source.
- `.opencode/plugins/timeline.ts` and `opencode.json` — remove the broken OpenCode symlink/config reference.
- `.changeset/fix-plugin-manifest.md`, `.changeset/timeline-initial-release.md`, `.changeset/rename-cli-bin.md` — remove `@ohmyc/timeline-plugin` release entries now owned by `ohmyc-plugins`.
- `plugins/timeline/` — delete the monorepo-owned plugin source tree.

---

### Task 1: Add Failing CLI Tests for Dependency-Based Plugin Resolution

**Files:**
- Modify: `packages/cli/src/commands/dashboard.ts`
- Create: `packages/cli/tests/dashboard.test.ts`

- [ ] **Step 1: Export injectable helpers before changing behavior**

In `packages/cli/src/commands/dashboard.ts`, keep current behavior but export these existing helpers so tests can target them:

```ts
export function getPluginsDir(): string {
  const base = process.env.AGENT_HOME ?? path.join(process.env.HOME ?? '~', '.claude')
  return path.join(base, 'plugins')
}

export function getPluginSourceDir(): string {
  // In development: resolve from src/commands/dashboard.ts -> ../../plugins/timeline
  // In production (bundled): resolve from dist/index.mjs -> ./plugins/timeline
  const srcPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', 'plugins', 'timeline')
  const distPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'plugins', 'timeline')

  if (existsSync(distPath)) {
    return distPath
  }
  return srcPath
}
```

- [ ] **Step 2: Write failing tests for the desired resolver contract**

Create `packages/cli/tests/dashboard.test.ts`:

```ts
import {
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
  vi,
} from 'vitest'

import {
  getInstalledPluginsPath,
  getPluginSourceDir,
  readInstalledPlugins,
  runInstall,
  writeInstalledPlugins,
} from '../src/commands/dashboard'

vi.mock('@ohmyc/timeline', () => ({
  backfillAll: vi.fn(() => ({ indexed: 0, skipped: 0, errors: 0 })),
  closeDatabase: vi.fn(),
  getStatus: vi.fn(() => ({ lastSyncAt: 1, sessionCount: 7 })),
  openDatabase: vi.fn(() => ({ prepare: vi.fn() })),
}))

vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const originalAgentHome = process.env.AGENT_HOME

describe('dashboard plugin registry helpers', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ohmyc-cli-dashboard-'))
    process.env.AGENT_HOME = path.join(tmpDir, '.claude')
  })

  afterEach(() => {
    process.env.AGENT_HOME = originalAgentHome
    rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('reads an empty installed plugin registry when the file is absent', () => {
    expect(getInstalledPluginsPath()).toBe(path.join(tmpDir, '.claude', 'plugins', 'installed_plugins.json'))
    expect(readInstalledPlugins()).toEqual({ version: 1, plugins: {} })
  })

  it('writes the installed plugin registry under AGENT_HOME', () => {
    writeInstalledPlugins({
      version: 1,
      plugins: {
        'ohmyc-timeline': [{
          version: '1.0.0',
          installedAt: '2026-06-15T00:00:00.000Z',
          lastUpdated: '2026-06-15T00:00:00.000Z',
          installPath: '/tmp/plugin',
          isLocal: true,
          scope: 'user',
        }],
      },
    })

    const raw = readFileSync(getInstalledPluginsPath(), 'utf8')
    expect(JSON.parse(raw).plugins['ohmyc-timeline'][0].installPath).toBe('/tmp/plugin')
  })

  it('does not resolve the removed monorepo plugins/timeline source path', () => {
    const resolved = getPluginSourceDir()

    expect(resolved).not.toContain(`${path.sep}plugins${path.sep}timeline`)
    expect(resolved).toContain(`${path.sep}node_modules${path.sep}@ohmyc${path.sep}timeline-plugin`)
  })

  it('registers the resolved local plugin package path during install', async () => {
    mkdirSync(path.dirname(getInstalledPluginsPath()), { recursive: true })
    writeFileSync(getInstalledPluginsPath(), JSON.stringify({ version: 1, plugins: {} }), 'utf8')

    await runInstall()

    const registry = JSON.parse(readFileSync(getInstalledPluginsPath(), 'utf8'))
    const install = registry.plugins['ohmyc-timeline'][0]
    expect(install.installPath).toBe(getPluginSourceDir())
    expect(install.isLocal).toBe(true)
    expect(install.scope).toBe('user')
  })
})
```

- [ ] **Step 3: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @ohmyc/cli test -- dashboard.test.ts
```

Expected: FAIL on `does not resolve the removed monorepo plugins/timeline source path` because `getPluginSourceDir()` still returns the monorepo `plugins/timeline` path.

- [ ] **Step 4: Commit the failing test**

```bash
git add packages/cli/src/commands/dashboard.ts packages/cli/tests/dashboard.test.ts
git commit -m "test(cli): cover timeline plugin package resolution"
```

---

### Task 2: Resolve `@ohmyc/timeline-plugin` from CLI Runtime

**Files:**
- Modify: `packages/cli/src/commands/dashboard.ts`
- Modify: `packages/cli/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the package dependency**

In `packages/cli/package.json`, add `@ohmyc/timeline-plugin` to dependencies:

```json
"dependencies": {
  "@ohmyc/shared": "workspace:*",
  "@ohmyc/timeline": "workspace:*",
  "@ohmyc/timeline-plugin": "^1.0.5",
  "cac": "^6.7.14",
  "pino": "^10.3.1",
  "pino-roll": "^4.0.0"
}
```

- [ ] **Step 2: Install to update the lockfile**

Run:

```bash
pnpm install --frozen-lockfile=false
```

Expected: `pnpm-lock.yaml` updates and `packages/cli/node_modules/@ohmyc/timeline-plugin` resolves.

- [ ] **Step 3: Implement dependency package root resolution**

Replace the helper section in `packages/cli/src/commands/dashboard.ts` with:

```ts
const TIMELINE_PLUGIN_PACKAGE = '@ohmyc/timeline-plugin'

function getCurrentDir(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

function findPackageRoot(resolvedEntry: string): string {
  let current = path.dirname(resolvedEntry)
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current
    }
    current = path.dirname(current)
  }
  throw new Error(`Could not find package root for ${resolvedEntry}`)
}

export function getPluginsDir(): string {
  const base = process.env.AGENT_HOME ?? path.join(process.env.HOME ?? '~', '.claude')
  return path.join(base, 'plugins')
}

export function getInstalledPluginsPath(): string {
  return path.join(getPluginsDir(), 'installed_plugins.json')
}

export function readInstalledPlugins(): { version?: number; plugins: Record<string, PluginInstall[]> } {
  try {
    const raw = readFileSync(getInstalledPluginsPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { version: 1, plugins: {} }
  }
}

export function writeInstalledPlugins(data: { version?: number; plugins: Record<string, PluginInstall[]> }): void {
  const pluginsDir = getPluginsDir()
  mkdirSync(pluginsDir, { recursive: true })
  writeFileSync(getInstalledPluginsPath(), JSON.stringify(data, null, 2), 'utf8')
}

export function hasJq(): boolean {
  try {
    execSync('jq --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function getBundledPluginDir(): string {
  return path.resolve(getCurrentDir(), '..', 'plugins', 'timeline')
}

export function getTimelinePluginPackageDir(): string {
  const entryUrl = import.meta.resolve(TIMELINE_PLUGIN_PACKAGE)
  return findPackageRoot(fileURLToPath(entryUrl))
}

export function getPluginSourceDir(): string {
  const bundledPath = getBundledPluginDir()
  if (existsSync(bundledPath)) {
    return bundledPath
  }

  try {
    const packagePath = getTimelinePluginPackageDir()
    if (existsSync(packagePath)) {
      return packagePath
    }
  } catch {
    // Convert module-resolution failures into the explicit install error below.
  }

  throw new Error(`Timeline plugin package not found. Reinstall or rebuild @ohmyc/cli so ${TIMELINE_PLUGIN_PACKAGE} is available.`)
}
```

Keep the existing `formatDate`, `runInstall`, `runUninstall`, `runSync`, and `runDoctor` bodies unchanged.

- [ ] **Step 4: Run the focused CLI test**

Run:

```bash
pnpm --filter @ohmyc/cli test -- dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run CLI TypeScript checks via tests**

Run:

```bash
pnpm --filter @ohmyc/cli test
```

Expected: PASS.

- [ ] **Step 6: Commit runtime dependency resolution**

```bash
git add packages/cli/package.json packages/cli/src/commands/dashboard.ts packages/cli/tests/dashboard.test.ts pnpm-lock.yaml
git commit -m "feat(cli): resolve timeline plugin from package dependency"
```

---

### Task 3: Copy Plugin Package Assets During CLI Build

**Files:**
- Modify: `packages/cli/tsup.config.ts`
- Create: `packages/cli/tests/build-assets.test.ts`

- [ ] **Step 1: Write the build artifact contract test**

Create `packages/cli/tests/build-assets.test.ts`:

```ts
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

describe('CLI timeline plugin build assets', () => {
  const pluginDist = path.resolve(import.meta.dirname, '../dist/plugins/timeline')

  afterEach(() => {
    rmSync(path.resolve(import.meta.dirname, '../dist'), { recursive: true, force: true })
  })

  it('copies package plugin manifests and runtime files into dist', async () => {
    await import('../tsup.config')

    expect(existsSync(path.join(pluginDist, '.agents/plugins/marketplace.json'))).toBe(true)
    expect(existsSync(path.join(pluginDist, '.claude-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(pluginDist, '.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(pluginDist, 'hooks/hooks.json'))).toBe(true)
    expect(existsSync(path.join(pluginDist, 'dist/ingest.mjs'))).toBe(true)
    expect(existsSync(path.join(pluginDist, 'package.json'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the build artifact test and verify it fails**

Run:

```bash
pnpm --filter @ohmyc/cli test -- build-assets.test.ts
```

Expected: FAIL because importing `tsup.config.ts` does not run `onSuccess`, and the config still references `../../plugins/timeline`.

- [ ] **Step 3: Refactor copy logic into exported helpers**

Replace `packages/cli/tsup.config.ts` with:

```ts
import {
  cpSync,
  existsSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsup'

const TIMELINE_PLUGIN_PACKAGE = '@ohmyc/timeline-plugin'

export const timelinePluginCopyPaths = [
  '.agents',
  '.claude-plugin',
  '.codex-plugin',
  'dist',
  'hooks',
  'package.json',
  'README.md',
]

function findPackageRoot(resolvedEntry: string): string {
  let current = path.dirname(resolvedEntry)
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current
    }
    current = path.dirname(current)
  }
  throw new Error(`Could not find package root for ${resolvedEntry}`)
}

export function resolveTimelinePluginPackageDir(): string {
  const entryUrl = import.meta.resolve(TIMELINE_PLUGIN_PACKAGE)
  return findPackageRoot(fileURLToPath(entryUrl))
}

export function copyTimelinePluginAssets(options: {
  packageDir?: string
  outputDir?: string
} = {}): string {
  const pluginSource = options.packageDir ?? resolveTimelinePluginPackageDir()
  const pluginDist = options.outputDir ?? path.resolve(import.meta.dirname, 'dist/plugins/timeline')

  if (!existsSync(pluginSource)) {
    throw new Error(`Cannot copy timeline plugin assets: ${TIMELINE_PLUGIN_PACKAGE} package root was not found at ${pluginSource}`)
  }

  cpSync(pluginSource, pluginDist, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(pluginSource, source)
      if (relative === '') {
        return true
      }
      return timelinePluginCopyPaths.some(allowed =>
        relative === allowed || relative.startsWith(`${allowed}${path.sep}`),
      )
    },
  })

  return pluginDist
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: false,
  clean: true,
  bundle: true,
  platform: 'node',
  target: 'node22',
  outExtension: () => ({ js: '.mjs' }),
  external: ['node:sqlite'],
  noExternal: [
    /@[\w-]+\/[\w-]+/,
    'cac',
  ],
  onSuccess: async () => {
    const pluginDist = copyTimelinePluginAssets()
    console.log(`Copied ${TIMELINE_PLUGIN_PACKAGE} assets to ${pluginDist}`)
  },
})
```

- [ ] **Step 4: Update the build artifact test to call the helper directly**

Replace `packages/cli/tests/build-assets.test.ts` with:

```ts
import {
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  copyTimelinePluginAssets,
  resolveTimelinePluginPackageDir,
  timelinePluginCopyPaths,
} from '../tsup.config'

describe('CLI timeline plugin build assets', () => {
  let tmpDir: string | undefined

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('copies package plugin manifests and runtime files into dist', () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ohmyc-cli-assets-'))
    const outputDir = path.join(tmpDir, 'plugins', 'timeline')

    copyTimelinePluginAssets({ outputDir })

    expect(existsSync(path.join(outputDir, '.agents/plugins/marketplace.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, '.claude-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, '.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'hooks/hooks.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'dist/ingest.mjs'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'package.json'))).toBe(true)
  })

  it('does not copy the removed monorepo plugin source tree', () => {
    expect(resolveTimelinePluginPackageDir()).toContain(`${path.sep}node_modules${path.sep}@ohmyc${path.sep}timeline-plugin`)
    expect(timelinePluginCopyPaths).toEqual([
      '.agents',
      '.claude-plugin',
      '.codex-plugin',
      'dist',
      'hooks',
      'package.json',
      'README.md',
    ])
  })
})
```

- [ ] **Step 5: Run build asset tests**

Run:

```bash
pnpm --filter @ohmyc/cli test -- build-assets.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run an actual CLI build**

Run:

```bash
pnpm --filter @ohmyc/cli build
test -f packages/cli/dist/plugins/timeline/.agents/plugins/marketplace.json
test -f packages/cli/dist/plugins/timeline/.claude-plugin/plugin.json
test -f packages/cli/dist/plugins/timeline/.codex-plugin/plugin.json
test -f packages/cli/dist/plugins/timeline/hooks/hooks.json
test -f packages/cli/dist/plugins/timeline/dist/ingest.mjs
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit build asset copy**

```bash
git add packages/cli/tsup.config.ts packages/cli/tests/build-assets.test.ts
git commit -m "build(cli): bundle timeline plugin package assets"
```

---

### Task 4: Remove Monorepo Workspace Ownership

**Files:**
- Delete: `plugins/timeline/`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Remove the workspace entry**

Change `pnpm-workspace.yaml` to:

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: Delete the monorepo plugin source directory**

Run:

```bash
rm -rf plugins/timeline
```

Expected: `plugins/timeline` no longer exists.

- [ ] **Step 3: Update lockfile after workspace removal**

Run:

```bash
pnpm install --frozen-lockfile=false
```

Expected: `pnpm-lock.yaml` no longer has an importer section for `plugins/timeline`, and `packages/cli` has a normal dependency entry for `@ohmyc/timeline-plugin`.

- [ ] **Step 4: Assert workspace references are gone from live config**

Run:

```bash
rg -n "plugins/timeline" pnpm-workspace.yaml pnpm-lock.yaml packages/cli/src packages/cli/tsup.config.ts packages/cli/tests
```

Expected: no matches.

- [ ] **Step 5: Run CLI tests**

Run:

```bash
pnpm --filter @ohmyc/cli test
```

Expected: PASS.

- [ ] **Step 6: Commit workspace removal**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/cli/package.json
git add -u plugins/timeline
git commit -m "refactor: remove monorepo timeline plugin workspace"
```

---

### Task 5: Remove Broken Local Plugin References

**Files:**
- Delete: `.agents/plugins/marketplace.json`
- Delete: `.opencode/plugins/timeline.ts`
- Modify: `opencode.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/README.md`

- [ ] **Step 1: Delete repo-local plugin marketplace and symlink**

Run:

```bash
rm -f .agents/plugins/marketplace.json
rm -f .opencode/plugins/timeline.ts
```

Expected: both files are removed from the working tree.

- [ ] **Step 2: Remove the OpenCode plugin reference**

Replace `opencode.json` with:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

- [ ] **Step 3: Remove the deleted plugin coverage job**

In `.github/workflows/ci.yml`, delete this block:

```yaml
      - name: Report Coverage (timeline-plugin)
        if: always()
        uses: davelosert/vitest-coverage-report-action@v2
        with:
          name: timeline-plugin
          working-directory: plugins/timeline
```

- [ ] **Step 4: Update stale CLI source-path comments**

In `packages/cli/src/index.ts`, replace the header comment with:

```ts
#!/usr/bin/env node
// CLI entry point — install/uninstall/sync/doctor for the timeline plugin.
// Session ingest is handled by the bundled @ohmyc/timeline-plugin assets
// copied into the CLI dist directory at build time.
```

- [ ] **Step 5: Update CLI README wording**

In `packages/cli/README.md`, replace the line under the dashboard options table with:

```md
Per-session ingest is handled by the bundled `@ohmyc/timeline-plugin` assets copied into the CLI package at build time; the CLI registers that local plugin path during `ohmyc dashboard --install`.
```

- [ ] **Step 6: Verify no live config points at the removed source**

Run:

```bash
rg -n "plugins/timeline|timeline-plugin" .github pnpm-workspace.yaml package.json packages/cli .agents .opencode opencode.json README.md README.zh-CN.md
```

Expected: only acceptable matches are:

```text
packages/cli/package.json: dependency on @ohmyc/timeline-plugin
packages/cli/src/index.ts: comment mentioning @ohmyc/timeline-plugin
packages/cli/README.md: docs mentioning @ohmyc/timeline-plugin
packages/cli/tsup.config.ts: TIMELINE_PLUGIN_PACKAGE constant
packages/cli/tests/*.ts: tests mentioning @ohmyc/timeline-plugin
```

- [ ] **Step 7: Run CLI tests**

Run:

```bash
pnpm --filter @ohmyc/cli test
```

Expected: PASS.

- [ ] **Step 8: Commit local reference cleanup**

```bash
git add .github/workflows/ci.yml opencode.json packages/cli/src/index.ts packages/cli/README.md
git add -u .agents/plugins/marketplace.json .opencode/plugins/timeline.ts
git commit -m "chore: remove monorepo timeline plugin references"
```

---

### Task 6: Remove Extracted Package From Monorepo Release Changesets

**Files:**
- Modify or Delete: `.changeset/fix-plugin-manifest.md`
- Modify or Delete: `.changeset/timeline-initial-release.md`
- Modify or Delete: `.changeset/rename-cli-bin.md`

- [ ] **Step 1: Inspect changesets that target the extracted package**

Run:

```bash
for f in .changeset/*.md; do
  if rg -q '@ohmyc/timeline-plugin' "$f"; then
    printf '\n==== %s ====\n' "$f"
    sed -n '1,120p' "$f"
  fi
done
```

Expected: the three known files contain `@ohmyc/timeline-plugin`.

- [ ] **Step 2: Delete plugin-only changesets**

If `.changeset/fix-plugin-manifest.md`, `.changeset/timeline-initial-release.md`, or `.changeset/rename-cli-bin.md` only contain `@ohmyc/timeline-plugin`, delete them:

```bash
rm -f .changeset/fix-plugin-manifest.md
rm -f .changeset/timeline-initial-release.md
rm -f .changeset/rename-cli-bin.md
```

If any file also includes another monorepo package, remove only this frontmatter line:

```md
"@ohmyc/timeline-plugin": patch
```

and keep the rest of that changeset.

- [ ] **Step 3: Verify no monorepo changeset targets the extracted package**

Run:

```bash
rg -n '@ohmyc/timeline-plugin' .changeset
```

Expected: no matches.

- [ ] **Step 4: Run changeset status**

Run:

```bash
pnpm changeset status --since=HEAD~1
```

Expected: command exits 0. If it reports unrelated unpublished package changes, do not modify them in this task.

- [ ] **Step 5: Commit changeset cleanup**

```bash
git add -u .changeset
git commit -m "chore: stop releasing extracted timeline plugin"
```

---

### Task 7: Full Verification and Final Polish

**Files:**
- Modify only files needed to fix verification failures from previous tasks.

- [ ] **Step 1: Run the focused CLI test suite**

Run:

```bash
pnpm --filter @ohmyc/cli test
```

Expected: PASS.

- [ ] **Step 2: Run the CLI build and assert bundled plugin files**

Run:

```bash
pnpm --filter @ohmyc/cli build
test -f packages/cli/dist/plugins/timeline/.agents/plugins/marketplace.json
test -f packages/cli/dist/plugins/timeline/.claude-plugin/plugin.json
test -f packages/cli/dist/plugins/timeline/.codex-plugin/plugin.json
test -f packages/cli/dist/plugins/timeline/hooks/hooks.json
test -f packages/cli/dist/plugins/timeline/dist/ingest.mjs
```

Expected: all commands exit 0.

- [ ] **Step 3: Run package-level tests**

Run:

```bash
pnpm -r test
```

Expected: PASS for all remaining workspace packages.

- [ ] **Step 4: Run full build**

Run:

```bash
pnpm build
```

Expected: PASS. Build output includes `Copied @ohmyc/timeline-plugin assets to .../packages/cli/dist/plugins/timeline`.

- [ ] **Step 5: Verify no deleted source references remain in live config**

Run:

```bash
rg -n "plugins/timeline" .github pnpm-workspace.yaml package.json packages/cli .agents .opencode opencode.json README.md README.zh-CN.md
```

Expected: no matches.

- [ ] **Step 6: Verify extracted package references are limited to CLI dependency/docs/tests**

Run:

```bash
rg -n "@ohmyc/timeline-plugin" package.json packages/cli pnpm-lock.yaml .changeset .github
```

Expected:

- Matches in `packages/cli/package.json`.
- Matches in `packages/cli/tsup.config.ts`.
- Matches in `packages/cli/src/commands/dashboard.ts`.
- Matches in `packages/cli/tests/*.ts`.
- Matches in `packages/cli/README.md`.
- Matches in `pnpm-lock.yaml`.
- No matches in `.changeset`.

- [ ] **Step 7: Review git status for unrelated user changes**

Run:

```bash
git status --short
```

Expected: only files touched by this plan are modified. Existing unrelated desktop/Tauri icon changes may still appear; do not stage or revert them.

- [ ] **Step 8: Commit final fixes if any**

If Step 1-7 required additional edits:

```bash
git add packages/cli/src/commands/dashboard.ts packages/cli/tests/dashboard.test.ts packages/cli/tests/build-assets.test.ts packages/cli/tsup.config.ts packages/cli/package.json packages/cli/README.md packages/cli/src/index.ts pnpm-workspace.yaml pnpm-lock.yaml .github/workflows/ci.yml opencode.json
git add -u plugins/timeline .agents/plugins/marketplace.json .opencode/plugins/timeline.ts .changeset/fix-plugin-manifest.md .changeset/timeline-initial-release.md .changeset/rename-cli-bin.md
git commit -m "test: verify extracted timeline plugin packaging"
```

If no edits were needed, do not create an empty commit.

---

## Implementation Notes

- Do not run `git reset --hard` or checkout files to remove unrelated user changes.
- Do not stage existing desktop/Tauri changes unless the user explicitly asks.
- The independent `ohmyc-plugins` repo must publish `@ohmyc/timeline-plugin` with `.agents`, `.claude-plugin`, `.codex-plugin`, `dist`, and `hooks` in its package contents before this monorepo build can succeed on a clean machine.
- If `import.meta.resolve('@ohmyc/timeline-plugin/package.json')` fails in tests, first verify `pnpm install --frozen-lockfile=false` has linked the dependency.
