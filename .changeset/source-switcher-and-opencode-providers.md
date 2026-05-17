---
"@ohmyc/shared": minor
"@ohmyc/cli": minor
"@ohmyc/ui": minor
---

Explorer gains an opencode provider, per-source filtering, and origin-aware entity cards.

- Shared: `Agent`/`Skill`/`Command` schemas carry optional `origins` and `badges` fields; new `OriginEnum` and `RenderBadgeSchema` Zod exports.
- CLI: `/api/{agents,skills,commands}` and their detail routes flow through the provider registry; responses include provider-supplied `badges` and `origins`. Detail handlers resolve entities via the registry for any source (origin, project, local), fixing 404s on `source=opencode` and `source=project`.
- UI: new Explorer-only `<SourceSwitcher>` header dropdown (last-on guard, persisted to `localStorage` as `ohmyc.sources`); `useAgents`/`useSkills`/`useCommands` thread the selection through a sorted `?origins=` query and cache key. `EntityCard` renders an origin chip plus provider-driven badges instead of per-type schema branching. Detail panel surfaces opencode `mode` and flattens one-level frontmatter objects (e.g. `permission.edit`).
