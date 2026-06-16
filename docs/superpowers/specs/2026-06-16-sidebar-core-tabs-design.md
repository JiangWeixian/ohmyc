# Sidebar Core Tabs Design

## Goal

Simplify the Explorer sidebar so the active management surface shows only the four core resource tabs:

- Agents
- Commands
- Skills
- Plugins

Timeline remains available in the sidebar under the existing Activity section. Hooks, MCP Servers, and LSP Servers are removed from the visible Explorer tab set.

## Current State

`packages/ui/src/explorer.tsx` defines `SECTIONS` with seven Explorer tabs: Agents, Skills, Commands, Plugins, Hooks, MCP Servers, and LSP Servers. The `Sidebar` component also renders Timeline separately above those tabs.

The Plugins route currently renders an Environment summary before the plugin list. That summary reads hooks, MCP servers, and LSP servers through `useHooks`, `useMcpServers`, and `useLspServers`, then displays workspace-level counts. Plugin cards themselves only show plugin-owned Agents, Skills, Commands, and Installs counts.

## Decisions

1. Keep Timeline visible.
   Timeline is not part of the four Explorer resource tabs; it remains the Activity entry in the sidebar.

2. Limit Explorer tabs to Agents, Commands, Skills, and Plugins.
   Hooks, MCP Servers, and LSP Servers are no longer active top-level UI destinations.

3. Remove the Plugins Environment summary.
   The workspace-level Hooks/MCP/LSP count panel is deleted from the Plugins page. The Plugins page starts with the Plugins section header and plugin inventory cards.

4. Keep lower-level config APIs and hooks for now.
   `useHooks`, `useMcpServers`, `useLspServers`, and the desktop/core config routes stay in place. This change is a UI information-architecture cleanup, not a backend capability removal.

5. Treat legacy config tab URLs as invalid Explorer tabs.
   `/explore/hooks`, `/explore/mcp`, and `/explore/lsp` should fall back to the default Explorer content rather than rendering removed pages.

## User Experience

The sidebar keeps the same chrome and visual style. Users see:

- Activity
  - Timeline
- Explore
  - Agents
  - Commands
  - Skills
  - Plugins

The Plugins page no longer opens with a general Environment panel. It shows the plugin inventory directly, with each plugin card retaining the existing enabled state, marketplace, install count, and component counts for Agents, Skills, and Commands.

## Implementation Shape

- Update `SECTIONS` in `packages/ui/src/explorer.tsx` to contain only the four core resource tabs, ordered as Agents, Commands, Skills, Plugins.
- Remove unused icon imports and config-section rendering branches for Hooks, MCP, and LSP from the Explorer UI.
- Remove `renderEnvironmentSummary` and its Hooks/MCP/LSP data reads from the Plugins route.
- Keep Timeline route rendering and default route behavior unchanged.
- Update command-palette and keyboard behavior only if they expose removed config destinations. Current palette destinations already omit Hooks/MCP/LSP.
- Update `DESIGN.md` before implementation to record the active sidebar model and the Plugins summary removal.

## Error Handling

Legacy URLs for removed tabs should not show stale pages or blank panels. They should resolve to the same fallback behavior used for unknown Explorer tabs.

Plugin loading errors and empty states remain unchanged. Removing the Environment summary also removes its implicit dependency on config read success.

## Testing

Focused UI tests should assert:

- Sidebar contains Timeline, Agents, Commands, Skills, and Plugins.
- Sidebar does not contain Hooks, MCP Servers, or LSP Servers.
- `/explore/hooks`, `/explore/mcp`, and `/explore/lsp` do not render their old config pages.
- `/explore/plugins` does not render the Environment summary.
- Plugin cards still render Agents, Skills, Commands, Installs, enabled state, and marketplace information.

Existing hook/API tests for configs should remain valid because the lower-level config capability is intentionally retained.
