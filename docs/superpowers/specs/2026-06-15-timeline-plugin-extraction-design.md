# Timeline Plugin Extraction Design

## Context

`plugins/timeline/` now has an independent repository at `ohmyc-plugins`. The monorepo should stop owning the plugin source, but `ohmyc dashboard --install` should keep working without requiring a network fetch at install time.

Current monorepo behavior:

- `plugins/timeline` is a pnpm workspace.
- `packages/cli/tsup.config.ts` copies selected files from `plugins/timeline` into `packages/cli/dist/plugins/timeline`.
- `ohmyc dashboard --install` registers a local plugin path in `~/.claude/plugins/installed_plugins.json`.
- In development it falls back to `plugins/timeline`; in production it prefers `dist/plugins/timeline`.
- `.agents/plugins/marketplace.json` and `.opencode/plugins/timeline.ts` still point at the monorepo plugin source.

## Goal

Remove the monorepo-owned timeline plugin source while preserving local install behavior:

- `plugins/timeline/` is deleted from this repo.
- `@ohmyc/cli` bundles the published `@ohmyc/timeline-plugin` package into its build output.
- `ohmyc dashboard --install` continues to register a local filesystem path, not install from the network.

## Non-Goals

- Do not change the timeline database schema or query APIs.
- Do not move `packages/timeline`; it remains the shared data layer.
- Do not make `dashboard --install` run `npm install`.
- Do not redesign plugin activation UX.

## Approach

`@ohmyc/cli` will depend on `@ohmyc/timeline-plugin`. During CLI build, `packages/cli/tsup.config.ts` will resolve the installed package root and copy the package files into:

```text
packages/cli/dist/plugins/timeline
```

The copied set should match the plugin package runtime surface:

- `.agents`
- `.claude-plugin`
- `.codex-plugin`
- `dist`
- `hooks`
- `package.json`
- `README.md`

`dashboard --install` keeps the same install record model. It resolves the plugin source in this order:

1. `packages/cli/dist/plugins/timeline` when running from a built CLI.
2. The resolved package root for `@ohmyc/timeline-plugin` in development.

It must not fall back to `../../plugins/timeline` after this migration.

## Repository Changes

Remove monorepo plugin ownership:

- Delete `plugins/timeline/`.
- Remove `plugins/timeline` from `pnpm-workspace.yaml`.
- Remove `@ohmyc/timeline-plugin` workspace entries from `pnpm-lock.yaml`.
- Remove changesets that target `@ohmyc/timeline-plugin`, since that package now releases from `ohmyc-plugins`.

Update CLI packaging:

- Add `@ohmyc/timeline-plugin` as a runtime dependency of `packages/cli`.
- Update `packages/cli/tsup.config.ts` to copy from the dependency package root instead of `../../plugins/timeline`.
- Include Codex and Agents plugin manifests in the copied files, not only the Claude manifest.

Update CLI runtime:

- Change `getPluginSourceDir()` to resolve the dependency package root as its development fallback.
- Keep `runInstall()`, `runUninstall()`, `runSync()`, and `runDoctor()` behavior otherwise unchanged.

Clean broken local references:

- Delete `.opencode/plugins/timeline.ts`, because it points at the removed source tree.
- Update or remove `opencode.json` plugin references that point at that symlink.
- Remove or update `.agents/plugins/marketplace.json` entries that point at `./plugins/timeline`.
- Update CLI docs that mention `plugins/timeline/dist/ingest.mjs` as a source path; docs should describe the bundled plugin path or the independent package.

## Data Flow

Build-time flow:

```text
pnpm build
  -> @ohmyc/cli tsup build
  -> resolve @ohmyc/timeline-plugin package root
  -> copy package runtime files into packages/cli/dist/plugins/timeline
```

Install-time flow:

```text
ohmyc dashboard --install
  -> resolve local plugin source
  -> write ~/.claude/plugins/installed_plugins.json
  -> backfill timeline database if empty
```

No install-time network access is required.

## Error Handling

- If the dependency package root cannot be resolved during CLI build, fail the build with a clear message naming `@ohmyc/timeline-plugin`.
- If `dashboard --install` cannot find either the built plugin copy or the dependency package root, fail with a message that asks the user to reinstall or rebuild `@ohmyc/cli`.
- Existing `jq` warning behavior stays unchanged.

## Tests

Update or add focused tests:

- CLI unit test for `getPluginSourceDir()` to prove it no longer returns `plugins/timeline`.
- CLI build/package test or script-level assertion that `packages/cli/dist/plugins/timeline/.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `hooks/hooks.json`, and `dist/ingest.mjs` exist after build.
- Repository reference check to ensure no live config points at `plugins/timeline`.
- Existing timeline package tests continue to cover database parsing and query behavior.

Manual verification:

```bash
pnpm install
pnpm --filter @ohmyc/cli build
test -f packages/cli/dist/plugins/timeline/.codex-plugin/plugin.json
test -f packages/cli/dist/plugins/timeline/hooks/hooks.json
pnpm --filter @ohmyc/cli test
```

## Migration Notes

Users who install through `ohmyc dashboard --install` keep the same local registration behavior. The install path changes internally from monorepo-owned plugin files to CLI-bundled dependency files.

OpenCode users should move to the plugin package from `ohmyc-plugins`; the monorepo symlink is removed because it would otherwise point at deleted source.
