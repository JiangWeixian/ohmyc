# tsconfig path mapping notes

## `@/*` alias collision (known sharp edge)

`packages/ui` uses `@/` internally to alias its own `src/` root. When
`packages/desktop` consumes ui components via workspace + subpath exports,
both tools see the `@/` from inside ui source files and need to resolve
them — but to ui's tree, not desktop's tree.

### tsc layer

`packages/desktop/tsconfig.json` maps `@/* → ../ui/src/*`. This lets tsc
resolve transitive `@/` imports inside ui source files when it follows
the `@ohmyc/ui/*` paths during type-checking. tsc still sees the alias
collision at the type-check level: an `@/...` import inside
`packages/desktop/src/` would also resolve into ui — but the Vite
runtime resolution disagrees (see below), so type-check + runtime are
no longer in sync.

### Vite layer (current solution)

`packages/desktop/vite.config.ts` registers a context-aware
`uiAliasPlugin` that runs with `enforce: 'pre'`. It resolves `@/` based
on the importer:

- If the importer is inside `packages/ui/src/` → `@/` resolves into
  `packages/ui/src/` (preserves ui's internal aliasing).
- Otherwise → `@/` resolves into `packages/desktop/src/` (desktop's own
  source).

This makes Vite correctly serve both packages at build time. At type
check time, tsc's mapping still treats desktop's `@/` as ui's tree —
which is the residual collision.

## Practical guidance for desktop contributors

Inside `packages/desktop/src/`, prefer relative imports (`./foo`,
`../foo`) for desktop-local files. Vite will route any `@/` correctly,
but tsc will still report types from ui's tree for that path, which
will confuse you. Reserve `@/` for ui-internal use only.

## Proper fix (deferred)

When the chart slice's debt accumulates further, migrate `packages/ui`
to a composite TS project:

1. Add `"composite": true` and `"declarationDir": "dist/types"` to
   `packages/ui/tsconfig.json`.
2. Add `"references": [{ "path": "../ui" }]` to
   `packages/desktop/tsconfig.json`.
3. Remove the `@/* → ../ui/src/*` path entry from desktop's tsconfig.
4. Remove the `uiAliasPlugin` from `packages/desktop/vite.config.ts`
   (desktop will then resolve `@/` only to its own source, with `@ohmyc/ui`
   treated as opaque declarations).

After migration: tsc treats `@ohmyc/ui` as opaque .d.ts declarations and
never traverses ui source. Both the tsc path mapping and the Vite plugin
become unnecessary. The collision disappears entirely.
