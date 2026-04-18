# Phase 3: Safe Switching and Reference Safety - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make profile lifecycle operations safe, reversible, and trustworthy for daily environment switching. This phase covers transaction-like activation with rollback, full deactivation cleanup, profile switching with confirmation, missing-component pre-flight checks, reference safety surfaces for store components, and concurrent activation protection. It does not add preview-diff workflows, profile comparison, or cross-ecosystem adapter features.

</domain>

<decisions>
## Implementation Decisions

### Rollback & transaction safety
- Activation must be transactional: if any step fails, undo everything done so far (remove created symlinks, delete generated directories, restore settings backup) and return to the pre-activation state
- When activation fails during a profile switch (Profile A → Profile B), rollback must restore Profile A's fully active state — not leave the user in a deactivated/clean slate
- Missing store components (referenced by profile but deleted from store) must block activation entirely via a pre-flight check, not activate with warnings. All referenced agents, skills, and commands must exist in the store before any filesystem changes begin

### Deactivation behavior
- Deactivation must fully clean up all generated artifacts: remove symlinks in agents/, skills/, commands/ subdirectories, delete generated .claude-plugin/, hooks/, .mcp.json, .lsp.json files, restore settings backup, and remove .active marker
- The profile definition itself stays intact — only the activation artifacts are cleaned up
- Profile switching uses deactivate-then-activate sequence: fully clean up Profile A, then activate Profile B. No differential/diff-based switching

### Warning & confirmation UX
- Activation warnings (missing components, risky changes) must surface in a confirmation modal/dialog that the user must acknowledge before proceeding
- Switching to a different profile while one is active must show a confirmation dialog: "Profile A is active. Switch to Profile B?"
- Deactivating the current profile does NOT require confirmation — it should be immediate/direct since it restores prior state
- Pre-flight checks run before any filesystem changes, so the modal shows what would happen before committing

### Reference safety surfaces
- Profile references must be visible inline in the store browser — each component shows which profiles reference it (e.g., "Used by 2 profiles: work, personal")
- Deleting a store component that profiles reference must show a warning but allow the delete to proceed (warn-but-allow, not hard block)
- Reference counts should be visible before the user initiates any delete action, not only in the delete confirmation

### Concurrent activation protection
- Activation must use file-based locking to prevent concurrent activation attempts from producing inconsistent state
- If a lock is held by another process, the activation request should fail with a clear error rather than silently overwriting

### Backup strategy
- Settings backups must be per-profile: before activating Profile B, back up current settings as settings.backup.<profileName>.json (where profileName is the previously active profile)
- This ensures rollback always knows which backup to restore, even across multiple profile switches

### Active profile deletion
- Deleting the currently active profile must be blocked with a message requiring the user to deactivate first
- No auto-deactivate-and-delete — the user must explicitly deactivate before deletion

### Settings risk threshold
- Only warn about settings changes that would overwrite keys the user has manually set in their current settings
- New keys added by the profile overlay are applied silently (no warning)
- This minimizes confirmation fatigue while protecting intentional user configuration

### Claude's Discretion
- Exact visual design of the confirmation modal (layout, icons, button order)
- Exact file-lock implementation details (lock file path, stale lock detection, timeout)
- Exact wording of confirmation dialog messages
- Exact treatment of partial symlink cleanup errors during rollback (log and continue vs. surface to user)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and roadmap scope
- `.planning/PROJECT.md` — Claude-first product direction, local-store-centered profile workflow, filesystem-based activation constraints
- `.planning/REQUIREMENTS.md` — Phase 3 requirements `INV-03`, `ACT-03..06`
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and planned sub-areas

### Prior phase decisions
- `.planning/phases/01-store-and-inventory-foundation/01-CONTEXT.md` — Canonical store positioning, read-only inventory boundary, import conflict handling
- `.planning/phases/02-profile-composition/02-CONTEXT.md` — Active-state semantics (profile name not path), pre-activation visibility decisions, deferred Phase 3 concerns

### Existing implementation anchors
- `packages/cli/src/server/services/profileService.ts` — Current activation/deactivation behavior, symlink creation, settings backup/merge, .active marker management
- `packages/cli/src/server/routes/profiles.ts` — Current profile API surface including activate/deactivate endpoints
- `packages/ui/src/hooks/useProfiles.ts` — Current activation/deactivation mutations and query invalidation
- `packages/ui/src/components/profiles/ProfileCard.tsx` — Current profile detail with Activate/Deactivate/Delete buttons
- `packages/cli/src/server/routes/store.ts` — Existing store delete behavior and reference checking
- `packages/ui/src/components/store/StoreComponentList.tsx` — Current store browser list where reference indicators should appear

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProfileService.activate()`: already creates symlinks, generates plugin files, backs up settings, and returns warnings for missing components — Phase 3 evolves this into a transactional flow rather than replacing it
- `ProfileService.deactivate()`: already restores settings and removes .active — Phase 3 extends it to clean up generated artifacts
- Store service already has reference-check plumbing for delete safety — can be extended for inline reference display
- `useActivateProfile` and `useDeactivateProfile` hooks already handle mutation and query invalidation — confirmation dialogs can be added as pre-mutation logic

### Established Patterns
- Settings backup uses `settings.backup.json` at `baseDir` — per-profile backup extends this pattern with profile-scoped filenames
- Activation warnings are already returned from the API as `{ warnings: string[] }` — the pre-flight check can reuse this structure with blocking semantics
- React Query mutations already invalidate the `['profiles']` query on success — confirmation dialogs fit naturally before mutation execution

### Integration Points
- Transaction safety requires changes to `ProfileService.activate()` — wrap symlink/plugin/settings operations in a rollback-capable sequence
- File locking should be added to the profile service layer, likely as a utility that wraps activate/deactivate
- Confirmation dialogs need coordination between `ProfileCard` button handlers and the mutation hooks
- Store component reference display needs a new API response field or endpoint, consumed by `StoreComponentList`
- Per-profile backup requires changes to the backup filename convention in both activate and deactivate paths

</code_context>

<specifics>
## Specific Ideas

- The user wants switching to feel safe enough for daily use — this is a power-user tool and mistakes should be recoverable
- Pre-flight checks before any filesystem changes are important for both safety and UX predictability
- Deactivation should be lightweight and immediate (no confirmation) since it restores prior state
- Reference visibility should be proactive (inline in store browser) rather than reactive (only on delete)

</specifics>

<deferred>
## Deferred Ideas

- Full activation diff preview and profile-vs-profile comparison — v2 preview work
- Differential/patch-based profile switching — current deactivate-then-activate is simpler and sufficient
- Cross-ecosystem profile abstractions — outside v1 scope

</deferred>

---
*Phase: 03-safe-switching-and-reference-safety*
*Context gathered: 2026-04-02*
