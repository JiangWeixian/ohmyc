## Module Analysis Report

**Project Type**: Monorepo (pnpm workspaces)
**Workspace Root**: `/Volumes/ORICO/Users/jiangwei/projects/claudeui`

---

### @ohmyc/shared
- **Responsibility**: Shared Zod schemas and TypeScript types used across the monorepo for configuration, agents, skills, commands, and profiles.
- **Key Files**:
  - `src/index.ts` — Re-exports all schema modules.
  - `src/schemas.ts` — Core `SettingsSchema` and `ClaudeMdSchema` definitions.
  - `src/settings-schema.ts` — Settings-related Zod schemas.
  - `src/agent-schema.ts` — Agent definition schemas.
  - `src/skill-schema.ts` — Skill definition schemas.
  - `src/command-schema.ts` — Command definition schemas.
  - `src/model-config-schema.ts` — Model configuration schemas.
  - `src/store-schema.ts` — Store/persistence schemas.
  - `src/plugin-schema.ts` — Plugin installation metadata schemas.
  - `src/profile-schema.ts` — Profile definition schemas.
- **Exports**: `SettingsSchema`, `ClaudeMdSchema`, `Settings`, `ClaudeMd`, plus agent/skill/command/model/store/plugin/profile types.
- **Depends On**: `zod`, `zod-to-json-schema`
- **Used By**: `@ohmyc/cli`, `@ohmyc/ui`, `@ohmyc/timeline-plugin`

---

### @ohmyc/timeline
- **Responsibility**: SQLite-based session timeline storage — parses AI assistant transcripts, ingests session metadata, and provides query APIs for heatmaps and event lists.
- **Key Files**:
  - `src/index.ts` — Public API: exports database lifecycle, ingest, writer, backfill, and query functions.
  - `src/schema.ts` — Database schema SQL, TypeScript interfaces (`SessionRow`, `SessionToolRow`, `SessionSkillRow`, `ParsedSessionData`, `HeatmapParams`, etc.), and migration definitions.
  - `src/db.ts` — Database lifecycle: `openDatabase`, `closeDatabase`, `migrate`, and `getDefaultDbPath`.
  - `src/ingest.ts` — Transcript parser: `parseTranscript` reads Claude Code JSONL files and returns structured `ParsedSessionData`.
  - `src/writer.ts` — Transactional session writer: `createWriter` prepares SQL statements and provides `writeSession` for upsert.
  - `src/query.ts` — Read-only query functions: `getHeatmap`, `getEvents`, `getSession`, `getProjects`, `getYears`, `getStatus`.
  - `src/backfill.ts` — Batch backfill logic for scanning project directories and importing all transcripts.
- **Exports**: `openDatabase`, `closeDatabase`, `ingestSession`, `createWriter`, `backfillAll`, `getHeatmap`, `getEvents`, `getSession`, `getProjects`, `getYears`, `getStatus`, plus all schema types and constants.
- **Depends On**: `better-sqlite3`
- **Used By**: `@ohmyc/cli`, `@ohmyc/timeline-plugin`

---

### @ohmyc/cli
- **Responsibility**: Node.js CLI and Fastify HTTP server — provides the `ohmyc`/`cui` command, serves the web UI, and exposes REST APIs for profiles, agents, skills, commands, settings, plugins, configs, and timeline data.
- **Key Files**:
  - `src/index.ts` — CLI entry point: defines `start`, `dashboard` commands using `cac`.
  - `src/launcher.ts` — Orchestrates server startup, port selection, browser opening, and graceful shutdown (`launchApp`).
  - `src/banner.ts` — ASCII banner generator reading package.json version.
  - `src/logger.ts` — Pino logger setup with daily-rotated file logs.
  - `src/server/index.ts` — Fastify server factory: `createServer`, `startServer`, `resolveStaticRoot`, route registration, and SPA fallback.
  - `src/server/services/config-locator.ts` — `ConfigLocator` class resolves all file-system paths (managed writes under `~/.cui/`, Claude Code reads under `~/.claude/`, project-scoped paths).
  - `src/server/services/agent-service.ts` — Agent CRUD and discovery logic.
  - `src/server/services/skill-service.ts` — Skill CRUD and discovery logic.
  - `src/server/services/command-service.ts` — Command CRUD and discovery logic.
  - `src/server/services/profile-service.ts` — Profile activation, comparison, and management.
  - `src/server/services/store-service.ts` — Store/persistence operations.
  - `src/server/services/plugin-service.ts` — Plugin registry management.
  - `src/server/services/plugin-resolver.ts` — Plugin dependency resolution.
  - `src/server/services/lock-service.ts` — File locking for concurrent access.
  - `src/server/services/model-config-service.ts` — Model configuration management.
  - `src/server/routes/agents.ts` — `/api/agents` REST endpoints.
  - `src/server/routes/skills.ts` — `/api/skills` REST endpoints.
  - `src/server/routes/commands.ts` — `/api/commands` REST endpoints.
  - `src/server/routes/profiles.ts` — `/api/profiles` REST endpoints.
  - `src/server/routes/settings.ts` — `/api/settings` REST endpoints.
  - `src/server/routes/config.ts` — `/api/config` REST endpoints.
  - `src/server/routes/configs.ts` — `/api/configs` REST endpoints.
  - `src/server/routes/plugins.ts` — `/api/plugins` REST endpoints.
  - `src/server/routes/store.ts` — `/api/store` REST endpoints.
  - `src/server/routes/timeline.ts` — `/api/timeline` REST endpoints.
  - `src/server/routes/inventory-source.ts` — Source/inventory endpoints.
  - `src/commands/dashboard.ts` — Dashboard CLI subcommands: `install`, `uninstall`, `sync`, `ingest`, `doctor`.
- **Exports**: CLI binary (`ohmyc`/`cui`), server factory functions, and service classes.
- **Depends On**: `@ohmyc/shared`, `@ohmyc/timeline`, `fastify`, `@fastify/static`, `cac`, `better-sqlite3`, `get-port`, `open`, `pino`, `pino-roll`, `proper-lockfile`, `gray-matter`, `untildify`, `zod-to-json-schema`
- **Used By**: None (top-level entry point)

---

### @ohmyc/ui
- **Responsibility**: React-based web dashboard — provides the visual interface for managing profiles, exploring agents/skills/commands, viewing the timeline heatmap, and editing configurations.
- **Key Files**:
  - `src/main.tsx` — React application entry point: mounts the app with `QueryClientProvider` and `BrowserRouter`.
  - `src/app.tsx` — Root component: sets up routing, command palette (`CommandPaletteProvider`), global keyboard shortcuts, and view switcher.
  - `src/explorer.tsx` — Explorer view for browsing agents, skills, commands, plugins, hooks, and configs via sidebar tabs.
  - `src/profiles-view.tsx` — Profiles view: list, create, edit, compare, and activate profiles.
  - `src/components/header.tsx` — Application header component.
  - `src/components/view-switcher.tsx` — Tab switcher between Profiles and Explorer views.
  - `src/components/command-palette.tsx` — Global ⌘K command palette with search and actions.
  - `src/components/profiles/profiles-sidebar.tsx` — Sidebar for profile navigation and selection.
  - `src/components/timeline/timeline-view.tsx` — Timeline heatmap and session list visualization.
  - `src/components/entity-card.tsx` / `src/components/entity-detail.tsx` — Reusable entity display components.
  - `src/components/compare-panel.tsx` — Profile comparison side panel.
  - `src/components/settings/settings-layout.tsx` — Settings editor layout.
  - `src/hooks/use-profiles.ts` — React Query hooks for profile CRUD and activation.
  - `src/hooks/use-agents.ts` — React Query hooks for agent data fetching.
  - `src/hooks/use-skills.ts` — React Query hooks for skill data fetching.
  - `src/hooks/use-commands.ts` — React Query hooks for command data fetching.
  - `src/hooks/use-timeline.ts` — React Query hooks for timeline heatmap and events.
  - `src/hooks/use-configs.ts` — React Query hooks for config, hook, MCP, and LSP data.
  - `src/hooks/use-plugins.ts` — React Query hooks for plugin and marketplace data.
  - `src/hooks/use-store.ts` — React Query hooks for store data.
  - `src/hooks/use-settings.ts` — React Query hooks for settings data.
  - `src/hooks/use-keyboard-shortcuts.ts` — Global keyboard shortcut handler.
  - `src/lib/utils.ts` — Utility functions (Tailwind `cn` helper).
  - `src/lib/markdown-frontmatter.ts` — Markdown frontmatter parser.
- **Exports**: Built static assets (HTML, CSS, JS) consumed by `@ohmyc/cli`.
- **Depends On**: `@ohmyc/shared`, `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `framer-motion`, `cmdk`, `lucide-react`, `@radix-ui/*`, `codemirror`, `tailwindcss`, `class-variance-authority`, `tailwind-merge`, `js-yaml`, `sonner`, `fast-deep-equal`, `@lobehub/icons`
- **Used By**: `@ohmyc/cli` (serves built UI assets)

---

### @ohmyc/timeline-plugin
- **Responsibility**: OpenCode plugin that captures session lifecycle events (turns, tokens, tools, skills) in real-time and writes them to the shared SQLite database at `~/.cui/timeline.db`.
- **Key Files**:
  - `opencode.ts` — Plugin entry point: initializes `bun:sqlite` database, creates event handler and tool hooks, exports `TimelinePlugin`.
  - `hooks/` — Plugin hook definitions (if any additional hooks exist).
- **Exports**: `TimelinePlugin` (default), `createAccumulator`, `createEventHandler`, `EventHandlerDeps`
- **Depends On**: `@opencode-ai/plugin` (peer), `@ohmyc/timeline` (via relative path import), `bun:sqlite`
- **Used By**: OpenCode runtime (loaded as a plugin by the OpenCode CLI)

---

## Dependency Graph

```
@ohmyc/shared
    ↑
    ├── @ohmyc/cli
    ├── @ohmyc/ui
    └── @ohmyc/timeline-plugin (via @ohmyc/timeline)

@ohmyc/timeline
    ↑
    ├── @ohmyc/cli
    └── @ohmyc/timeline-plugin

@ohmyc/ui
    ↑
    └── @ohmyc/cli (serves built assets)

@ohmyc/timeline-plugin
    └── (consumed by OpenCode runtime, not by other packages)
```

## Architecture Summary

OhMyC is a **configuration management dashboard** for AI assistant tooling (Claude Code, OpenCode). It consists of:

1. **Shared types** (`@ohmyc/shared`) — Central schema definitions using Zod.
2. **Timeline storage** (`@ohmyc/timeline`) — SQLite database for tracking AI session history with transcript parsing and query APIs.
3. **CLI + Server** (`@ohmyc/cli`) — Node.js CLI that doubles as a Fastify HTTP server, exposing REST APIs and serving the React UI.
4. **Web Dashboard** (`@ohmyc/ui`) — React SPA for visual management of profiles, agents, skills, commands, and timeline visualization.
5. **OpenCode Plugin** (`@ohmyc/timeline-plugin`) — Real-time session capture plugin for the OpenCode runtime, feeding data into the same SQLite database.
