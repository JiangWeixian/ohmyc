# Timeline Plugin npm Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `plugins/timeline/` as `@ohmyc/timeline-plugin` npm package, bundled into a single file via `bun build`.

**Architecture:** `bun build` bundles `opencode.ts` plus `@ohmyc/timeline` code into a single `dist/index.js`. Runtime-provided modules (`bun:sqlite`, `@opencode-ai/plugin`) stay external. Claude Code hooks ship as static files.

**Tech Stack:** Bun (bundler), TypeScript, `@ohmyc/timeline`, `@opencode-ai/plugin`

---

### Task 1: Fix imports in opencode.ts

**Files:**
- Modify: `plugins/timeline/opencode.ts:8-9,12`

The current source uses monorepo-relative imports. Change them to package imports so the bundler can resolve from `node_modules`.

- [ ] **Step 1: Update imports**

```ts
// Replace these three lines:
import { CURRENT_SCHEMA_VERSION, SCHEMA_SQL } from '../../packages/timeline/src/schema.js'
import { createWriter } from '../../packages/timeline/src/writer.js'
import type { ParsedSessionData } from '../../packages/timeline/src/ingest.js'

// With:
import { CURRENT_SCHEMA_VERSION, SCHEMA_SQL } from '@ohmyc/timeline/schema'
import { createWriter } from '@ohmyc/timeline/writer'
import type { ParsedSessionData } from '@ohmyc/timeline'
```

- [ ] **Step 2: Run tests to verify imports resolve**

Run: `cd plugins/timeline && pnpm vitest run`
Expected: All tests pass (tests mock `bun:sqlite` so they don't need the actual package linked)

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/opencode.ts
git commit -m "refactor(timeline-plugin): switch to package imports for bundling"
```

---

### Task 2: Create package.json

**Files:**
- Create: `plugins/timeline/package.json`

This makes `plugins/timeline/` an independent npm package.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ohmyc/timeline-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "files": [
    "dist",
    "hooks",
    "README.md"
  ],
  "scripts": {
    "build": "bun build opencode.ts --outdir dist --target bun --external bun:sqlite --external @opencode-ai/plugin",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.14.31"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.14.31",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Add dist/ to .gitignore (plugin-level)**

Create `plugins/timeline/.gitignore`:

```
dist/
node_modules/
```

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/package.json plugins/timeline/.gitignore
git commit -m "feat(timeline-plugin): add package.json for npm publishing"
```

---

### Task 3: Wire into workspace

**Files:**
- Modify: `package.json` (workspace root) — add `plugins/*` to workspace if not already present

- [ ] **Step 1: Check if `plugins/*` is in pnpm workspace**

Read `pnpm-workspace.yaml` (or check root `package.json`). If `plugins/*` is not listed, add it.

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`

This links `@ohmyc/timeline` and `@opencode-ai/plugin` into `plugins/timeline/node_modules/`.

- [ ] **Step 3: Verify tests still pass**

Run: `cd plugins/timeline && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit (if workspace config changed)**

```bash
git add pnpm-workspace.yaml
git commit -m "chore: add plugins/* to pnpm workspace"
```

---

### Task 4: Build and verify bundle

**Files:**
- Creates: `plugins/timeline/dist/index.js`

- [ ] **Step 1: Run build**

Run: `cd plugins/timeline && pnpm build`
Expected: `dist/index.js` created, no errors

- [ ] **Step 2: Verify bundle is a single file**

Run: `wc -l plugins/timeline/dist/index.js`
Expected: Single JS file with all `@ohmyc/timeline` code inlined

- [ ] **Step 3: Verify externals are NOT bundled**

Run: `grep -c "bun:sqlite" plugins/timeline/dist/index.js`
Expected: 0 (it's external)

Run: `grep -c "@opencode-ai/plugin" plugins/timeline/dist/index.js`
Expected: 0 (it's external)

- [ ] **Step 4: Verify exports are present**

Run: `grep "TimelinePlugin" plugins/timeline/dist/index.js`
Expected: Export found

- [ ] **Step 5: Commit (dist is gitignored, no commit needed for dist itself)**

No commit — `dist/` is gitignored. Build runs at publish time.

---

### Task 5: Update symlink to use bundle (optional)

**Files:**
- Modify: `.opencode/plugins/timeline.ts` symlink

The current symlink points to source. For local development, source is fine. For published package consumption, users would point to `dist/index.js`. No change needed for dev workflow — skip this unless you want to test the bundle locally.

- [ ] **Step 1 (optional): Test bundle loads in OpenCode**

Change symlink:
```bash
rm .opencode/plugins/timeline.ts
ln -s ../../plugins/timeline/dist/index.js .opencode/plugins/timeline.js
```

Run OpenCode and verify the plugin loads without errors.

- [ ] **Step 2: Revert symlink for development**

```bash
rm .opencode/plugins/timeline.js
ln -s ../../plugins/timeline/opencode.ts .opencode/plugins/timeline.ts
```
