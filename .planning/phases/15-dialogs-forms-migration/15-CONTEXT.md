# Phase 15: Dialogs & Forms Migration - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 migrates all dialog components (6), form/settings primitives (4), editor components (3), GeneralSettings, CommandPalette, and Toast from hand-built implementations to uitripled/shadcn primitives. The app must remain visually identical after migration — this is structural refactoring, not visual redesign.

Dead code removal and accessibility audit are Phase 16 scope.

</domain>

<decisions>
## Implementation Decisions

### Dialog Migration
- **D-01:** All dialogs use NativeDialog (Radix + framer-motion) from `@/components/uitripled/native-dialog`. This includes the 5 profile/store dialogs (ConfirmSwitchDialog, ActivateConfirmDialog, ActivationBlockedDialog, ImportComponentsDialog, DeleteConfirmDialog) and KeyboardShortcutsPanel.
- **D-02:** Extract shared code before migration. `truncateUrl()` helper (duplicated in ConfirmSwitchDialog and ActivateConfirmDialog) moves to a shared util. Model-config-change rendering (duplicated across both) extracts to a shared component.
- **D-03:** Each dialog keeps its existing props interface. Internal implementation swaps from hand-rolled backdrop (`fixed inset-0 bg-black/60`) to NativeDialogOverlay + NativeDialogContent.

### Form Primitives
- **D-04:** All form primitives switch to CSS-only animations (shadcn standard). No framer-motion micro-interactions (spring scale, animated toggle thumb, staggered dropdown items).
- **D-05:** Replace settings/ui/ files in-place. Each file (Button.tsx, Input.tsx, Select.tsx, Toggle.tsx) becomes a re-export or thin wrapper around the shadcn equivalent. Consumers keep their existing imports.
- **D-06:** Use NativeButton (from `@/components/uitripled/native-button`) for all button needs. Direct import — no wrapper in settings/ui/Button. Update all consumers to import from `@/components/uitripled` or `@/components/ui/button`. Variant mapping: `primary→default`, `danger→destructive`, `secondary→secondary`, `ghost→ghost`.
- **D-07:** NativeButton already provides `loading` prop with pulse animation. No additional loading wrapper needed.

### Command Palette
- **D-08:** Install `cmdk` npm package and rebuild CommandPalette using the cmdk library. cmdk provides accessible search, keyboard navigation, and filtering out of the box (shadcn pattern).
- **D-09:** Wrap the cmdk-based CommandPalette in NativeDialog for the overlay/modal behavior. The Cmd+K trigger and context API (CommandPaletteProvider, useCommandPalette) remain the same.

### Toast
- **D-10:** Replace custom Toast with Sonner (`sonner` npm package). Sonner provides toast notifications with a similar imperative API (`toast.success()`, `toast.error()`, etc.) and is the shadcn-recommended toast solution.
- **D-11:** Update all `useToast()` call sites to use Sonner's `toast` function directly. The ToastProvider and ToastContext are replaced by Sonner's `<Toaster />` component.

### Editor & Settings Migration
- **D-12:** Direct swap per editor — each editor (ProfileEditor, StoreComponentEditor, ModelConfigEditor) replaces bare `<input>`, `<textarea>`, `<button>` elements with shadcn Input, Textarea, and NativeButton. No shared form layout abstraction.
- **D-13:** GeneralSettings replaces settings/ui primitive imports with shadcn equivalents. Input → shadcn Input + Label, Select → shadcn Select composable, Toggle → shadcn Switch + Label, Button → NativeButton.
- **D-14:** Add `<Label>` from `@/components/ui/label` to all form controls that currently lack explicit labels.
- **D-15:** ProfileEditor's bare `<select>` for model config becomes shadcn Select composable (SelectTrigger, SelectContent, SelectItem).

### Agent's Discretion
- Exact cmdk component structure and styling for the rebuilt CommandPalette
- Sonner theme/styling configuration to match ClaudeUI dark theme
- Whether to keep the `settings/ui/` directory after migration or delete it
- How to handle the variant mapping differences in individual button instances
- JsonEditor and ComponentPicker/PluginPicker remain unchanged (they're custom, not form primitives)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dialog primitives (installed in Phase 13)
- `packages/ui/src/components/uitripled/native-dialog.tsx` — NativeDialog with framer-motion (128 lines, Radix-based)
- `packages/ui/src/components/ui/dialog.tsx` — shadcn Dialog with CSS animations (NOT used per D-01, but available for reference)

### Form primitives (installed in Phase 13)
- `packages/ui/src/components/ui/input.tsx` — shadcn Input (20 lines, base-ui)
- `packages/ui/src/components/ui/textarea.tsx` — shadcn Textarea (18 lines)
- `packages/ui/src/components/ui/select.tsx` — shadcn Select composable (199 lines, base-ui)
- `packages/ui/src/components/ui/switch.tsx` — shadcn Switch (32 lines, base-ui)
- `packages/ui/src/components/ui/label.tsx` — shadcn Label (20 lines)
- `packages/ui/src/components/ui/button.tsx` — shadcn Button (60 lines, base-ui, CVA variants)
- `packages/ui/src/components/uitripled/native-button.tsx` — NativeButton with loading/glow (88 lines, wraps shadcn Button)

### Components being migrated — Dialogs
- `packages/ui/src/components/profiles/ConfirmSwitchDialog.tsx` — Switch confirmation (133 lines)
- `packages/ui/src/components/profiles/ActivateConfirmDialog.tsx` — Activation confirmation (97 lines)
- `packages/ui/src/components/profiles/ActivationBlockedDialog.tsx` — Blocked activation (58 lines)
- `packages/ui/src/components/store/ImportComponentsDialog.tsx` — Import dialog (145 lines)
- `packages/ui/src/components/store/DeleteConfirmDialog.tsx` — Delete confirmation (54 lines)
- `packages/ui/src/components/ui/KeyboardShortcutsPanel.tsx` — Shortcuts display (98 lines, framer-motion)

### Components being migrated — Settings primitives
- `packages/ui/src/components/settings/ui/Button.tsx` — Custom button with loading (91 lines, framer-motion)
- `packages/ui/src/components/settings/ui/Input.tsx` — Custom input with label/error (59 lines, framer-motion)
- `packages/ui/src/components/settings/ui/Select.tsx` — Custom dropdown (114 lines, framer-motion)
- `packages/ui/src/components/settings/ui/Toggle.tsx` — Custom toggle (64 lines, framer-motion)

### Components being migrated — Editors
- `packages/ui/src/components/profiles/ProfileEditor.tsx` — Profile form (373 lines, bare HTML elements)
- `packages/ui/src/components/store/StoreComponentEditor.tsx` — Component editor (178 lines, bare HTML)
- `packages/ui/src/components/store/ModelConfigEditor.tsx` — Model config form (176 lines, bare HTML)
- `packages/ui/src/components/settings/GeneralSettings.tsx` — Settings page (219 lines, uses settings/ui primitives)

### Components being migrated — Utilities
- `packages/ui/src/components/ui/CommandPalette.tsx` — Command palette (272 lines, framer-motion)
- `packages/ui/src/components/ui/Toast.tsx` — Toast system (125 lines, framer-motion, imperative API)

### Consuming components
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Uses ConfirmSwitchDialog, ActivateConfirmDialog, ActivationBlockedDialog (useActivationFlow hook)
- `packages/ui/src/components/store/StoreComponentEditor.tsx` — Uses DeleteConfirmDialog
- `packages/ui/src/App.tsx` or equivalent — Wraps with ToastProvider (will switch to Sonner `<Toaster />`)

### Project context
- `.planning/PROJECT.md` — Key Decisions table
- `.planning/ROADMAP.md` — Phase 15 requirements (DLG-01–DLG-06, FORM-01–FORM-08, UTIL-01, UTIL-02)
- `.planning/REQUIREMENTS.md` — Full requirement definitions
- `.planning/phases/14-core-ui-migration/14-CONTEXT.md` — Phase 14 decisions (locked)
- `.planning/phases/13-uitripled-foundation/13-CONTEXT.md` — Phase 13 decisions (locked)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NativeDialog** — Radix-based dialog with framer-motion fade/scale/blur animations. Already installed and tested.
- **NativeButton** — Wraps shadcn Button with spring hover/tap, loading pulse, optional glow. Has `loading` prop built in.
- **shadcn form primitives** — Input, Textarea, Select, Switch, Label, Checkbox all installed and CSS-only.
- **cn()** at `@/lib/utils` — Universal class merging utility.

### Established Patterns
- **No entry animations**: Per Phase 14 D-05/D-15, cards and lists render immediately. Forms and dialogs are interactive primitives where CSS transitions for state changes are appropriate.
- **CSS custom properties**: All colors via `var(--surface-*)`, `var(--border-*)`, `var(--text-*)`, `var(--accent-*)` or shadcn semantic tokens.
- **cn() composition**: Every component uses `cn()` for conditional class merging.
- **Discriminated union dialog state**: ProfileCard's `useActivationFlow` hook manages dialog state as a union type. The dialogs themselves receive simple props (onConfirm, onCancel, onClose).

### Integration Points
- **ProfileCard** (migrated in Phase 14) renders all 3 profile dialogs via the `useActivationFlow` hook. Dialog props interfaces must stay compatible.
- **StoreComponentEditor** renders `DeleteConfirmDialog` via `showDeleteDialog` state.
- **ToastProvider** wraps the app at the top level. Migration to Sonner requires replacing with `<Toaster />` at the same level.
- **CommandPaletteProvider** wraps the app and provides `useCommandPalette` context. Migration must preserve this API.
- **GeneralSettings** is the sole consumer of all 4 settings/ui primitives.

### Key Risks
- **cmdk API shape**: The rebuilt CommandPalette must preserve the existing `CommandPaletteProvider` + `useCommandPalette` context API and `CommandItem` interface so consumers don't change.
- **Sonner API shape**: Sonner uses `toast()` directly (not a hook). All `useToast().success()` calls become `toast.success()`. Need to find and update all call sites.
- **Select API mismatch**: Custom settings/ui/Select takes `options: {value, label}[]`. shadcn Select is composable children. Migration must bridge this gap.
- **Variant mapping**: settings/ui/Button uses `primary/secondary/ghost/danger`. NativeButton uses `default/outline/secondary/ghost/destructive/link`. Each consumer needs correct mapping.

</code_context>

<specifics>
## Specific Ideas

- Install `cmdk` and `sonner` as new dependencies in Phase 15.
- The shared `truncateUrl()` util can live at `src/utils/truncateUrl.ts`.
- The shared model-config-change component can live at `src/components/profiles/ModelConfigChangeList.tsx`.
- For GeneralSettings' Select migration, create a thin wrapper that accepts the `options` array prop and renders the composable shadcn Select children internally.
- Sonner's `<Toaster />` component supports theme configuration — set to `theme="dark"` and customize toast styling to match ClaudeUI tokens.

</specifics>

<deferred>
## Deferred Ideas

- **Dead code removal**: Phase 16 will delete all hand-built components fully replaced by uitripled (settings/ui/ directory, old Toast.tsx, etc.)
- **Accessibility audit**: Phase 16 will verify focus management, keyboard nav, and ARIA across all migrated components.
- **React 19 ref-as-prop refactor**: Phase 16 (Polish) can remove forwardRef from uitripled components.
- **JsonEditor / ComponentPicker / PluginPicker**: These are custom components (CodeMirror-based, React Query-backed) that don't benefit from shadcn migration. Left unchanged.

</deferred>

---

*Phase: 15-dialogs-forms-migration*
*Context gathered: 2026-04-20*
