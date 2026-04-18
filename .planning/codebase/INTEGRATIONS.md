# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**Local API (UI → CLI):**
- Fastify HTTP API - UI fetches `/api/*` from the local server
  - Server entry: `packages/cli/src/server/index.ts`
  - Client hooks: `packages/ui/src/hooks/*.ts`

**Plugin System:**
- Plugin discovery and metadata loading from local filesystem
  - Resolver: `packages/cli/src/server/services/pluginResolver.ts`
  - Plugin inventory: `packages/cli/src/server/services/pluginService.ts`

## Data Storage

**Databases:**
- File system only (no DB detected)
  - Profiles: `~/.claude/profiles/*/profile.json` via `packages/cli/src/server/services/profileService.ts`
  - Store components: `~/.claude/store/*` via `packages/cli/src/server/services/storeService.ts`
  - Agents/Commands: `~/.claude/agents/*.md`, `~/.claude/commands/*.md` via `agentService.ts`, `commandService.ts`
  - Skills: `~/.claude/skills/*/SKILL.md` via `skillService.ts`
  - Settings: `~/.claude/settings.json` via `packages/cli/src/server/routes/settings.ts`
  - Model configs: `~/.claude/store/model-configs/*.json` via `modelConfigService.ts`

**File Storage:**
- Local filesystem only (no external storage providers detected)

**Caching:**
- React Query client cache in UI (`packages/ui/src/main.tsx`)

## Authentication & Identity

**Auth Provider:**
- None detected (local UI + local server, no auth layer)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Fastify built-in logger enabled in `packages/cli/src/server/index.ts`

## CI/CD & Deployment

**Hosting:**
- Local CLI-hosted server; UI served as static assets via `@fastify/static` (`packages/cli/src/server/index.ts`)

**CI Pipeline:**
- Not detected

## Environment Configuration

**Required env vars:**
- `AGENT_HOME` - overrides `.claude` directory name in `packages/cli/src/server/index.ts`

**Secrets location:**
- Settings and model configs stored locally under `~/.claude` (handled by `packages/cli/src/server/services/profileService.ts` and `modelConfigService.ts`)

## Webhooks & Callbacks

**Incoming:**
- None (no external webhooks; only local HTTP API)

**Outgoing:**
- None detected (no external API clients found)

---

*Integration audit: 2026-04-13*
