# Requirements: ClaudeUI

**Defined:** 2026-04-17
**Core Value:** Users can reliably assemble and switch between Claude-focused coding environments from reusable local components without manually editing scattered config files.

## v1.4 Requirements

Requirements for project-aware loading and .cu rebrand. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: Server discovers project-local `.claude/` directory via walk-up from CWD at startup
- [x] **FOUND-02**: All path resolution centralized through ConfigLocator — no scattered `.claude`/`.cu` string literals
- [x] **FOUND-03**: SourceBadge UI renders `project` variant for project-scoped inventory items

### Project Loading

- [ ] **LOAD-01**: Agents, skills, commands, and configs routes return merged results from global and project directories
- [ ] **LOAD-02**: Project-scoped items override global items when both provide the same component name
- [ ] **LOAD-03**: All merged items tagged with `source` field (`global`/`project`) in API responses

### .cu Rebrand

- [x] **REBR-01**: CLI writes all managed data (store, profiles, activation output) to `~/.cu/` instead of `~/.claude/`
- [x] **REBR-02**: Existing `~/.claude/` data remains readable after rebrand so users don't lose existing configurations

## v1.5+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Settings Provenance

- **SETP-01**: Per-key settings provenance display showing which layer contributed each settings key
- **SETP-02**: Visual merge conflict indicators — both items shown with source badges, project wins

### Migration

- **MIGR-01**: Guided migration helper — one-time guided move from `.claude` to `.cu` for ClaudeUI data only

### CLI Enhancements

- **CLI-01**: CLI auto-update mechanism
- **CLI-02**: CLI configuration file for default port, browser preference, etc.
- **CLI-03**: `cu dev` mode for development with hot reload

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-project support | Manage multiple projects simultaneously — not core to single-project workflow |
| `.cu` as primary read path | Future state after full migration — premature for v1.4 |
| Project-aware profile composition | Profiles referencing project-scoped components — complex, defer |
| Directory rebrand for project-local `.claude/` | Claude Code owns project `.claude/` — never rename those |
| Plugin path migration (`installed_plugins.json`) | Claude Code manages plugin installs — paths may not be ours to move |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 10 | Complete |
| FOUND-02 | Phase 10 | Complete |
| FOUND-03 | Phase 10 | Complete |
| LOAD-01 | Phase 11 | Pending |
| LOAD-02 | Phase 11 | Pending |
| LOAD-03 | Phase 11 | Pending |
| REBR-01 | Phase 12 | Complete |
| REBR-02 | Phase 12 | Complete |

**Coverage:**
- v1.4 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after roadmap creation*
