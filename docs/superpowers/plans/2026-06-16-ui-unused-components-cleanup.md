# UI Unused Components Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused `packages/ui/src/components` files while preserving current UI routes, desktop integration, and the broad `@ohmyc/ui/components/*` export pattern.

**Architecture:** This is a graph-pruning cleanup, not a feature change. The plan first confirms the candidate files still have zero monorepo inbound imports, then deletes only those files, keeps `packages/ui/package.json` subpath exports unchanged, and validates the preserved `App`, `Explorer`, `menubar`, settings, timeline, and store-editor chains with existing checks.

**Tech Stack:** TypeScript, React, Vite, Vitest, pnpm workspaces, Tauri desktop package.

---

## File Structure

**Create**

- None.

**Modify**

- None expected. `packages/ui/package.json` must keep `./components/*` unchanged.

**Delete**

- `packages/ui/src/components/json-editor.tsx`
- `packages/ui/src/components/settings/ui/button.tsx`
- `packages/ui/src/components/settings/ui/input.tsx`
- `packages/ui/src/components/settings/ui/select.tsx`
- `packages/ui/src/components/settings/ui/toggle.tsx`
- `packages/ui/src/components/settings/utils.ts`
- `packages/ui/src/components/ui/avatar.tsx`
- `packages/ui/src/components/ui/checkbox.tsx`
- `packages/ui/src/components/ui/dialog.tsx`
- `packages/ui/src/components/ui/hover-card.tsx`
- `packages/ui/src/components/ui/keyboard-shortcuts-panel.tsx`
- `packages/ui/src/components/ui/keyboard-shortcuts.tsx`
- `packages/ui/src/components/ui/password-input.tsx`
- `packages/ui/src/components/ui/quick-actions.tsx`
- `packages/ui/src/components/ui/scroll-area.tsx`
- `packages/ui/src/components/ui/separator.tsx`
- `packages/ui/src/components/ui/Skeleton.tsx`
- `packages/ui/src/components/ui/slider.tsx`
- `packages/ui/src/components/ui/textarea.tsx`
- `packages/ui/src/components/ui/Toast.tsx`
- `packages/ui/src/components/ui/tooltip.tsx`
- `packages/ui/src/components/uitripled/index.ts`

**Preserve**

- `packages/ui/package.json`, especially the `./components/*` export.
- `packages/ui/src/components/menubar/menubar-page.tsx` and the full menubar dependency chain.
- `packages/ui/src/components/settings/settings-layout.tsx` and the full settings dependency chain currently imported by `Explorer`.
- `packages/ui/src/components/store/**`, `packages/ui/src/components/markdown-editor.tsx`, and helpers used by the store editor subgraph.
- `packages/ui/src/components/uitripled/native-button.tsx` and `packages/ui/src/components/uitripled/native-dialog.tsx`.

## Task 1: Confirm The Deletion Set Is Still Unused

**Files:**
- Read: `packages/ui/src/components/**`
- Read: `packages/ui/package.json`
- Read: `packages/desktop/src/main.tsx`
- Read: `packages/desktop/src/menubar.tsx`

- [ ] **Step 1: Run an alias-aware reference check**

Run this from `/Users/bytedance/Projects/oss/ohmyc`:

```bash
node --input-type=module <<'EOF'
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exts = ['.ts', '.tsx', '.js', '.jsx'];
const candidates = [
  'packages/ui/src/components/json-editor.tsx',
  'packages/ui/src/components/settings/ui/button.tsx',
  'packages/ui/src/components/settings/ui/input.tsx',
  'packages/ui/src/components/settings/ui/select.tsx',
  'packages/ui/src/components/settings/ui/toggle.tsx',
  'packages/ui/src/components/settings/utils.ts',
  'packages/ui/src/components/ui/avatar.tsx',
  'packages/ui/src/components/ui/checkbox.tsx',
  'packages/ui/src/components/ui/dialog.tsx',
  'packages/ui/src/components/ui/hover-card.tsx',
  'packages/ui/src/components/ui/keyboard-shortcuts-panel.tsx',
  'packages/ui/src/components/ui/keyboard-shortcuts.tsx',
  'packages/ui/src/components/ui/password-input.tsx',
  'packages/ui/src/components/ui/quick-actions.tsx',
  'packages/ui/src/components/ui/scroll-area.tsx',
  'packages/ui/src/components/ui/separator.tsx',
  'packages/ui/src/components/ui/Skeleton.tsx',
  'packages/ui/src/components/ui/slider.tsx',
  'packages/ui/src/components/ui/textarea.tsx',
  'packages/ui/src/components/ui/Toast.tsx',
  'packages/ui/src/components/ui/tooltip.tsx',
  'packages/ui/src/components/uitripled/index.ts',
];

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'coverage') {
      continue;
    }
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(p));
    } else if (exts.includes(path.extname(p))) {
      out.push(p);
    }
  }
  return out;
}

const allFiles = walk(path.join(root, 'packages'));
const fileSet = new Set(allFiles.map(f => path.resolve(f)));
const candidateSet = new Set(candidates.map(f => path.resolve(root, f)));

function resolveSpec(from, spec) {
  let base;
  if (spec.startsWith('@/')) {
    base = path.join(root, 'packages/ui/src', spec.slice(2));
  } else if (spec === '@ohmyc/ui/app') {
    base = path.join(root, 'packages/ui/src/app');
  } else if (spec.startsWith('@ohmyc/ui/components/')) {
    base = path.join(root, 'packages/ui/src/components', spec.slice('@ohmyc/ui/components/'.length));
  } else if (spec.startsWith('@ohmyc/ui/hooks/')) {
    base = path.join(root, 'packages/ui/src/hooks', spec.slice('@ohmyc/ui/hooks/'.length));
  } else if (spec.startsWith('@ohmyc/ui/state/')) {
    base = path.join(root, 'packages/ui/src/state', spec.slice('@ohmyc/ui/state/'.length));
  } else if (spec.startsWith('@ohmyc/ui/lib/')) {
    base = path.join(root, 'packages/ui/src/lib', spec.slice('@ohmyc/ui/lib/'.length));
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(from), spec);
  } else {
    return null;
  }

  const matches = [];
  if (path.extname(base)) {
    matches.push(base);
  }
  for (const ext of exts) {
    matches.push(base + ext);
  }
  for (const ext of exts) {
    matches.push(path.join(base, 'index' + ext));
  }
  return matches.map(p => path.resolve(p)).find(p => fileSet.has(p)) ?? null;
}

const importRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const inbound = new Map([...candidateSet].map(f => [f, []]));

for (const file of allFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(importRe)) {
    const spec = match[1] || match[2];
    const target = resolveSpec(file, spec);
    if (target && inbound.has(target)) {
      inbound.get(target).push(path.relative(root, file));
    }
  }
}

let failed = false;
for (const candidate of candidates) {
  const refs = inbound.get(path.resolve(root, candidate)) ?? [];
  if (refs.length > 0) {
    failed = true;
    console.log(`${candidate} <- ${refs.join(', ')}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log('All cleanup candidates have zero alias-aware inbound imports.');
EOF
```

Expected: exit code `0` and the exact line:

```text
All cleanup candidates have zero alias-aware inbound imports.
```

- [ ] **Step 2: Confirm the package export pattern is still broad**

Run:

```bash
jq -r '.exports["./components/*"]' packages/ui/package.json
```

Expected:

```text
./src/components/*.tsx
```

- [ ] **Step 3: Confirm desktop still has one direct component subpath import**

Run:

```bash
rg -n "@ohmyc/ui/components/" packages/desktop/src
```

Expected:

```text
packages/desktop/src/menubar.tsx:1:import { MenubarPage } from '@ohmyc/ui/components/menubar/menubar-page'
```

- [ ] **Step 4: Commit nothing**

Run:

```bash
git status --short
```

Expected: no output.

## Task 2: Delete The Zero-Reference Component Files

**Files:**
- Delete: the 22 files listed in the File Structure section.
- Preserve: `packages/ui/package.json`

- [ ] **Step 1: Delete only the confirmed zero-reference files**

Run this exact command from `/Users/bytedance/Projects/oss/ohmyc`:

```bash
rm \
  packages/ui/src/components/json-editor.tsx \
  packages/ui/src/components/settings/ui/button.tsx \
  packages/ui/src/components/settings/ui/input.tsx \
  packages/ui/src/components/settings/ui/select.tsx \
  packages/ui/src/components/settings/ui/toggle.tsx \
  packages/ui/src/components/settings/utils.ts \
  packages/ui/src/components/ui/avatar.tsx \
  packages/ui/src/components/ui/checkbox.tsx \
  packages/ui/src/components/ui/dialog.tsx \
  packages/ui/src/components/ui/hover-card.tsx \
  packages/ui/src/components/ui/keyboard-shortcuts-panel.tsx \
  packages/ui/src/components/ui/keyboard-shortcuts.tsx \
  packages/ui/src/components/ui/password-input.tsx \
  packages/ui/src/components/ui/quick-actions.tsx \
  packages/ui/src/components/ui/scroll-area.tsx \
  packages/ui/src/components/ui/separator.tsx \
  packages/ui/src/components/ui/Skeleton.tsx \
  packages/ui/src/components/ui/slider.tsx \
  packages/ui/src/components/ui/textarea.tsx \
  packages/ui/src/components/ui/Toast.tsx \
  packages/ui/src/components/ui/tooltip.tsx \
  packages/ui/src/components/uitripled/index.ts
```

Expected: command exits with code `0`.

- [ ] **Step 2: Verify no package manifest change was made**

Run:

```bash
git diff -- packages/ui/package.json
```

Expected: no output.

- [ ] **Step 3: Verify the deleted file set is exactly the intended set**

Run:

```bash
git status --short
```

Expected:

```text
 D packages/ui/src/components/json-editor.tsx
 D packages/ui/src/components/settings/ui/button.tsx
 D packages/ui/src/components/settings/ui/input.tsx
 D packages/ui/src/components/settings/ui/select.tsx
 D packages/ui/src/components/settings/ui/toggle.tsx
 D packages/ui/src/components/settings/utils.ts
 D packages/ui/src/components/ui/Skeleton.tsx
 D packages/ui/src/components/ui/Toast.tsx
 D packages/ui/src/components/ui/avatar.tsx
 D packages/ui/src/components/ui/checkbox.tsx
 D packages/ui/src/components/ui/dialog.tsx
 D packages/ui/src/components/ui/hover-card.tsx
 D packages/ui/src/components/ui/keyboard-shortcuts-panel.tsx
 D packages/ui/src/components/ui/keyboard-shortcuts.tsx
 D packages/ui/src/components/ui/password-input.tsx
 D packages/ui/src/components/ui/quick-actions.tsx
 D packages/ui/src/components/ui/scroll-area.tsx
 D packages/ui/src/components/ui/separator.tsx
 D packages/ui/src/components/ui/slider.tsx
 D packages/ui/src/components/ui/textarea.tsx
 D packages/ui/src/components/ui/tooltip.tsx
 D packages/ui/src/components/uitripled/index.ts
```

- [ ] **Step 4: Run the UI typecheck**

Run:

```bash
pnpm exec tsc --noEmit -p packages/ui/tsconfig.json
```

Expected: exit code `0`.

- [ ] **Step 5: Run the narrow UI tests**

Run:

```bash
pnpm --filter @ohmyc/ui exec vitest run tests/app.routes.test.tsx tests/explorer.inventory.test.tsx tests/components/menubar
```

Expected: exit code `0`; Vitest reports passing tests for the specified files.

- [ ] **Step 6: Commit the deletion**

Run:

```bash
git add \
  packages/ui/src/components/json-editor.tsx \
  packages/ui/src/components/settings/ui/button.tsx \
  packages/ui/src/components/settings/ui/input.tsx \
  packages/ui/src/components/settings/ui/select.tsx \
  packages/ui/src/components/settings/ui/toggle.tsx \
  packages/ui/src/components/settings/utils.ts \
  packages/ui/src/components/ui/avatar.tsx \
  packages/ui/src/components/ui/checkbox.tsx \
  packages/ui/src/components/ui/dialog.tsx \
  packages/ui/src/components/ui/hover-card.tsx \
  packages/ui/src/components/ui/keyboard-shortcuts-panel.tsx \
  packages/ui/src/components/ui/keyboard-shortcuts.tsx \
  packages/ui/src/components/ui/password-input.tsx \
  packages/ui/src/components/ui/quick-actions.tsx \
  packages/ui/src/components/ui/scroll-area.tsx \
  packages/ui/src/components/ui/separator.tsx \
  packages/ui/src/components/ui/Skeleton.tsx \
  packages/ui/src/components/ui/slider.tsx \
  packages/ui/src/components/ui/textarea.tsx \
  packages/ui/src/components/ui/Toast.tsx \
  packages/ui/src/components/ui/tooltip.tsx \
  packages/ui/src/components/uitripled/index.ts
git commit -m "refactor(ui): remove unused component inventory"
```

Expected: commit succeeds.

## Task 3: Run Broad Verification And Record Existing Lint Limitation

**Files:**
- Read: `packages/ui/package.json`
- Read: `packages/desktop/package.json`
- Modify: no source files unless verification finds a real regression from Task 2.

- [ ] **Step 1: Run the full UI test suite**

Run:

```bash
pnpm --filter @ohmyc/ui test
```

Expected: exit code `0`; current baseline is `20` test files and `102` tests.

- [ ] **Step 2: Run the UI build**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: exit code `0`.

- [ ] **Step 3: Run the desktop TypeScript check**

Run:

```bash
pnpm --filter @ohmyc/desktop exec tsc --noEmit -p tsconfig.json
```

Expected: exit code `0`.

- [ ] **Step 4: Run the desktop build**

Run:

```bash
pnpm --filter @ohmyc/desktop build
```

Expected: exit code `0`.

- [ ] **Step 5: Run UI lint and classify the result**

Run:

```bash
pnpm --filter @ohmyc/ui lint
```

Expected existing tooling failure, not a cleanup regression:

```text
TypeError: context.getSourceCode is not a function
```

If lint exits `0`, record that lint now passes. If lint fails with a different error, inspect the file path in the lint output and fix only errors caused by the deletion commit.

- [ ] **Step 6: Confirm final git state**

Run:

```bash
git status --short
```

Expected: no output.

## Self-Review

Spec coverage:

- Delete zero-reference component files: Task 1 confirms references; Task 2 deletes the files.
- Keep `./components/*` unchanged: Task 2 Step 2 verifies no package manifest change.
- Preserve runtime route behavior: Task 2 Step 5, Task 3 Step 1, Task 3 Step 2 validate app routes and UI build.
- Preserve desktop integration: Task 1 Step 3, Task 3 Step 3, and Task 3 Step 4 validate desktop imports and build.
- Preserve store editor subgraph: no store files are listed in the deletion command.
- Record lint limitation: Task 3 Step 5 classifies the known `tailwindcss/classnames-order` crash.

Red-flag scan: no deferred-work markers, incomplete sections, or undefined helper names are present.

Type consistency: command paths, package names, and file paths match the spec and current package manifests.
