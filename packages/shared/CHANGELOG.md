# @ohmyc/shared

## 0.2.0

### Minor Changes

- ddb8ab2: Expose provider locator metadata on shared agent, command, skill, and plugin schemas so clients can distinguish Codex, Claude, OpenCode, and shared resource origins.
- 5c5edd7: Explorer gains an opencode provider, per-source filtering, and origin-aware entity cards.

  - Shared: `Agent`/`Skill`/`Command` schemas carry optional `origins` and `badges` fields; new `OriginEnum` and `RenderBadgeSchema` Zod exports.
  - CLI: `/api/{agents,skills,commands}` and their detail routes flow through the provider registry; responses include provider-supplied `badges` and `origins`. Detail handlers resolve entities via the registry for any source (origin, project, local), fixing 404s on `source=opencode` and `source=project`.
  - UI: new Explorer-only `<SourceSwitcher>` header dropdown (last-on guard, persisted to `localStorage` as `ohmyc.sources`); `useAgents`/`useSkills`/`useCommands` thread the selection through a sorted `?origins=` query and cache key. `EntityCard` renders an origin chip plus provider-driven badges instead of per-type schema branching. Detail panel surfaces opencode `mode` and flattens one-level frontmatter objects (e.g. `permission.edit`).

### Patch Changes

- d361ce2: Add proper `dist`-based entry points and `exports` to `@ohmyc/shared`.
