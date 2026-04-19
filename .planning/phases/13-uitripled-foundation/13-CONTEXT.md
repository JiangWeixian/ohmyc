# Phase 13: uitripled Foundation - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 installs uitripled (shadcn-based) component library infrastructure into `packages/ui`: peer dependencies, copied primitives, design token mappings, path aliases, and a verified React 19 + Tailwind v3 compatibility baseline. No existing components are modified or replaced in this phase — Phase 13 is purely additive infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Path Alias Setup
- **D-01:** Add `@` → `src/` path alias in both `packages/ui/tsconfig.json` (compilerOptions.paths) and `packages/ui/vite.config.ts` (resolve.alias). Note: `vitest.config.ts` already has this alias. uitripled components use `@/lib/utils` imports — the alias allows them to work unchanged.
- **D-02:** Create `packages/ui/tsconfig.json` (does not currently exist). Content: base compiler options with `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`.

### cn() Utility Location
- **D-03:** Move `cn()` from `src/components/cn.ts` to `src/lib/utils.ts`. Update all 28 existing imports across the codebase from relative paths (`'../cn'`, `'./cn'`, `'../../cn'`) to `'@/lib/utils'` or appropriate relative paths. Delete the old `src/components/cn.ts`. This unifies the utility location and matches the shadcn convention that uitripled components expect.
- **D-04:** 28 files need import path updates. Full list:
  - `src/Explorer.tsx` — `'./components/cn'` → `'@/lib/utils'`
  - `src/components/ui/CommandPalette.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ui/HoverCard.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ui/QuickActions.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ui/KeyboardShortcutsPanel.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ui/Toast.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ui/Skeleton.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/settings/ui/Toggle.tsx` — `'../../cn'` → `'@/lib/utils'`
  - `src/components/settings/ui/Select.tsx` — `'../../cn'` → `'@/lib/utils'`
  - `src/components/settings/ui/Input.tsx` — `'../../cn'` → `'@/lib/utils'`
  - `src/components/settings/ui/Button.tsx` — `'../../cn'` → `'@/lib/utils'`
  - `src/components/settings/SettingsSidebar.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/store/ModelConfigEditor.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/store/ImportComponentsDialog.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/store/DeleteConfirmDialog.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/store/StoreComponentEditor.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/store/StoreComponentList.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ProfileEditor.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ProfileCard.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ProfilesSidebar.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ConfirmSwitchDialog.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ActivateConfirmDialog.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/PluginPicker.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ComponentPicker.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/profiles/ActivationBlockedDialog.tsx` — `'../cn'` → `'@/lib/utils'`
  - `src/components/ViewSwitcher.tsx` — `'./cn'` → `'@/lib/utils'`
  - `src/components/Sidebar.tsx` — `'./cn'` → `'@/lib/utils'`
  - `src/components/EntityCard.tsx` — `'./cn'` → `'@/lib/utils'`

### Radix UI Version Strategy
- **D-05:** Install the exact Radix UI versions that uitripled's `package.json` specifies. These are proven to work together. Full list of required Radix packages:
  - `@radix-ui/react-slot: ^1.2.3`
  - `@radix-ui/react-dialog: ^1.1.15`
  - `@radix-ui/react-avatar: ^1.1.11`
  - `@radix-ui/react-checkbox: ^1.3.3`
  - `@radix-ui/react-dropdown-menu: ^2.1.16`
  - `@radix-ui/react-separator: ^1.1.8`
  - `@radix-ui/react-slider: ^1.3.6`
  - `@radix-ui/react-switch: ^1.2.6`
  - `@radix-ui/react-select: ^2.2.6`
  - `@radix-ui/react-tooltip: ^1.2.8`
  - `@radix-ui/react-tabs: ^1.1.13`

### CVA Dependency
- **D-06:** Install `class-variance-authority: ^0.7.1` into `packages/ui`. Required by uitripled's Button and Badge components which use `cva()` for variant definitions.

### React 19 Upgrade
- **D-07:** Upgrade React from ^18.2.0 to ^19.0.0 across `packages/ui`. This is a scope expansion from the original plan, driven by the uitripled peer dependency requirement. Changes:
  - `react: ^18.2.0` → `^19.0.0`
  - `react-dom: ^18.2.0` → `^19.0.0`
  - `@types/react: ^18.2.66` → `^19.0.0`
  - `@types/react-dom: ^18.2.22` → `^19.0.0`
  - `@testing-library/react: ^16.3.0` — verify compatibility (v16 supports React 19)
- **D-08:** CLI and shared packages have no React dependencies — no changes needed there. Only `packages/ui` requires the upgrade.
- **D-09:** Run full test suite after upgrade to catch any React 19 breaking changes (e.g., removed APIs, changed ref forwarding behavior, strict mode changes).

### "use client" Directives
- **D-10:** Keep `"use client"` directives in copied uitripled components. They are harmless in Vite (ignored by non-Next.js bundlers) and removing them creates unnecessary diff from source.

### Component Copy Strategy
- **D-11:** Copy uitripled primitives from `vendor/uitripled/packages/components/react-shadcn/src/ui/` to `packages/ui/src/components/ui/` using the shadcn copy pattern. 19 base primitives needed: button, card, badge, input, textarea, select, switch, tabs, dialog, dropdown-menu, tooltip, label, separator, scroll-area, avatar, slider, checkbox, animated-checkbox, password-input.
- **D-12:** Each copied component retains its `import { cn } from "@/lib/utils"` import unchanged (works via D-01 alias).
- **D-13:** Establish barrel re-export at `packages/ui/src/components/uitripled/index.ts` for all primitives.

### Design Token Mapping (Phase 13-02)
- **D-14:** Add shadcn CSS custom properties to `globals.css :root` alongside existing ClaudeUI tokens. Do NOT remove or modify any existing `--surface-*`, `--border-*`, `--text-*`, `--accent-*` tokens. Both token systems coexist.
- **D-15:** Map ClaudeUI hex values to HSL channel values (without `hsl()` wrapper) for the `hsl(var(--token))` Tailwind pattern. See ROADMAP Phase 13 design token mapping reference.
- **D-16:** Extend `tailwind.config.js` theme colors with full shadcn token set (card, popover, primary, secondary, muted, accent, destructive, border, input, ring).
- **D-17:** ClaudeUI is dark-only — define shadcn tokens only in `:root`, no `.dark` class.

### Agent's Discretion
- Exact tsconfig.json compiler options (target, module, jsx settings)
- Order of dependency installation (all at once vs incremental)
- Whether to use `npx shadcn@latest init/add` CLI or manual copy from vendor directory
- Test structure and naming conventions within the smoke test suite
- Whether animated uitripled components (animated-sidebar, animated-dialog, etc.) are installed in Phase 13 or deferred to Phase 14 when they're first needed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Path alias infrastructure
- `packages/ui/vite.config.ts` — needs `resolve.alias` for `@`
- `packages/ui/vitest.config.ts` — already has `@` alias (reference implementation)
- `packages/ui/tsconfig.json` — needs creation with paths config

### cn() utility migration
- `packages/ui/src/components/cn.ts` — current location (to be moved to `src/lib/utils.ts`)
- All 28 files listed in D-04 need import path updates

### Design token mapping
- `packages/ui/src/globals.css` — existing ClaudeUI tokens (lines 8-45), add shadcn tokens here
- `packages/ui/tailwind.config.js` — current config with partial color definitions

### uitripled source components (read-only reference)
- `vendor/uitripled/packages/components/react-shadcn/src/ui/*.tsx` — 19 component source files
- `vendor/uitripled/packages/components/react-shadcn/package.json` — dependency list (Radix UI versions, CVA)
- `vendor/uitripled/packages/config/tailwind-config/src/theme.css` — shadcn theme reference (oklch, use as reference only — ClaudeUI uses hex)

### Current hand-built components (unchanged in Phase 13)
- `packages/ui/src/components/settings/ui/Button.tsx` — uses framer-motion + cn, will be replaced in Phase 15
- `packages/ui/src/components/SourceBadge.tsx` — inline styles, will be replaced in Phase 14

### Project context
- `.planning/PROJECT.md` — Key Decisions table (uitripled decisions already logged)
- `.planning/ROADMAP.md` — Phase 13 design token mapping reference table
- `.planning/REQUIREMENTS.md` — FOUND-01 through FOUND-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **cn() utility** at `src/components/cn.ts` — identical to uitripled's `cn()`. Moving to `src/lib/utils.ts` unifies both.
- **tailwindcss-animate** already installed — uitripled components use `animate-in`, `fade-in-0`, etc. classes from this plugin.
- **clsx + tailwind-merge** already installed — core of the `cn()` utility.
- **lucide-react** already installed — uitripled components import icons from it.
- **framer-motion** already installed — uitripled animated components depend on it.
- **vitest.config.ts** already has `@` path alias — proves the pattern works.

### Established Patterns
- **Component structure**: `src/components/{category}/{Component}.tsx` — uitripled primitives go in `src/components/ui/`, animated variants in `src/components/uitripled/`.
- **cn() usage**: Every component imports `cn` for conditional class merging. Currently from `../cn` or `../../cn` — migrating to `@/lib/utils`.
- **CSS tokens in :root**: All design tokens are CSS custom properties in `globals.css :root`. shadcn tokens are added to the same block.

### Integration Points
- `packages/ui/src/lib/` directory does not yet exist — needs creation for `utils.ts`.
- `packages/ui/tsconfig.json` does not yet exist — needs creation for IDE path resolution and `tsc --noEmit`.
- React 19 upgrade only affects `packages/ui` — CLI and shared have no React deps.

### React 19 Upgrade Considerations
- `forwardRef` still works in React 19 but may show deprecation warnings — uitripled components use `React.forwardRef` extensively.
- `React.ElementRef` and `React.ComponentPropsWithoutRef` types may need updates for React 19 types.
- `@testing-library/react` v16 supports React 19.
- framer-motion v12 supports React 19.

</code_context>

<specifics>
## Specific Ideas

- The `cn()` move is a single write + 28 find-replace operations. Use `replaceAll` to update import paths efficiently — each path pattern (`from '../cn'`, `from '../../cn'`, `from './cn'`, `from './components/cn'`) is distinct enough for safe replacement.
- React 19 upgrade is best done as the first step of 13-01, before any Radix UI installs, so pnpm doesn't flag peer dep conflicts during install.
- If `npx shadcn@latest init` fails due to pnpm workspace detection issues, fall back to manual copy from `vendor/uitripled/packages/components/react-shadcn/src/ui/` — the source is already available locally.

</specifics>

<deferred>
## Deferred Ideas

- **React 19 ref as prop**: React 19 allows passing ref as a regular prop without `forwardRef`. Phase 16 (Polish) can refactor uitripled components to use this pattern, but Phase 13 keeps them as-is.
- **Animated uitripled components** (animated-sidebar, animated-dialog, etc.): May be installed in Phase 13 if time permits, but only the base 19 primitives are required for Phase 14 start.
- **Tailwind v4 upgrade**: Out of scope per REQUIREMENTS.md. Phase 13 validates Tailwind v3 compatibility only.

</deferred>

---

*Phase: 13-uitripled-foundation*
*Context gathered: 2026-04-19*
