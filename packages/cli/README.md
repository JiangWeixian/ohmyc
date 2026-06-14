# @ohmyc/cli

Local HTTP server and CLI that manages `.claude` agent configs, profiles, plugins, and timeline analytics for [OhMyC](https://github.com/JiangWeixian/ohmyc).

## Quick Start

```bash
pnpm add @ohmyc/cli
ohmyc
```

The server starts on port 3000 and opens the browser. If the port is busy it picks the next available one.

## Usage

The CLI exposes two commands: `start` (the default) and `dashboard`.

### `ohmyc start`

```bash
ohmyc start --port 4000 --cwd ~/projects/my-app
ohmyc start --api-only
```

| Option | Type | Default | Example | Description |
| --- | --- | --- | --- | --- |
| `--port` | `number` | `3000` | `--port 4000` | Port to listen on (0–65535) |
| `--api-only` | `boolean` | `false` | `--api-only` | API server only, skip static UI and browser |
| `--cwd` | `string` | `process.cwd()` | `--cwd ~/src/app` | Working directory for project discovery |

Running bare `ohmyc` is equivalent to `ohmyc start`.

### `ohmyc dashboard`

Manage the Timeline plugin and transcript database.

```bash
ohmyc dashboard --install
ohmyc dashboard --sync
ohmyc dashboard --doctor
```

| Option | Type | Default | Example | Description |
| --- | --- | --- | --- | --- |
| `--install` | `boolean` | — | `--install` | Install the timeline plugin and run initial backfill |
| `--uninstall` | `boolean` | — | `--uninstall` | Remove the timeline plugin (preserves database) |
| `--sync` | `boolean` | — | `--sync` | Scan all transcripts and import missing sessions |
| `--doctor` | `boolean` | — | `--doctor` | Diagnose plugin, hooks, and database health |

Per-session ingest is handled by the timeline plugin's bundled node entry (`plugins/timeline/dist/ingest.mjs`), invoked directly by the Claude Code Stop hook — not via this CLI.

## API

The server exposes JSON REST routes. All endpoints return JSON.

### Settings

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/settings` | Read `.claude/settings.json` for the project |
| `POST` | `/api/settings` | Write `.claude/settings.json` |
| `GET` | `/api/settings/schema` | JSON Schema generated from Zod |

### Agents / Skills / Commands

Each inventory type is resolved from the OhMyC store, enabled plugins, and the project directory.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/agents` | List agents |
| `GET` | `/api/agents/:name` | Get agent detail (`?source=plugin&pluginId=x`, `?scope=project`) |
| `GET` | `/api/skills` | List skills |
| `GET` | `/api/skills/:name` | Get skill detail |
| `GET` | `/api/commands` | List commands |
| `GET` | `/api/commands/:name` | Get command detail |

### Profiles

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/profiles` | List profiles with active indicator |
| `POST` | `/api/profiles` | Create a profile |
| `GET` | `/api/profiles/:name` | Get a profile |
| `PUT` | `/api/profiles/:name` | Update a profile |
| `DELETE` | `/api/profiles/:name` | Delete a profile (cannot delete active) |
| `GET` | `/api/profiles/:name/preflight` | Preview activation changes |
| `POST` | `/api/profiles/:name/activate` | Activate (writes symlinks and settings) |
| `POST` | `/api/profiles/:name/deactivate` | Deactivate current profile |

### Store

CRUD for user-managed store components. Delete checks profile references unless `?force=true`.

| Method | Path | Description |
| --- | --- | --- |
| `GET/POST` | `/api/store/agents` | List / create |
| `GET/PUT/DELETE` | `/api/store/agents/:name` | Get / update / delete |
| `GET/POST` | `/api/store/skills` | List / create |
| `GET/PUT/DELETE` | `/api/store/skills/:name` | Get / update / delete |
| `GET/POST` | `/api/store/commands` | List / create |
| `GET/PUT/DELETE` | `/api/store/commands/:name` | Get / update / delete |
| `GET/POST` | `/api/store/model-configs` | List / create |
| `GET/PUT/DELETE` | `/api/store/model-configs/:name` | Get / update / delete |
| `POST` | `/api/store/import` | Bulk import (`dryRun`, `overwrite`) |

### Plugins

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/plugins` | List installed plugins with enabled state |
| `GET` | `/api/plugins/:id` | Get plugin detail |
| `GET` | `/api/marketplaces` | List known marketplaces |
| `GET` | `/api/marketplaces/:id` | Get marketplace detail |

### Timeline

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/timeline/heatmap` | Aggregated data (`from`, `to`, `metric=sessions|turns|tokens`, optional `project`) |
| `GET` | `/api/timeline/events` | Paginated events (`from`, `to`, `project`, `limit`, `cursor`) |
| `GET` | `/api/timeline/sessions/:id` | Session detail |
| `GET` | `/api/timeline/projects` | List projects |
| `GET` | `/api/timeline/years` | List years with data |
| `GET` | `/api/timeline/status` | Sync status (session count, last sync) |

## Configuration

| Variable | Type | Default | Example | Description |
| --- | --- | --- | --- | --- |
| `OHMYC_HOME` | `string` | `.config/ohmyc` | `OHMYC_HOME=.ohmyc` | Directory name under home for managed data |
| `AGENT_HOME` | `string` | `.claude` | `AGENT_HOME=.claude` | Directory name under home for Claude Code paths |
| `OHMYC_LOG_CONSOLE` | `string` | — | `OHMYC_LOG_CONSOLE=true` | Enable pino-pretty console output |
| `NODE_ENV` | `string` | — | `NODE_ENV=test` | Isolates logs per PID when `test` or `CI=true` |

Directory layout:

```
~/.config/ohmyc/                 # managed data (OHMYC_HOME)
├── agents/                      # user-managed agent definitions
├── skills/                      # user-managed skill definitions
├── commands/                    # user-managed command definitions
├── profiles/<name>/profile.json
├── store/                       # agents, skills, commands, model-configs
├── settings.json
└── logs/                        # daily-rotated pino logs

~/.claude/                       # Claude Code paths (AGENT_HOME)
├── plugins/
└── settings.json

<project>/.claude/               # project-scoped (auto-discovered)
├── agents/
├── skills/
├── commands/
├── settings.json
└── settings.local.json
```

## Development

```bash
pnpm install
pnpm --filter @ohmyc/cli test
pnpm --filter @ohmyc/cli build
```

| Script | Command |
| --- | --- |
| `dev` | `tsx watch src/index.ts start --api-only --cwd $INIT_CWD` |
| `dev:server` | `tsx watch src/index.ts --cwd $INIT_CWD` |
| `build` | `rimraf dist && tsup` |
| `build:full` | `pnpm --filter @ohmyc/ui build && tsup` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |

## Architecture

```
src/
├── index.ts            # CLI entry (cac)
├── banner.ts           # ASCII banner + version
├── launcher.ts         # Server startup, port fallback, browser open
├── logger.ts           # Pino + pino-roll daily rotation
├── commands/
│   └── dashboard.ts    # Timeline plugin install/uninstall/sync/doctor
└── server/
    ├── index.ts        # Fastify factory, route registration
    ├── routes/         # 11 route modules
    └── services/       # 10 service modules
```

Key dependencies: **Fastify**, **cac**, **node:sqlite** (via `@ohmyc/timeline`), **pino**/**pino-roll**.

---

Built with care ฅ(=｀ω´=)ฅ
