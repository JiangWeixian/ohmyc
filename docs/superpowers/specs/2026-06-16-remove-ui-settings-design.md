# Remove UI Settings Design

## Context

The UI package currently has a Settings page implementation under
`packages/ui/src/components/settings/`, plus navigation paths that can point to
`/explore/settings`. The user confirmed the desired scope is option B: remove
the frontend Settings entry and page functionality while keeping the lower-level
settings transport and hook capability available for other configuration flows.

There are two important boundaries:

- The Settings page is a UI feature and should be removed from the Explorer
  experience.
- `useSettings` and the `settings.get` / `settings.set` transport methods are
  lower-level configuration APIs and should remain.

## Goals

- Remove all user-facing Settings page entry points in `packages/ui`.
- Remove the Settings page component tree.
- Keep backend and transport-level settings access intact.
- Ensure `/explore/settings` no longer exists as a usable page.
- Preserve tests for the retained lower-level settings hook.

## Non-Goals

- Do not remove `packages/ui/src/hooks/use-settings.ts`.
- Do not remove `settings.get` or `settings.set` from the transport layer.
- Do not alter backend settings persistence behavior.
- Do not add a legacy fallback page for `/explore/settings`.

## Proposed Approach

Use a frontend-only removal:

1. Remove Settings from the Command Palette.
2. Remove keyboard navigation to `/explore/settings`.
3. Remove `SettingsLayout` usage from Explorer.
4. Delete the Settings page component directory.
5. Delete component tests that only cover the removed Settings page.
6. Keep hook-level tests for `useSettings`.

This keeps the deletion focused on the UI feature while avoiding risk to shared
configuration plumbing.

## Navigation Behavior

After removal:

- The Command Palette no longer shows a Settings command.
- `g` then `s` should navigate to Skills consistently with the existing
  navigation label and shortcut meaning.
- A direct visit to `/explore/settings` should be treated as an invalid Explorer
  tab and fall back through the existing invalid-tab behavior.

No special redirect or placeholder should be added for the removed route.

## Files To Remove

- `packages/ui/src/components/settings/general-settings.tsx`
- `packages/ui/src/components/settings/settings-content.tsx`
- `packages/ui/src/components/settings/settings-layout.tsx`
- `packages/ui/src/components/settings/settings-sidebar.tsx`
- `packages/ui/tests/components/settings/general-settings.test.tsx`

## Files To Update

- `packages/ui/src/app.tsx`
  - Remove the Settings icon import if unused.
  - Remove the `goto-settings` command.

- `packages/ui/src/hooks/use-keyboard-shortcuts.ts`
  - Change `g` then `s` inside `/explore/*` from `/explore/settings` to
    `/explore/skills`.
  - Update comments so shortcut documentation matches behavior.

- `packages/ui/src/explorer.tsx`
  - Remove `SettingsLayout` import.
  - Remove the `activeSection === 'settings'` render branch.
  - Ensure `settings` is not part of the valid section list.

- Tests that assert settings navigation exists should be updated or removed.

## Testing

Run focused UI tests after implementation:

```bash
pnpm --filter @ohmyc/ui exec vitest run \
  tests/app.routes.test.tsx \
  tests/explorer.inventory.test.tsx \
  tests/hooks/use-settings.test.tsx
```

Then run full package tests or coverage before committing the implementation:

```bash
pnpm --filter @ohmyc/ui test:coverage
```

Expected evidence:

- No component tests import `components/settings/*`.
- `use-settings.test.tsx` still passes.
- `/explore/settings` does not render a Settings page.
- Command Palette no longer exposes a Settings command.

## Risks

- Existing users may have learned the hidden `g s` Settings shortcut. The new
  behavior is more consistent because `g s` maps to Skills.
- Removing component tests will lower coverage slightly, but the package
  recently exceeded the 85% target with margin. Coverage should be rechecked
  after deletion.

## Decision

Proceed with frontend Settings page removal and retain lower-level settings
APIs.
