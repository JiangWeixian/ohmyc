# Agent Home & Profile Usage Guide

## Overview

OhMyC is a local management tool for Claude Code extensions and configuration. It revolves around two core concepts: the **Store** (component repository) and **Profile** (environment configuration). Users can import components into a local store, compose reusable profiles from them, and safely switch between environments.

## Agent Home

Agent Home is the root directory where Claude Code stores all configuration, plugins, and components.

**Configuration:**
- Environment variable: `AGENT_HOME`
- Default: `~/.claude`

**Directory Structure:**

```
~/.claude/
├── agents/                # Agent definitions (.md files)
├── skills/                # Skill definitions (directories with SKILL.md)
├── commands/              # Command definitions (.md files)
├── plugins/               # Installed plugins
├── store/                 # Component store (managed by OhMyC)
│   ├── agents/            # Store agents
│   ├── skills/            # Store skills
│   ├── commands/          # Store commands
│   └── .metadata/
│       └── imports.json   # Import provenance tracking
├── profiles/              # Profile definitions and activation state
│   ├── .active            # Active profile marker
│   └── <profile-name>/    # Per-profile directory
│       ├── profile.json   # Profile configuration
│       ├── agents/        # → symlinks to store agents
│       ├── skills/        # → symlinks to store skills
│       ├── commands/      # → symlinks to store commands
│       ├── .claude-plugin/  # Generated plugin files
│       ├── hooks/         # Hooks configuration
│       ├── .mcp.json      # MCP server configuration
│       └── .lsp.json      # LSP server configuration
├── settings.json                        # Main settings file
└── settings.backup.<profile>.json       # Per-profile settings backup
```

## Store (Component Repository)

The Store is the canonical storage location for components. All profiles reference components from the Store.

### Importing Components

Import agents, skills, and commands from an existing directory into the Store:

```bash
# API call
POST /api/store/import
Body: { "sourceDir": "/path/to/your/components", "dryRun": true }
```

**Import flow:**
1. Scans the source directory for agents, skills, and commands
2. Detects conflicts with existing components
3. `dryRun: true` returns a preview without making changes
4. Actual import copies files into the Store and records provenance in `imports.json`

**Provenance tracking** (recorded in `<AGENT_HOME>/store/.metadata/imports.json`):
- `importPath`: Original import source path
- `importedAt`: Timestamp of import

### Managing Store Components

| Action | API | Description |
|--------|-----|-------------|
| List agents | `GET /api/store/agents` | List all store agents |
| Get agent details | `GET /api/store/agents/:name` | Get a single agent |
| Create agent | `POST /api/store/agents` | Create a new agent in the store |
| Edit agent | `PUT /api/store/agents/:name` | Update agent content |
| Delete agent | `DELETE /api/store/agents/:name` | Delete agent (checks profile references) |

The same API pattern applies to skills (`/api/store/skills`) and commands (`/api/store/commands`).

> **Note:** If a component is referenced by any profile, deletion returns `409 Conflict` with a `referencedBy` array listing the profiles. Use `?force=true` to override.

## Profiles (Environment Configurations)

A profile is a reusable working environment composed of Store components, settings overlays, hooks, MCP/LSP servers, and plugin configurations.

### Creating a Profile

```bash
POST /api/profiles
Body: {
  "name": "my-profile",
  "description": "Daily development environment",
  "agents": ["reviewer", "debugger"],
  "skills": ["deploy", "test-runner"],
  "commands": ["commit", "review"],
  "plugins": ["some-plugin"],
  "settings": { "theme": "dark" },
  "hooks": { ... },
  "mcpServers": { ... },
  "lspServers": { ... }
}
```

**Naming rules:** Only `[a-zA-Z0-9_-]` characters. Reserved names cannot be used: `store`, `.active`, `plugins`, `agents`, `skills`, `commands`.

### Editing a Profile

```bash
PUT /api/profiles/:name
Body: { "description": "Updated description", "agents": ["reviewer"] }
```

Supports partial updates — omitted fields remain unchanged.

### Activating a Profile

Activating a profile applies its components and settings to Agent Home:

```bash
POST /api/profiles/:name/activate
```

**Activation flow (transactional with rollback):**

```
Request → Acquire lock (prevent concurrent activations)
       → Preflight check: verify all components exist in Store
       → Deactivate previous profile (if any)
       → Backup current settings.json
       → Write .active marker file
       → Create symlinks (agents/skills/commands → store)
       → Generate plugin files (.claude-plugin, hooks, .mcp.json, .lsp.json)
       → Merge profile settings into settings.json
       → Release lock
       → Return success + warnings
```

**If any step fails, all changes are rolled back in reverse order**, restoring the previous state.

**Created/modified artifacts:**
- `<AGENT_HOME>/profiles/.active` — activation marker containing the profile's absolute path
- `<profile>/agents/*.md` — symlinks to store agents
- `<profile>/skills/*` — symlinks to store skills
- `<profile>/commands/*.md` — symlinks to store commands
- `<profile>/.claude-plugin/plugin.json` — generated plugin manifest
- `<profile>/hooks/hooks.json` — hooks configuration (if defined)
- `<profile>/.mcp.json` — MCP servers (if defined)
- `<profile>/.lsp.json` — LSP servers (if defined)
- `<AGENT_HOME>/settings.backup.<profile>.json` — settings backup
- `<AGENT_HOME>/settings.json` — merged with profile settings

### Preflight Check

Before activating, verify that the profile can be activated:

```bash
GET /api/profiles/:name/preflight
```

Returns:
```json
{
  "canActivate": true,
  "missing": [],
  "settingsWarnings": ["Will override 'theme' in settings.json"],
  "currentActive": "old-profile"
}
```

### Deactivating a Profile

```bash
POST /api/profiles/:name/deactivate
```

**Deactivation flow:**
1. Restore `settings.json` from backup
2. Remove all symlinks (agents, skills, commands)
3. Remove generated plugin files (`.claude-plugin/`, `hooks/`, `.mcp.json`, `.lsp.json`)
4. Remove `.active` marker
5. Clean up backup file

If no profile is active, deactivation is a no-op.

### Switching Profiles

Simply activate the new profile — the system automatically deactivates the current one first. The entire operation is transactional: if activation fails, the previous profile is restored.

```bash
# Switch from current profile to "personal"
POST /api/profiles/personal/activate
```

### Deleting a Profile

```bash
DELETE /api/profiles/:name
```

> **Note:** The currently active profile cannot be deleted — returns `409 Conflict`. Deactivate it first.

## Viewing the Current Environment

These APIs list components in Agent Home with source labels:

| API | Description |
|-----|-------------|
| `GET /api/agents` | List all agents (with source labels) |
| `GET /api/skills` | List all skills (with source labels) |
| `GET /api/commands` | List all commands (with source labels) |
| `GET /api/plugins` | List installed plugins |
| `GET /api/configs` | View environment configuration |

**Source labels:**
- `local` — regular files (not symlinks)
- `profile` — symlinks from the active profile
- `plugin` — from enabled plugins

## Error Codes

| Code | Meaning | Context |
|------|---------|---------|
| `400` | Bad Request | Invalid profile name, malformed JSON |
| `404` | Not Found | Profile or component does not exist |
| `409` | Conflict | Duplicate profile name, component referenced by profiles, active profile cannot be deleted |
| `422` | Unprocessable Entity | Missing store components for activation (returns `missing` array) |
| `423` | Locked | Another activation operation is in progress |

## Typical Workflow

```
1. Import components into Store
   POST /api/store/import { sourceDir: "/path/to/components" }

2. Create a Profile
   POST /api/profiles { name: "work", agents: [...], skills: [...] }

3. Preflight check
   GET /api/profiles/work/preflight

4. Activate the Profile
   POST /api/profiles/work/activate

5. Switch to another Profile
   POST /api/profiles/personal/activate

6. Deactivate
   POST /api/profiles/personal/deactivate
```
