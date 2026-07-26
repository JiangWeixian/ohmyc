# ohmyc

OhMyC is a local-first personal Coding Monitor for AI-assisted development. It
shows activity, sessions, token usage, and project momentum across coding
agents, with a resource library for inspecting the agents, skills, commands, and
plugins that power that work.

## Features

- Local monitor for AI coding sessions, turns, token usage, and projects
- Explorer for local agents, skills, commands, and plugins
- Provider-aware discovery for Codex, Claude, OpenCode, and shared `.agents`
  skills
- Local desktop/web UI powered by React and Tauri

### Multi-tool discovery

OhMyC reads provider resources from:

- Codex: `~/.codex/` and project `.codex/`
- Claude: `~/.claude/` and project `.claude/`
- OpenCode: `~/.config/opencode/` (or `~/Library/Application Support/opencode/`
  on macOS), project `.opencode/`, and documented OpenCode config overrides
- Shared skills: `~/.agents/skills/` and project `.agents/skills/`

Use the Explorer source filter to switch between `codex`, `claude`, and
`opencode`. Shared `.agents` skills appear as `codex · opencode`.

## Tech Stack

- **CLI**: [cac](https://github.com/cacjs/cac)
- **Desktop/UI**: Tauri + React
- **Core**: Rust
- **Language**: TypeScript + Rust
- **Build**: [Vite](https://vitejs.dev/) + [tsup](https://github.com/egoist/tsup)
- **Package Manager**: pnpm

## Installation

```bash
pnpm add -g ohmyc
```

## Usage

```bash
ohmyc
```

This starts OhMyC so you can inspect local coding activity and browse local
agent resources.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build
pnpm build
```

## License

[MIT](./LICENSE)
