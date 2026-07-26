# Provider Registry Design

## Context

OhMyC is a local-first coding monitor and resource library. Its Rust desktop backend currently reads several resource types directly from Claude-oriented paths, with partial support for Codex plugin cache and shared agent skills. That is no longer enough: the product needs to treat Codex, Claude, and OpenCode as first-class agent ecosystems across four resource types:

- Agents
- Skills
- Commands
- Plugins

The implementation should follow each ecosystem's documented filesystem and manifest formats instead of forcing every resource through the Claude parser.

References used for this design:

- Codex customization: https://developers.openai.com/codex/concepts/customization
- Codex subagents: https://developers.openai.com/codex/subagents
- Codex plugins: https://developers.openai.com/codex/plugins/build
- Claude skills: https://code.claude.com/docs/en/skills
- Claude subagents: https://code.claude.com/docs/en/sub-agents
- Claude plugin reference: https://code.claude.com/docs/en/plugins-reference
- OpenCode skills: https://opencode.ai/docs/skills/
- OpenCode agents: https://opencode.ai/docs/agents/
- OpenCode commands: https://opencode.ai/docs/commands/
- OpenCode plugins: https://opencode.ai/docs/plugins/
- OpenCode config: https://opencode.ai/docs/config/

## Goals

- Support Codex, Claude, and OpenCode as source-filterable origins in the desktop backend.
- Parse the documented formats for agents, skills, commands, and plugins.
- Keep the existing UI contract mostly additive: existing cards, origin chips, and plugin fields should continue to work.
- Include plugin-contributed agents, skills, and commands in the main resource lists when the plugin format exposes them statically.
- Treat `.agents/skills` as a shared agent-skill location recognized by Codex and OpenCode, displayed as `codex · opencode`.
- Avoid executing user plugin code while building inventory.

## Non-Goals

- Do not implement runtime-accurate CLI introspection as the primary source of truth.
- Do not execute OpenCode JS/TS plugins to discover dynamic tools.
- Do not redesign the UI.
- Do not infer undocumented resource support from directory names alone.

## Architecture

Add a Rust `ProviderRegistry` layer between Tauri API commands and filesystem readers.

The Tauri API should express resource intent:

- `list_agents(origins)`
- `list_skills(origins)`
- `list_commands(origins)`
- `list_plugins(origins)`

The registry owns provider composition, origin filtering, deduplication, and stable locator generation. It delegates filesystem discovery and parsing to provider-specific modules:

- `ClaudeProvider`
- `CodexProvider`
- `OpenCodeProvider`
- `SharedAgentsProvider`

Each provider declares:

- Supported resource kinds.
- Global, project, plugin, or shared paths it reads.
- Parser used for each resource kind.
- Agent origins that recognize each resource.

This keeps provider-specific format drift local to one module instead of spreading `if origin == ...` branches across resource APIs.

## Data Model

Keep current frontend-compatible fields:

- `id`
- `frontmatter`
- `content`
- `raw`
- `source`: `local | plugin | project`
- `scope`: `global | project`
- `pluginId`
- `origins`
- `badges`

Add stable identity fields:

- `locatorId`: stable opaque identity for list keys and detail lookup.
- `sourcePath`: absolute filesystem path when available.
- `sourceProvider`: `codex | claude | opencode | shared`.
- `sourceKind`: `global | project | plugin | shared`.

Example for a shared skill:

```json
{
  "id": "fast-commit",
  "source": "local",
  "scope": "global",
  "sourceProvider": "shared",
  "sourceKind": "shared",
  "origins": ["codex", "opencode"]
}
```

Frontend display remains `codex · opencode`.

## Resource Matrix

### Agents

Claude:

- Global: `~/.claude/agents/**/*.md`
- Project: `.claude/agents/**/*.md`
- Plugin: `<plugin>/agents/**/*.md`
- Format: Markdown with YAML frontmatter.
- Identity: `name` frontmatter is the runtime identity. File path is inventory identity.
- Origins: `["claude"]`

Codex:

- Global: `~/.codex/agents/*.toml`
- Project: `.codex/agents/*.toml`
- Format: TOML.
- Required fields: `name`, `description`, `developer_instructions`.
- `developer_instructions` maps to `content`.
- Origins: `["codex"]`

OpenCode:

- Global Markdown: `~/.config/opencode/agents/*.md`
- Project Markdown: `.opencode/agents/*.md`
- Global config: `~/.config/opencode/opencode.json` or `.jsonc`, `agent` object.
- Project config: `opencode.json` or `opencode.jsonc`, `agent` object.
- Format: Markdown with YAML frontmatter, or JSON/JSONC config object.
- Markdown filename becomes the agent name.
- Origins: `["opencode"]`

### Skills

Claude:

- Global: `~/.claude/skills/<name>/SKILL.md`
- Project: `.claude/skills/<name>/SKILL.md`
- Plugin: `<plugin>/skills/<name>/SKILL.md`
- Format: Agent Skills standard, with Claude extensions.
- Origins: `["claude"]`

Codex:

- Global shared skills: `~/.agents/skills/<name>/SKILL.md`
- Project shared skills: `.agents/skills/<name>/SKILL.md`
- Plugin: `<codex-plugin>/skills/<name>/SKILL.md`
- Format: Agent Skills standard.
- Shared `.agents/skills` origins: `["codex", "opencode"]`
- Codex plugin skill origins: `["codex"]`

OpenCode:

- Global native: `~/.config/opencode/skills/<name>/SKILL.md`
- Project native: `.opencode/skills/<name>/SKILL.md`
- Claude-compatible paths: `~/.claude/skills`, `.claude/skills`
- Agent-compatible paths: `~/.agents/skills`, `.agents/skills`
- Format: Agent Skills standard with OpenCode validation rules.
- Native origins: `["opencode"]`
- Claude-compatible skill origins: `["claude", "opencode"]`, with `sourceProvider = "claude"`.
- Shared `.agents/skills` origins: `["codex", "opencode"]`

OpenCode compatibility must not erase ownership. A skill read from `.claude/skills` remains Claude-owned, but its `origins` include OpenCode because OpenCode documents that it loads those paths.

### Commands

Claude:

- Global: `~/.claude/commands/*.md`
- Project: `.claude/commands/*.md`
- Plugin: `<plugin>/commands/*.md`
- Format: Markdown with YAML frontmatter.
- Origins: `["claude"]`

Codex:

- Deprecated custom prompts: `~/.codex/prompts/*.md`
- Format: Markdown with YAML frontmatter.
- Treat as command-like resources with a `prompt` or `deprecated` badge.
- Origins: `["codex"]`

Codex official guidance now points reusable workflows toward skills, so these should be displayed as legacy command resources rather than promoted as the preferred path.

OpenCode:

- Global Markdown: `~/.config/opencode/commands/*.md`
- Project Markdown: `.opencode/commands/*.md`
- Global/project config: `command` object in OpenCode config.
- Format: Markdown with YAML frontmatter, or JSON/JSONC config object.
- `template` maps to `content`.
- Origins: `["opencode"]`

### Plugins

Claude:

- Registry: `~/.claude/plugins/installed_plugins.json`
- Enable state: `~/.claude/settings.json.enabledPlugins`
- Manifest: `.claude-plugin/plugin.json`
- Components: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`
- Component resources enter the corresponding resource lists with `source = "plugin"`.

Codex:

- Installed cache: `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`
- Manifest: `.codex-plugin/plugin.json`
- Enable state: `~/.codex/config.toml`
- Marketplaces:
  - `$REPO_ROOT/.agents/plugins/marketplace.json`
  - `~/.agents/plugins/marketplace.json`
  - legacy `$REPO_ROOT/.claude-plugin/marketplace.json`
- Components: `skills/`, `hooks/hooks.json`, `.mcp.json`, `.app.json`, `assets/`
- Plugin skills enter the Skills list with `source = "plugin"` and `origins = ["codex"]`.

OpenCode:

- Local plugins:
  - `~/.config/opencode/plugins/*.{js,ts}`
  - `.opencode/plugins/*.{js,ts}`
- NPM plugins: `plugin` array in OpenCode config.
- Format: JS/TS module or npm package name.
- Display as plugin entities only.
- Do not execute plugins or infer static agents, skills, or commands from arbitrary JS/TS.

## Deduplication and Priority

- The same physical file appears once.
- Shared `.agents/skills` entries appear once with `origins = ["codex", "opencode"]`.
- Same-name resources from different providers remain separate.
- Same-name resources from different scopes remain separate in inventory.
- Provider runtime precedence can be shown later as metadata, but OhMyC should not hide lower-priority definitions by default.
- `locatorId` must be used for React keys and detail lookup.

A stable locator should include enough data to avoid collisions:

```text
<kind>:<sourceProvider>:<source>:<scope>:<pluginId-or-none>:<id>:<sourcePath-hash>
```

## Plugin Resources in Main Lists

Plugin-contributed static resources should enter main resource lists when the plugin format documents component directories:

- Claude plugin agents, skills, commands.
- Codex plugin skills.

OpenCode plugins should stay on the Plugins page because they are executable JS/TS extensions rather than static component bundles.

## Error Handling

The backend should prefer partial inventory over page failure:

- Missing directory: return empty list.
- File deleted during scan: skip.
- Single malformed file: skip resource and emit a diagnostic.
- Permission error: return partial provider result and emit a diagnostic.
- JSONC/TOML parse error: skip that config file and emit a diagnostic.
- Malformed plugin manifest: show the plugin best-effort, with empty or partial components.

Diagnostics can remain internal at first. A future `source health` surface can expose:

```json
{
  "source": "opencode",
  "path": "...",
  "severity": "warning",
  "message": "..."
}
```

## Risk Controls

### Non-Unique IDs

Risk: `entity.id` is no longer unique after adding multiple providers.

Control:

- Backend emits `locatorId`.
- Frontend list keys use `locatorId` with fallback to `id`.
- Detail lookup accepts locator data instead of only `name`.
- Keep `id` for display and compatibility.

### API Compatibility

Risk: frontend schemas already allow plugin/project sources, but Rust currently returns only local values.

Control:

- Expand Rust `ComponentSource` to `Local | Plugin | Project`.
- Add new fields without removing existing fields.
- Keep mock and story compatibility through fallback logic.

### Watcher Coverage

Risk: API may read new provider paths, but live desktop refresh may only watch Claude paths.

Control:

- Phase 1: guarantee API correctness.
- Phase 2: add provider watch roots:
  - `~/.claude`
  - `~/.codex`
  - `~/.agents`
  - `~/.config/opencode`
  - project `.claude`, `.codex`, `.agents`, `.opencode`
- Rename or generalize watcher payloads from `claude_home` to provider config events.
- Frontend invalidates agents, skills, commands, and plugins on provider config changes.

### Format Drift

Risk: Codex and OpenCode are evolving quickly.

Control:

- Keep each ecosystem parser isolated.
- Build fixtures from official docs.
- Avoid UI-side compatibility guesses.
- Update one provider module when an ecosystem format changes.

### Plugin Overreach

Risk: executing or analyzing arbitrary plugins to infer resources is unsafe.

Control:

- Parse only documented static manifests and directories.
- Do not execute OpenCode JS/TS plugin modules.
- Do not infer resource components from arbitrary plugin code.

## Test Plan

Parser unit tests:

- Claude Markdown agent.
- Claude skill.
- Claude command.
- Codex TOML agent.
- Codex shared skill.
- Codex plugin skill.
- Codex deprecated prompt.
- OpenCode Markdown agent.
- OpenCode JSONC `agent`.
- OpenCode Markdown command.
- OpenCode JSONC `command`.
- OpenCode native skill.
- Plugin manifest custom component paths where documented.

Provider tests:

- Missing dirs return empty lists.
- Bad files do not fail a full provider list.
- Global and project paths are both scanned.
- Plugin resources get `source = "plugin"` and `pluginId`.
- Shared skills get `origins = ["codex", "opencode"]`.

Registry integration tests:

- `origins = None` returns all supported origins.
- `origins = "codex"` includes `.agents/skills`.
- `origins = "opencode"` includes `.agents/skills`.
- `origins = "opencode"` includes OpenCode native skills and Claude-compatible `.claude/skills`.
- `origins = "claude"` excludes `.agents/skills`.
- Same shared skill is deduplicated into one card.
- Same-name resources from different providers stay distinct.
- Plugin-contributed resources appear in main lists where supported.

Frontend compatibility tests:

- Entity cards render `codex · opencode`.
- Entity list keys use `locatorId` when present.
- Detail selection opens the intended same-name resource.
- Plugin resources display plugin metadata in detail meta rows.

## Acceptance Criteria

- Agents page shows Claude Markdown agents, Codex TOML agents, and OpenCode Markdown/config agents.
- Skills page shows Claude skills, Claude-compatible OpenCode-visible skills, shared `.agents/skills`, OpenCode native skills, and supported plugin skills.
- Commands page shows Claude commands, OpenCode commands, and Codex deprecated prompts as legacy prompt resources.
- Plugins page lists Claude, Codex, and OpenCode plugins without executing plugin code.
- `.agents/skills` resources display `codex · opencode`.
- Filtering to Claude does not include `.agents/skills`.
- Same-name resources from multiple providers are selectable independently.
