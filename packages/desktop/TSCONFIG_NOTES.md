# tsconfig path mapping notes

## `@/*` alias collision (known sharp edge)

- `tsconfig.json` maps `@/* → ../ui/src/*` so `tsc` can resolve transitive `@/`
  imports inside `packages/ui` source when it follows our `@ohmyc/ui/*` paths
  during type-checking.
- `vite.config.ts` maps `@ → ./src` so runtime imports point at desktop's own
  source.

This means `import x from '@/foo'` inside `packages/desktop/src/` resolves
DIFFERENTLY in `tsc` (→ `packages/ui`) and Vite (→ `packages/desktop`). Build
and type-check would diverge silently.

## Workaround in this slice

**Do NOT use `@/...` imports inside `packages/desktop/src/`.** Use relative
paths (`./menubar`, `../foo`) for desktop-local imports. The `@ohmyc/ui/*`
subpath imports for cross-package consumption work correctly (no collision —
those go through `paths` mapped to specific subdirs).

## Proper fix (deferred)

When the chart slice lands, migrate `packages/ui` to a composite TS project:

1. Add `"composite": true`, `"declarationDir": "dist/types"` to
   `packages/ui/tsconfig.json`.
2. Add `"references": [{ "path": "../ui" }]` to
   `packages/desktop/tsconfig.json`.
3. Remove the `@/* → ../ui/src/*` path entry — desktop's `tsc` will then see
   `@ohmyc/ui` only as opaque `.d.ts` declarations and never traverse ui
   source, so the alias collision disappears.
