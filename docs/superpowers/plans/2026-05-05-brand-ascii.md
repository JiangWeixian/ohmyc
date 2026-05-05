# OhMyC Brand ASCII Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a slanted italic ASCII art banner of "OhMyC" at the top of every CLI command execution, with TTY-aware conditional display.

**Architecture:** A single `printBanner()` utility that checks `process.stdout.isTTY` before printing the ASCII wordmark and version tagline. Integrated into the CLI entrypoint via cac's global middleware so it runs before every command.

**Tech Stack:** TypeScript, cac (CLI framework), vitest (testing), Node.js `process.stdout.isTTY`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/cli/src/banner.ts` | Create | Banner string constant + `printBanner()` function with TTY detection |
| `packages/cli/tests/banner.test.ts` | Create | Unit tests for banner content, TTY conditional display, and version string |
| `packages/cli/src/index.ts` | Modify | Integrate `printBanner()` call before `cli.parse()` so it runs on every command |

---

## Prerequisites

Before starting, verify the dev environment is ready:

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
pnpm install
```

Expected: Dependencies install without errors.

---

### Task 1: Create Banner Utility Module

**Files:**
- Create: `packages/cli/src/banner.ts`
- Test: `packages/cli/tests/banner.test.ts`

**Context:** The banner needs to be a pure function that returns the ASCII string and a print function that checks TTY before outputting. This keeps the banner logic isolated from the CLI framework.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/tests/banner.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getBanner, printBanner } from '@/banner'

describe('banner', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  describe('getBanner', () => {
    it('returns the OhMyC ASCII wordmark', () => {
      const banner = getBanner()
      expect(banner).toContain('OhMyC')
      expect(banner).toContain('___')
      expect(banner).toContain('/ _ \\')
    })

    it('includes the version from package.json', () => {
      const banner = getBanner()
      expect(banner).toMatch(/v\d+\.\d+\.\d+/)
    })

    it('has exactly 7 lines (5 wordmark + 1 blank + 1 tagline)', () => {
      const banner = getBanner()
      const lines = banner.split('\n')
      expect(lines.length).toBe(7)
    })
  })

  describe('printBanner', () => {
    it('prints the banner when stdout is a TTY', () => {
      const originalIsTTY = process.stdout.isTTY
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

      printBanner()

      expect(logSpy).toHaveBeenCalledTimes(1)
      const printed = logSpy.mock.calls[0][0] as string
      expect(printed).toContain('OhMyC')

      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
    })

    it('does not print when stdout is not a TTY', () => {
      const originalIsTTY = process.stdout.isTTY
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

      printBanner()

      expect(logSpy).not.toHaveBeenCalled()

      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx vitest run tests/banner.test.ts
```

Expected: FAIL with "Cannot find module '@/banner'" or similar import error.

- [ ] **Step 3: Write minimal implementation**

Create `packages/cli/src/banner.ts`:

```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function getBanner(): string {
  // Read version from package.json
  const packagePath = resolve(__dirname, '../package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const version = packageJson.version

  return [
    '   ___   _   _   __  __     ____',
    '  / _ \\ | | | |  \\ \/ /    / ___|',
    ' | | | || |_| |   \\  /    | |    ',
    ' | |_| ||  _  |   /  \\    | |___ ',
    '  \\___/ |_| |_|  /_/\\_\\    \\____|',
    '',
    `OhMyC v${version} — CLI for managing .claude configs`,
  ].join('\n')
}

export function printBanner(): void {
  if (process.stdout.isTTY) {
    console.log(getBanner())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx vitest run tests/banner.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
git add packages/cli/src/banner.ts packages/cli/tests/banner.test.ts
git commit -m "feat(cli): add banner utility with TTY detection"
```

---

### Task 2: Integrate Banner into CLI Entrypoint

**Files:**
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/tests/banner.test.ts` (verify integration via existing test patterns)

**Context:** The banner must display before every command. The cleanest approach is to call `printBanner()` at the top of the entrypoint file, before `cli.parse()`. This ensures it runs for all commands: `cu start`, `cu dashboard`, bare `cu`, etc.

- [ ] **Step 1: Modify index.ts to import and call printBanner**

Edit `packages/cli/src/index.ts` — add import at the top and call before `cli.parse()`:

```typescript
#!/usr/bin/env node
import { cac } from 'cac'

import {
  runDoctor,
  runIngest,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
import { launchApp } from './launcher'
import { printBanner } from './banner'  // ADD THIS LINE

const cli = cac('cu')

// ... existing command definitions unchanged ...

cli.help()
cli.version('0.1.0')

printBanner()  // ADD THIS LINE — before cli.parse()
cli.parse()
```

**Important:** Place `printBanner()` AFTER all command definitions but BEFORE `cli.parse()`. This ensures the banner prints before any command action runs.

- [ ] **Step 2: Add integration test for index.ts banner behavior**

Add to `packages/cli/tests/banner.test.ts` (append to the end of the file, after the existing `describe('printBanner', ...)` block):

```typescript
describe('CLI integration', () => {
  it('prints banner on startup when TTY is available', async () => {
    const originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    // Clear module cache to re-run module-level code
    const modulePath = resolve(import.meta.dirname, '../src/index.ts')
    vi.resetModules()

    await import(modulePath)

    // Banner should have been printed
    expect(logSpy).toHaveBeenCalled()
    const calls = logSpy.mock.calls.map((args: any[]) => args.join(' '))
    const hasBanner = calls.some((msg: string) => msg.includes('OhMyC'))
    expect(hasBanner).toBe(true)

    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
  })
})
```

- [ ] **Step 3: Run tests to verify integration**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx vitest run tests/banner.test.ts
```

Expected: All tests PASS (5 total: 2 getBanner + 2 printBanner + 1 integration).

- [ ] **Step 4: Run full CLI test suite**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx vitest run
```

Expected: All tests PASS (banner tests + existing launcher-cli tests).

- [ ] **Step 5: Manual verification — run the CLI**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx tsx src/index.ts --help
```

Expected output (banner + help text):
```
   ___   _   _   __  __     ____
  / _ \ | | | |  \ \/ /    / ___|
 | | | || |_| |   \  /    | |
 | |_| ||  _  |   /  \    | |___
  \___/ |_| |_|  /_/\_\    \____|

OhMyC v0.1.0 — CLI for managing .claude configs

Usage:
  $ cu [...args]
  $ cu start
  $ cu dashboard

Commands:
  [...args]        Start OhMyC (default)
  start            Start the OhMyC server and open the browser
  dashboard        Manage Timeline dashboard data and plugin

For more info, run any command with the `--help` flag
  $ cu start --help
  $ cu dashboard --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

- [ ] **Step 6: Verify banner is suppressed when piped**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli
npx tsx src/index.ts --help | cat
```

Expected output: Help text WITHOUT the banner (because stdout is not a TTY when piped).

- [ ] **Step 7: Commit**

```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
git add packages/cli/src/index.ts packages/cli/tests/banner.test.ts
git commit -m "feat(cli): integrate banner into CLI entrypoint"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task | Status |
|------------------|------|--------|
| Slanted italic ASCII wordmark | Task 1, Step 3 | ✅ |
| Display on every CLI command | Task 2, Step 1 | ✅ |
| TTY detection (skip when piped) | Task 1, Step 3 | ✅ |
| Version from package.json | Task 1, Step 3 | ✅ |
| Standard ASCII only | Task 1, Step 3 | ✅ |
| No colors / no ANSI codes | Task 1, Step 3 | ✅ |
| Test coverage | Task 1 & 2 | ✅ |
| 7 lines total (5 + 1 blank + 1 tagline) | Task 1, Step 1 | ✅ |

### 2. Placeholder Scan

- No "TBD", "TODO", or "implement later" found
- No vague "add error handling" steps — error handling is explicit (TTY check)
- All test code is complete with assertions
- All implementation code is complete and copy-paste ready
- No references to undefined functions or types

### 3. Type Consistency

- `getBanner()` returns `string` — consistent across test and implementation
- `printBanner()` returns `void` — consistent across test and implementation
- `process.stdout.isTTY` is checked as boolean — correct

---

## Post-Implementation Checklist

After all tasks are complete:

- [ ] All tests pass: `npx vitest run`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Manual test: `npx tsx src/index.ts --help` shows banner
- [ ] Manual test: `npx tsx src/index.ts --help | cat` hides banner
- [ ] No lint errors: `npx eslint src/banner.ts tests/banner.test.ts src/index.ts`

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-brand-ascii.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?