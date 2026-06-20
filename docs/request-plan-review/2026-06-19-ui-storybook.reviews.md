# Automated Reviews

Source: `docs/superpowers/plans/2026-06-19-ui-storybook.md`

Reviewers detected: `claude`, `codex`, `opencode`. (`gemini`, `qwen` not installed.)

---

## Reviewer: claude

Reviewer failed: claude CLI authentication failed (401 Invalid authentication credentials). Automated review not run for this reviewer.

---

## Reviewer: codex

### Finding: Invalid RenderBadge fixture kinds
Severity: high
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:483-486
Quote:
> { kind: 'model', label: 'opus' },

Comment:
`RenderBadge.kind` in the current shared type is `mono | pill`, so `model` and `tool` will fail TypeScript in Task 2. Change these fixture values to valid `RenderBadge` kinds, or explicitly include a preceding shared-type change in the plan.

### Finding: Missing required design context step
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:52-62
Quote:
> ## Task 1: Install Storybook And Add The Config Skeleton

Comment:
The plan starts implementation without telling workers to read `PRODUCT.md` and `DESIGN.md`, even though this repo requires those before product, UX, or visual work. Add an initial step before Storybook/story creation to read both files and treat conflicts as doc-first changes.

### Finding: Menubar fixtures will age out
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:577-590
Quote:
> { date: '2026-06-15', value: 5000 },

Comment:
The menubar components derive their visible range from the runtime date, but these fixtures use fixed June 2026 dates. Stories may become blank when the plan is executed later. Freeze `Date` in Storybook tests/stories or generate the fixture dates relative to the current 16-week window.

### Finding: MDX import dependency is not declared
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:1658
Quote:
> import { Meta } from '@storybook/blocks'

Comment:
`Intro.mdx` imports `@storybook/blocks`, but the dependency install step does not add that package directly. With pnpm strict resolution this can break `build-storybook`. Add `@storybook/blocks` to the Task 1 dev dependency install list or avoid importing it directly.

---

## Reviewer: opencode

### Finding: Missing `@lobehub` Vite inlining workaround in Storybook config
Severity: high
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:139-160
Quote:
> async viteFinal(config) {
>   config.assetsInclude = [ ... ]
>   config.resolve = { ...alias... }
>   config.server = { ...proxy... }

Comment:
The existing `packages/ui/vitest.config.ts:28-34` explicitly inlines `/@lobehub\/(ui|icons)/` with a comment that lobehub "ships ESM Node can't load directly (JSON imports without `type: json` attributes); inline it so Vite transforms it instead." `packages/ui/src/components/timeline/event-list.tsx:4-5` imports `@lobehub/icons/es/Claude` and `OpenCode`, so every story that renders `EventList`, `TimelineView`, or `MenubarPage` (Tasks 5 and 6) pulls lobehub through Vite. Neither `.storybook/main.ts` `viteFinal` nor the `storybook` project in `vitest.workspace.ts` (lines 263-292) adds `optimizeDeps.include` / `ssr.noExternal` / `server.deps.inline` for `@lobehub`. `build-storybook` and `test:storybook` will very likely fail with the same JSON-import error the jsdom config was written to work around. Fix: in `viteFinal`, add `config.optimizeDeps = { ...config.optimizeDeps, include: ['@lobehub/ui', '@lobehub/icons'] }` (and/or `config.ssr = { noExternal: [/@lobehub\/(ui|icons)/] }`), and mirror the `server.deps.inline` pattern from the existing `vitest.config.ts`. Add a verification story that renders `EventList` to Task 1 smoke checks so this regressions loudly.

### Finding: `getBoundingClientRect` override harms fidelity in real Chromium browser mode
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:222-240
Quote:
> beforeAll(() => {
>   const originalGetBCR = Element.prototype.getBoundingClientRect
>   Element.prototype.getBoundingClientRect = function () {
>     return { ... width: 720, height: 360 ... } as DOMRect
>   }

Comment:
This mock is helpful in jsdom (where BCR returns zeroes), but the `storybook` Vitest project runs in **Playwright Chromium** (`test.browser.provider: 'playwright'`, lines 282-289), where `getBoundingClientRect` works natively. Forcing every element to a fixed 720×360 rect will break positioning math for Radix portals (`Select`, `DropdownMenu`, `NativeDialog`), Recharts (`DualLineChart`), and the `ContributionGraph` hover coordinates (`contribution-graph.tsx:63-69` uses real BCR for hover x/y). The returned teardown is also registered via `beforeAll`'s return value, which only runs at `afterAll`, so the mock stays active for every story. Recommendation: drop the BCR override entirely in browser mode (rely on native Chromium layout), or gate it behind an environment check so it only applies under jsdom.

### Finding: Vague edit instruction for `MonitorSpikeView` WebGL fallback
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:1686
Quote:
> If `MonitorSpikeView` fails in browser tests because WebGL assets cannot initialize, set `tags: ['!test', 'experimental']` only on `Default` and re-run `test:storybook`

Comment:
The instruction doesn't specify the exact code change. `Default` is currently declared as `export const Default: Story = {}` (line 1650). An executing agent could (a) mutate `Default.tags = ['!test', 'experimental']` after the export, (b) convert it to an object literal, or (c) replace the meta-level tags — and each has different semantics around `autodocs` inheritance. Also, `['!test', 'experimental']` does not carry `autodocs`, so the story would drop out of docs unintentionally. Specify the concrete edit, e.g. "append `Default.tags = ['!test', 'experimental', 'autodocs']` after the export," and state the expected `test:storybook`/`build-storybook` outcomes after the change.

### Finding: Storybook (and addon) versions are unpinned, risking API drift
Severity: medium
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:79
Quote:
> pnpm --filter @ohmyc/ui add -D storybook @storybook/react-vite @storybook/addon-docs @storybook/addon-a11y @storybook/addon-vitest @storybook/test @vitest/browser playwright

Comment:
No version specifiers are given. `storybook` resolves to latest (9.x at time of writing); the plan hard-codes assumptions that have churned between Storybook 8 and 9 — `storybookTest` from `@storybook/addon-vitest/vitest-plugin` (line 256), `Meta`/`StoryObj`/`Preview`/`Decorator` from `@storybook/react-vite`, and `import { Meta } from '@storybook/blocks'` in `Intro.mdx` (line 1658). A mismatched major version will fail Task 1 Steps 11-12 with no recovery path documented. Pin a known-compatible version range (e.g. `storybook@^9`) across all `@storybook/*` packages, or add an explicit Step 0 that checks the installed `storybook` version against the APIs used and aborts on mismatch.

### Finding: `test` script is silently modified, contradicting "keeping the existing scripts"
Severity: low
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:96-110
Quote:
> Edit `packages/ui/package.json` so the `scripts` object includes these exact entries while keeping the existing scripts:
> "test": "vitest run --config vitest.config.ts",

Comment:
The current script in `packages/ui/package.json` is `"test": "vitest run"` (no `--config`). The step rewrites it to `vitest run --config vitest.config.ts`. Behaviorally near-equivalent (Vitest auto-discovers `vitest.config.ts`), but the wording "while keeping the existing scripts" misrepresents a modification as preservation, which makes review diffing harder. Either keep `test` byte-identical or explicitly note that `--config` is being added and why.

### Finding: File Structure summary disagrees with Step 9 on `tsconfig.json` include
Severity: low
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:32
Quote:
> - Modify: `packages/ui/tsconfig.json`
>   - Include `.storybook` and `src/stories` TypeScript files.

Comment:
The File Structure blurb says to include `.storybook` and `src/stories`, but `src/stories` is already covered by the existing `"include": ["src"]`, and Step 9 (lines 296-308) actually adds `["src", ".storybook", "vitest.workspace.ts"]` — it does not add `src/stories` and it does add `vitest.workspace.ts`, which the summary omits. Update the summary to match Step 9 so an agent skimming the File Structure section doesn't make a different edit.

### Finding: Exported helpers/fixtures are never referenced by any story
Severity: note
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:405-409
Quote:
> export const withDarkCanvas: Decorator = Story => ( ... )

Comment:
`withDarkCanvas` (lines 405-409), `StorySurface` (lines 452-461), and `emptyTimelineEventsResponse` (lines 645-647) are created and exported but no story in Tasks 3-7 uses them (the global decorator in `preview.tsx` already provides the dark canvas, so `withDarkCanvas` is redundant). The plan's lint step (Task 8 Step 5) runs with `--max-warnings 0`; unused exports may or may not trip the current ESLint config, but they are dead weight that a future reader must maintain. Either wire each into at least one story or drop them from Task 2.

### Finding: CI integration is referenced but never wired
Severity: note
Location: docs/superpowers/plans/2026-06-19-ui-storybook.md:17
Quote:
> - Storybook testing in CI docs: https://storybook.js.org/docs/writing-tests/in-ci

Comment:
The References section links the CI docs, and the goal statement frames this as a "test foundation," but no task adds `test:storybook` or `build-storybook` to any GitHub Actions workflow / CI config. If CI wiring is intentionally out of scope for this plan, say so explicitly in the Self-Review; otherwise add a Task that updates the relevant workflow so the new `test:storybook` script actually runs on PRs.
