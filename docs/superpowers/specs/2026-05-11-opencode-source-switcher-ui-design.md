# Source switcher + origin chips (UI)

Status: SPEC
Branch target: `feat/opencode-providers` (off `develop`)
Pairs with: `2026-05-11-opencode-providers-backend-design.md` (backend half)
Source: `~/.gstack/projects/JiangWeixian-claudeui/jiangwei-hotfix-issue-9-design-20260509-232405.md`
Approved layout: `~/.gstack/projects/JiangWeixian-claudeui/designs/source-switcher-20260510/approved.json` (variant C from `/design-shotgun`)

## Problem

Once the backend can return entries from multiple tools (Claude, opencode, the neutral `.agents/` namespace), the Explorer UI needs:

1. A way for the user to scope the view to one or more sources.
2. A consistent way to show *which* tool(s) a given entry belongs to.
3. A render-hint pathway so per-tool schema differences (e.g. opencode `mode`) don't push schema branching into `EntityCard`.

This spec covers the UI half only. The provider/registry/routes work lives in the paired backend spec.

## Scope

- Header `<SourceSwitcher>` component + menu styling.
- `useSources()` store + localStorage persistence.
- `?origins=` query wiring in `useAgents` / `useSkills` / `useCommands` hooks.
- `EntityCard` origin chip + provider-driven `badges` prop.
- Detail-panel surfacing of opencode-specific frontmatter fields (`mode`, `permission.*`) via the existing harvest in `explorer.tsx:250-264`.
- DESIGN.md decisions-log update.

## Non-Goals (v1)

- No bespoke UI for opencode `permission` (no chip, no hover card). It shows up as metadata rows in the detail panel via the existing harvest.
- No source filter in the ⌘K palette (out of scope; can be added in v1.5 if needed).
- No per-source coloring beyond the small origin chip in the card header.
- No edit affordances. Read-only.

## Constraints

- Don't introduce schema branching in `EntityCard`. The provider supplies `badges: RenderBadge[]`; the card just renders them.
- Last-on guard: the SourceSwitcher cannot end up with zero selected sources.
- Default = all sources checked.
- Must match the approved layout (variant C). Position in the header between the breadcrumb and `CommandPaletteTrigger`.

## SourceSwitcher

### Behavior

- Dropdown picker with a checkbox per registered source: `Claude`, `Opencode`. (The `agents` origin is a property of skills, not a top-level source — it does not appear in the menu.)
- Trigger button label:
  - All checked → `Source: All`
  - One checked → `Source: Claude` or `Source: Opencode`
  - (Zero checked is unreachable — see last-on guard.)
- **Last-on guard:** unchecking the final remaining checkbox is a no-op. The checkbox stays checked and the click is silently ignored. Rationale: zero-state has no value and is confusing.
- **Persistence:** `localStorage` key `ohmyc.sources` as a JSON string array, e.g. `["claude","opencode"]`. Read on mount; written on every change.
- **Initial state:** if the key is absent or invalid, default to all sources checked. If the key contains an origin no longer recognized by the backend, ignore that entry silently.

### Styling

- **Trigger:** ghost variant, `h-7`, `text-[13px]`, chevron-down icon.
- **Position:** header, between breadcrumb and `CommandPaletteTrigger`.
- **Menu container:** `bg #191a1b`, `border rgba(255,255,255,0.08)`, `rounded-lg`, `p-2`.
- Item layout follows the approved JSON in `~/.gstack/projects/JiangWeixian-claudeui/designs/source-switcher-20260510/approved.json`.

### State

```ts
// packages/ui/src/state/sources.ts
type Origin = 'claude' | 'opencode' | 'agents'

interface SourcesStore {
  selected: Set<Origin>
  toggle: (origin: Origin) => void   // honors last-on guard
  set: (origins: Origin[]) => void
}

export const useSources = create<SourcesStore>(...)
```

- Zustand store (matches existing UI-state conventions in this repo).
- `toggle` enforces the last-on guard and writes to localStorage.

## Hook wiring

`useAgents`, `useSkills`, `useCommands` (existing data hooks) read the selected sources and append `?origins=...` (comma-joined, sorted for stable cache keys) to the fetch URL.

- When the selected set equals the full registered set, omit the query param entirely (cleaner URLs, server defaults to all).
- React Query / SWR cache key includes the sorted origins string.

## EntityCard

`EntityCard` (`packages/ui/src/components/entity-card.tsx`) is extended so that schema-specific badges flow in from the provider rather than from per-entity-type switch statements in `explorer.tsx`.

### Origin chip

- Small `MonoBadge` in the card header next to the title.
- Value: `entity.origins.length === 1 ? entity.origins[0] : entity.origins.join(' · ')`. Shared skills therefore render as e.g. `claude · opencode · agents`.
- Backend supplies `origins: Origin[]` only (no separate singular `origin` field).

### Provider-driven badges

Replace the current per-entity-type badge logic in `explorer.tsx:78-108` with a single path: `entity.badges` (precomputed by the backend per the `RenderBadge` shape from the backend spec) is passed straight to `EntityCard`'s `badges` prop. The card stops branching on schema.

### Detail panel

No changes required. The existing frontmatter harvest in `explorer.tsx:250-264` already iterates over `selectedEntity.frontmatter` and emits metadata rows for known fields. Opencode-specific fields land in automatically:

- `mode` → one row labelled `mode`.
- `permission` → one row per non-default key, labelled `permission.edit`, `permission.bash`, etc. (Implementation: flatten one level when the value is an object.)

The metadata-harvest extension to flatten `permission` is the only detail-panel code change. No new component.

## Sidebar

No changes. The existing SECTIONS list is unaffected.

## Migration order

This UI ships as PR #3 (after the two backend PRs in the paired spec):

3. **PR #3 — SourceSwitcher + origin chips + EntityCard badges.**
   - Land `useSources()` store + localStorage.
   - Land `<SourceSwitcher>` header component.
   - Wire `?origins=` query param in data hooks.
   - Extend `EntityCard` to take `badges` from provider entities.
   - Add origin chip on `EntityCard`.
   - Extend `explorer.tsx` metadata harvest to flatten one-level objects (covers `permission`).
   - Include a screenshot in the PR body.

## Testing

- **SourceSwitcher last-on guard:** unchecking the only selected source is a no-op; menu state and localStorage unchanged.
- **localStorage round-trip:** set sources, reload component, state restored.
- **Unknown origin in localStorage:** silently ignored, not crashed.
- **Skill dedup visible in UI:** with a fixture `SKILL.md` reachable via Claude and Agents providers, the card renders **one** entry and the origin chip reads `claude · agents`.
- **Origin filter UX:** unchecking `Opencode` removes opencode-only agents within 100ms (client-driven by query-key change, no full refetch needed if cached).
- **EntityCard:** renders provider-supplied badges verbatim; no schema branching remains in the component.

## Success criteria

- With both `~/.claude/agents/foo.md` and `~/.config/opencode/agents/bar.md` present and **Source: All** selected, the Explorer shows two cards with correct origin chips.
- A `SKILL.md` under `~/.agents/skills/shared/` shows once in the Skills tab with three origin chips (`claude · opencode · agents`).
- Switching Source to **Claude** hides the opencode-only agent within 100ms.
- Opencode agent's `permission: { edit: deny, bash: ask }` shows up as two metadata rows in the detail panel (`permission.edit: deny`, `permission.bash: ask`).
- Opencode agent's `mode` shows up both as an `EntityCard` badge and as a metadata row in the detail panel.

## Risks & mitigations

- **Stale localStorage after origin rename.** If a future release renames an origin, old localStorage values would point at nothing. Mitigation: filter against the live set of registered origins on load; default-fill the rest.
- **Cache fragmentation.** Toggling sources creates new query keys. Mitigation: omit `?origins=` when the selection equals the full set so the "all" case shares one cache entry across users.
- **Badge sprawl on opencode agents.** Mode alone is fine; resist adding permission badges in v1 (covered in non-goals).

## DESIGN.md update

Add one row to the Decisions Log: "Header gains Source switcher between breadcrumb and ⌘K trigger; default = all sources, persisted to `localStorage` as `ohmyc.sources`. Last-on guard prevents zero-state." Land in PR #3 alongside the UI change.
