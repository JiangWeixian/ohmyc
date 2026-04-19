# Roadmap: ClaudeUI

## Milestones

- **v1.0 ClaudeUI MVP** -- Phases 1-3 (shipped 2026-04-07)
- **v1.1 Bugfixes** -- Phase 4 (shipped 2026-04-08)
- **v1.2 Model Config** -- Phases 5-7 (shipped 2026-04-13)
- **v1.3 CLI MVP** -- Phases 8-9 (shipped 2026-04-16)
- **v1.4 Project-Aware Loading + .cu Rebrand** -- Phases 10-12 (shipped 2026-04-19) — [archive](./milestones/v1.4-ROADMAP.md)
- **v1.5 UI Refactor — uitripled Migration** -- Phases 13-16 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1-12): Completed milestone work
- Integer phases (13-16): Current v1.5 milestone work
- Decimal phases (10.1, 10.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Store and Inventory Foundation** (v1.0)
- [x] **Phase 2: Profile Composition** (v1.0)
- [x] **Phase 3: Safe Switching and Reference Safety** (v1.0)
- [x] **Phase 4: Explorer Tab Corrections** (v1.1)
- [x] **Phase 5: Model Config Store Backend** (v1.2)
- [x] **Phase 6: Model Config UI and Profile Integration** (v1.2)
- [x] **Phase 7: Activation Integration** (v1.2)
- [x] **Phase 8: CLI Launcher** (v1.3)
- [x] **Phase 9: Package and Publish** (v1.3)
- [x] **Phase 10: Config Foundation** (v1.4)
- [x] **Phase 11: Project-Local Loading** (v1.4)
- [x] **Phase 12: .cu Rebrand** (v1.4)
- [ ] **Phase 13: uitripled Foundation** (v1.5) — install deps, design token mapping, base primitives
- [ ] **Phase 14: Core UI Migration** (v1.5) — sidebar, explorer, entity cards, utility components
- [ ] **Phase 15: Dialogs & Forms Migration** (v1.5) — modals, forms, settings, editors, command palette
- [ ] **Phase 16: Polish & Validation** (v1.5) — animations, accessibility, visual regression, dead code removal

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Store and Inventory Foundation | v1.0 | 4/4 | Complete | 2026-03-31 |
| 2. Profile Composition | v1.0 | 3/3 | Complete | 2026-04-07 |
| 3. Safe Switching and Reference Safety | v1.0 | 2/2 | Complete | 2026-04-07 |
| 4. Explorer Tab Corrections | v1.1 | 2/2 | Complete | 2026-04-07 |
| 5. Model Config Store Backend | v1.2 | 2/2 | Complete | 2026-04-09 |
| 6. Model Config UI and Profile Integration | v1.2 | 2/2 | Complete | 2026-04-10 |
| 7. Activation Integration | v1.2 | 2/2 | Complete | 2026-04-11 |
| 8. CLI Launcher | v1.3 | 2/2 | Complete | 2026-04-13 |
| 9. Package and Publish | v1.3 | 3/3 | Complete | 2026-04-14 |
| 10. Config Foundation | v1.4 | 2/2 | Complete | 2026-04-18 |
| 11. Project-Local Loading | v1.4 | 2/2 | Complete | 2026-04-18 |
| 12. .cu Rebrand | v1.4 | 1/1 | Complete | 2026-04-18 |
| 13. uitripled Foundation | v1.5 | 0/? | In Progress | — |
| 14. Core UI Migration | v1.5 | 0/? | Pending | — |
| 15. Dialogs & Forms Migration | v1.5 | 0/? | Pending | — |
| 16. Polish & Validation | v1.5 | 0/? | Pending | — |

## Phase Details: v1.5

### Phase 13: uitripled Foundation

**Goal**: uitripled primitives are installed, design tokens mapped, and a verified subset of components render correctly in the React 18 + Tailwind v3 environment.

**Dependencies**: None (first phase of v1.5)

**Plans:**
- [ ] 13-01-PLAN — Install Radix UI deps, copy uitripled UI primitives, establish barrel re-exports (FOUND-01, FOUND-02, FOUND-06)
- [ ] 13-02-PLAN — Design token mapping: ClaudeUI tokens → shadcn tokens in globals.css (FOUND-03)
- [ ] 13-03-PLAN — Compatibility verification: React 18, Tailwind v3, render smoke tests (FOUND-04, FOUND-05)

**Requirements covered:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06

**Key risks:**
- React 18 incompatibility with Radix UI latest versions (mitigate: pin tested versions)
- Tailwind v3 missing features used by uitripled components (mitigate: Tailwind v3 covers standard utility classes)
- Design token color space mismatch (ClaudeUI uses hex, uitripled uses oklch) — need custom dark theme mapping

**Design token mapping reference:**
| ClaudeUI Token | shadcn Token | Mapping |
|----------------|-------------|---------|
| --surface-base (#080a0a) | --background | Dark custom |
| --surface-raised (#0f1112) | --card | Dark custom |
| --surface-overlay (#15181a) | --popover | Dark custom |
| --border-default (#202427) | --border | Dark custom |
| --text-primary (#e2e4e3) | --foreground | Dark custom |
| --text-secondary (#b2b5b7) | --muted-foreground | Dark custom |
| --accent-blue (#5E6AD2) | --primary | Blue accent |
| --accent-red (#e0675c) | --destructive | Red accent |

### Phase 14: Core UI Migration

**Goal**: All primary navigation, card display, and utility components use uitripled primitives. The app is visually identical but structurally refactored.

**Dependencies**: Phase 13 complete

**Plans:**
- [ ] 14-01-PLAN — Sidebar migration: Sidebar, ProfilesSidebar, SettingsSidebar → animated-sidebar (NAV-01)
- [ ] 14-02-PLAN — Tabs migration: Explorer, ViewSwitcher → Tabs (NAV-02, NAV-03)
- [ ] 14-03-PLAN — Card migration: EntityCard, ProfileCard, ConfigSection, SectionHeader → Card (CARD-01, CARD-02, CARD-03, CARD-04)
- [ ] 14-04-PLAN — Badge + utility migration: SourceBadge → Badge, Toast, HoverCard, Skeleton, QuickActions (CARD-05, UTIL-02, UTIL-03, UTIL-04, UTIL-05)

**Requirements covered:** NAV-01, NAV-02, NAV-03, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, UTIL-02, UTIL-03, UTIL-04, UTIL-05

**Key risks:**
- animated-sidebar assumes specific layout patterns — may need adaptation for ClaudeUI's sidebar structure
- Explorer tab content is complex — Tabs migration must preserve scroll state and tab bar behavior

### Phase 15: Dialogs & Forms Migration

**Goal**: All modal dialogs, form controls, and the command palette use uitripled primitives. Settings and editor views use standardized form components.

**Dependencies**: Phase 14 complete

**Plans:**
- [ ] 15-01-PLAN — Dialog migration: all 6 dialog components → Dialog / animated-dialog (DLG-01, DLG-02, DLG-03, DLG-04, DLG-05, DLG-06)
- [ ] 15-02-PLAN — Form primitives migration: Button, Input, Select, Toggle → uitripled primitives (FORM-01, FORM-02, FORM-03, FORM-04)
- [ ] 15-03-PLAN — Editor & settings migration: ProfileEditor, StoreComponentEditor, ModelConfigEditor, GeneralSettings (FORM-05, FORM-06, FORM-07, FORM-08)
- [ ] 15-04-PLAN — Command palette migration: CommandPalette → uitripled command-palette (UTIL-01)

**Requirements covered:** DLG-01–DLG-06, FORM-01–FORM-08, UTIL-01

**Key risks:**
- Dialog state machines (discriminated unions) must be preserved during migration
- Form validation patterns may differ between hand-built and uitripled inputs
- Command palette behavior (search, keyboard nav) must be preserved exactly

### Phase 16: Polish & Validation

**Goal**: The migrated UI passes all existing tests, has no visual regressions, and has clean accessibility. Dead code from replaced components is removed.

**Dependencies**: Phase 15 complete

**Plans:**
- [ ] 16-01-PLAN — Test suite verification and regression fixes (POL-01, POL-04)
- [ ] 16-02-PLAN — Accessibility audit: focus management, keyboard nav, ARIA (POL-02, POL-03)
- [ ] 16-03-PLAN — Dead code removal: delete replaced hand-built components (POL-05)

**Requirements covered:** POL-01, POL-02, POL-03, POL-04, POL-05

**Exit criteria:**
- All existing tests pass
- No visual regressions (manual visual check of all views)
- All hand-built components replaced by uitripled are deleted
- Lighthouse accessibility score ≥ 90 (or parity with pre-migration)
