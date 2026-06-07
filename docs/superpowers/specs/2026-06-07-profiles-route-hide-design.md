# Hide Profiles route + fold Timeline into Explore — design

**Date:** 2026-06-07
**Status:** Approved
**Type:** UI surgery (hide-only — no backend or component deletion)

## Background

Slices 7 + 7b shipped the full Profiles migration end-to-end onto native Rust/Tauri commands. Now the product decision is to **hide Profiles from the UI entirely** — users should have no visible entry point to the profile management surface. The Profiles UI lives on inside the codebase (route, components, hooks) so the change is one revert away from undoing.

Concurrently, Timeline (currently a top-level route at `/timeline` with a Profiles-styled left sidebar) becomes a tab inside Explore at `/explore/timeline`, with its own "Activity" group at the top of the Explorer sidebar.

## Goals

- Default landing changes from `/profiles` to `/explore/timeline`.
- No nav, palette, header, or sidebar surface mentions Profiles.
- Timeline reachable only via the Explorer sidebar's Activity group (or direct URL).
- `/profiles/*` route registration stays — direct URL entry still resolves to the working Profiles UI. Trivially revertible by adding entry points back.
- Backend (Rust core, Tauri commands, all use-profiles hook surface area) is untouched.

## Non-goals

- Deleting any Profiles components, hooks, Tauri commands, or Rust modules.
- Deleting `active-profile-chip.tsx` or `view-switcher.tsx` (left as dead-imports-of-nothing for clean revert).
- Restructuring Explore's section system. Timeline is a **special tab** (kept out of the SECTIONS list), not a regular section.

## Design

### Architecture changes (UI only)

**Route table (`app.tsx`):**

| Route | Before | After |
|---|---|---|
| `/explore` (default) | `→ /explore/agents` | `→ /explore/timeline` |
| `/timeline` | `<TimelineRoute />` | **deleted** (catch-all handles it) |
| `/profiles/*` | `<ProfilesView />` | unchanged (URL-only access) |
| catch-all `*` | `→ /profiles` | `→ /explore/timeline` |

The `TimelineRoute` function (currently `app.tsx:191-220`) is deleted. Its body renders a `ProfilesSidebar` on the left + `TimelineView` on the right, fetching profiles via `useProfiles()` purely to feed the sidebar. None of that is needed after the change — `TimelineView` is rendered directly inside Explorer.

**Explorer (`explorer.tsx`):**

- `SECTIONS` array stays as is: agents, skills, commands, plugins, hooks, mcp, lsp.
- Add a special branch: when `activeSection === 'timeline'`, render `<TimelineView />` instead of the section-specific content.
- `activeSection` validity check at line 105 expands to accept `'timeline'` in addition to anything in `SECTIONS`. Default fallback for unknown tab values: `'timeline'`.

**Explorer sidebar (`components/sidebar.tsx`):**

- "Activity" group (top, single button labeled Timeline) stays — this is the "special group" placement.
- Button click handler changes from `navigate('/timeline')` to `navigate('/explore/timeline')`.
- Active-state styling fires when on `/explore/timeline` (the parent Explorer passes the active tab in, sidebar checks for `activeSection === 'timeline'` and applies the same highlight classes used by selected SECTIONS tabs).

**Profile sidebar (`components/profiles/profiles-sidebar.tsx`):**

- Delete the "Timeline" button at the top (lines 119-131) + the `timelineActive` prop. URL-typed Profiles users get no back-link to Timeline.
- Delete the "+ New Profile" `TabsTrigger` at the end of the My Profiles list (lines 201-214). The `new-profile` SidebarSelection type stays — the create flow is just no longer reachable via this sidebar. Drop the now-unused `Plus` icon import.

**Header (`components/header.tsx`):**

- Remove `<ActiveProfileChip>` render + import. Header has no profile chrome.
- Remove all `/profiles*` page-title detection branches. URL-typing `/profiles/*` falls through to default title — acceptable for a hidden surface.
- Remove `/timeline` page-title branch (timeline now lives inside Explorer; the Explorer header handles its own title).

**App (`app.tsx`):**

- ⌘K palette: drop four profile-related action sources (Edit Active, Clone Active, Compare, New Profile) at lines 70, 80, 87, 99. Drop any profile-route navigations from `goToCommands`/`searchCommands`.
- ⌘K Timeline action at line 131: `navigate('/timeline')` → `navigate('/explore/timeline')`.
- Drop the `active: ViewId` derivation (line 230) and `handleChange` (lines 232-234) — `ViewSwitcher` is no longer rendered anywhere.
- Drop `ViewSwitcher`, `ProfilesSidebar`, `ViewId` imports.

### Components left in tree (no code change, no longer imported)

- `components/active-profile-chip.tsx`
- `components/view-switcher.tsx`
- The `ProfilesSidebar`'s `timelineActive` prop handling code path becomes unreachable (only `ProfilesView` renders the sidebar now; it never passes `timelineActive=true`).

### Backend (zero changes)

- `crates/ohmyc-core/src/profiles/` — untouched.
- `packages/desktop/src-tauri/src/api/profiles.rs` — untouched.
- `packages/ui/src/hooks/use-profiles.ts` — untouched. Still called from `profile-card.tsx`, `profile-editor.tsx`, `profiles-view.tsx`, `active-profile-chip.tsx` (now dead).

## Data flow (after change)

```
User opens app
  └─ /         → catch-all redirect
                  └─ /explore/timeline
                       └─ Explorer
                            ├─ Sidebar (Activity > Timeline highlighted)
                            └─ TimelineView (full-width main pane)

User types /profiles in URL
  └─ /profiles/*
       └─ ProfilesView (works as before, minus Timeline back-link and "+ New Profile" button)
```

The two surfaces are isolated — no UI affordance crosses between them.

## Edge cases

1. **Bookmarked `/timeline`** → catch-all → `/explore/timeline`. Same content, new URL.
2. **Bookmarked `/profiles/dev`** → still resolves. User can't get back to it from chrome.
3. **`/profiles/new` URL typed** → still works. New-profile create flow is reachable only this way (sidebar `+` is gone).
4. **Header title on URL-typed `/profiles/*`** → default fallback. Hidden surface, cosmetic.
5. **Explorer validates `activeSection`** — must accept `'timeline'`, otherwise `/explore/timeline` falls back to the default tab and infinite-loops on the redirect.

## Testing

**Existing tests stay green** — Rust + Tauri, `profile-editor`, `profile-card`, `use-profiles`, `use-store`, `use-plugins`, `use-timeline` are all unaffected.

**Test that may need updating:** `tests/profiles-view.test.tsx` — if any assertion clicks/queries the "+ New Profile" tab in the sidebar, those expectations must change (drop the assertion). Profile-create flow itself still works.

**No new tests required.** This is mechanical UI surgery on hidden routes.

**Verification gates:**
- `pnpm --filter @ohmyc/ui exec tsc --noEmit` — passes (modulo pre-existing menubar baseline errors).
- `pnpm --filter @ohmyc/ui test` — 4 pre-existing menubar failures unchanged; no new failures.
- Manual smoke (after `pnpm desktop`):
  - App lands on `/explore/timeline` with Timeline highlighted in Activity group.
  - Header shows no profile chip.
  - ⌘K palette has no profile actions.
  - Direct URL `/profiles` still renders the Profiles UI; the rendered sidebar has no Timeline link and no "+ New Profile" button.

## Implementation notes

The change is one branch worth of mechanical edits across ~5 files. Files touched:
- `packages/ui/src/app.tsx`
- `packages/ui/src/explorer.tsx`
- `packages/ui/src/components/sidebar.tsx`
- `packages/ui/src/components/profiles/profiles-sidebar.tsx`
- `packages/ui/src/components/header.tsx`

Estimated diff: ~80 lines added/changed, ~120 lines removed (the deleted `TimelineRoute` body + sidebar buttons + palette actions + header detection branches). Single commit on a hide-profiles-route branch.

Revert path: `git revert` of the implementation commit restores every entry point. No data, schema, or backend state is touched.
