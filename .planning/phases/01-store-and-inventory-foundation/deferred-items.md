## Deferred Items

### Out-of-scope test failures observed during 01-03 execution

- `packages/ui/src/hooks/__tests__/usePlugins.test.tsx`
  Current assertions expect normalized numeric component counts and `enabled` defaults, but the current hook output renders raw component arrays and omits `enabled` for sparse plugin data.

- `packages/ui/src/__tests__/Explorer.inventory.test.tsx`
  The `shows the current environment summary for read-only config sections` assertion uses a single `getByText('Hooks')`, but the current Explorer UI renders multiple matching `Hooks` labels.
