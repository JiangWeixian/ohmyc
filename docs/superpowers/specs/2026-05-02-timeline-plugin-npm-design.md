# Timeline Plugin — npm Package Design

**Date:** 2026-05-02
**Status:** Approved

## Goal

Publish `plugins/timeline/` as an npm package (`@claudeui/timeline-plugin`) that works for both OpenCode (Bun) and Claude Code (hooks) users.

## Decision: Single-file bundle via `bun build`

Bundle `opencode.ts` and all its library dependencies into a single `dist/index.js` file. Runtime-provided modules stay external.

## Build

```
bun build opencode.ts --outdir dist --target bun --external bun:sqlite --external @opencode-ai/plugin
```

**Bundled (inlined):**
- `@claudeui/timeline/schema` — schema constants, SQL, types
- `@claudeui/timeline/writer` — session writer logic

**External (runtime-provided):**
- `bun:sqlite` — Bun built-in
- `@opencode-ai/plugin` — provided by OpenCode host
- `node:fs`, `node:os`, `node:path` — Node built-ins

## Package Structure

```
plugins/timeline/
├── opencode.ts          # source entry
├── hooks/               # Claude Code integration (shipped as static files)
│   ├── hooks.json
│   └── ingest.sh
├── dist/                # build output (gitignored)
│   └── index.js         # single bundled file
├── tests/               # existing tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## package.json

```json
{
  "name": "@claudeui/timeline-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "files": ["dist", "hooks", "README.md"],
  "scripts": {
    "build": "bun build opencode.ts --outdir dist --target bun --external bun:sqlite --external @opencode-ai/plugin",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.14.31"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.14.31",
    "vitest": "^2.1.9"
  }
}
```

Key decisions:
- `@claudeui/timeline` is NOT a dependency — its code is inlined by the bundler
- `@opencode-ai/plugin` is a peer dependency only (provided by OpenCode at runtime)
- No runtime `dependencies` — everything needed is bundled or externalized
- Tests run against source (`opencode.ts`), not the bundle

## Source Changes

Before bundling, fix monorepo-relative imports in `opencode.ts`:

```diff
- import { CURRENT_SCHEMA_VERSION, SCHEMA_SQL } from '../../packages/timeline/src/schema.js'
- import { createWriter } from '../../packages/timeline/src/writer.js'
- import type { ParsedSessionData } from '../../packages/timeline/src/ingest.js'
+ import { CURRENT_SCHEMA_VERSION, SCHEMA_SQL } from '@claudeui/timeline/schema'
+ import { createWriter } from '@claudeui/timeline/writer'
+ import type { ParsedSessionData } from '@claudeui/timeline'
```

This lets the bundler resolve `@claudeui/timeline` from `node_modules` and inline it.

## Claude Code Integration

Hooks directory ships as static files. Users manually configure:
- Copy `hooks/hooks.json` content into `.claude/settings.json`
- Ensure `ingest.sh` is accessible from the hooks working directory

No setup command needed — users configure themselves.

## Testing

Tests remain unchanged. They mock `bun:sqlite` and test against source code. The bundle is not tested directly — it's a pure build artifact.
