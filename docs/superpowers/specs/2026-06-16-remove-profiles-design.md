# Remove Profiles feature — design

**Date:** 2026-06-16
**Status:** Approved
**Type:** Product and backend feature removal

## Background

Profiles used to be the product front door: a user could create a profile, attach agents, skills, commands, plugins, model config, runtime JSON, then activate or compare it. That model is now being removed from OhMyC. The app should no longer expose profile management in the UI, shared schema, Tauri command surface, or Rust core domain.

The removal is archived through Git, not through an in-app migration. Before implementation changes are made, create a Git tag at the current restore point:

`archive/profiles-before-removal-20260616`

That tag is the recovery mechanism if profiles need to come back later. User data under `$OHMYC_HOME/profiles` is left untouched on disk, but the new application does not read, migrate, display, activate, or maintain it.

## Goals

- Remove the Profiles feature from frontend routes, UI components, command palette actions, shortcuts, tests, and shared TypeScript schema.
- Remove the native profiles command surface from Tauri.
- Remove the Rust `ohmyc_core::profiles` domain and tests.
- Remove profile reference tracking from store management.
- Remove `profile` from provider source enums.
- Keep the app default route as `/explore/timeline`.
- Preserve restoreability through the archive Git tag.

## Non-goals

- Migrating, deleting, renaming, or archiving existing `$OHMYC_HOME/profiles` data.
- Keeping dormant profiles APIs for compatibility.
- Showing a migration or tombstone page at `/profiles`.
- Retaining legacy `profile` origin values in current schemas.

## Archive Boundary

Implementation starts by tagging the pre-removal state. The tag name is stable and descriptive:

`archive/profiles-before-removal-20260616`

No filesystem migration runs against user data. In particular, implementation must not touch:

- `$OHMYC_HOME/profiles`
- `$OHMYC_HOME/profiles/.active`
- profile-generated plugin directories
- profile activation backup files

After removal, these files become inert historical data. Restoring the feature means checking out or branching from the archive tag, not relying on runtime compatibility code.

## Frontend Design

The route table removes `/profiles/*`. `/explore` and unknown routes continue to redirect to `/explore/timeline`, matching the current effective default route.

Remove profiles-only UI and hooks:

- `ProfilesView`
- profile sidebar, card, editor, pickers, and activation/compare dialogs
- active profile chip
- compare panel
- `use-profiles`
- profiles-specific tests
- profile command palette entries and keyboard shortcuts

The command palette keeps only current navigation and entity search for Agents, Skills, Commands, Timeline, and Settings. It must not include activate, compare, edit, duplicate, or create profile actions.

Global shortcuts lose profile semantics:

- no `g p`
- no `Cmd+1`, `Cmd+2`, or `Cmd+3` profile activation
- no `c` compare shortcut

Store management becomes ordinary component management. Any "Used by profiles" column, profile-name pills, profile reference counters, or delete conflict copy tied to profiles is removed.

If implementation finds Storybook or equivalent stories:

- delete profiles-only stories
- keep shared component stories, but remove profiles-specific scenarios from them

## Backend Design

Tauri removes the profiles command module and command registration:

- delete `packages/desktop/src-tauri/src/api/profiles.rs`
- remove `pub mod profiles`
- remove all `profiles_*` entries from `tauri::generate_handler!`

Rust core removes the profiles domain:

- delete `crates/ohmyc-core/src/profiles/`
- remove `pub mod profiles`
- remove profile CRUD, preflight, activation, locking, marketplace, and symlink logic
- remove tests that exercise those modules

Store code no longer scans profile JSON files to compute references. The `store/references.rs` profile reference helper and delete-safety checks based on profile usage are removed. Store delete errors reflect only constraints that still exist after profiles are gone.

Error types that exist only for profile activation or profile reference conflicts are deleted once their call sites are gone.

## Shared Schema

Remove `packages/shared/src/profile-schema.ts` and its barrel export from `packages/shared/src/index.ts`.

Remove `profile` from source enums in current entity schemas:

- agents
- skills
- commands

The current product no longer accepts or produces profile-origin entities. Historical data with `source: "profile"` is not preserved as a supported schema case.

## Documentation Design

`DESIGN.md` must be updated before code deletion:

- product context no longer lists profiles
- Layout & Interaction no longer describes profiles as the front door or killer flow
- default route is documented as `/explore/timeline`
- active-profile chip, Compare panel, profile row interactions, profile editor, and Profiles to Components rules are removed or replaced
- Decisions Log gains a 2026-06-16 entry noting that Profiles were archived behind a Git tag and removed from product/backend surfaces

Existing docs and generated codebase-tour pages that describe Profiles can be left as historical docs unless they are part of active product guidance. Active guidance should not instruct users to use profiles.

## Data Flow After Removal

Application startup:

```text
User opens app
  -> route fallback
  -> /explore/timeline
  -> Explorer shell
  -> Timeline view
```

Store delete flow:

```text
User deletes a store component
  -> Tauri store command
  -> component delete logic
  -> no profile reference scan
  -> success or current non-profile error
```

Legacy profile data:

```text
$OHMYC_HOME/profiles exists
  -> app ignores it
  -> no migration
  -> no deletion
```

## Error Handling

Visiting `/profiles/*` in the new app falls through to the standard route fallback and lands on `/explore/timeline`. There is no special removed-feature page.

If an old frontend somehow calls a removed `profiles.*` Tauri command, that is treated as a version mismatch. The new app does not keep compatibility shims for deleted commands.

Store delete confirmations no longer mention profiles. Since profile reference checking is gone, profile references cannot block deletion.

## Testing

Delete tests that only cover removed profiles behavior. Update tests that use profiles as a generic transport example to use a surviving command instead.

Expected test updates:

- remove profiles view/component/hook tests
- remove Rust profiles module tests
- remove Tauri profiles API tests
- update store delete tests that assert profile reference conflicts
- update shared schema expectations for entity source enums
- update route and command palette tests so `/profiles` and profile actions are absent
- update any stories or visual snapshots that are profiles-only

Verification gates for implementation:

- `pnpm test`
- `pnpm --filter @ohmyc/shared build`
- `pnpm --filter @ohmyc/ui build`
- `pnpm --filter @ohmyc/desktop build`
- `cargo test`
- targeted UI smoke: app starts at `/explore/timeline`, command palette contains no profiles actions, store component delete copy has no profiles references

## Implementation Order

1. Create the archive Git tag on the pre-removal commit.
2. Update `DESIGN.md` to make `/explore/timeline` the documented front door and remove profiles guidance.
3. Remove frontend profiles routes, components, hooks, shortcuts, command palette actions, tests, and stories.
4. Remove shared profile schema and `profile` source enum values.
5. Remove Tauri profiles command module and registration.
6. Remove Rust profiles core domain and profile reference scanning.
7. Run formatting, type checks, and tests.

## Restore Path

To restore profiles later, create a branch from:

`archive/profiles-before-removal-20260616`

Then either continue development from that branch or cherry-pick unrelated post-removal changes back in. The removal commit itself should not contain user data migration, so restoring code from the tag is the intended recovery path.
