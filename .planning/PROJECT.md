# ClaudeUI

## What This Is

ClaudeUI is a local management workspace for Claude Code extensions and configuration, built for power users who maintain multiple AI coding environments. It provides a web UI and API for importing components into a local store, composing reusable profiles from those components, and switching between profiles with transactional safety and rollback support. Explorer tabs show accurate, source-distinguished data with plugin attribution.

## Core Value

Users can reliably assemble and switch between Claude-focused coding environments from reusable local components without manually editing scattered config files.

## Requirements

### Validated

- ✓ Browse and edit Claude-compatible configuration files through a local web UI and CLI launcher — existing
- ✓ Manage core extension component types including agents, skills, commands, plugins, and settings through the current API/UI surface — existing
- ✓ Support a local store and profile model for composing reusable extension sets — existing foundation
- ✓ Fix Hooks/MCP/LSP Explorer tabs to distinguish local config vs plugin-provided data — v1.1
- ✓ Hide CLAUDE.md tab until feature is implemented — v1.1
- ✓ Fix Plugins tab profile reference display — v1.1
- ✓ Make ClaudeUI genuinely usable as a personal manager for Claude extension components — v1.0
- ✓ Make the local store the primary place to import, organize, inspect, and reuse components — v1.0
- ✓ Let users create profiles by combining components from the store into named working setups — v1.0
- ✓ Make switching profiles fast and trustworthy with transactional activation — v1.0
- ✓ Preserve Claude's existing file conventions as the storage and activation standard — v1.0
- ✓ Model config as a first-class store component type (API key, base URL, model name, provider) — v1.2
- ✓ Model config store UI and profile integration — v1.2
- ✓ Activation integration via settings.json env vars — v1.2
- ✓ CLI launcher: `cu` command starts server and auto-opens browser — v1.3
- ✓ Pre-built UI static assets bundled into package, no runtime build — v1.3
- ✓ Port conflict handling with graceful fallback — v1.3
- ✓ Startup status messages during CLI launch — v1.3
- ✓ Global install via `npm install -g @aiou/cu` with zero additional setup — v1.3
- ✓ Self-contained CJS bundle with all runtime deps inlined — v1.3
- ✓ Centralized path resolution via ConfigLocator — all `.claude` path references through single service (Phase 10)
- ✓ Project-local `.claude/` discovery at startup with CWD-only check and silent fallback — Phase 10
- ✓ SourceBadge project variant with green (#22c55e) rendering and shared schema `'project'` source support — Phase 10
- ✓ Dual-source inventory loading — global and project items merged in all routes with source badges (Phase 11)
- ✓ Write path rebrand to ~/.cui/ — managed data writes separate from plugin reads at ~/.claude/ (Phase 12)
- ✓ CUI_HOME env var independently overrides write path, AGENT_HOME only affects plugin/project paths

### Active

- [ ] Refactor ClaudeUI UI to use uitripled component library (shadcn-based) — v1.5
- [ ] Leave room for future support of other coding-agent ecosystems through import and conversion into the Claude-centered model
- [ ] CLI auto-update mechanism
- [ ] CLI configuration file for default port, browser preference, etc.
- [ ] `cu dev` mode for development with hot reload

### Out of Scope

- Building a brand-new cross-agent skill specification in v1 — the product should follow Claude's existing conventions first
- Full first-release parity across every coding-agent ecosystem — multi-ecosystem support comes later through adapters and conversion
- Replacing the local-first model with a remote marketplace as the core workflow — the primary store is local and user-owned

## Context

Brownfield TypeScript monorepo with separate UI, CLI, and shared schema packages. All milestones v1.0–v1.4 complete. ConfigLocator centralizes all path resolution with split writeBaseDir (~/.cui/) and claudeCodeDir (~/.claude/). Project-local dual-source loading with merge and source attribution. CLI builds as self-contained CJS bundle via tsup, publishes as `@aiou/cu`. UI uses React 18, Vite, Tailwind v3, framer-motion with custom design tokens. uitripled (shadcn-based component library) source available at vendor/uitripled/ for migration reference.

## Constraints

- **Storage Standard**: Claude-compatible file structure and semantics — v1 should use Claude's existing conventions as the canonical storage model
- **Platform**: Local filesystem-based activation — current profile switching relies on symlinks/plugin generation and is therefore constrained by host filesystem behavior
- **Architecture**: Brownfield evolution over rewrite — existing store/profile services and UI should be leveraged rather than replaced wholesale
- **Audience**: Advanced multi-environment users — workflows should optimize for power and reuse, not only basic single-profile editing
- **UI Framework**: uitripled components copied via shadcn pattern (source copy, not npm package) — components live in the codebase and can be adapted

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Claude conventions as the canonical storage model for v1 | Existing formats already exist and the immediate goal is to make Claude workflows good, not invent a new standard | ✓ Good |
| Treat the local store as the center of the product experience | Users want to import existing components, inspect what is installed, and recombine those assets into new profiles | ✓ Good |
| Position profiles as reusable component compositions with fast switching | Quick context switching is the daily workflow the user described and should be a first-class capability | ✓ Good |
| Defer broader agent-ecosystem support to later import/conversion layers | Future expansion matters, but v1 should avoid abstraction that weakens Claude usability today | ✓ Good |
| Use proper-lockfile for inter-process file locking | Needed atomic activation to prevent race conditions between concurrent processes | ✓ Good |
| Use discriminated union for dialog state machine | Separate boolean flags lead to impossible states | ✓ Good |
| Normalize active profile at read boundary | Cleaner than changing on-disk .active format | ✓ Good |
| Use per-profile backup naming after the activating profile | Simple deactivation lookup without scanning | ✓ Good |
| Flatten hooks into individual entries with event name and composite name for source tagging | Hooks in settings.json are nested by event — flattening enables uniform source tagging | ✓ Good |
| Allow name collisions between local and plugin entries | Frontend SourceBadge distinguishes them visually — no need to prevent at API level | ✓ Good |
| useMemo for pluginRefMap at top-level component | React hooks rules require hooks at top level, not inside conditional render functions | ✓ Good |
| Profile references use blue pill badges (1-2 refs) / summary text (3+) | Matches existing StoreComponentList pattern for consistent UI | ✓ Good |
| Explicit noExternal list of 9 deps instead of regex catch-all | tsup v8+ regex is unreliable per upstream issue #619 | ✓ Good |
| CJS output with .cjs extension for type:module packages | Avoids conflict with package.json type:module field | ✓ Good |
| Banner+define pattern to shim import.meta.url in CJS | Keeps source code ESM-clean while supporting CJS bundle output | ✓ Good |
| Prepublish name rewrite from @claudeui/cli to @aiou/cu with process.on('exit') restore | Original package.json never permanently modified | ✓ Good |
| Files allowlist (not .npmignore) for tarball control | Explicit control over what ships in the npm package | ✓ Good |
| AGENT_HOME stays as .claude for v1.3, directory rebrand deferred to v2 | Avoids breaking change in CLI MVP release | ✓ Good |
| CUI_HOME overrides writeBaseDir, AGENT_HOME only affects claudeCodeDir and project discovery | Separation of concerns — write path and plugin/project paths are independently configurable | ✓ Good |
| Use uitripled (shadcn-based) as UI component library via source copy | 280+ components available, matches existing cn() pattern, Radix UI primitives provide accessibility out of the box | ✓ Good |
| Map ClaudeUI design tokens to shadcn token system rather than adopting oklch color space | Preserves current dark theme appearance while enabling uitripled component compatibility | Pending |
| Add @ path alias in tsconfig.json + vite.config.ts for uitripled compatibility | Zero code changes to copied uitripled components, matches shadcn convention | Pending |
| Move cn() from src/components/cn.ts to src/lib/utils.ts, update all 28 imports | Unifies utility location with shadcn convention that uitripled components expect | Pending |
| Upgrade React from ^18.2.0 to ^19.0.0 (packages/ui only) | uitripled peer dep is React 19; CLI and shared packages have no React deps | Pending |
| Install exact Radix UI versions uitripled specifies | Proven compatibility between uitripled components and specific Radix versions | Pending |
| Keep "use client" directives in copied uitripled components | Harmless in Vite, avoids unnecessary diff from source | Pending |

## Current Milestone: v1.5 UI Refactor — uitripled Migration

**Goal:** Refactor ClaudeUI's UI to use uitripled components wherever possible, replacing hand-built components with shadcn-based primitives.

**Target features:**
- Install uitripled infrastructure (Radix UI deps, copied primitives, barrel exports)
- Map ClaudeUI design tokens to shadcn token system
- Migrate all card, sidebar, tab, badge, dialog, form, and utility components
- Validate accessibility, visual parity, and test coverage

**Phases:** 13–16 (uitripled Foundation → Core UI Migration → Dialogs & Forms → Polish & Validation)

<details>
<summary>v1.4 archive</summary>

**Goal:** CLI loads project-local `.claude/` alongside global, and activation writes go to `.cu`.

**Target features:**
- Discover and load project `.claude/` directory on startup (alongside global)
- Merge both stores into unified views with source badges, project overrides global
- Rebrand activation/write path from `.claude` to `.cu` (store, profiles, settings)

</details>

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-19 for v1.5 milestone start*
