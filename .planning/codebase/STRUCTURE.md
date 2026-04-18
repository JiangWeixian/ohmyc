# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
claudeui/
├── packages/
│   ├── cli/                  # CLI + Fastify server
│   │   ├── src/
│   │   │   ├── index.ts       # CLI entry
│   │   │   └── server/        # API + static serving
│   │   │       ├── routes/    # REST endpoints
│   │   │       └── services/  # File-backed services
│   ├── ui/                   # React UI (Vite)
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── hooks/         # Data hooks for API
│   │   │   ├── App.tsx        # Router
│   │   │   ├── Explorer.tsx   # Explorer view
│   │   │   ├── ProfilesView.tsx # Profiles view
│   │   │   └── main.tsx       # UI entry
│   │   └── index.html
│   └── shared/               # Zod schemas + types
│       └── src/
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

## Directory Purposes

**`packages/cli/src/server/routes/`:**
- Purpose: Fastify route handlers
- Contains: `agents.ts`, `skills.ts`, `commands.ts`, `profiles.ts`, `store.ts`, `configs.ts`, `plugins.ts`, `settings.ts`
- Key files: `packages/cli/src/server/routes/store.ts`, `packages/cli/src/server/routes/profiles.ts`

**`packages/cli/src/server/services/`:**
- Purpose: File-backed business logic
- Contains: `AgentService`, `SkillService`, `CommandService`, `ProfileService`, `StoreService`, `PluginService`
- Key files: `packages/cli/src/server/services/profileService.ts`, `packages/cli/src/server/services/storeService.ts`

**`packages/ui/src/hooks/`:**
- Purpose: API query/mutation hooks
- Contains: `useAgents.ts`, `useSkills.ts`, `useCommands.ts`, `useProfiles.ts`, `useStore.ts`, `useSettings.ts`, `usePlugins.ts`, `useConfigs.ts`

**`packages/ui/src/components/`:**
- Purpose: UI component library
- Contains: `profiles/`, `store/`, `settings/`, `ui/` subtrees
- Key files: `packages/ui/src/components/profiles/ProfileEditor.tsx`, `packages/ui/src/components/store/StoreComponentList.tsx`

**`packages/shared/src/`:**
- Purpose: Zod schemas + shared types
- Contains: `agentSchema.ts`, `skillSchema.ts`, `commandSchema.ts`, `profileSchema.ts`, `settingsSchema.ts`, `modelConfigSchema.ts`, `pluginSchema.ts`

## Key File Locations

**Entry Points:**
- `packages/cli/src/index.ts`: CLI command handler
- `packages/cli/src/server/index.ts`: Fastify server setup
- `packages/ui/src/main.tsx`: React app bootstrap
- `packages/ui/src/App.tsx`: Router and view switcher

**Configuration:**
- `packages/ui/vite.config.ts`: Vite config
- `packages/ui/tailwind.config.js`: Tailwind config
- `packages/ui/postcss.config.js`: PostCSS config
- `tsconfig.json`: Root TS config

**Core Logic:**
- `packages/cli/src/server/services/*Service.ts`: file-backed CRUD
- `packages/ui/src/hooks/*.ts`: UI data layer
- `packages/shared/src/*.ts`: schema definitions

**Testing:**
- `packages/cli/src/server/routes/__tests__/`
- `packages/cli/src/server/services/__tests__/`
- `packages/ui/src/__tests__/`

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `packages/ui/src/components/Sidebar.tsx`)
- Hooks: `useX.ts` (e.g., `packages/ui/src/hooks/useProfiles.ts`)
- Services: `camelCaseService.ts` (e.g., `packages/cli/src/server/services/profileService.ts`)
- Routes: `plural.ts` (e.g., `packages/cli/src/server/routes/agents.ts`)
- Schemas: `*Schema.ts` (e.g., `packages/shared/src/profileSchema.ts`)

**Directories:**
- Feature groups under UI: `profiles/`, `store/`, `settings/`, `ui/` in `packages/ui/src/components/`
- Tests colocated in `__tests__/`

## Where to Add New Code

**New API Endpoint:**
- Route handler: `packages/cli/src/server/routes/<area>.ts`
- Service logic: `packages/cli/src/server/services/<area>Service.ts`

**New UI Feature:**
- View/Component: `packages/ui/src/components/<area>/`
- Data hook: `packages/ui/src/hooks/use<Area>.ts`
- Route/view wiring: `packages/ui/src/App.tsx` or `packages/ui/src/Explorer.tsx`

**New Shared Schema:**
- Add to `packages/shared/src/<entity>Schema.ts`
- Export in `packages/shared/src/index.ts`

## Special Directories

**`dist/`:**
- Purpose: build output (UI + CLI)
- Generated: Yes
- Committed: No

**`.claude/` (runtime data):**
- Purpose: user data store (profiles, agents, skills, commands, store, plugins)
- Managed by: `packages/cli/src/server/index.ts` and services
- Committed: No

---

*Structure analysis: 2026-04-13*
