# Phase 4: Explorer Tab Corrections - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix Explorer sidebar tabs to show accurate, source-distinguished data and only expose implemented features. This covers: adding source badges to Hooks/MCP/LSP config entries, surfacing plugin-contributed config entries alongside local ones, hiding the unimplemented CLAUDE.md tab from the sidebar, and displaying which profiles reference each plugin. No editing capabilities, no new features, no cross-ecosystem work.

</domain>

<decisions>
## Implementation Decisions

### Source badge display
- Reuse the existing `SourceBadge` component for hooks/MCP/LSP entries — same visual treatment as agents/skills/commands cards
- Badges are per-entry: each hook, MCP server, and LSP server entry shows its own badge
- Badge appears on the existing `ConfigEntryCard` layout — add SourceBadge next to the entry name, no card redesign

### Plugin contribution data
- API returns a merged list where each config entry has a `source` field ("local" or "plugin") and a `pluginId` when applicable
- Only enabled plugins contribute to hooks/MCP/LSP lists — disabled plugin contributions are excluded
- Use existing `PluginService.scanComponents()` which already reads hooks/hooks.json, .mcp.json, and .lsp.json from plugin install paths
- The configs API routes (configs.ts) need to be updated to merge local config data with plugin-contributed data, tagging each entry with source + pluginId

### CLAUDE.md tab removal
- Remove the `claude-md` entry from the `SECTIONS` array in Explorer.tsx only
- Leave the route handler and placeholder code in place (unreachable) — dead code cleanup is separate

### Plugin profile references
- Match the existing `StoreComponentList` reference display pattern: "0" for none, count + inline blue pill badges with profile names for 1-2 refs, "Used by N profiles" with hover tooltip for 3+
- Compute references client-side from profile data — build a `referencedByMap` for plugins, same approach as StoreComponentList builds for agents/skills/commands
- No new API endpoint needed

### Claude's Discretion
- Exact shape of the merged API response (array of tagged entries vs. object with source metadata)
- How to handle name collisions between local and plugin-contributed entries
- Whether to flatten plugin hook event structure (e.g., SessionStart hooks array) or preserve the nested format
- Exact placement of profile reference display within the plugin card

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/03-safe-switching-and-reference-safety/03-CONTEXT.md` — Transactional activation, deactivation cleanup, concurrent protection, backup strategy

### Existing implementation anchors
- `packages/ui/src/Explorer.tsx` — Main Explorer component with SECTIONS array, tab routing, hooks/MCP/LSP rendering via ConfigSection, plugins rendering, CLAUDE.md placeholder
- `packages/ui/src/components/ConfigSection.tsx` — Current config entry card rendering (no source badges)
- `packages/ui/src/components/SourceBadge.tsx` — Existing source badge component handling local/profile/plugin sources
- `packages/ui/src/components/Sidebar.tsx` — Sidebar component that renders SECTIONS array
- `packages/cli/src/server/routes/configs.ts` — Current configs API routes (local-only, no source attribution)
- `packages/cli/src/server/routes/plugins.ts` — Plugins API routes
- `packages/cli/src/server/services/pluginService.ts` — PluginService with scanComponents() that already reads hooks/mcpServers/lspServers from plugin installs
- `packages/ui/src/hooks/useConfigs.ts` — Hooks for fetching hooks/MCP/LSP data
- `packages/ui/src/hooks/usePlugins.ts` — Hooks for fetching plugin data
- `packages/ui/src/components/store/StoreComponentList.tsx` — Reference display pattern to match (referencedByMap, profile name badges)

### Codebase structure
- `.planning/codebase/STRUCTURE.md` — Directory layout, where to add code
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, styling (Tailwind + CSS vars), React Query patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SourceBadge` component: already handles local/plugin distinction with correct styling — drop-in for config entries
- `PluginService.scanComponents()`: already discovers hooks, mcpServers, lspServers from plugin install directories — the data pipeline exists
- `StoreComponentList` referencedByMap pattern: client-side profile reference computation — replicate for plugins
- `useProfiles` hook: already fetches all profiles with their plugin references — available in Explorer

### Established Patterns
- Source attribution via `source` + `pluginId` fields on entity objects — agents/skills/commands already use this
- Config sections rendered through `ConfigSection` component with `ConfigEntryCard` — add badge to card
- React Query for data fetching, `useQuery` with typed select — hooks/useConfigs.ts follows this pattern
- Tailwind CSS with CSS variables for theming — consistent styling through utility classes

### Integration Points
- `configs.ts` routes need access to `PluginService` to merge plugin contributions — dependency injection via Fastify plugin options
- Explorer.tsx `renderPlugins()` needs `useProfiles` hook to build plugin-to-profile reference map
- `ConfigSection`/`ConfigEntryCard` need `source` and `pluginId` props added to accept and display badges
- SECTIONS array edit is a one-line change in Explorer.tsx

</code_context>

<specifics>
## Specific Ideas

- Plugin hooks follow a nested structure (event → array of hook groups → hooks array). The codex plugin example: `hooks.SessionStart[0].hooks[0].command` — need to flatten or adapt this for display alongside local hooks from settings.json
- The LSP plugin (claude-code-lsps) has individual LSP server directories each with their own plugin.json — the scanComponents already handles this
- Keep the Explorer tabs visually consistent with existing agents/skills/commands cards

</specifics>

<deferred>
## Deferred Ideas

- Full removal of CLAUDE.md route handler and placeholder code — can clean up dead code later
- Editing hooks/MCP/LSP from Explorer tabs — future feature
- Non-Claude ecosystem adapter imports — deferred to future milestone

</deferred>

---
*Phase: 04-explorer-tab-corrections*
*Context gathered: 2026-04-07*
