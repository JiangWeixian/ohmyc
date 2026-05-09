# OhMyC Timeline Plugin

Collects session data (turns, tokens, tools, skills) from both **Claude Code** and **OpenCode** agents and ingests it into the OhMyC Timeline dashboard.

## Supported Agents

| Agent | Integration | Data Source |
|-------|-------------|-------------|
| Claude Code | Hook-based (`hooks/ingest.sh`) | JSONL transcript files |
| OpenCode | Plugin-based (`opencode.ts`) | Real-time event hooks |

## Claude Code Setup

The Claude Code plugin uses a `Stop` hook that fires when a session ends. The hook script reads the transcript JSONL file and ingests it into the timeline database via the CLI.

## OpenCode Setup

The OpenCode plugin lives at `plugins/timeline/opencode.ts` and is symlinked from `.opencode/plugins/timeline.ts`. It sets `agentName='opencode'` and hooks into:

- `session.created` / `session.idle` / `session.deleted` — session lifecycle
- `message.updated` — message tokens and model info
- `message.part.updated` — user message text for summaries
- `tool.execute.before` / `tool.execute.after` — tool and skill tracking

Data is written directly to `~/.config/ohmyc/timeline.db` using `bun:sqlite` via the shared `@ohmyc/timeline/writer` module.

## Shared Code

Both agents write to the same SQLite database (`~/.config/ohmyc/timeline.db`) using the schema and writer from `@ohmyc/timeline`:

- `@ohmyc/timeline/writer` — Runtime-agnostic writer (works with `better-sqlite3` and `bun:sqlite`)
- `@ohmyc/timeline/schema` — Database schema and TypeScript types

## Future: OpenCode Backfill

OpenCode stores historical session data in `~/.local/share/opencode/opencode.db`. A future enhancement could read this database and backfill missing sessions into the timeline.
