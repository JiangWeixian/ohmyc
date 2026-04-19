# Requirements: v1.5 UI Refactor — uitripled Migration

**Defined:** 2026-04-19
**Status:** Active

## Foundation

- [x] **FOUND-01**: Install uitripled peer dependencies (Radix UI primitives, CVA, lucide-react upgrades) into `packages/ui` — Phase 13
- [x] **FOUND-02**: Copy relevant uitripled UI primitives (button, card, dialog, input, select, tabs, tooltip, badge, switch, checkbox, dropdown-menu, separator, scroll-area, label, avatar, slider, textarea) into `packages/ui/src/components/uitripled/` using shadcn copy pattern — Phase 13
- [x] **FOUND-03**: Map ClaudeUI design tokens (--surface-*, --border-*, --text-*, --accent-*) to shadcn token system (--background, --card, --popover, --border, --foreground, --muted-foreground, --primary, etc.) in globals.css, preserving current dark theme appearance — Phase 13
- [x] **FOUND-04**: Verify React 18 compatibility with uitripled components — test all copied primitives render without errors in React 18 environment — Phase 13
- [x] **FOUND-05**: Verify Tailwind v3 compatibility — ensure uitripled component classes compile and render correctly with Tailwind v3 — Phase 13
- [x] **FOUND-06**: Establish uitripled component re-export pattern — single barrel import path from `@/components/uitripled` for all primitives — Phase 13

## Component Migration: Sidebar & Navigation

- [ ] **NAV-01**: Replace hand-built Sidebar with uitripled animated-sidebar — ProfileSidebar, SettingsSidebar, main Sidebar — Phase 14
- [ ] **NAV-02**: Replace ViewSwitcher with uitripled Tabs primitive for view mode toggling — Phase 14
- [ ] **NAV-03**: Replace Explorer tabs with uitripled Tabs component — Phase 14

## Component Migration: Cards & Display

- [ ] **CARD-01**: Replace EntityCard with uitripled Card primitive (CardHeader, CardTitle, CardDescription, CardContent, CardFooter) — Phase 14
- [ ] **CARD-02**: Replace ProfileCard with uitripled Card — Phase 14
- [ ] **CARD-03**: Replace ConfigSection with uitripled Card — Phase 14
- [ ] **CARD-04**: Replace SectionHeader with uitripled Card header pattern — Phase 14
- [ ] **CARD-05**: Replace SourceBadge with uitripled Badge — Phase 14

## Component Migration: Dialogs

- [ ] **DLG-01**: Replace ConfirmSwitchDialog with uitripled Dialog — Phase 15
- [ ] **DLG-02**: Replace ActivateConfirmDialog with uitripled animated-dialog — Phase 15
- [ ] **DLG-03**: Replace ActivationBlockedDialog with uitripled Dialog — Phase 15
- [ ] **DLG-04**: Replace ImportComponentsDialog with uitripled Dialog — Phase 15
- [ ] **DLG-05**: Replace DeleteConfirmDialog with uitripled Dialog — Phase 15
- [ ] **DLG-06**: Replace KeyboardShortcutsPanel with uitripled Dialog — Phase 15

## Component Migration: Forms & Inputs

- [ ] **FORM-01**: Replace settings/ui/Button with uitripled Button (with variants: default, destructive, outline, secondary, ghost, link) — Phase 15
- [ ] **FORM-02**: Replace settings/ui/Input with uitripled Input — Phase 15
- [ ] **FORM-03**: Replace settings/ui/Select with uitripled Select — Phase 15
- [ ] **FORM-04**: Replace settings/ui/Toggle with uitripled Switch — Phase 15
- [ ] **FORM-05**: Migrate ProfileEditor form controls to uitripled Input, Select, Switch — Phase 15
- [ ] **FORM-06**: Migrate StoreComponentEditor to uitripled form primitives — Phase 15
- [ ] **FORM-07**: Migrate ModelConfigEditor to uitripled form primitives — Phase 15
- [ ] **FORM-08**: Migrate GeneralSettings to uitripled form primitives — Phase 15

## Component Migration: Utilities

- [ ] **UTIL-01**: Replace CommandPalette with uitripled command-palette — Phase 15
- [ ] **UTIL-02**: Replace Toast with uitripled toast-notification — Phase 14
- [ ] **UTIL-03**: Replace HoverCard with uitripled tooltip/hover-card — Phase 14
- [ ] **UTIL-04**: Replace Skeleton with uitripled Skeleton or custom equivalent — Phase 14
- [ ] **UTIL-05**: Replace QuickActions with uitripled DropdownMenu — Phase 14

## Polish & Validation

- [ ] **POL-01**: Verify all existing tests pass after migration with no regressions — Phase 16
- [ ] **POL-02**: Audit focus management and keyboard navigation across all migrated components — Phase 16
- [ ] **POL-03**: Verify ARIA attributes and screen reader compatibility via Radix UI primitives — Phase 16
- [ ] **POL-04**: Visual regression check — all views render identically to pre-migration baseline — Phase 16
- [ ] **POL-05**: Remove dead code — delete old hand-built components fully replaced by uitripled — Phase 16

## Out of Scope

- React 19 upgrade (validate compatibility first, upgrade is separate milestone if needed)
- Tailwind v4 upgrade (validate v3 compatibility first)
- Dark/light theme toggle (ClaudeUI is dark-only, uitripled theme-provider not needed)
- Migration of MarkdownRenderer (custom CodeMirror integration, not a UI primitive concern)
- Migration of JsonEditor (CodeMirror-based, not a UI primitive concern)
- uitripled section/page components (marketing blocks, hero sections — not applicable)

## Requirements Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 13 | Complete |
| FOUND-02 | Phase 13 | Complete |
| FOUND-03 | Phase 13 | Complete |
| FOUND-04 | Phase 13 | Complete |
| FOUND-05 | Phase 13 | Complete |
| FOUND-06 | Phase 13 | Complete |
| NAV-01 | Phase 14 | Pending |
| NAV-02 | Phase 14 | Pending |
| NAV-03 | Phase 14 | Pending |
| CARD-01 | Phase 14 | Pending |
| CARD-02 | Phase 14 | Pending |
| CARD-03 | Phase 14 | Pending |
| CARD-04 | Phase 14 | Pending |
| CARD-05 | Phase 14 | Pending |
| UTIL-02 | Phase 14 | Pending |
| UTIL-03 | Phase 14 | Pending |
| UTIL-04 | Phase 14 | Pending |
| UTIL-05 | Phase 14 | Pending |
| DLG-01 | Phase 15 | Pending |
| DLG-02 | Phase 15 | Pending |
| DLG-03 | Phase 15 | Pending |
| DLG-04 | Phase 15 | Pending |
| DLG-05 | Phase 15 | Pending |
| DLG-06 | Phase 15 | Pending |
| FORM-01 | Phase 15 | Pending |
| FORM-02 | Phase 15 | Pending |
| FORM-03 | Phase 15 | Pending |
| FORM-04 | Phase 15 | Pending |
| FORM-05 | Phase 15 | Pending |
| FORM-06 | Phase 15 | Pending |
| FORM-07 | Phase 15 | Pending |
| FORM-08 | Phase 15 | Pending |
| UTIL-01 | Phase 15 | Pending |
| POL-01 | Phase 16 | Pending |
| POL-02 | Phase 16 | Pending |
| POL-03 | Phase 16 | Pending |
| POL-04 | Phase 16 | Pending |
| POL-05 | Phase 16 | Pending |
