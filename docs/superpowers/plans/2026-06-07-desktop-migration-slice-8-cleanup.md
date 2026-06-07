# Desktop Migration — Slice 8: Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the dual-implementation scaffolding. Remove `packages/cli/src/server/` (Fastify routes + services + launcher + migrate-home), `packages/ui/src/lib/transport/fetch.ts` (legacy HTTP transport), the slice-2 timeline contract test (TS reader is gone), and trim `packages/cli` to a `dashboard`-only CLI. After this slice, the only path to the OhMyC UI is the Tauri desktop app — `pnpm dev` against a TS server is gone, the npm-published CLI is just the Claude Code capture-plugin installer, and the workspace owns one implementation per surface.

**Architecture:** Pure deletion. Slice 8 ships zero new product code. The only "implementations" are:
- One UX scope cut: `useStoreImport` + `ImportComponentsDialog` deleted as a documented decision (see "Scope cut" below).
- Transport-seam simplification: collapse `transport.ts`'s three-way `tauri | fetch | mock` selector to `tauri | mock` (mock kept for vitest; tauri is the production path).
- Vite config trim: drop the `VITE_TRANSPORT=fetch` build path; the existing `VITE_TRANSPORT=tauri` define in `packages/desktop/vite.config.ts` becomes the default in `packages/ui/src/lib/transport.ts`.

Once these land, `pnpm tauri build` is the only path to a shipping artifact and `pnpm tauri dev` is the only path for UI iteration.

**Tech Stack:** Mostly `rm`. No new dependencies.

---

## Scope cut: `useStoreImport` + ImportComponentsDialog

The slice-5 plan deferred `useStoreImport` (bulk import of agents/skills/commands from an external directory) to a follow-up. It currently calls `POST /api/store/import` via raw `fetch()` and is consumed by `ImportComponentsDialog`, rendered as a primary CTA on the empty Store page and in the Store toolbar.

**This slice deletes both** — the hook, the dialog, the TS service (~333 lines), the route, and the toolbar/empty-state CTAs. Rationale:

- The TS server is going away in this slice. Keeping `useStoreImport` alive would require porting `StoreService.import()` (~300 lines of recursive copy + provenance index + dry-run + conflict detection) to Rust + a new Tauri command + tests. That ballooning is exactly the scope-creep slice 5 originally cut.
- The import surface duplicates `cp -R` from a shell. Power users (the only audience for bulk import) can copy components into `$OHMYC_HOME/store/{agents,skills,commands}/` directly; the watcher (broadened in Task 9 below) picks them up.
- The empty-state CTA wording can be replaced with "Create your first component" which links to the existing create flow (already migrated in slice 5).

**If you would rather preserve bulk-import,** STOP HERE and have me write a Slice 8a plan that ports `useStoreImport` to native first. That's a 6-8 task focused mini-slice; this cleanup plan would then run as Slice 8b. The user-facing CTA stays, no UX regression.

---

## Out of scope (deferred to future slices)

- **Windows symlink support** — deferred since slice 7b. Tracked as a separate portability slice once the Tauri-on-Windows surface is exercised.
- **`serde_json/preserve_order` workspace flip** — slice 7's settings-warnings cosmetic divergence. Worth doing once the workspace deps are touched anyway, but YAGNI for slice 8.
- **`packages/cli` README + npm description rewrite** — the CLI is now strictly the dashboard-plugin installer. Update the README at publish time, not here.

---

## File deletions vs modifications

**Deleted:**
- `packages/cli/src/server/` — entire directory (12 routes + 13 services + `index.ts`).
- `packages/cli/src/launcher.ts`
- `packages/cli/src/migrate-home.ts`
- `packages/cli/tests/server/` — entire directory
- `packages/cli/tests/launcher-cli.test.ts`
- `packages/cli/tests/migrate-home.test.ts`
- `packages/ui/src/lib/transport/fetch.ts`
- `packages/ui/src/hooks/use-store.ts` — `useStoreImport` function + `legacyFetch` helper (rest of file kept; this is a partial edit, not a full delete)
- `packages/ui/src/components/store/import-components-dialog.tsx`
- `crates/ohmyc-core/tests/timeline_contract.rs`
- `crates/ohmyc-core/tests/fixtures/timeline-contract/` — entire fixtures dir

**Modified:**
- `packages/cli/src/index.ts` — drop the `start` + default commands; keep only `dashboard`. Drop the `printBanner()` call (banner advertised the server URL).
- `packages/cli/package.json` — drop server-only deps (`@fastify/static`, `fastify`, `get-port`, `gray-matter`, `open`, `proper-lockfile`, `untildify`, `zod-to-json-schema`); drop `dev` + `dev:server` scripts; rename `start` script to point at the dashboard subcommand only.
- `packages/cli/tsup.config.ts` — drop the noExternal entries for server deps; drop the UI-asset copy (the CLI no longer serves the UI).
- `packages/ui/src/lib/transport.ts` — collapse to `tauri | mock`; drop the `pickFromEnv` fetch fallback.
- `packages/ui/src/components/store/store-component-list.tsx` — drop `ImportComponentsDialog` import, the `showImportDialog` state, the toolbar Import button, and the empty-state Import CTA.
- `packages/ui/package.json` — drop the `dev` script (or repurpose to `dev:fixtures` running vite against a static fixture set, per spec line 282).

---

## Task ordering rationale

Deletion order is critical so the workspace stays green between commits. The dependency graph is:

```
TS routes → TS services → launcher → CLI index
                         ↘  fetch.ts → use-store.ts (useStoreImport) → ImportComponentsDialog → store-component-list.tsx
```

We delete from leaves toward roots:
- Tasks 1-3: UI-side import dialog removal (leaf in the import chain) + use-store.ts trim.
- Tasks 4-5: Transport seam collapse (fetch.ts deletion + transport.ts simplification).
- Tasks 6-8: TS server deletion + launcher/migrate-home removal + CLI index trim.
- Task 9: Timeline contract test deletion (TS reader is gone, no longer needed).
- Task 10: Watcher broadening to cover `$OHMYC_HOME/profiles/` + `$OHMYC_HOME/store/` (the "external activations" follow-up flagged in slice 7b).
- Task 11: package.json scripts + deps trim.
- Task 12: Final workspace verification + `pnpm tauri build` smoke.

---

## Task 1: Remove the Import button + empty-state CTA from `store-component-list.tsx`

**Files:**
- Modify: `packages/ui/src/components/store/store-component-list.tsx`

The dialog stays in tree until Task 2 deletes the file, but the surface that triggers it goes now.

- [ ] **Step 1: Drop the dialog import + the `showImportDialog` state**

Open `packages/ui/src/components/store/store-component-list.tsx`. Find and delete the import line (line 25):

```tsx
import { ImportComponentsDialog } from './import-components-dialog'
```

Find and delete the state hook (around line 127):

```tsx
const [showImportDialog, setShowImportDialog] = useState(false)
```

- [ ] **Step 2: Delete the toolbar Import button**

Find the button around line 322-336 that calls `setShowImportDialog(true)`. It looks roughly like:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setShowImportDialog(true)}
  ...
>
  ...
  Import
</Button>
```

Delete the entire `<Button>` block including its surrounding whitespace.

- [ ] **Step 3: Replace the empty-state Import CTA with a Create CTA**

Find the empty-state block around lines 385-405 — the one with copy "Import {labels.plural} from an existing Claude-compatible directory to start building a canonical local store." and a button labelled "Import components".

Replace the entire block (the copy paragraph + the Import button) with:

```tsx
<p className="text-sm text-muted-foreground">
  No {labels.plural} yet. Create your first one to start building a canonical local store.
</p>
<Button
  variant="outline"
  onClick={() => onEdit?.(category)}
>
  Create {labels.singular}
</Button>
```

The `onEdit?.(category)` pattern (with no id argument) is how slice 5 wired the existing toolbar "New {labels.singular}" button at line 349 — calling `onEdit(category, undefined)` triggers the create flow. Verify by grepping `onEdit?.(category)` in the file before this step; that's how the toolbar's New button works.

- [ ] **Step 4: Delete the rendered `<ImportComponentsDialog>` element**

Find the conditional render around line 514-517:

```tsx
{/* Import Dialog */}
{showImportDialog && (
  <ImportComponentsDialog onClose={() => setShowImportDialog(false)} />
)}
```

Delete the entire block (the comment + the conditional).

- [ ] **Step 5: Verify typecheck + tests pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

Run: `pnpm --filter @ohmyc/ui test src/components/store 2>&1 | tail -10`
Expected: existing store-component-list tests pass (we only deleted UI; no test should depend on the Import button).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/store/store-component-list.tsx
git commit -m "feat(store): replace Import CTA with Create CTA (slice 8 scope cut)"
```

---

## Task 2: Delete `ImportComponentsDialog`

**Files:**
- Delete: `packages/ui/src/components/store/import-components-dialog.tsx`

Now that nothing references it.

- [ ] **Step 1: Verify no remaining references**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && grep -rn "import-components-dialog\|ImportComponentsDialog" packages/ui/src/ 2>&1 | grep -v node_modules`
Expected: no output (Task 1 already removed the only consumer).

- [ ] **Step 2: Delete the file**

```bash
git rm packages/ui/src/components/store/import-components-dialog.tsx
```

- [ ] **Step 3: Verify the UI still typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(store): delete ImportComponentsDialog (CTA removed in prior commit)"
```

---

## Task 3: Strip `useStoreImport` + `legacyFetch` from `use-store.ts`

**Files:**
- Modify: `packages/ui/src/hooks/use-store.ts`

The hook and its private helper are dead code now.

- [ ] **Step 1: Remove the trailing block**

Open `packages/ui/src/hooks/use-store.ts`. The file currently ends with (lines ~207-240):

```ts
// ---- Import (deferred — uses legacy fetch) ----
async function legacyFetch<ResponseType>(url: string, method: string, body?: unknown): Promise<ResponseType> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw Object.assign(new Error(error.error || 'Request failed'), { data: error })
  }
  return res.json()
}

export function useStoreImport() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (req: StoreImportRequest) =>
      legacyFetch<StoreImportResult>('/api/store/import', 'POST', req),
    onSuccess: (_result, request) => {
      if (!request.dryRun) {
        void qc.refetchQueries({ queryKey: ['store'] })
      }
    },
  })

  return {
    ...mutation,
    previewImport: (sourceDir: string) =>
      mutation.mutateAsync({ sourceDir, dryRun: true, overwrite: false }),
    applyImport: (sourceDir: string, overwrite = false) =>
      mutation.mutateAsync({ sourceDir, dryRun: false, overwrite }),
  }
}
```

Delete the entire block (from the `// ---- Import` comment to the closing `}` of `useStoreImport`).

- [ ] **Step 2: Drop the now-unused `StoreImportRequest` + `StoreImportResult` imports**

At the top of the same file, find the type-import block referencing `StoreImportRequest` and `StoreImportResult` (around lines 18-19) and remove those two names. If the resulting import becomes empty, delete it entirely.

- [ ] **Step 3: Verify typecheck**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no errors. If anything still imports `useStoreImport` from `@/hooks/use-store`, grep for it now — that's a leak from Task 1's editing of `store-component-list.tsx` (the import statement at the top of that file references the now-deleted hook).

- [ ] **Step 4: Run UI tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test 2>&1 | tail -10`
Expected: 165 passing (slice 7 baseline minus any tests that referenced useStoreImport — there shouldn't be any). 3 pre-existing menubar failures remain.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-store.ts
git commit -m "feat(store): drop useStoreImport + legacyFetch (last raw-fetch consumer)"
```

---

## Task 4: Collapse `transport.ts` to `tauri | mock`

**Files:**
- Modify: `packages/ui/src/lib/transport.ts`

The `'fetch'` arm becomes unreachable once fetch.ts is gone (Task 5). Update transport.ts first so Task 5's deletion compiles cleanly.

- [ ] **Step 1: Replace the file**

Open `packages/ui/src/lib/transport.ts` and replace the contents entirely with:

```ts
import { mockTransport } from './transport/mock'

export type Transport = (wire: string, args?: unknown) => Promise<unknown>

export interface ApiError {
  code: string
  message: string
  detail?: unknown
}

type TransportName = 'tauri' | 'mock'

function pickFromEnv(): TransportName {
  // VITE_TRANSPORT is set to 'tauri' by packages/desktop/vite.config.ts and
  // to 'mock' by vitest setup. Any other value falls back to 'tauri' — the
  // desktop binary is the only production target.
  const raw = (import.meta.env?.VITE_TRANSPORT ?? 'tauri') as string
  return raw === 'mock' ? 'mock' : 'tauri'
}

let active: TransportName = pickFromEnv()

// `@tauri-apps/api` is not a dep of @ohmyc/ui (only @ohmyc/desktop pulls it in).
// Dynamic import keeps it out of the vitest bundle unless the active transport
// asks for it.
async function resolve(name: TransportName): Promise<Transport> {
  switch (name) {
    case 'tauri': {
      const { tauriTransport } = await import('./transport/tauri')
      return tauriTransport
    }
    case 'mock': return mockTransport
  }
}

export async function request<T>(wire: string, args?: unknown): Promise<T> {
  const transport = await resolve(active)
  return transport(wire, args) as Promise<T>
}

export function __setTransportForTests(name: TransportName): void {
  active = name
}

export function resetTransportForTests(): void {
  active = pickFromEnv()
}
```

- [ ] **Step 2: Verify the test suite still uses `__setTransportForTests('mock')` correctly**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && grep -rn "__setTransportForTests" packages/ui/src/ 2>&1 | grep -v node_modules | head -10`
Expected: every call site passes `'mock'` (matches the narrowed TransportName).

- [ ] **Step 3: Run the transport tests against the slimmer surface**

The fetch-route tests in `transport.test.ts` import `fetchTransport` directly and bypass the transport selector. They'll still pass for now (Task 5 deletes them along with fetch.ts). For this task, verify only the non-fetch tests:

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test src/lib/transport/transport.test.ts 2>&1 | tail -15`
Expected: existing tests pass. The "routes wire name to mock handler" and "rejects with ApiError shape" tests should still work — they only use the mock transport.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/lib/transport.ts
git commit -m "refactor(transport): collapse to tauri | mock (drop fetch fallback)"
```

---

## Task 5: Delete `transport/fetch.ts` + its tests

**Files:**
- Delete: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts` (delete the fetch-route tests)

The TS server is the only thing fetch.ts talked to and we're about to delete it.

- [ ] **Step 1: Delete the file**

```bash
git rm packages/ui/src/lib/transport/fetch.ts
```

- [ ] **Step 2: Strip the fetch-route tests from `transport.test.ts`**

Open `packages/ui/src/lib/transport/transport.test.ts`. There are multiple tests that do `const { fetchTransport } = await import('./fetch')` and then call `fetchTransport(...)`. Identify them by grepping:

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && grep -n "fetchTransport\|./fetch'" packages/ui/src/lib/transport/transport.test.ts`

Delete every `it(...)` block that references `fetchTransport`. Keep the tests that use only the mock transport (the ones at the top of the describe block).

The result should be a file with roughly:
- The "routes wire name to mock handler" test.
- The "propagates handler arguments to the mock" test.
- The "rejects with ApiError shape when handler throws" test.
- The "throws when no handler is registered" test.

Everything that imported `fetch` goes.

- [ ] **Step 3: Verify typecheck + remaining tests pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui exec tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

Run: `pnpm --filter @ohmyc/ui test src/lib/transport/transport.test.ts 2>&1 | tail -10`
Expected: 4 mock-only tests passing.

- [ ] **Step 4: Run the full UI test suite to catch any other fetch-arm dependence**

Run: `pnpm --filter @ohmyc/ui test 2>&1 | tail -10`
Expected: same count as Task 3's run, minus the deleted fetch-route tests. 3 pre-existing menubar failures unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(transport): delete fetch.ts + fetch-route tests (TS server goes next)"
```

---

## Task 6: Delete `packages/cli/src/server/` + its tests

**Files:**
- Delete: `packages/cli/src/server/` (entire directory)
- Delete: `packages/cli/tests/server/` (entire directory)

`launcher.ts` imports `startServer` from this directory — Task 7 deletes the launcher. To keep this commit self-contained, we temporarily break the launcher build; Task 7 fixes it.

- [ ] **Step 1: Delete the server directory**

```bash
git rm -r packages/cli/src/server packages/cli/tests/server
```

- [ ] **Step 2: Verify the failure surface is bounded**

The CLI will not compile right now (`launcher.ts` imports `./server/index`). That's expected — Task 7 deletes launcher.ts next.

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/cli exec tsc --noEmit 2>&1 | tail -10`
Expected: errors limited to `Cannot find module './server/index'` in launcher.ts and `Cannot find module '@/server/index'` in launcher-cli.test.ts. No other compile errors.

If any error is OUTSIDE those two files, stop and investigate — something else depended on the server that we missed.

- [ ] **Step 3: Commit despite the temporary CLI break**

```bash
git commit -m "feat(cli): delete TS Fastify server + its tests (launcher fixed next commit)"
```

The temporary break is justified by the next commit landing in the same PR. Reviewers can verify by checking `git diff HEAD~1..HEAD+1`.

---

## Task 7: Delete `launcher.ts`, `migrate-home.ts`, their tests

**Files:**
- Delete: `packages/cli/src/launcher.ts`
- Delete: `packages/cli/src/migrate-home.ts`
- Delete: `packages/cli/tests/launcher-cli.test.ts`
- Delete: `packages/cli/tests/migrate-home.test.ts`

With the server gone, the launcher (which orchestrated server startup + browser open) and migrate-home (which one-time migrated `~/.cui` to `~/.config/ohmyc`) are dead code. Migration happened at the `migrate-home.ts` ship in May 2026; any user installing fresh today goes directly to `~/.config/ohmyc`.

- [ ] **Step 1: Delete the files**

```bash
git rm packages/cli/src/launcher.ts packages/cli/src/migrate-home.ts packages/cli/tests/launcher-cli.test.ts packages/cli/tests/migrate-home.test.ts
```

- [ ] **Step 2: Verify the CLI still has compile errors but they're now isolated to `index.ts`**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/cli exec tsc --noEmit 2>&1 | tail -10`
Expected: errors limited to `Cannot find module './launcher'` in `packages/cli/src/index.ts`. Task 8 fixes this.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cli): delete launcher + migrate-home (TS server is gone)"
```

---

## Task 8: Trim `packages/cli/src/index.ts` to `dashboard`-only

**Files:**
- Modify: `packages/cli/src/index.ts`

Drop the `start` command, the default `[...args]` command, the `launchApp` import, and the banner. The CLI's only job now is the `dashboard` subcommand (the Claude Code capture-plugin installer).

- [ ] **Step 1: Replace the file**

Open `packages/cli/src/index.ts` and replace the contents entirely with:

```ts
#!/usr/bin/env node
// CLI entry point — only the `dashboard` subcommand remains. The OhMyC UI is
// shipped exclusively as the Tauri desktop app; this binary exists to install
// and maintain the Claude Code capture plugin that writes session data to
// ~/.claude/db.sqlite.
import { cac } from 'cac'

import {
  runDoctor,
  runIngest,
  runInstall,
  runSync,
  runUninstall,
} from './commands/dashboard.js'
import { logger } from './logger'

const cli = cac('ohmyc')

cli
  .command('dashboard', 'Manage Timeline dashboard data and plugin')
  .option('--install', 'Install the timeline plugin and run initial backfill')
  .option('--uninstall', 'Remove the timeline plugin (preserves database)')
  .option('--sync', 'Scan all transcripts and import missing sessions')
  .option('--ingest', 'Ingest a single session')
  .option('--session <id>', 'Session ID to ingest (used with --ingest)')
  .option('--file <path>', 'Path to transcript file (used with --ingest)')
  .option('--doctor', 'Diagnose plugin, hooks, and database health')
  .action(async (options) => {
    try {
      if (options.install) {
        await runInstall()
      } else if (options.uninstall) {
        await runUninstall()
      } else if (options.sync) {
        await runSync()
      } else if (options.ingest) {
        if (!options.session) {
          logger.error('--session <id> is required')
          process.exit(1)
        }
        await runIngest(options.session, options.file)
      } else if (options.doctor) {
        await runDoctor()
      } else {
        logger.info('No action specified. Use one of: --install, --uninstall, --sync, --ingest, --doctor')
        cli.outputHelp()
        process.exit(1)
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli.help()
cli.version('0.1.0')
cli.parse()
```

- [ ] **Step 2: Delete `banner.ts` (no longer referenced)**

The old `start` flow called `printBanner()` to advertise the server URL. The dashboard subcommands don't need a banner.

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && grep -rn "printBanner\|banner" packages/cli/src/ 2>&1 | grep -v node_modules`
Expected: no remaining references after Task 8 Step 1 (the new index.ts dropped the import). If `banner.ts` is referenced anywhere else, investigate before deleting.

```bash
git rm packages/cli/src/banner.ts packages/cli/tests/banner.test.ts
```

- [ ] **Step 3: Verify the CLI typechecks**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/cli exec tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: Run the CLI tests (what's left)**

Run: `pnpm --filter @ohmyc/cli test 2>&1 | tail -10`
Expected: only dashboard-related tests run. The launcher/migrate-home/banner/server tests are gone.

- [ ] **Step 5: Verify the CLI builds**

Run: `pnpm --filter @ohmyc/cli build 2>&1 | tail -15`
Expected: `tsup` produces `dist/index.mjs`. The `onSuccess` hook that copied UI assets may warn or fail — that's addressed in Task 11.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): trim to dashboard-only entrypoint (drop start + launcher + banner)"
```

---

## Task 9: Delete the timeline contract test

**Files:**
- Delete: `crates/ohmyc-core/tests/timeline_contract.rs`
- Delete: `tests/fixtures/timeline-contract/` (the workspace-level fixtures dir)

Per the spec (line 324): "Delete the contract test after the timeline slice ships and the TS reader is gone." The TS reader is now gone (Task 6).

- [ ] **Step 1: Confirm the fixtures location**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && ls tests/fixtures/timeline-contract/ 2>&1 | head -5`
Expected: lists `expected/` and `seed.sql`.

- [ ] **Step 2: Delete both**

```bash
git rm crates/ohmyc-core/tests/timeline_contract.rs
git rm -r tests/fixtures/timeline-contract
```

- [ ] **Step 3: Run the Rust tests to confirm nothing else depended on the fixtures**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core 2>&1 | grep "test result" | head -5`
Expected: lib tests still pass (232 from slice 7b merge). Integration tests count drops from 5 (contract tests) to 0.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): delete timeline contract test (TS reader is gone)"
```

---

## Task 10: Broaden the fs watcher to cover `$OHMYC_HOME/{profiles,store}/`

**Files:**
- Modify: `crates/ohmyc-core/src/watcher.rs`
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

Slice 6 and slice 7 left dormant matchers in `use-fs-changed.ts` for `<base>/store/<type>/` and the profile activation flow — they don't fire today because `default_watch_paths` only watches `~/.claude/` + the timeline DB dir. With the TS server gone (and external-process CLI activations a real possibility — the dashboard CLI may now write to `~/.config/ohmyc/profiles/.active`), the watcher should broaden.

- [ ] **Step 1: Add a failing test in `watcher.rs`**

Open `crates/ohmyc-core/src/watcher.rs`. Inside the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn default_watch_paths_includes_ohmyc_home_base() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev_db = std::env::var("OHMYC_TIMELINE_DB").ok();
        let prev_home = std::env::var("OHMYC_HOME").ok();
        std::env::set_var("OHMYC_TIMELINE_DB", "/tmp/test-db/timeline.db");
        std::env::set_var("OHMYC_HOME", "/tmp/test-ohmyc-home");
        let paths = default_watch_paths().unwrap();
        match prev_db {
            Some(v) => std::env::set_var("OHMYC_TIMELINE_DB", v),
            None => std::env::remove_var("OHMYC_TIMELINE_DB"),
        }
        match prev_home {
            Some(v) => std::env::set_var("OHMYC_HOME", v),
            None => std::env::remove_var("OHMYC_HOME"),
        }
        let path_strings: Vec<String> = paths
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        assert!(path_strings.iter().any(|p| p.contains("test-ohmyc-home")));
    }
```

If the file doesn't already have an `ENV_LOCK` import, add `use std::sync::Mutex; static ENV_LOCK: Mutex<()> = Mutex::new(());` at the top of the test module (the same pattern other modules use).

- [ ] **Step 2: Run to confirm it fails**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib watcher 2>&1 | tail -10`
Expected: the new test fails — `default_watch_paths` returns only `[db_dir, claude_home]`, no OHMYC_HOME entry.

- [ ] **Step 3: Extend `default_watch_paths`**

Find the existing `pub fn default_watch_paths()` in `watcher.rs` (currently around line 71-78). Update its body to also include the OhMyC base dir:

```rust
pub fn default_watch_paths() -> Result<Vec<PathBuf>, ApiError> {
    let db = crate::timeline::default_db_path()?;
    let db_dir = db.parent().map(|p| p.to_path_buf()).ok_or_else(|| {
        ApiError::Internal("db path has no parent".to_string())
    })?;
    let claude_home = crate::claude_home::resolve()?;
    let ohmyc_base = crate::store::base_dir()?;
    Ok(vec![db_dir, claude_home, ohmyc_base])
}
```

`crate::store::base_dir()` was the slice-5 helper that resolves `$OHMYC_HOME` (or `~/.config/ohmyc`). Confirm it's `pub` — it has been since slice 5 (`crates/ohmyc-core/src/store/mod.rs:19`).

- [ ] **Step 4: Run the test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib watcher 2>&1 | tail -10`
Expected: all watcher tests pass, including the new one.

- [ ] **Step 5: Update `FsEvent` to include the new path kind (optional)**

If the existing `FsEvent` enum has a `ClaudeHome { path }` variant and that's what the watcher emits for matches, the matchers in `use-fs-changed.ts` that check `path.includes('/store/agents/')` etc. will now actually fire — because `<base>/store/agents/<name>.md` is under the watched `<base>` tree.

No code change needed; the existing claude_home branch in the watcher already emits the `path` string verbatim and the JS matcher just substring-checks. The dormant matchers will activate.

- [ ] **Step 6: Drop the "dormant matchers" comment in use-fs-changed.ts**

Open `packages/ui/src/hooks/use-fs-changed.ts`. Find the comment block from slice 5 that says something like "Dormant matchers — the watcher's default_watch_paths does NOT include `<base>/store/` today...". Delete the comment block (3-6 lines) so the file reflects the current behavior: those matchers fire now.

- [ ] **Step 7: Run the full UI test suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/ui test 2>&1 | tail -10`
Expected: same counts as Task 5.

- [ ] **Step 8: Commit**

```bash
git add crates/ohmyc-core/src/watcher.rs packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(watcher): broaden default paths to OHMYC_HOME base (activates dormant matchers)"
```

---

## Task 11: Trim `packages/cli` package.json + tsup config

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/tsup.config.ts`

Drop server-only deps, drop `dev`/`dev:server` scripts, drop the UI-asset copy in tsup's `onSuccess`.

- [ ] **Step 1: Replace `packages/cli/package.json`**

Open `packages/cli/package.json` and replace with:

```json
{
  "name": "@ohmyc/cli",
  "version": "0.1.0",
  "type": "module",
  "files": [
    "dist",
    "README.md"
  ],
  "bin": {
    "ohmyc": "dist/index.mjs"
  },
  "scripts": {
    "build": "rimraf dist && tsup",
    "start": "node dist/index.mjs dashboard",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "pnpm build"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "dependencies": {
    "@ohmyc/shared": "workspace:*",
    "@ohmyc/timeline": "workspace:*",
    "better-sqlite3": "^11.5.0",
    "cac": "^6.7.14",
    "pino": "^10.3.1",
    "pino-roll": "^4.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^20.12.7",
    "@vitest/coverage-v8": "^3.2.4",
    "pino-pretty": "^13.1.3",
    "rimraf": "^6.1.3",
    "tsup": "^8.0.2",
    "tsx": "^4.21.0",
    "typescript": "^5.4.5",
    "vitest": "^3.2.4"
  }
}
```

Changes from the original:
- `bin`: dropped the `cui` alias (the legacy CLI name from the `~/.cui` migration era).
- `scripts`: dropped `dev`, `dev:server`, renamed `build:full` to just `build`. The `start` script now points directly at the dashboard subcommand.
- `dependencies`: dropped `@fastify/static`, `fastify`, `get-port`, `gray-matter`, `open`, `proper-lockfile`, `untildify`, `zod-to-json-schema`. Also dropped `@ohmyc/ui` from devDeps (we no longer build a bundled UI into the CLI).
- `devDependencies`: dropped `@types/proper-lockfile`.

- [ ] **Step 2: Trim `packages/cli/tsup.config.ts`**

Open `packages/cli/tsup.config.ts` and replace with:

```ts
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: false,
  clean: true,
  bundle: true,
  platform: 'node',
  target: 'node18',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: ['better-sqlite3'],
  noExternal: [
    /@[\w-]+\/[\w-]+/,
    'cac',
  ],
  onSuccess: async () => {
    // The CLI ships the Claude Code capture plugin alongside the binary so
    // `ohmyc dashboard --install` can copy it into place. The plugin source
    // lives at plugins/timeline; we copy a curated subset into dist/.
    const pluginSource = path.resolve(import.meta.dirname, '../../plugins/timeline')
    const pluginDist = path.resolve(import.meta.dirname, 'dist/plugins/timeline')

    if (existsSync(pluginSource)) {
      const allowedPaths = [
        'dist',
        'hooks',
        '.claude-plugin',
        'package.json',
        'README.md',
      ]
      cpSync(pluginSource, pluginDist, {
        recursive: true,
        filter: (source) => {
          const relative = path.relative(pluginSource, source)
          if (relative === '') {
            return true
          }
          return allowedPaths.some(allowed =>
            relative.startsWith(allowed),
          )
        },
      })
      console.log(`Copied plugin assets from ${pluginSource} to ${pluginDist}`)
    }
  },
})
```

Changes:
- Dropped server-only `noExternal` entries: `@fastify/static`, `fastify`, `get-port`, `gray-matter`, `open`, `proper-lockfile`, `untildify`, `zod-to-json-schema`.
- Dropped the UI-dist copy block (the CLI no longer ships the UI bundle).

- [ ] **Step 3: Reinstall workspace deps**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm install 2>&1 | tail -10`
Expected: success; lockfile updates to reflect the removed deps. If the install reports peer-dependency warnings on the removed packages, that's expected and harmless.

- [ ] **Step 4: Build the CLI**

Run: `pnpm --filter @ohmyc/cli build 2>&1 | tail -10`
Expected: `tsup` produces `dist/index.mjs` cleanly. The "Copied plugin assets" log line appears. No "Warning: UI dist not found" message (we deleted that branch).

- [ ] **Step 5: Smoke-test the produced binary**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && node packages/cli/dist/index.mjs --help 2>&1 | head -20`
Expected: help text shows ONLY the `dashboard` subcommand. No `start` mention.

- [ ] **Step 6: Drop `dev` from `packages/ui/package.json`**

Per the spec (line 282), `pnpm dev` against the TS server is gone. Open `packages/ui/package.json` and remove the `"dev": "vite"` script (or rename it to `"dev:fixtures"` if you want to preserve a static-fixture iteration path — but that's a follow-up; YAGNI for slice 8).

Replace:
```json
    "dev": "vite",
```
with nothing (delete the line).

- [ ] **Step 7: Verify the workspace builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm -r build 2>&1 | tail -15`
Expected: `@ohmyc/ui`, `@ohmyc/shared`, `@ohmyc/timeline`, `@ohmyc/cli`, `@ohmyc/desktop` all build. The UI build still works because `vite build` is independent of `vite dev`.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/package.json packages/cli/tsup.config.ts packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(cli): trim deps + tsup; drop ui pnpm dev (TS server is gone)"
```

---

## Task 12: Final verification — full workspace sweep + `tauri build` smoke

**Files:** none modified

This is the merge-readiness gate.

- [ ] **Step 1: Run every test suite**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui
cargo test -p ohmyc-core 2>&1 | grep "test result" | head -3
cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml 2>&1 | grep "test result" | head -3
pnpm -r test 2>&1 | tail -15
```

Expected:
- core: **232 passing** (slice 7b baseline; contract tests deleted in Task 9 but those were `integration` not `unit`, so the unit count is unchanged).
- desktop: **30 passing** (unchanged).
- ui: lower than slice-7b's 181 because Task 5 deleted the fetch-route tests (~6-8 of them) and Task 3 deleted use-store tests that exercised useStoreImport. New target: **~170 passing, 3 pre-existing menubar failures**.
- cli: only `dashboard.test.ts` runs (server/launcher/migrate-home tests gone). Count depends on what `dashboard.test.ts` covers — should be a handful.

If any test fails that wasn't in the pre-existing menubar set, stop and investigate before continuing.

- [ ] **Step 2: Full workspace build**

Run: `pnpm -r build 2>&1 | tail -15`
Expected: no errors. All packages build.

- [ ] **Step 3: Tauri build smoke (the production target)**

Run: `pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin 2>&1 | tail -20`
Expected: produces `packages/desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/...` artifacts. The binary should be ≤15 MB (per the spec line 331). The build may take 5-10 minutes on a cold cache.

Note: if you're not on aarch64-apple-darwin, swap the target to your platform or run plain `pnpm --filter @ohmyc/desktop tauri build` and let it default.

- [ ] **Step 4: Run the desktop app once and exercise activation**

This is the manual smoke that catches any remaining TS-server dependence in the runtime path:

1. Open `packages/desktop/src-tauri/target/release/bundle/macos/OhMyC.app` (or platform equivalent).
2. Verify the menubar icon appears.
3. Open the main window via the tray.
4. Navigate to Profiles. Create, activate, and deactivate a profile.
5. Navigate to Store. Verify list, get, create, update, delete still work for each entity type.
6. Verify the Explorer (`/explore/plugins`, `/explore/agents`, etc.) renders.

If any surface is broken, the bug is almost certainly that the dynamic transport `resolve()` is selecting `'mock'` instead of `'tauri'` because `VITE_TRANSPORT` wasn't baked into the production bundle. Check `packages/desktop/vite.config.ts:42` — the `'tauri'` define must still be present.

- [ ] **Step 5: Commit the merge-readiness checkpoint (optional)**

If you want a single commit on the branch that says "slice 8 verified", create an empty one:

```bash
git commit --allow-empty -m "chore: slice 8 verification — cargo + pnpm tests green, tauri build OK"
```

This makes the merge-readiness state explicit in `git log`.

- [ ] **Step 6: Merge to feat/menubar-chart with the standard slice cadence**

Per the cadence established by slices 5-7b:

```bash
git checkout feat/menubar-chart
git merge --no-ff feat/slice-8-cleanup -m "Merge branch 'feat/slice-8-cleanup' — desktop migration COMPLETE"
```

The merge commit body should call out the final state: TS server deleted, transport seam collapsed, CLI trimmed to dashboard-only, all 8 slices shipped.

---

## Self-review notes

**Spec coverage:**

Per spec line 279-282 ("Cleanup — delete `packages/cli/src/server`, `serve`, `launcher`, `migrate-home`; delete `transport/fetch.ts`; trim `packages/cli` to only the `dashboard` command; delete `pnpm dev` from `packages/ui`"):
- `packages/cli/src/server` deleted in Task 6.
- `serve` (the `start` command in cli index.ts) removed in Task 8.
- `launcher` deleted in Task 7.
- `migrate-home` deleted in Task 7.
- `transport/fetch.ts` deleted in Task 5.
- `packages/cli` trimmed to dashboard-only in Task 8 + 11.
- `pnpm dev` removed from `packages/ui` in Task 11 Step 6.

Per spec line 324 ("delete the contract test after the timeline slice ships and the TS reader is gone"):
- Timeline contract test deleted in Task 9.

Per the slice-7b scope cut ("watcher broadening for `$OHMYC_HOME/profiles/` → slice 8"):
- Watcher broadened in Task 10.

**Scope cuts documented at the top:**
- `useStoreImport` + `ImportComponentsDialog` deletion — flagged with the "If you would rather preserve bulk-import, STOP HERE" callout.
- Windows symlinks — deferred portability slice.
- `serde_json/preserve_order` — slice 7 cosmetic, YAGNI.
- CLI README/npm description — publish-time concern.

**Type consistency:**
- `TransportName` narrowed to `'tauri' | 'mock'` (Task 4) — call sites verified by grep in Task 4 Step 2.
- `store::base_dir()` referenced in Task 10 — public since slice 5, confirmed at top of Task 10 Step 3.
- `default_watch_paths()` signature unchanged — just adds a third path to the returned Vec.

**Placeholder scan:** None — every step has either complete code, a complete `rm`/`git rm` command, or an exact assertion. No "fix the build" or "address fallout" language.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-desktop-migration-slice-8-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks. Given that Tasks 6+7 leave a temporary CLI compile break and Task 12 is the manual smoke gate, a per-task subagent makes the breakpoint discipline easy.

**2. Inline Execution** — `executing-plans` skill in this session.

Which approach?

(**If you want to preserve bulk-import**, redirect now — say "write slice 8a to port useStoreImport" and I'll draft the import-port mini-slice first. This cleanup slice can then run as slice 8b without touching the import dialog.)
