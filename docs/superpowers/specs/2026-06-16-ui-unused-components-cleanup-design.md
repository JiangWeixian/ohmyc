# UI Unused Components Cleanup Design

## Goal

Remove unused component files from `packages/ui/src/components` based on current monorepo usage while keeping the package easy to extend.

The cleanup should reduce stale inventory code without changing the supported route behavior, desktop integration, or the broad `@ohmyc/ui/components/*` subpath export pattern.

## Context

`@ohmyc/ui` is a private workspace package. Its `package.json` exports a broad component surface:

```json
"./components/*": "./src/components/*.tsx"
```

`packages/desktop` currently imports only one component subpath directly:

```ts
import { MenubarPage } from '@ohmyc/ui/components/menubar/menubar-page'
```

The desktop app also imports `@ohmyc/ui/app` and `@ohmyc/ui/globals.css`. No other `@ohmyc/ui/components/*` consumers were found in the monorepo.

## Decisions

Keep `./components/*` unchanged. It remains a broad subpath export so adding future components does not require editing `package.json`.

Delete component files that have zero inbound imports inside the monorepo. This includes inventory-style UI primitives and unused helper files under `packages/ui/src/components`.

Do not delete the store editor subgraph in this cleanup. It is not connected to the current runtime route tree, but it has tests and internal dependencies. Treat it as a separate product decision.

Do not change route behavior. The existing `App`, `Explorer`, `settings`, `timeline`, and `menubar` runtime chains should remain intact.

## Deletion Scope

The cleanup targets zero-reference files identified under `packages/ui/src/components`, including:

- `json-editor.tsx`
- `settings/ui/button.tsx`
- `settings/ui/input.tsx`
- `settings/ui/select.tsx`
- `settings/ui/toggle.tsx`
- `settings/utils.ts`
- `ui/avatar.tsx`
- `ui/checkbox.tsx`
- `ui/dialog.tsx`
- `ui/hover-card.tsx`
- `ui/keyboard-shortcuts-panel.tsx`
- `ui/keyboard-shortcuts.tsx`
- `ui/password-input.tsx`
- `ui/quick-actions.tsx`
- `ui/scroll-area.tsx`
- `ui/separator.tsx`
- `ui/Skeleton.tsx`
- `ui/slider.tsx`
- `ui/textarea.tsx`
- `ui/Toast.tsx`
- `ui/tooltip.tsx`
- `uitripled/index.ts`

Before deleting, re-run a focused reference check for these exact files. If a file has gained a runtime or test reference, remove it from the deletion set.

## Preserved Scope

Keep the current runtime chains:

- `App` and command palette
- `Explorer` and sidebar-driven views
- `timeline` components
- `menubar` components, especially `menubar/menubar-page.tsx`
- settings components currently imported by `Explorer`
- shared UI primitives still referenced by preserved components
- `uitripled/native-button.tsx` and `uitripled/native-dialog.tsx`

Keep the store editor subgraph for now:

- `store/store-component-list.tsx`
- `store/store-component-editor.tsx`
- `store/model-config-editor.tsx`
- `store/delete-confirm-dialog.tsx`
- `markdown-editor.tsx`
- transitive helpers used only by that subgraph

## Architecture And Data Flow

This cleanup does not introduce new architecture. It removes unreachable leaves from the existing component graph.

Imports continue to flow from `App` into `Explorer`, from `Explorer` into active feature components, and from `packages/desktop` into `@ohmyc/ui/app`, `@ohmyc/ui/globals.css`, and `@ohmyc/ui/components/menubar/menubar-page`.

Because the subpath export remains broad, future components can still be added under `src/components` without package manifest changes.

## Error Handling

There is no runtime error handling change. The main risk is deleting a component that is referenced through an alias or a non-obvious consumer.

Mitigation:

- use an alias-aware reference check before deletion
- run UI tests after deletion
- run TypeScript checks for `packages/ui`
- check desktop type/build coverage where available, because desktop is the known external consumer of `@ohmyc/ui`

## Testing

Run these checks after implementation:

```bash
pnpm exec tsc --noEmit -p packages/ui/tsconfig.json
pnpm --filter @ohmyc/ui test
```

Also run the narrow tests most likely to catch accidental component graph damage:

```bash
pnpm --filter @ohmyc/ui exec vitest run tests/app.routes.test.tsx tests/explorer.inventory.test.tsx tests/components/menubar
```

Run the desktop verification command that exists in the repo at implementation time. If no non-writing desktop typecheck command exists, document that gap.

`pnpm --filter @ohmyc/ui lint` currently fails due to a `tailwindcss/classnames-order` ESLint plugin API crash. That should be recorded as an existing tooling issue rather than treated as a failure caused by this cleanup.

## Out Of Scope

- Removing the store editor feature/subgraph
- Changing `@ohmyc/ui` subpath export patterns
- Removing dependencies from `package.json`
- Fixing the existing ESLint Tailwind plugin crash
- Changing settings route behavior
