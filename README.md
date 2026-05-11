# ohmyc

A CLI tool with a built-in WebUI for visualizing and editing `.claude` configuration files.

## Features

- Visual management of all `.claude` configuration files
- View and edit `settings.json`, `CLAUDE.md`, hooks, MCP servers, commands, agents, skills, plugins, and more
- Local web interface powered by React + shadcn/ui
- Simple CLI to launch the WebUI

### Multi-tool discovery

OhMyC also reads opencode config from `~/.config/opencode/` (or
`~/Library/Application Support/opencode/` on macOS) and `<cwd>/.opencode/`,
plus the shared `~/.agents/skills/` and `<cwd>/.agents/skills/` namespace.
Set `OPENCODE_CONFIG_DIR` to override the global opencode config dir.

## Tech Stack

- **CLI**: [cac](https://github.com/cacjs/cac)
- **WebUI**: React + [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **Build**: [Vite](https://vitejs.dev/) (WebUI) + [tsup](https://github.com/egoist/tsup) (CLI)
- **Package Manager**: npm

## Installation

```bash
npm install -g ohmyc
```

## Usage

```bash
ohmyc
```

This starts a local web server and opens the UI in your browser, where you can browse and edit your `.claude` configuration.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build
npm run build
```

## License

[MIT](./LICENSE)
