# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Monorepo with CLI-hosted Fastify API serving a React SPA

**Key Characteristics:**
- Three packages: CLI server, UI, shared schemas (`packages/cli`, `packages/ui`, `packages/shared`)
- File-based persistence for agents/skills/commands/profiles/model configs
- Plugin-aware aggregation (local + plugin + profile sources)

## Layers

**CLI/API Layer:**
- Purpose: Serve REST endpoints and static UI assets
- Location: `packages/cli/src/server/`
- Contains: Fastify routes and services
- Depends on: filesystem, shared schemas, gray-matter
- Used by: UI hooks via `/api/*`

**Shared Schema Layer:**
- Purpose: Zod schemas + types for requests/responses
- Location: `packages/shared/src/`
- Contains: `*Schema.ts` definitions and exports
- Depends on: Zod
- Used by: CLI routes/services and UI types

**UI Layer:**
- Purpose: SPA for exploring and editing `.claude` data
- Location: `packages/ui/src/`
- Contains: React components, hooks, router
- Depends on: React, React Router, React Query
- Used by: End users in browser

## Data Flow

**Local UI → API:**
1. UI hooks call `/api/*` (e.g., `packages/ui/src/hooks/useAgents.ts`).
2. Fastify routes delegate to services (`packages/cli/src/server/routes/*.ts`).
3. Services read/write `.claude` files and markdown (`packages/cli/src/server/services/*.ts`).
4. Responses returned as JSON to UI.

**Profile Activation Flow:**
1. UI calls `/api/profiles/:name/activate` (`packages/ui/src/hooks/useProfiles.ts`).
2. `ProfileService.activate` updates `.claude` state, creates symlinks, and writes settings (`packages/cli/src/server/services/profileService.ts`).
3. Active profile recorded in `profiles/.active` (same file).

## Key Abstractions

**Service Classes:**
- Purpose: CRUD + filesystem persistence per entity
- Examples: `packages/cli/src/server/services/agentService.ts`, `skillService.ts`, `commandService.ts`
- Pattern: Read/write Markdown with gray-matter and JSON for configs

**Plugin Resolver:**
- Purpose: Resolve enabled plugin install paths
- Example: `packages/cli/src/server/services/pluginResolver.ts`

**Store Import:**
- Purpose: Copy component bundles into `~/.claude/store`
- Example: `packages/cli/src/server/services/storeService.ts`

## Entry Points

**CLI Entry:**
- Location: `packages/cli/src/index.ts`
- Triggers: `claudeui` command
- Responsibilities: Parse args, start server

**Server Entry:**
- Location: `packages/cli/src/server/index.ts`
- Triggers: CLI start
- Responsibilities: Create Fastify, register routes, serve UI

**UI Entry:**
- Location: `packages/ui/src/main.tsx`
- Triggers: Browser load
- Responsibilities: Create React root, router, query client

## Error Handling

**Strategy:** Return HTTP status codes + JSON error messages

**Patterns:**
- Routes validate with Zod and send 400/404 (`packages/cli/src/server/routes/*.ts`).
- Services return `null`/`false` on missing files (`packages/cli/src/server/services/*.ts`).

## Cross-Cutting Concerns

**Logging:** Fastify logger enabled in `packages/cli/src/server/index.ts`
**Validation:** Zod schemas in `packages/shared/src/*.ts`
**Authentication:** None (local server, no auth layer)

---

*Architecture analysis: 2026-04-13*
