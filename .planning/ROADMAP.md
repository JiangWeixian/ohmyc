# Roadmap: ClaudeUI

## Milestones

- **v1.0 ClaudeUI MVP** -- Phases 1-3 (shipped 2026-04-07)
- **v1.1 Bugfixes** -- Phase 4 (shipped 2026-04-08)
- **v1.2 Model Config** -- Phases 5-7 (shipped 2026-04-13)
- **v1.3 CLI MVP** -- Phases 8-9 (shipped 2026-04-16)
- **v1.4 Project-Aware Loading + .cu Rebrand** -- Phases 10-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1-12): Planned milestone work
- Decimal phases (10.1, 10.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Store and Inventory Foundation** (v1.0)
- [x] **Phase 2: Profile Composition** (v1.0)
- [x] **Phase 3: Safe Switching and Reference Safety** (v1.0)
- [x] **Phase 4: Explorer Tab Corrections** (v1.1)
- [x] **Phase 5: Model Config Store Backend** (v1.2)
- [x] **Phase 6: Model Config UI and Profile Integration** (v1.2)
- [x] **Phase 7: Activation Integration** (v1.2)
- [x] **Phase 8: CLI Launcher** (v1.3)
- [x] **Phase 9: Package and Publish** (v1.3)
- [x] **Phase 10: Config Foundation** -- Centralize path resolution, add project discovery, extend source schema
- [x] **Phase 11: Project-Local Loading** -- Dual-source inventory loading with merge and source attribution
- [ ] **Phase 12: .cu Rebrand** -- Write path moves to ~/.cu/ with backward-compatible reads

## Phase Details

<details>
<summary>v1.0 ClaudeUI MVP (Phases 1-3) -- SHIPPED 2026-04-07</summary>

- [x] Phase 1: Store and Inventory Foundation (4/4 plans) -- completed 2026-03-31
- [x] Phase 2: Profile Composition (3/3 plans) -- completed 2026-04-07
- [x] Phase 3: Safe Switching and Reference Safety (2/2 plans) -- completed 2026-04-07

</details>

<details>
<summary>v1.1 Bugfixes (Phase 4) -- SHIPPED 2026-04-08</summary>

- [x] Phase 4: Explorer Tab Corrections (2/2 plans) -- completed 2026-04-07

</details>

<details>
<summary>v1.2 Model Config (Phases 5-7) -- SHIPPED 2026-04-13</summary>

- [x] Phase 5: Model Config Store Backend (2/2 plans) -- completed 2026-04-09
- [x] Phase 6: Model Config UI and Profile Integration (2/2 plans) -- completed 2026-04-10
- [x] Phase 7: Activation Integration (2/2 plans) -- completed 2026-04-11

</details>

<details>
<summary>v1.3 CLI MVP (Phases 8-9) -- SHIPPED 2026-04-16</summary>

- [x] Phase 8: CLI Launcher (2/2 plans) -- completed 2026-04-13
- [x] Phase 9: Package and Publish (3/3 plans) -- completed 2026-04-14

</details>

### v1.4 Project-Aware Loading + .cu Rebrand (In Progress)

**Milestone Goal:** CLI loads project-local `.claude/` alongside global, and activation writes go to `.cu`.

#### Phase 10: Config Foundation
**Goal**: All path resolution goes through a single ConfigLocator service, project directories are discoverable at startup, and the UI can render project-scoped source badges.
**Depends on**: Phase 9 (v1.3 complete)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. Server discovers a project-local `.claude/` directory when launched inside a project tree and exposes the project path to route handlers
  2. No `.claude` or `.cu` path string literals exist outside ConfigLocator -- all path resolution calls go through the centralized service
  3. SourceBadge component renders a visually distinct `project` variant in the explorer UI
  4. Merge policy is defined and documented: project items override global items when both provide the same component name, both remain visible
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — ConfigLocator service with project discovery and path centralization (FOUND-01, FOUND-02)
- [x] 10-02-PLAN.md — SourceBadge project variant and shared schema source enum extension (FOUND-03)

**UI hint**: yes

#### Phase 11: Project-Local Loading
**Goal**: Users see both global and project-scoped components merged in every inventory view, with source badges distinguishing origin and project items taking precedence on conflicts.
**Depends on**: Phase 10
**Requirements**: LOAD-01, LOAD-02, LOAD-03
**Success Criteria** (what must be TRUE):
  1. Agents, skills, commands, and configs API routes return merged results containing items from both global and project directories
  2. When a global and project item share the same name, the project-scoped item appears in the UI as the active override (project wins)
  3. Every item in merged API responses carries a `source` field (`global` or `project`)
  4. Explorer views display both global and project items with distinct source badges so users can tell where each component originates
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Backend dual-source loading with scope field and merge routes (LOAD-01, LOAD-02, LOAD-03)
- [x] 11-02-PLAN.md — Frontend merge display and view-only behavior for project items (LOAD-02)

**UI hint**: yes

#### Phase 12: .cu Rebrand
**Goal**: All managed data writes go to `~/.cu/` instead of `~/.claude/`, while existing data in `~/.claude/` remains readable so no user loses configurations.
**Depends on**: Phase 10
**Requirements**: REBR-01, REBR-02
**Success Criteria** (what must be TRUE):
  1. Store, profiles, and activation output are written to `~/.cu/` -- activating a profile creates symlinks and files under `~/.cu/`
  2. Existing configurations from `~/.claude/` are still readable after rebrand so previously created profiles and store items are not lost
  3. Fresh install with no prior `~/.claude/` data works correctly by writing only to `~/.cu/`
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12

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
| 12. .cu Rebrand | v1.4 | 0/2 | Not started | - |
