# Phase 14: Core UI Migration - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 migrates all primary navigation (sidebars, tabs, view switcher), card display (EntityCard, ProfileCard, ConfigSection, SectionHeader), badge (SourceBadge, Badge, MonoBadge), and utility components (HoverCard, QuickActions, Skeleton, Tooltip) from hand-built implementations to uitripled/shadcn primitives. The app must remain visually identical after migration — this is structural refactoring, not visual redesign.

Dialog components, form controls, and the command palette are Phase 15 scope. Toast is deferred to Phase 15.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Migration
- **D-01:** All three sidebars (Sidebar, ProfilesSidebar, SettingsSidebar) use uitripled native-tabs internally for navigation. Each section becomes a TabsTrigger with `layoutId`-based animated indicator.
- **D-02:** Each sidebar is migrated independently — no shared abstraction, hook, or base component. The same native-tabs wrapping pattern is applied consistently but each file is self-contained.
- **D-03:** Remove framer-motion entry animations from sidebars. Keep CSS `transition` for hover states. native-tabs provides the active indicator animation via `layoutId` — that's the only motion.

### Card Migration
- **D-04:** Full replacement — EntityCard, ProfileCard, and ConfigSection are rebuilt on shadcn Card primitives (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter).
- **D-05:** Card entry/hover animations are removed. Cards render immediately with no motion.div wrapping. Keep CSS `transition` for hover state changes (shadow, border color) but no framer-motion.
- **D-06:** EntityCard's Badge and MonoBadge are extracted to separate files. Badge is replaced by shadcn Badge with variant system. MonoBadge becomes a shadcn Badge variant with `font-mono` styling.
- **D-07:** ProfileCard's discriminated union dialog state machine (switch/activate-warn/blocked) is extracted into a custom hook (`useActivationFlow`). ProfileCard becomes a layout component using shadcn Card + the hook.
- **D-08:** EntityCard's dynamic `iconAccentVar` CSS variable injection pattern is preserved. The accent color is applied via inline style or a CSS class rather than dynamic template-literal Tailwind classes (which risk purge issues).

### Badge & Utility Migration
- **D-09:** SourceBadge becomes a shadcn Badge wrapper that selects variant by source type (local/profile/plugin/project). Hardcoded colors (`#22c55e`) are replaced with CSS var references.
- **D-10:** QuickActions' custom Tooltip is replaced with shadcn Tooltip (from `@/components/ui/tooltip`), which uses Radix UI for accessibility. Remove the custom mouse-event-based implementation.
- **D-11:** HoverCard is replaced by shadcn Card with CSS hover transitions. Remove framer-motion dependency from this component.
- **D-12:** Skeleton components (Skeleton, CardSkeleton, ListItemSkeleton, AnimatedList) are replaced with shadcn-style Skeleton. CardSkeleton and ListItemSkeleton adapt to match the migrated EntityCard and sidebar layouts.
- **D-13:** Toast is deferred to Phase 15. It's a well-structured context provider with an imperative API that doesn't benefit from shadcn migration — better addressed alongside dialog/form migrations.
- **D-14:** ViewSwitcher is migrated to uitripled native-tabs (2-tab segmented control with animated indicator). This unifies the tab pattern across the app.

### Animation Strategy
- **D-15:** Remove list and card entry animations (framer-motion stagger, motion.div wrapping). Use native-* wrappers only for interactive primitives (native-tabs indicator, native-tooltip) and CSS `transition` for hover state changes. No stagger, no spring animations on cards or list items.
- **D-16:** Stagger timing is no longer applicable — list entry animations are removed.

### Agent's Discretion
- Exact shadcn Card sub-component mapping for each hand-built card (which content goes in CardHeader vs CardContent)
- Whether to use `native-button` or keep the existing settings/ui/Button.tsx (which is Phase 15 scope)
- Skeleton replacement shape and sizing details
- How to handle SectionHeader — it's small and uses framer-motion for fade-in. Whether to wrap with motion.div or use CSS animation is at agent's discretion
- ProfileCard two-column layout specifics after Card migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 infrastructure (installed and verified)
- `packages/ui/src/components/ui/*.tsx` — 18 shadcn base primitives (button, card, badge, input, textarea, select, switch, tabs, dialog, dropdown-menu, tooltip, label, separator, scroll-area, avatar, slider, checkbox, password-input)
- `packages/ui/src/components/uitripled/index.ts` — Barrel re-export of native animated wrappers
- `packages/ui/src/components/uitripled/native-tabs.tsx` — Animated tabs with layoutId indicator
- `packages/ui/src/components/uitripled/native-tooltip.tsx` — Animated tooltip wrapper (Radix-based)
- `packages/ui/src/components/uitripled/native-button.tsx` — Animated button with loading/glow
- `packages/ui/src/components/uitripled/native-dialog.tsx` — Animated dialog wrapper (Radix-based)
- `packages/ui/src/globals.css` — Dual token system (ClaudeUI + shadcn tokens coexist)
- `packages/ui/tailwind.config.js` — Full shadcn color mappings via hsl(var(--token))
- `packages/ui/src/lib/utils.ts` — cn() utility at canonical location

### Components being migrated (read current implementation)
- `packages/ui/src/components/Sidebar.tsx` — Main sidebar (111 lines, CSS transitions)
- `packages/ui/src/components/profiles/ProfilesSidebar.tsx` — Profile nav sidebar (128 lines, framer-motion)
- `packages/ui/src/components/settings/SettingsSidebar.tsx` — Settings nav sidebar (73 lines, framer-motion)
- `packages/ui/src/components/ViewSwitcher.tsx` — Two-tab segmented control (43 lines, CSS only)
- `packages/ui/src/components/EntityCard.tsx` — Entity card + Badge + MonoBadge (101 lines)
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Profile card with activation flow (319 lines)
- `packages/ui/src/components/ConfigSection.tsx` — Config section + ConfigEntryCard (119 lines)
- `packages/ui/src/components/SectionHeader.tsx` — Section heading (35 lines)
- `packages/ui/src/components/SourceBadge.tsx` — Source attribution badge (40 lines)
- `packages/ui/src/components/ui/HoverCard.tsx` — Hover animation wrapper (38 lines)
- `packages/ui/src/components/ui/QuickActions.tsx` — Action bar + FAB + Tooltip (150 lines)
- `packages/ui/src/components/ui/Skeleton.tsx` — Loading placeholders (100 lines)
- `packages/ui/src/components/ui/Toast.tsx` — Toast provider + hook (125 lines, NOT migrating)

### Consuming components (understand import patterns)
- `packages/ui/src/Explorer.tsx` — Main orchestrator, imports EntityCard, Badge, MonoBadge, Sidebar, Skeleton, ViewSwitcher, SectionHeader, ConfigSection, SourceBadge

### Project context
- `.planning/PROJECT.md` — Key Decisions table
- `.planning/ROADMAP.md` — Phase 14 requirements (NAV-01–NAV-03, CARD-01–CARD-05, UTIL-02–UTIL-05)
- `.planning/REQUIREMENTS.md` — Full requirement definitions
- `.planning/phases/13-uitripled-foundation/13-CONTEXT.md` — Phase 13 decisions (locked)
- `.planning/phases/13-uitripled-foundation/13-01-SUMMARY.md` — Phase 13 execution results

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn Card** at `@/components/ui/card` — Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter (103 lines, uses plain div)
- **shadcn Badge** at `@/components/ui/badge` — Badge with CVA variants (52 lines)
- **shadcn Tabs** at `@/components/ui/tabs` — Tabs, TabsList, TabsTrigger, TabsContent (80 lines, base-ui)
- **shadcn Tooltip** at `@/components/ui/tooltip` — Tooltip, TooltipTrigger, TooltipContent, TooltipProvider (64 lines, base-ui)
- **shadcn Separator** at `@/components/ui/separator` — Can replace border dividers in sidebars
- **native-tabs** at `@/components/uitripled/native-tabs` — Animated tab indicator via layoutId
- **native-tooltip** at `@/components/uitripled/native-tooltip` — Animated tooltip (Radix-based, works with AnimatePresence)
- **cn()** at `@/lib/utils` — Universal class merging utility
- **framer-motion** — Keep installed for native-* animated wrappers (native-tabs, native-tooltip). No longer used for card/list entry animations.

### Established Patterns
- **No entry animations**: Cards and list items render immediately — no stagger, no fade-in, no spring animations.
- **CSS custom properties**: All colors via `var(--surface-*)`, `var(--border-*)`, `var(--text-*)`, `var(--accent-*)` or shadcn tokens
- **Custom utility classes**: `panel`, `panel-subtle`, `transition-smooth` defined in globals.css — continue using these
- **cn() composition**: Every component uses `cn()` for conditional class merging
- **Controlled components**: Sidebars, ViewSwitcher, EntityCard are all controlled (no internal state for selection)

### Integration Points
- `Explorer.tsx` is the primary consumer of all Phase 14 components — it imports EntityCard, Badge, MonoBadge, Sidebar, Skeleton, ViewSwitcher, SectionHeader, ConfigSection, SourceBadge
- Profiles sidebar is rendered in a React Router route, receives Profile[] from useProfiles hook
- Settings sidebar is rendered inside SettingsLayout
- ViewSwitcher is injected as `headerSlot` prop into Sidebar
- ProfileCard uses ConfirmSwitchDialog, ActivateConfirmDialog, ActivationBlockedDialog — these are Phase 15 scope but ProfileCard must keep using them

### Architectural Notes
- **Dual primitive library**: shadcn base primitives use `@base-ui/react`, but native animated wrappers (dialog, tooltip) use `@radix-ui/react-*` for AnimatePresence-compatible portals. This is intentional and already in place.
- **Dynamic Tailwind classes**: EntityCard's `iconAccentVar` template-literal class generation (e.g., `group-hover:bg-[var(${iconAccentVar})]/15`) may not be detected by Tailwind's purge. Migration should use inline styles or safelist.
- **Hardcoded colors**: `#5E6AD2` in ProfileCard active badge and `#22c55e` in SourceBadge project variant — both need CSS var replacement.

</code_context>

<specifics>
## Specific Ideas

- Each sidebar independently wraps native-tabs for the active indicator. The native-tabs `layoutId="active-tab"` pattern gives smooth indicator sliding between sections.
- ProfileCard's `useActivationFlow` hook should encapsulate the discriminated union state (`switch | activate-warn | blocked | delete-active-blocked | null`), preflight mutation, lock error handling, and the auto-dismiss timeout.
- ViewSwitcher is the simplest native-tabs migration — it's already a 2-option segmented control, just needs tabs wrapping.
- Badge extraction: Move Badge/MonoBadge out of EntityCard.tsx into their own file. shadcn Badge handles the variant system. MonoBadge adds `font-mono` via className override.

</specifics>

<deferred>
## Deferred Ideas

- **Toast migration** (UTIL-02): Deferred to Phase 15. Toast is a well-structured context provider with imperative API that fits better alongside dialog/form migrations.
- **animated-sidebar uitripled component**: The vendor has an animated-sidebar component but it's a self-contained demo. Phase 14 implements sidebar migration using native-tabs wrapping instead.
- **Button/Toggle/Input/Select form primitives** (FORM-01–FORM-04): Phase 15 scope. Current settings/ui/Button.tsx and settings/ui/Input.tsx use framer-motion and will be replaced then.
- **Command palette** (UTIL-01): Phase 15 scope.
- **React 19 ref-as-prop refactor**: Phase 16 (Polish) can remove forwardRef from uitripled components.
- **Dead code removal**: Phase 16 will delete all hand-built components fully replaced by uitripled.

### Reviewed Requirements
- UTIL-02 (Toast → uitripled toast-notification): Deferred to Phase 15 — imperative API better preserved alongside dialog/form work.

</deferred>

---

*Phase: 14-core-ui-migration*
*Context gathered: 2026-04-19*
