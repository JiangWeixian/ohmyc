# Phase 4: Explorer Tab Corrections - Research

**Researched:** 2026-04-07
**Domain:** UI data accuracy, source attribution in Explorer config tabs
**Confidence:** HIGH

## Summary

Phase 4 is a bugfix phase focused on making Explorer sidebar tabs display accurate, source-distinguished data and hiding unimplemented features. The core work involves: (1) updating the backend configs API routes to merge local config data with plugin-contributed data, tagging each entry with source and pluginId metadata; (2) updating the ConfigSection/ConfigEntryCard frontend components to render SourceBadge on each entry; (3) removing the CLAUDE.md tab from the sidebar SECTIONS array; and (4) adding profile reference counts to the Plugins tab.

The patterns for all four changes already exist in the codebase. Agents/skills/commands routes already demonstrate source-tagged API responses with PluginResolver. SourceBadge already handles local/profile/plugin rendering. StoreComponentList already shows the profile reference pattern with referencedByMap. The work is primarily wiring existing patterns into the configs routes and ConfigSection component.

**Primary recommendation:** Follow the exact source-attribution pattern from agents.ts (PluginResolver + source/pluginId tagging) for the configs routes, reuse SourceBadge drop-in in ConfigEntryCard, and replicate the referencedByMap computation from StoreComponentList in renderPlugins.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Reuse the existing `SourceBadge` component for hooks/MCP/LSP entries -- same visual treatment as agents/skills/commands cards
- Badges are per-entry: each hook, MCP server, and LSP server entry shows its own badge
- Badge appears on the existing `ConfigEntryCard` layout -- add SourceBadge next to the entry name, no card redesign
- API returns a merged list where each config entry has a `source` field ("local" or "plugin") and a `pluginId` when applicable
- Only enabled plugins contribute to hooks/MCP/LSP lists -- disabled plugin contributions are excluded
- Use existing `PluginService.scanComponents()` which already reads hooks/hooks.json, .mcp.json, and .lsp.json from plugin install paths
- The configs API routes (configs.ts) need to be updated to merge local config data with plugin-contributed data, tagging each entry with source + pluginId
- Remove the `claude-md` entry from the `SECTIONS` array in Explorer.tsx only
- Leave the route handler and placeholder code in place (unreachable) -- dead code cleanup is separate
- Match the existing `StoreComponentList` reference display pattern: "0" for none, count + inline blue pill badges with profile names for 1-2 refs, "Used by N profiles" with hover tooltip for 3+
- Compute references client-side from profile data -- build a `referencedByMap` for plugins, same approach as StoreComponentList builds for agents/skills/commands
- No new API endpoint needed

### Claude's Discretion
- Exact shape of the merged API response (array of tagged entries vs. object with source metadata)
- How to handle name collisions between local and plugin-contributed entries
- Whether to flatten plugin hook event structure (e.g., SessionStart hooks array) or preserve the nested format
- Exact placement of profile reference display within the plugin card

### Deferred Ideas (OUT OF SCOPE)
- Full removal of CLAUDE.md route handler and placeholder code -- can clean up dead code later
- Editing hooks/MCP/LSP from Explorer tabs -- future feature
- Non-Claude ecosystem adapter imports -- deferred to future milestone
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TAB-01 | Hooks tab shows hook entries with source distinction -- local config (settings.json) entries display "local" badge, plugin-contributed entries display "plugin" badge with plugin name | configs.ts needs PluginResolver to merge plugin hooks; ConfigEntryCard needs source/pluginId props; SourceBadge handles rendering |
| TAB-02 | MCP Servers tab shows server entries with source distinction -- local config (.mcp.json) entries display "local" badge, plugin-contributed entries display "plugin" badge with plugin name | configs.ts needs PluginResolver to merge plugin .mcp.json entries; ConfigEntryCard needs source/pluginId props; SourceBadge handles rendering |
| TAB-03 | LSP Servers tab shows server entries with source distinction -- local config (.lsp.json) entries display "local" badge, plugin-contributed entries display "plugin" badge with plugin name | configs.ts needs PluginResolver to merge plugin .lsp.json entries; ConfigEntryCard needs source/pluginId props; SourceBadge handles rendering |
| TAB-04 | CLAUDE.md tab is hidden from the Explorer sidebar until the feature is implemented | Remove `{ id: 'claude-md', label: 'CLAUDE.md', icon: FileText }` from SECTIONS array in Explorer.tsx |
| PLUG-01 | Plugins tab correctly displays which profiles reference each plugin, showing profile names that include the plugin in their composition | Build referencedByMap from useProfiles data iterating profile.plugins arrays; render with StoreComponentList pattern in renderPlugins() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in use across all Explorer components |
| @tanstack/react-query | 5.x | Data fetching hooks | Used by useConfigs, usePlugins, useProfiles hooks |
| Fastify | 4.x | Backend API framework | configs.ts routes run on Fastify |
| Zod | 3.x | Type validation | Shared schemas already use Zod |
| Vitest | 1.x | Testing | Both packages use vitest run |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | 11.x | Animation | Already in ConfigEntryCard for entry animations |
| Tailwind CSS | 3.x | Styling | All component styling, including SourceBadge |
| Lucide React | N/A | Icons | ConfigSection and plugin cards use Lucide icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SourceBadge (existing) | Custom badge per tab | No benefit -- SourceBadge already handles all 3 source types |
| PluginResolver (existing) | Direct PluginService import in configs.ts | PluginResolver already encapsulates enabled-plugin discovery; reuse it |
| Client-side merge | Backend merge in configs.ts | Backend merge is cleaner, matches agents/skills/commands pattern, avoids double-fetching |

**Installation:** No new packages needed -- all dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure (unchanged from existing)
```
packages/
  cli/src/server/
    routes/
      configs.ts          # MODIFY: add plugin merging
      inventorySource.ts  # EXISTS: source resolution utility
    services/
      pluginResolver.ts   # EXISTS: enabled plugin path discovery
  ui/src/
    Explorer.tsx          # MODIFY: remove claude-md from SECTIONS, add profile refs to plugins
    components/
      ConfigSection.tsx   # MODIFY: add source/pluginId to ConfigEntryCard
      SourceBadge.tsx     # EXISTS: drop-in, no changes needed
    hooks/
      useConfigs.ts       # MODIFY: update response types for tagged entries
```

### Pattern 1: Source Attribution in API Routes (from agents.ts)
**What:** Backend merges local entities with plugin-contributed ones, tagging each with source and pluginId.
**When to use:** Any config/entity endpoint that needs to show both local and plugin data.
**Example:**
```typescript
// Source: packages/cli/src/server/routes/agents.ts (lines 18-39)
// Current pattern to replicate in configs.ts:
fastify.get('/api/agents', async () => {
  const agents = await service.list();
  // Tag local entries
  for (const agent of agents) {
    (agent as any).source = 'local';
  }
  // Aggregate from enabled plugins
  const pluginPaths = await resolver.getEnabledPluginPaths();
  for (const { id, installPath } of pluginPaths) {
    const pluginService = new AgentService(path.join(installPath, 'agents'));
    const pluginAgents = await pluginService.list();
    for (const agent of pluginAgents) {
      agents.push({ ...agent, source: 'plugin', pluginId: id });
    }
  }
  agents.sort((a, b) => a.id.localeCompare(b.id));
  return { agents };
});
```

### Pattern 2: Profile Reference Map (from StoreComponentList)
**What:** Client-side computation of which profiles reference a given entity.
**When to use:** Anywhere entity-to-profile relationship needs display.
**Example:**
```typescript
// Source: packages/ui/src/components/store/StoreComponentList.tsx (lines 77-97)
// For plugins, iterate profile.plugins instead of profile.agents/skills/commands:
const referencedByMap = new Map<string, string[]>();
for (const p of allProfiles) {
  for (const ref of p.plugins) {
    const existing = referencedByMap.get(ref) ?? [];
    existing.push(p.name);
    referencedByMap.set(ref, existing);
  }
}
```

### Pattern 3: ConfigEntryCard with Badge (proposed change)
**What:** Add source/pluginId props to ConfigEntryCard and render SourceBadge next to entry name.
**When to use:** ConfigSection rendering for hooks, MCP, LSP tabs.
**Example:**
```typescript
// Proposed change to ConfigEntryCard in ConfigSection.tsx:
interface ConfigEntryCardProps {
  name: string;
  data: Record<string, unknown>;
  icon: IconType;
  iconColor: string;
  index: number;
  source?: 'local' | 'plugin';  // NEW
  pluginId?: string;              // NEW
}

// Inside ConfigEntryCard render, add next to the <h3>:
<SourceBadge source={source ?? 'local'} pluginId={pluginId} />
```

### Anti-Patterns to Avoid
- **Duplicating PluginResolver logic:** configs.ts should import PluginResolver, not re-implement enabled-plugin discovery. PluginResolver already handles the enabledPlugins map from settings.json.
- **Breaking the configs API response shape for existing consumers:** The current response is `{ mcpServers: Record<string, any> }`, `{ hooks: Record<string, any> }`, `{ lspServers: Record<string, any> }`. The new response needs to preserve backward compatibility while adding source metadata. Use an array-of-tagged-entries approach or add a wrapper layer.
- **Fetching plugin data separately on the client:** The configs API should handle merging server-side. The client should not need to fetch /api/plugins and /api/configs separately and merge them.
- **Removing the claude-md route handler:** CONTEXT.md explicitly says leave the route handler and placeholder in place. Only remove the SECTIONS array entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enabled plugin discovery | Custom settings.json + installed_plugins.json parsing | `PluginResolver.getEnabledPluginPaths()` | Already exists, handles enabled filtering, returns `{ id, installPath }` |
| Source badge rendering | Custom badge component per tab | `SourceBadge` component | Already handles local/profile/plugin with correct styling |
| Profile reference computation | New API endpoint for plugin-to-profile mapping | Client-side `referencedByMap` from `useProfiles` data | CONTEXT.md says no new endpoint; StoreComponentList pattern already works |
| Plugin component scanning | Custom file reading in configs.ts | `PluginService.scanComponents()` | Already reads hooks/hooks.json, .mcp.json, .lsp.json from plugin paths |

**Key insight:** The data pipeline for plugin config contributions already exists (PluginService.scanComponents reads hooks, mcpServers, lspServers from plugin install directories). The gap is only in the configs.ts routes not using it.

## Common Pitfalls

### Pitfall 1: Hooks Data Structure Mismatch
**What goes wrong:** Local hooks from settings.json use an event-keyed nested structure `{ PreToolUse: [{ matcher, hooks: [{ type, command }] }] }`, while plugin hooks from hooks/hooks.json may use the same or a different structure. Merging them requires careful handling of the nested event arrays.
**Why it happens:** Hooks are not a flat key-value map like MCP/LSP servers. They have a nested structure: event name -> array of hook groups -> each with matcher + hooks array.
**How to avoid:** For hooks, the merged API response should preserve the event-keyed structure but tag individual hook entries with source/pluginId. Consider flattening to individual hook entries for display, or keeping the nested structure and tagging at the group level.
**Warning signs:** Plugin hooks showing as `[object Object]` in the UI, or nested events being lost during merge.

### Pitfall 2: Name Collisions Between Local and Plugin Entries
**What goes wrong:** A local .mcp.json might define server "db" and a plugin might also contribute a server named "db". Simple key-based merging would overwrite one.
**Why it happens:** Config files from different sources are not namespaced by convention.
**How to avoid:** For MCP/LSP (which are key-value maps), when collisions occur, prefix the plugin entry name or keep both with source distinction. The CONTEXT.md marks this as Claude's discretion.
**Warning signs:** Duplicate keys silently dropped in merged response.

### Pitfall 3: Disabled Plugins Still Contributing
**What goes wrong:** Disabled plugins' hooks/MCP/LSP entries appear in the Explorer tabs.
**Why it happens:** configs.ts currently has no plugin awareness at all. When adding plugin merging, the code must use PluginResolver (which checks enabledPlugins) rather than scanning all installed plugins.
**How to avoid:** Always use `PluginResolver.getEnabledPluginPaths()` which filters by the enabledPlugins map in settings.json.
**Warning signs:** Config entries from disabled plugins showing up in tabs.

### Pitfall 4: Breaking configs.test.ts Tests
**What goes wrong:** Existing tests in `configs.test.ts` create a Fastify server with only `{ baseDir }` option. After adding PluginResolver dependency, the tests will fail because the routes options interface changes.
**Why it happens:** configsRoutes currently only takes `baseDir`. Adding plugin merging requires passing `pluginsDir` and `settingsPath` too.
**How to avoid:** Update the ConfigRoutesOptions interface and the test setup. Ensure tests cover both the "no plugins" case (backward compat) and the "with plugins" case.
**Warning signs:** `npm test` in packages/cli fails after changes.

### Pitfall 5: CLAUDE.md Route Still Reachable via URL
**What goes wrong:** After removing claude-md from SECTIONS, navigating directly to `/explore/claude-md` still shows the placeholder.
**Why it happens:** SECTIONS only controls the sidebar rendering. The route handler in the content area (`{activeSection === 'claude-md' && renderPlaceholder()}`) is still active.
**How to avoid:** This is actually expected per CONTEXT.md -- "Leave the route handler and placeholder code in place (unreachable)". The sidebar removal means no user can navigate there through the UI. Direct URL access is acceptable dead code.
**Warning signs:** None -- this is intentional.

## Code Examples

### Updated configs.ts with Plugin Merging (MCP Servers)
```typescript
// Source: proposed modification to packages/cli/src/server/routes/configs.ts
import { PluginResolver } from '../services/pluginResolver';

interface ConfigRoutesOptions {
  baseDir: string;
  pluginsDir: string;     // NEW
  settingsPath: string;    // NEW
}

export const configsRoutes: FastifyPluginAsync<ConfigRoutesOptions> = async (fastify, options) => {
  const { baseDir, pluginsDir, settingsPath } = options;
  const resolver = new PluginResolver(pluginsDir, settingsPath);

  // GET /api/mcp -- merged local + plugin
  fastify.get('/api/mcp', async () => {
    const localData = await readJson(path.join(baseDir, '.mcp.json'));
    const localServers = localData?.mcpServers ?? {};
    const entries: Array<{ name: string; config: any; source: 'local' | 'plugin'; pluginId?: string }> = [];

    for (const [name, config] of Object.entries(localServers)) {
      entries.push({ name, config: config as any, source: 'local' });
    }

    const pluginPaths = await resolver.getEnabledPluginPaths();
    for (const { id, installPath } of pluginPaths) {
      const pluginData = await readJson(path.join(installPath, '.mcp.json'));
      const pluginServers = pluginData?.mcpServers ?? {};
      for (const [name, config] of Object.entries(pluginServers)) {
        entries.push({ name, config: config as any, source: 'plugin', pluginId: id });
      }
    }

    return { mcpServers: entries };
  });
  // Similar pattern for /api/hooks and /api/lsp
};
```

### Updated ConfigEntryCard with SourceBadge
```typescript
// Source: proposed modification to packages/ui/src/components/ConfigSection.tsx
import { SourceBadge } from './SourceBadge';

interface ConfigEntryCardProps {
  name: string;
  data: Record<string, unknown>;
  icon: IconType;
  iconColor: string;
  index: number;
  source?: 'local' | 'plugin';   // NEW
  pluginId?: string;               // NEW
}

function ConfigEntryCard({ name, data, icon: Icon, iconColor, index, source = 'local', pluginId }: ConfigEntryCardProps) {
  return (
    <motion.div ...>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center ...">
          <Icon size={16} className={iconColor} />
        </div>
        <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{name}</h3>
        <SourceBadge source={source} pluginId={pluginId} />  {/* NEW */}
      </div>
      <pre className="...">
        {JSON.stringify(data, null, 2)}
      </pre>
    </motion.div>
  );
}
```

### Plugin Profile References in renderPlugins()
```typescript
// Source: proposed addition to Explorer.tsx renderPlugins()
const { data: profilesData } = useProfiles();
const allProfiles = profilesData?.profiles ?? [];

// Build plugin -> profiles reference map
const pluginRefMap = useMemo(() => {
  const map = new Map<string, string[]>();
  for (const p of allProfiles) {
    for (const pluginId of p.plugins) {
      const existing = map.get(pluginId) ?? [];
      existing.push(p.name);
      map.set(pluginId, existing);
    }
  }
  return map;
}, [allProfiles]);

// Then inside the plugin card rendering:
const refNames = pluginRefMap.get(plugin.id) ?? [];
const refCount = refNames.length;
// Render using StoreComponentList pattern:
// 0 -> "0"
// 1-2 -> count + blue pill badges with names
// 3+ -> "Used by N profiles" with tooltip
```

### Server Registration Update
```typescript
// Source: packages/cli/src/server/index.ts line 68
// Current:
await fastify.register(configsRoutes, { baseDir });
// Must become:
await fastify.register(configsRoutes, { baseDir, pluginsDir, settingsPath });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Configs routes return raw local-only data | Configs routes need to merge local + plugin data | Phase 4 | configs.ts API shape changes from Record<string,any> to array of tagged entries |
| ConfigEntryCard has no source awareness | ConfigEntryCard needs source + pluginId props | Phase 4 | ConfigSection and ConfigEntryCard interfaces expand |
| Plugins tab shows component counts only | Plugins tab also shows profile references | Phase 4 | renderPlugins() needs useProfiles hook and reference map |

**Deprecated/outdated:**
- The current `Record<string, unknown>` response shape for configs will be replaced with array-of-tagged-entries. The frontend `useConfigs.ts` hooks must be updated to match.

## Open Questions

1. **Hooks merge format**
   - What we know: Local hooks are event-keyed (`{ PreToolUse: [{ matcher, hooks: [...] }] }`). Plugin hooks from `hooks/hooks.json` follow the same structure per PluginService.scanComponents.
   - What's unclear: Whether to flatten hooks into individual entries (each hook gets its own card) or keep event-grouped (one card per event, with sub-entries). CONTEXT.md marks flattening decision as Claude's discretion.
   - Recommendation: Keep the current event-keyed grouping for local hooks (backward compat) and add plugin hooks as additional entries. For display, flatten to individual hook entries within each event, tagged with source. This matches how the current UI iterates `Object.entries(data)`.

2. **MCP/LSP collision handling**
   - What we know: Both local .mcp.json and plugin .mcp.json are key-value maps where keys are server names.
   - What's unclear: What happens when the same key appears in both.
   - Recommendation: Include both entries in the response array. The plugin entry gets a disambiguated display name like "name (plugin-name)" or rely on the SourceBadge to distinguish them visually.

3. **useConfigs.ts response type update**
   - What we know: Current hooks return `Record<string, any>` from the API. After the merge, the API returns an array of tagged objects.
   - What's unclear: Exact TypeScript interface for the new response.
   - Recommendation: Define a `ConfigEntry` interface with `{ name: string; config: any; source: 'local' | 'plugin'; pluginId?: string }` and update the hook select functions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x |
| Config file | `packages/cli/vitest.config.ts`, `packages/ui/vitest.config.ts` |
| Quick run command (CLI) | `cd packages/cli && npx vitest run routes/__tests__/configs.test.ts` |
| Quick run command (UI) | `cd packages/ui && npx vitest run components/__tests__/SourceBadge.test.tsx` |
| Full suite command (CLI) | `cd packages/cli && npm test` |
| Full suite command (UI) | `cd packages/ui && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAB-01 | Hooks API returns merged local+plugin entries with source tags | unit (backend) | `cd packages/cli && npx vitest run routes/__tests__/configs.test.ts` | needs update |
| TAB-02 | MCP API returns merged local+plugin entries with source tags | unit (backend) | `cd packages/cli && npx vitest run routes/__tests__/configs.test.ts` | needs update |
| TAB-03 | LSP API returns merged local+plugin entries with source tags | unit (backend) | `cd packages/cli && npx vitest run routes/__tests__/configs.test.ts` | needs update |
| TAB-04 | SECTIONS array in Explorer.tsx does not contain claude-md | manual / smoke | visual inspection | no test file |
| PLUG-01 | Plugin profile references computed correctly | unit (frontend) | `cd packages/ui && npx vitest run` | needs new test |

### Sampling Rate
- **Per task commit:** `cd packages/cli && npm test && cd ../ui && npm test`
- **Per wave merge:** Full suites for both packages
- **Phase gate:** Both suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cli/src/server/routes/__tests__/configs.test.ts` -- update existing tests to cover plugin-merged responses with source tags
- [ ] `packages/ui/src/components/__tests__/ConfigSection.test.tsx` -- new file, test ConfigEntryCard renders SourceBadge with correct source/pluginId
- [ ] No new framework install needed -- vitest already configured in both packages

## Sources

### Primary (HIGH confidence)
- Direct source code reading: `configs.ts`, `ConfigSection.tsx`, `SourceBadge.tsx`, `Explorer.tsx`, `agents.ts`, `pluginResolver.ts`, `pluginService.ts`, `StoreComponentList.tsx`
- `packages/shared/src/pluginSchema.ts` -- InstalledPlugin type with components.hooks/mcpServers/lspServers
- `packages/shared/src/profileSchema.ts` -- Profile type with plugins: string[] field
- `packages/cli/src/server/index.ts` -- Server registration with dependency injection pattern

### Secondary (MEDIUM confidence)
- Existing test patterns from `configs.test.ts` and `SourceBadge.test.tsx` confirm test approach
- CONTEXT.md decisions are locked and researched against actual code

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all verified in package.json files
- Architecture: HIGH - existing patterns (agents.ts source attribution, StoreComponentList reference map) directly apply
- Pitfalls: HIGH - identified from reading actual data structures and test files

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase, no external dependencies changing)
