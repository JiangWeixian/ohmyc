---
phase: 09-package-and-publish
reviewed: 2026-04-14T12:20:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/cli/tsup.config.ts
  - packages/cli/package.json
  - packages/cli/scripts/prepublish.mjs
  - packages/cli/src/__tests__/package.test.ts
  - packages/cli/src/server/index.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-04-14T12:20:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed five files in the CLI package related to the packaging and publish workflow: the tsup build configuration, package.json manifest, the prepublish script that rewrites the package name, the package configuration test suite, and the Fastify server entry point.

The build and packaging pipeline is well-structured overall. The tsup config correctly bundles all runtime dependencies via `noExternal`, injects a CJS-compatible `import.meta.url` shim via esbuild define, and copies UI assets in an `onSuccess` hook. The test suite validates that the produced bundle has no external npm imports. The server entry has proper SPA fallback routing with `wildcard: false` on static serving.

One critical bug was found in `prepublish.mjs`: the `process.on('exit', restore)` handler fires when the Node.js process exits, which restores `package.json` before npm reads it, defeating the name-rewrite strategy. Two warnings relate to incomplete Node.js builtins coverage in tests and the server binding to all network interfaces without authentication.

## Critical Issues

### CR-01: prepublish.mjs exit handler restores package.json before npm reads it

**File:** `packages/cli/scripts/prepublish.mjs:24`
**Issue:** The script registers `process.on('exit', restore)` to restore the original `package.json`. However, this `exit` handler fires when the `prepublish.mjs` child process exits -- not when npm finishes publishing. The actual execution sequence is:

1. npm invokes `prepublishOnly`: `pnpm build:full && node scripts/prepublish.mjs`
2. The `node scripts/prepublish.mjs` child process writes modified `package.json` with `name: "@aiou/cu"` (line 33)
3. The child process event loop empties
4. The `exit` handler fires, `restore()` overwrites with the original `name: "@claudeui/cli"` (line 23)
5. The child process exits, control returns to npm
6. npm reads `package.json` from disk -- sees `@claudeui/cli`, not `@aiou/cu`

The published package will have the wrong name. The `dependencies: {}` clearing on line 30 will also be undone, meaning npm will attempt to resolve `workspace:*` dependencies during publish, likely causing a failure or an incorrect tarball.

**Fix:** Remove the `process.on('exit', restore)` pattern. Instead, save a backup file and add a `postpublish` script to restore it:

```json
// package.json scripts
{
  "prepublishOnly": "pnpm build:full && node scripts/prepublish.mjs",
  "postpublish": "node scripts/postpublish.mjs"
}
```

```javascript
// scripts/prepublish.mjs -- modify without exit handlers
// ... pre-flight checks unchanged ...

const original = readFileSync(pkgPath, 'utf-8');
// Save backup to a sibling file
writeFileSync(join(__dirname, '..', 'package.json.bak'), original);

const pkg = JSON.parse(original);
pkg.name = '@aiou/cu';
pkg.dependencies = {};
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Package configured for publication as @aiou/cu');
```

```javascript
// scripts/postpublish.mjs -- new file, restores from backup
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bakPath = join(__dirname, '..', 'package.json.bak');
const pkgPath = join(__dirname, '..', 'package.json');

if (existsSync(bakPath)) {
  writeFileSync(pkgPath, readFileSync(bakPath, 'utf-8'));
  unlinkSync(bakPath);
  console.log('Original package.json restored.');
}
```

Also add `package.json.bak` to `.gitignore`.

## Warnings

### WR-01: NODE_BUILTINS set in test missing subpath builtins

**File:** `packages/cli/src/__tests__/package.test.ts:16-24`
**Issue:** The `NODE_BUILTINS` set used to filter bare imports in the bundle completeness test is missing Node.js subpath modules: `assert/strict`, `dns/promises`, `timers/promises`, `stream/consumers`, `stream/promises`, `stream/web`, `readline/promises`, `inspector/promises`. If any bundled dependency internally uses these subpath imports without the `node:` prefix, the test will flag them as external npm packages, producing a false positive.

Note that `node:` prefixed imports are already excluded by the regex on line 91, so `node:fs/promises` etc. are safe. The risk is limited to subpath-only imports that lack the `node:` prefix.

**Fix:** Add the missing subpath builtins to the set:

```typescript
const NODE_BUILTINS = new Set([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'dns/promises', 'domain', 'events',
  'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector', 'inspector/promises', 'module',
  'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'readline/promises', 'repl', 'stream', 'stream/consumers',
  'stream/promises', 'stream/web', 'string_decoder', 'sys', 'timers', 'timers/promises',
  'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib',
]);
```

### WR-02: Server binds to 0.0.0.0 exposing it on all network interfaces

**File:** `packages/cli/src/server/index.ts:141`
**Issue:** `fastify.listen({ port, host: '0.0.0.0' })` binds to all network interfaces, making the server accessible from any device on the same network. This is a local developer tool that serves configuration files, agent definitions, and potentially sensitive data from the user's `~/.claude` directory. On machines connected to public or corporate networks, this exposes the CLI server to other devices without any authentication or authorization.

**Fix:** Default to `127.0.0.1` (localhost only) and accept an explicit `--host` flag for users who intentionally want network access:

```typescript
export interface StartServerOptions {
  defaultPort?: number;
  staticRoot?: string;
  host?: string;
}

// In startServer():
const host = opts.host ?? '127.0.0.1';
const address = await fastify.listen({ port, host });
```

## Info

### IN-01: console.log in server code duplicates Fastify's structured logger

**File:** `packages/cli/src/server/index.ts:79,142`
**Issue:** Two `console.log` calls exist in the server module. The Fastify instance already has `logger: true` enabled (line 68), which provides structured JSON logging. These `console.log` calls bypass Fastify's logger and produce unstructured output. Line 79 (`Serving static files from`) is also redundant since Fastify's logger already captures the listen address.

**Fix:** Replace with `fastify.log.info()` to use the configured structured logger, or remove them since Fastify's logger already covers the relevant events.

### IN-02: AGENT_HOME environment variable is undocumented

**File:** `packages/cli/src/server/index.ts:91`
**Issue:** `process.env.AGENT_HOME` overrides the default `.claude` base directory, but this variable has no CLI flag, no `--help` text, and no documentation. Users cannot discover this option without reading source code.

**Fix:** Add a CLI flag (e.g., `--agent-home`) in the CLI argument parser to expose this option, or add a code comment explaining the intended use case.

---

_Reviewed: 2026-04-14T12:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
