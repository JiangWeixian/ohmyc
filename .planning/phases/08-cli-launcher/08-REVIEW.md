---
phase: 08-cli-launcher
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - packages/cli/package.json
  - packages/cli/src/__tests__/launcherCli.test.ts
  - packages/cli/src/index.ts
  - packages/cli/src/launcher.ts
  - packages/cli/src/server/__tests__/launcherServer.test.ts
  - packages/cli/src/server/index.ts
  - packages/cli/tsup.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed 7 files in the CLI launcher package covering the CLI entrypoint (`index.ts`), launcher orchestration (`launcher.ts`), HTTP server setup (`server/index.ts`), build config (`tsup.config.ts`), and two test files. The code is well-structured with clean separation between CLI parsing, launch orchestration, and server lifecycle. Tests have good coverage of the core flows.

Four warnings were identified: an unvalidated port parse, a silently-ignoring default command, an unrecoverable `process.exit` in library code, and a test mock that is not restored on failure. Three informational items cover hardcoded version, verbose production logging, and an unused import.

## Critical Issues

No critical issues found.

## Warnings

### WR-01: Unvalidated port parse produces silent NaN

**File:** `packages/cli/src/index.ts:11`
**Issue:** `parseInt(options.port, 10)` can return `NaN` when the user passes a non-numeric value like `cu start --port abc`. This `NaN` propagates into `launchApp({ defaultPort: NaN })`, then into `getPort({ port: [NaN, NaN + 1, ...] })` via `startServer`. The behavior of `get-port` with `NaN` inputs is undefined -- it may silently pick a random port or throw an opaque error.
**Fix:**
```typescript
const port = parseInt(options.port, 10);
if (isNaN(port) || port < 0 || port > 65535) {
  console.error(`Invalid port: ${options.port}. Must be a number between 0 and 65535.`);
  process.exit(1);
}
await launchApp({ defaultPort: port });
```

### WR-02: Default command silently ignores arguments

**File:** `packages/cli/src/index.ts:16-22`
**Issue:** The `[...args]` default command does nothing when `args.length > 0`. Running `cu --port 4000` or `cu some-unknown-command` produces zero output and exits with code 0. The user gets no feedback that their arguments were ignored. This is a usability bug.
**Fix:** Either delegate unrecognized args to the `start` command, or print a message like `"Unknown arguments: ${args.join(' ')}. Did you mean 'cu start'?"` and show help.

### WR-03: `process.exit(1)` in launcher prevents error handling and cleanup

**File:** `packages/cli/src/launcher.ts:43`
**Issue:** `process.exit(1)` is called inside `launchApp()` which is an exported library function. This prevents any caller from handling the error, prevents `finally` blocks from running, and forces the test suite to mock `process.exit` (line 124 of the test). The process exit should be the CLI entrypoint's responsibility, not the launcher's.
**Fix:** Throw the error from `launchApp` and let `index.ts` catch it:
```typescript
// launcher.ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(`Failed to start ClaudeUI: ${message}`);
}

// index.ts
try {
  await launchApp({ defaultPort: port });
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
```

### WR-04: `process.exit` mock not restored on test failure

**File:** `packages/cli/src/__tests__/launcherCli.test.ts:124-143`
**Issue:** The `exitSpy` is created and restored inline at lines 124 and 143, but this restoration only runs if the test reaches line 142. If an `expect` assertion fails before that line (or if an earlier `await` rejects), `exitSpy.mockRestore()` is never called. Since `process.exit` is a global side effect, subsequent tests could fail unpredictably. The spy restoration should use a `finally` block or be moved to `afterEach`.
**Fix:**
```typescript
it('prints actionable error and exits non-zero when startup throws', async () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  try {
    startServerMock.mockRejectedValue(new Error('Port 3000 is in use'));
    await launchApp({ defaultPort: 3000 });
    expect(openMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  } finally {
    exitSpy.mockRestore();
  }
});
```

## Info

### IN-01: Hardcoded version string

**File:** `packages/cli/src/index.ts:25`
**Issue:** `cli.version('0.1.0')` is hardcoded rather than read from `package.json`. This will drift out of sync whenever the version in `package.json` is bumped.
**Fix:** Read version at build time or from `package.json`:
```typescript
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
cli.version(pkg.version);
```

### IN-02: Fastify logger enabled in production

**File:** `packages/cli/src/server/index.ts:69`
**Issue:** `Fastify({ logger: true })` enables structured JSON logging to stdout. This will interleave JSON log lines with the clean `console.log` status messages in `launcher.ts`, producing noisy output for CLI users.
**Fix:** Consider using `logger: false` for production, or configuring a custom logger that only writes to stderr, or using a `--verbose` flag to enable it.

### IN-03: Unused import `path` in test file

**File:** `packages/cli/src/__tests__/launcherCli.test.ts:3`
**Issue:** `import path from 'path'` is imported but only used at line 148 (`path.resolve(__dirname, ...)`). While it is technically used, the `__dirname` variable is not defined in ESM modules (this file uses ESM imports from `vitest`). This will resolve to `undefined` at runtime if the test framework does not provide a `__dirname` polyfill. Vitest does polyfill `__dirname`, so this works, but it is worth noting.
**Fix:** No action required. Vitest provides `__dirname` polyfill. This is informational.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
