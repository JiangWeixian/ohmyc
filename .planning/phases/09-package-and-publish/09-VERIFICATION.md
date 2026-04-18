---
phase: 09-package-and-publish
verified: 2026-04-14T12:24:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/10
  gaps_closed:
    - "prepublishOnly script runs build:full before npm publish"
    - "Running node dist/index.cjs from the package starts the CLI without errors"
    - "Stale build artifacts (chunk-*.js, src-*.js) persisted in dist/"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run npm pack, install globally, and execute cu command"
    expected: "cu command starts the CLI and shows help output"
    why_human: "Cannot test actual npm global install behavior programmatically"
  - test: "Run cu start and verify full startup flow (server starts, UI loads, browser opens)"
    expected: "CLI starts without errors, serves UI on a port, opens browser"
    why_human: "Requires running server and browser interaction"
---

# Phase 9: Package and Publish Verification Report

**Phase Goal:** Users can install and run ClaudeUI globally via npm with zero additional setup
**Verified:** 2026-04-14T12:24:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (Plan 03)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tsup bundles all 9 runtime dependencies into dist/index.cjs with zero external npm imports | VERIFIED | tsup.config.ts has all 9 deps in noExternal array; CJS build produces single 2.13MB dist/index.cjs; import check test passes with only Node builtins and internal subpath references found |
| 2 | package.json files field includes exactly dist and README.md | VERIFIED | package.json line 18: `"files": ["dist", "README.md"]` -- exactly 2 entries |
| 3 | prepublishOnly script runs build:full before npm publish | VERIFIED | package.json line 16: `"prepublishOnly": "pnpm build:full && node scripts/prepublish.mjs"` -- build:full runs first, then name rewrite |
| 4 | packages/cli/.npmrc routes @aiou scope to public npm registry | VERIFIED | .npmrc contains `@aiou:registry=https://registry.npmjs.org/` |
| 5 | prepublish.mjs rewrites package name from @claudeui/cli to @aiou/cu and clears dependencies | VERIFIED | Script sets `pkg.name = '@aiou/cu'` and `pkg.dependencies = {}`; process.on('exit') restores original; tested and confirmed restore cycle works |
| 6 | npm pack --dry-run output lists only dist/ and README.md (and auto-included package.json) | VERIFIED | npm pack --dry-run shows 5 files: dist/index.cjs, 3 ui assets, package.json |
| 7 | npm pack --dry-run output does NOT list src/, test files, tsup.config.ts, or .npmrc | VERIFIED | npm pack output contains no src/, tsup.config, vitest.config, .npmrc, or scripts/ entries |
| 8 | Package test confirms bin.cu points to dist/index.cjs | VERIFIED | package.test.ts line 39-41 asserts `pkg.bin.cu === 'dist/index.cjs'` |
| 9 | Package test confirms files field includes dist | VERIFIED | package.test.ts lines 43-48 assert files contains 'dist' and 'README.md' |
| 10 | node dist/index.cjs --help runs without errors and displays CLI help output | VERIFIED | `node dist/index.cjs --help` outputs usage info with "start" command, "--version" flag; no "Dynamic require" crash |

**Score:** 10/10 truths verified

### Gap Closure Results (Re-verification)

All 3 gaps from previous verification have been closed:

| Previous Gap | Fix Applied | Evidence |
|-------------|-------------|----------|
| prepublishOnly missing build:full | prepublishOnly now runs `pnpm build:full && node scripts/prepublish.mjs` | package.json line 16 |
| Bundle crashes with "Dynamic require of events" | tsup format changed from ESM to CJS; import.meta.url shim via esbuild banner+define | tsup.config.ts line 10: `format: ['cjs']`; bundle header has `_importMetaUrl` banner |
| Stale chunk/src files persisted in dist/ | tsup `clean: true` + CJS format produces only index.cjs and ui/ | `ls dist/` shows only index.cjs and ui/ directory |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/tsup.config.ts` | CJS format, all 9 deps in noExternal, import.meta.url shim | VERIFIED | format:['cjs'], splitting:false, clean:true, esbuildOptions with banner+define for _importMetaUrl |
| `packages/cli/package.json` | files field, prepublishOnly with build:full, bin pointing to .cjs | VERIFIED | All fields present and correct |
| `packages/cli/.npmrc` | Scoped registry for @aiou to public npm | VERIFIED | Single line: @aiou:registry=https://registry.npmjs.org/ |
| `packages/cli/scripts/prepublish.mjs` | Prepublish script that rewrites name, clears deps, checks .cjs dist | VERIFIED | Pre-flight checks dist/index.cjs, rewrites name to @aiou/cu, restores on exit |
| `packages/cli/src/__tests__/package.test.ts` | Tests for package config, CJS bundle, runtime smoke test | VERIFIED | 11 tests covering bin, files, prepublishOnly, publishConfig, noExternal, CJS format, build output, and runtime execution |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| package.json | scripts/prepublish.mjs | prepublishOnly script field | WIRED | `"prepublishOnly": "pnpm build:full && node scripts/prepublish.mjs"` |
| tsup.config.ts | dist/index.cjs | tsup build with noExternal + CJS format | WIRED | Build produces single 2.13MB CJS bundle with import.meta.url shim |
| package.json bin.cu | dist/index.cjs | bin entry points to CLI entry | WIRED | `"cu": "dist/index.cjs"` -- file exists and runs |
| package.test.ts | package.json | reads package.json fields | WIRED | `readFileSync(pkgPath)` reads actual package.json |
| package.test.ts | dist/index.cjs | smoke test executes bundle | WIRED | `execSync('node dist/index.cjs --help')` runs and asserts output |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| dist/index.cjs | _importMetaUrl banner | require("url").pathToFileURL(__filename) | Yes -- real file URL from __filename | FLOWING |
| dist/index.cjs | require() calls | Node.js native CJS loader | Yes -- 101 require() calls for Node builtins | FLOWING |
| package.test.ts | pkg | package.json readFileSync | Yes -- reads actual config | FLOWING |
| package.test.ts | output | execSync('node dist/index.cjs --help') | Yes -- actual CLI help output | FLOWING |
| prepublish.mjs | pkg | package.json readFileSync | Yes -- reads and modifies actual file | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CJS bundle runs without crash | `node dist/index.cjs --help` | Prints usage: start command, --version flag, --help flag | PASS |
| Clean build produces single bundle | `rm -rf dist/ && pnpm build:full` then `ls dist/` | Only index.cjs and ui/ | PASS |
| All tests pass | `pnpm test` | 275 passed, 0 failed (18 test files) | PASS |
| npm pack correct contents | `npm pack --dry-run` | 5 files: dist/index.cjs, 3 ui assets, package.json | PASS |
| Prepublish rewrite cycle | `node scripts/prepublish.mjs` | Rewrites to @aiou/cu, restores @claudeui/cli on exit | PASS |
| No "Dynamic require" in bundle | `grep -c "Dynamic require" dist/index.cjs` | Returns 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PKG-01 | 09-01, 09-02, 09-03 | cu installable globally via npm install -g | SATISFIED | bin.cu points to dist/index.cjs; publishConfig.access=public; .npmrc routes @aiou scope; files allowlist includes dist |
| PKG-02 | 09-01, 09-02, 09-03 | Package includes built CLI and UI assets ready to run without build step | SATISFIED | dist/index.cjs (2.13MB self-contained CJS) + dist/ui/index.html + assets; all 9 runtime deps bundled; npm pack confirms 5-file tarball |
| PKG-03 | 09-01, 09-02, 09-03 | CLI works after global install without additional setup or dev dependencies | SATISFIED | node dist/index.cjs --help runs without errors; bundle is zero-dependency (only Node builtins as external requires); smoke test passes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| dist/index.cjs | 51179 | Optional require("esprima") in bundled js-yaml | Info | esprima is an optional dependency of js-yaml, wrapped in try/catch, not required for CLI operation |

No TODO/FIXME/placeholder comments found in any source files. No empty implementations detected. No hardcoded empty data values.

### Confirmation Bias Counter Check

1. **Partially met requirement:** PKG-03 claims "CLI works after global install without additional setup." The bundle runs locally with `node dist/index.cjs --help`, but the actual `npm install -g` workflow has not been tested end-to-end. The prepublish script rewrites the name but this has only been tested in isolation, not through an actual `npm publish` then `npm install -g` cycle. Flagged for human verification.

2. **Test that passes but may not fully test the stated behavior:** The "no external npm package imports" test filters out specifiers containing `/`, which correctly excludes internal bundled subpath references. However, `esprima` is a bare require() that IS external (not in package dependencies) but passes because it is wrapped in a try/catch inside bundled js-yaml code. If js-yaml ever requires esprima unconditionally, the bundle would break at runtime. Current risk is minimal since js-yaml 3.x has used this optional pattern stably.

3. **Uncovered error path:** The prepublish.mjs script modifies package.json in-place and restores on `process.on('exit')`. If the process is killed with SIGKILL (which cannot be caught), the restore would not execute, leaving package.json in a modified state with name=@aiou/cu. This is a known trade-off documented in the plan and acceptable for a developer-only script.

### Human Verification Required

### 1. Global install test

**Test:** Run `npm pack` in packages/cli, then `npm install -g claudeui-cli-0.1.0.tgz`, then run `cu --help` from a new terminal.
**Expected:** `cu` command is available globally, prints help output with "start" command and "--version" flag.
**Why human:** Cannot test actual npm global install behavior in this environment. The bin entry, files allowlist, and bundle have been verified programmatically but the end-to-end npm install cycle needs human confirmation.

### 2. Full CLI startup after global install

**Test:** After global install, run `cu start` and verify the full startup flow.
**Expected:** CLI starts without errors, serves UI on a port, opens browser.
**Why human:** Requires running server, network access, and browser interaction. The CJS bundle runs correctly in isolation (`--help`), but the full server startup flow (Fastify, port selection, browser launch) should be confirmed by a human.

### 3. npm publish dry run

**Test:** Run `npm publish --dry-run` from packages/cli to verify the full prepublish lifecycle.
**Expected:** Build runs, name is rewritten to @aiou/cu, tarball is created with correct contents, package.json is restored to @claudeui/cli.
**Why human:** The prepublishOnly lifecycle involves npm's own process management which may interact differently with the restore mechanism than `node scripts/prepublish.mjs` alone.

### Gaps Summary

**No gaps remaining.** All 3 gaps from the previous verification have been closed:

1. **prepublishOnly missing build:full** -- Fixed. The script now runs `pnpm build:full && node scripts/prepublish.mjs`, ensuring a fresh build before the name rewrite.

2. **Bundle crashes with "Dynamic require" error** -- Fixed. tsup format changed from ESM to CJS, eliminating the broken `__require` shim. An esbuild banner+define pattern was added to shim `import.meta.url` in CJS context, keeping source code ESM-compatible. The bundle runs and produces correct help output.

3. **Stale build artifacts** -- Fixed. tsup `clean: true` combined with CJS format (which does not produce chunks) ensures dist/ contains only `index.cjs` and `ui/`.

**Note:** The dist directory must be rebuilt after pulling the Plan 03 changes. The old ESM-built `dist/index.js` may persist in working directories and would still crash. Running `pnpm build:full` produces the correct `dist/index.cjs` CJS bundle.

---

_Verified: 2026-04-14T12:24:00Z_
_Verifier: Claude (gsd-verifier)_
