# Phase 3: Safe Switching and Reference Safety - Research

**Researched:** 2026-04-05
**Domain:** Profile lifecycle safety, transactional filesystem operations, Node.js file locking, React confirmation UX
**Confidence:** HIGH

## Summary

Phase 3 transforms the existing best-effort activation/deactivation flow in `ProfileService` into a safe, transactional lifecycle. The core challenge is evolving the current `activate()` method -- which creates symlinks, generates plugin files, and merges settings in a single pass with soft warnings for missing components -- into a pre-flight-checked, rollback-capable operation that either succeeds completely or restores the exact prior state.

The existing codebase already provides significant scaffolding: `ProfileService.activate()` already does symlink creation, plugin generation, and settings backup/merge. `ProfileService.deactivate()` already restores settings and removes `.active`. The store routes already have `getReferencingProfiles()` in `StoreService` and the store delete endpoints already check references. The `StoreComponentList` UI already computes a client-side `referencedByMap` from profiles. Phase 3 hardens all of these: making activation transactional with rollback, changing missing-component warnings into pre-flight blockers, extending deactivation to clean all generated artifacts, adding per-profile backup naming, and surfacing confirmation dialogs for switching and risky activations.

**Primary recommendation:** Refactor `ProfileService.activate()` into a step-based transaction with a rollback stack, use `proper-lockfile` for inter-process locking (battle-tested, handles stale locks and retries), and introduce a confirmation dialog component for activation/switching pre-flight checks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Activation must be transactional: if any step fails, undo everything done so far (remove created symlinks, delete generated directories, restore settings backup) and return to the pre-activation state
- When activation fails during a profile switch (Profile A to Profile B), rollback must restore Profile A's fully active state -- not leave the user in a deactivated/clean slate
- Missing store components (referenced by profile but deleted from store) must block activation entirely via a pre-flight check, not activate with warnings. All referenced agents, skills, and commands must exist in the store before any filesystem changes begin
- Deactivation must fully clean up all generated artifacts: remove symlinks in agents/, skills/, commands/ subdirectories, delete generated .claude-plugin/, hooks/, .mcp.json, .lsp.json files, restore settings backup, and remove .active marker
- The profile definition itself stays intact -- only the activation artifacts are cleaned up
- Profile switching uses deactivate-then-activate sequence: fully clean up Profile A, then activate Profile B. No differential/diff-based switching
- Activation warnings (missing components, risky changes) must surface in a confirmation modal/dialog that the user must acknowledge before proceeding
- Switching to a different profile while one is active must show a confirmation dialog: "Profile A is active. Switch to Profile B?"
- Deactivating the current profile does NOT require confirmation -- it should be immediate/direct since it restores prior state
- Pre-flight checks run before any filesystem changes, so the modal shows what would happen before committing
- Profile references must be visible inline in the store browser -- each component shows which profiles reference it (e.g., "Used by 2 profiles: work, personal")
- Deleting a store component that profiles reference must show a warning but allow the delete to proceed (warn-but-allow, not hard block)
- Reference counts should be visible before the user initiates any delete action, not only in the delete confirmation
- Activation must use file-based locking to prevent concurrent activation attempts from producing inconsistent state
- If a lock is held by another process, the activation request should fail with a clear error rather than silently overwriting
- Settings backups must be per-profile: before activating Profile B, back up current settings as settings.backup.<profileName>.json (where profileName is the previously active profile)
- This ensures rollback always knows which backup to restore, even across multiple profile switches
- Deleting the currently active profile must be blocked with a message requiring the user to deactivate first
- No auto-deactivate-and-delete -- the user must explicitly deactivate before deletion
- Only warn about settings changes that would overwrite keys the user has manually set in their current settings
- New keys added by the profile overlay are applied silently (no warning)

### Claude's Discretion
- Exact visual design of the confirmation modal (layout, icons, button order)
- Exact file-lock implementation details (lock file path, stale lock detection, timeout)
- Exact wording of confirmation dialog messages
- Exact treatment of partial symlink cleanup errors during rollback (log and continue vs. surface to user)

### Deferred Ideas (OUT OF SCOPE)
- Full activation diff preview and profile-vs-profile comparison -- v2 preview work
- Differential/patch-based profile switching -- current deactivate-then-activate is simpler and sufficient
- Cross-ecosystem profile abstractions -- outside v1 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-03 | User can see which profiles reference a selected store component before editing or deleting it | StoreComponentList already builds `referencedByMap` client-side; StoreService already has `getReferencingProfiles()`. Need inline profile name display. |
| ACT-03 | User can deactivate the active profile and restore prior settings state | Current `deactivate()` restores settings and removes `.active` but does not clean symlinks/plugin files. Need full artifact cleanup. |
| ACT-04 | User can switch directly from one profile to another without manually cleaning up the previous one | Current `activate()` already calls `deactivate()` first. Need transactional rollback if the new activation fails. |
| ACT-05 | User receives warnings when activation skips missing components or would apply risky changes | Current `activate()` returns soft warnings. Need pre-flight blocking for missing components, settings overwrite warnings surfaced in confirmation modal. |
| ACT-06 | User is not left in a partially activated state if activation fails midway | Need step-based transaction with rollback stack in `activate()`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | built-in | Filesystem operations for symlink, rm, readFile, writeFile | Already used throughout ProfileService |
| `proper-lockfile` | 4.1.2 | Inter-process file locking for activation/deactivation | Handles stale lock detection, retry, and cross-platform edge cases out of the box. Preferred over hand-rolled `wx` flag approach. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Query (`@tanstack/react-query`) | existing | Mutation hooks for activate/deactivate with confirmation pre-check | Already installed, pattern established |
| Radix UI AlertDialog | existing project pattern | Confirmation dialogs per Linear UI skill guidelines | Project uses AlertDialog for destructive/irreversible actions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `proper-lockfile` | Built-in `fs.open` with `wx` flag | `wx` approach avoids a dependency but requires hand-rolling stale lock detection, retry logic, and signal handling. `proper-lockfile` is battle-tested and covers these edge cases. |
| Manual rollback stack | Database-like transactions | Overkill for filesystem operations; a manual undo stack with recorded operations is simpler and sufficient. |

**Installation:**
```bash
pnpm add proper-lockfile --filter @claudeui/cli
```

**Version verification:** `proper-lockfile@4.1.2` verified via npm registry on 2026-04-05.

## Architecture Patterns

### Recommended Project Structure Changes
```
packages/cli/src/server/
├── services/
│   ├── profileService.ts       # EVOLVES: transactional activate/deactivate
│   ├── storeService.ts          # EXTENDS: getReferencingProfiles already exists
│   └── lockService.ts           # NEW: file-based locking utility
├── routes/
│   ├── profiles.ts              # EXTENDS: new endpoints for pre-flight, active-delete protection
│   └── store.ts                 # MINOR: reference counts on list responses
packages/ui/src/
├── components/profiles/
│   ├── ProfileCard.tsx          # EXTENDS: confirmation before activate/switch
│   ├── ConfirmSwitchDialog.tsx  # NEW: switch confirmation modal
│   └── ActivationWarnings.tsx   # NEW: pre-flight warning display
├── hooks/
│   └── useProfiles.ts           # EXTENDS: pre-flight mutation, confirmation flow
```

### Pattern 1: Step-Based Transaction with Rollback Stack
**What:** Decompose `activate()` into discrete steps, each recording an undo action on success. On failure, pop the undo stack and execute in reverse.
**When to use:** The core activation flow in `ProfileService.activate()`.
**Example:**
```typescript
// Conceptual structure for transactional activation
interface UndoAction {
  label: string;
  undo: () => Promise<void>;
}

async activateTransactional(name: string): Promise<{ warnings: string[] }> {
  const undoStack: UndoAction[] = [];
  let previousActive: string | null = null;

  try {
    // Step 0: Acquire lock
    await this.lockService.acquire();
    undoStack.push({ label: 'release-lock', undo: () => this.lockService.release() });

    // Step 1: Pre-flight check (no filesystem changes)
    const missing = await this.preflightCheck(name);
    if (missing.length > 0) {
      throw new ActivationBlockedError('Missing components', missing);
    }

    // Step 2: Detect current active and record for rollback
    previousActive = await this.getActive();

    // Step 3: Deactivate current profile (if any)
    if (previousActive) {
      await this.deactivate(); // deactivate is already safe
    }

    // Step 4: Per-profile settings backup
    const backupName = previousActive
      ? `settings.backup.${previousActive}.json`
      : 'settings.backup.default.json';
    const currentSettings = await this.readSettings();
    await this.writeBackup(backupName, currentSettings);
    undoStack.push({ label: 'restore-backup', undo: () => this.restoreBackup(backupName) });

    // Step 5: Create symlinks (record each for rollback)
    for (const agent of profile.agents) {
      await this.createSymlink(agent, 'agents');
      undoStack.push({ label: `symlink-agent-${agent}`, undo: () => this.removeSymlink(agent, 'agents') });
    }
    // ... skills, commands

    // Step 6: Generate plugin files
    await this.generatePluginFiles(name);
    undoStack.push({ label: 'plugin-files', undo: () => this.removeGeneratedFiles(name) });

    // Step 7: Merge settings
    await this.mergeSettings(name);
    // Settings backup already recorded; undo restores it

    // Step 8: Write .active marker
    await this.writeActive(name);
    undoStack.push({ label: 'active-marker', undo: () => this.removeActive() });

    return { warnings: this.computeSettingsWarnings(currentSettings, profile.settings) };
  } catch (err) {
    // Rollback in reverse order
    for (let i = undoStack.length - 1; i >= 0; i--) {
      try {
        await undoStack[i].undo();
      } catch (rollbackErr) {
        // Log but continue rollback
      }
    }
    // If this was a switch (previousActive exists), re-activate the old profile
    if (previousActive && !(err instanceof ActivationBlockedError)) {
      try {
        await this.activate(previousActive);
      } catch { /* best effort */ }
    }
    throw err;
  } finally {
    await this.lockService.release();
  }
}
```

### Pattern 2: Pre-Flight Check Endpoint
**What:** A separate API endpoint that validates a profile can be activated without making any filesystem changes. Returns missing components, settings overwrite warnings, and the current active profile name.
**When to use:** Before the confirmation dialog; the UI calls this to populate the warning modal.
**Example:**
```typescript
// New method on ProfileService
async preflight(name: string): Promise<PreflightResult> {
  const profile = await this.get(name);
  if (!profile) throw new Error(`Profile "${name}" not found`);

  const missing: string[] = [];
  // Check agents
  for (const agent of profile.agents) {
    if (!(await this.storeComponentExists('agents', agent))) {
      missing.push(`agent:${agent}`);
    }
  }
  // ... skills, commands

  // Settings overwrite warnings
  const currentSettings = await this.readSettings();
  const settingsWarnings = this.computeSettingsWarnings(currentSettings, profile.settings);

  const currentActive = await this.getActive();

  return {
    canActivate: missing.length === 0,
    missing,
    settingsWarnings,
    currentActive,
  };
}
```

### Pattern 3: File-Based Advisory Lock
**What:** Use a lockfile with atomic creation to prevent concurrent activations.
**When to use:** Wrapping the entire activate/deactivate flow.
**Example:**
```typescript
import lockfile from 'proper-lockfile';

class LockService {
  private lockPath: string;
  private releaseHandle: (() => Promise<void>) | null = null;

  constructor(lockDir: string) {
    this.lockPath = path.join(lockDir, '.activation.lock');
  }

  async acquire(): Promise<void> {
    // Ensure lock file exists before locking
    try { await fs.writeFile(this.lockPath, '', { flag: 'wx' }); } catch {}

    this.releaseHandle = await lockfile.lock(this.lockPath, {
      stale: 10_000,   // 10s stale threshold — activation is fast
      retries: { retries: 3, minTimeout: 200 },
    });
  }

  async release(): Promise<void> {
    if (this.releaseHandle) {
      await this.releaseHandle();
      this.releaseHandle = null;
    }
  }
}
```

### Pattern 4: Full Artifact Cleanup in Deactivation
**What:** Extend `deactivate()` to remove all generated files, not just settings and `.active`.
**When to use:** The `deactivate()` method needs to clean up the full activation footprint.
**Example:**
```typescript
async deactivate(): Promise<void> {
  const activeName = await this.getActive();
  if (!activeName) return; // nothing to deactivate

  const activeDir = path.join(this.profilesDir, activeName);

  // Restore per-profile settings backup
  const backupName = `settings.backup.${activeName}.json`;
  const backupPath = path.join(this.baseDir, backupName);
  try {
    const backup = await readFile(backupPath, 'utf-8');
    await writeFile(path.join(this.baseDir, 'settings.json'), backup, 'utf-8');
    await unlink(backupPath); // clean up per-profile backup
  } catch { /* no backup for this profile */ }

  // Remove generated symlinks
  for (const sub of ['agents', 'skills', 'commands']) {
    const dir = path.join(activeDir, sub);
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        await rm(path.join(dir, entry), { force: true });
      }
    } catch { /* dir doesn't exist */ }
  }

  // Remove generated config files
  for (const file of ['.claude-plugin', 'hooks', '.mcp.json', '.lsp.json']) {
    await rm(path.join(activeDir, file), { recursive: true, force: true });
  }

  // Remove .active marker
  await unlink(this.activePath()).catch(() => {});
}
```

### Anti-Patterns to Avoid
- **Swallowing rollback errors silently:** Log every rollback failure at minimum. The user should never discover a partially-rolled-back state days later.
- **Using global singleton lock:** Lock scope must be per-baseDir, not process-wide. Each ClaudeUI instance manages its own baseDir.
- **Converting warnings to exceptions in the old code path:** The existing `activate()` returns `{ warnings }` -- the new pre-flight approach is a separate flow. Don't mutate the old response shape during refactoring.
- **Deleting the old generic `settings.backup.json` immediately:** During the transition from generic to per-profile backups, handle both file names during deactivation for backward compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Custom modal with manual focus trapping, portal, keyboard handling | Radix AlertDialog (already in project dependency chain) | Project skill mandates AlertDialog for destructive/irreversible actions; handles focus trap, Escape key, aria attributes |
| Settings deep merge | Custom recursive merge with edge cases | Existing `ProfileService.deepMerge()` | Already works, already tested. Extend with overwrite detection rather than replacing. |
| Reference counting | Walk all profiles on every list call | Client-side `referencedByMap` (already built in `StoreComponentList`) + optional server-side enrichment | Already implemented in the UI. Could optionally add server-side `referencingProfiles` field to list responses. |
| File locking with retries and stale detection | `proper-lockfile` (chosen) | Hand-rolled `wx` flag approach | `proper-lockfile` handles stale lock detection, retry, signal handling, and cross-platform edge cases out of the box. No reason to reinvent this. |

**Key insight:** Phase 3 is primarily about hardening existing flows, not building new systems from scratch. The transaction pattern is the only genuinely new architectural concept. File locking uses `proper-lockfile` — no need to hand-roll stale detection or retry logic.

## Common Pitfalls

### Pitfall 1: Symlink Cleanup is Platform-Sensitive
**What goes wrong:** On macOS, symlinks are files -- `rm()` works. On Windows, symlinks to directories behave differently depending on whether they were created with `junction` vs. `symboliclink`. The existing code uses `symlink()` from `fs/promises` which creates symbolic links on both platforms.
**Why it happens:** Node.js `fs.symlink` behavior differs by OS for directory symlinks.
**How to avoid:** Use `rm(path, { force: true })` which handles both files and directories. Never use `unlink()` for directory symlinks -- it will fail on some platforms. The existing code already uses `unlink` for file symlinks (agents/commands) and `rm` for directory symlinks (skills), which is correct. Keep this pattern.
**Warning signs:** Tests fail on CI but pass locally on macOS.

### Pitfall 2: Race Condition Between Preflight and Activate
**What goes wrong:** UI calls preflight, shows "all clear" to user, but by the time user clicks "Activate", a component has been deleted from the store. Activation then fails midway.
**Why it happens:** Time-of-check to time-of-use gap.
**How to avoid:** Re-run preflight as the first step inside the transactional `activate()`. The external preflight is for UX (showing warnings), not safety. The internal preflight is the actual gate. If it fails, rollback restores prior state.
**Warning signs:** Activation fails after user confirms clean preflight.

### Pitfall 3: Per-Profile Backup Naming Collision During Rapid Switching
**What goes wrong:** User switches from A to B to C quickly. Each switch backs up settings as `settings.backup.{previous}.json`. If B's activation was incomplete when C starts, B's backup may not exist or may be stale.
**Why it happens:** Sequential deactivate-then-activate without proper ordering.
**How to avoid:** The file lock prevents concurrent activation. Within a single locked activation, the sequence is: deactivate current (A), backup settings as `settings.backup.A.json`, then proceed with B's activation. Each step is sequential within the lock.
**Warning signs:** Settings restoration after deactivation shows wrong content.

### Pitfall 4: Settings Overwrite Detection Must Compare Against Pre-Activation State
**What goes wrong:** When switching profiles, the "current settings" already include Profile A's overlay. The warning system should warn about keys that Profile B would overwrite that the user manually set (pre-A), not keys that Profile A set.
**Why it happens:** The current settings file is a merged view, not the user's original settings.
**How to avoid:** Compare profile B's settings against the backup (which contains the pre-A state), not against the current settings file. The backup represents the user's intentional configuration.
**Warning signs:** Users get warned about their own profile's settings when switching between profiles.

### Pitfall 5: Deactivation Must Handle Partially-Activated Profiles
**What goes wrong:** If the app crashes during activation, some artifacts exist but `.active` was never written. On restart, deactivation can't find which profile was being activated.
**Why it happens:** `.active` is written as the last step in the current flow.
**How to avoid:** Two options: (1) Write `.active` earlier in the transaction (before symlinks), so deactivation can detect and clean up, or (2) During deactivation, if no `.active` exists but generated artifacts are found in a profile dir, do nothing (the transactional rollback should have already cleaned them up). Option 1 is safer.
**Warning signs:** Orphaned symlinks or plugin files in profile directories after a crash.

## Code Examples

Verified patterns from existing codebase:

### Existing Activation Flow (Current -- to be refactored)
```typescript
// Source: packages/cli/src/server/services/profileService.ts:135-253
async activate(name: string): Promise<{ warnings: string[] }> {
  const profile = await this.get(name);
  if (!profile) throw new Error(`Profile "${name}" not found`);

  // Deactivate current if any
  const currentActive = await this.getActive();
  if (currentActive) {
    await this.deactivate();
  }

  // ... symlink creation, plugin generation, settings backup/merge
  // Currently: missing components produce warnings but don't block
  // Phase 3: missing components block activation via pre-flight
}
```

### Existing Deactivation Flow (Current -- to be extended)
```typescript
// Source: packages/cli/src/server/services/profileService.ts:255-269
async deactivate(): Promise<void> {
  // Currently only restores settings and removes .active
  // Phase 3: must also remove symlinks, plugin files, hooks, mcp, lsp
  const settingsPath = path.join(this.baseDir, 'settings.json');
  const backupPath = path.join(this.baseDir, 'settings.backup.json');
  // ... restore and clean up
}
```

### Existing Reference Check (Already Works)
```typescript
// Source: packages/cli/src/server/services/storeService.ts:246-262
async getReferencingProfiles(type: 'agents' | 'skills' | 'commands', name: string): Promise<string[]> {
  const refs: string[] = [];
  // Scans all profiles to find which ones reference a component
  // Phase 3: can be reused for inline reference display
}
```

### Existing Client-Side Reference Map (Already Works)
```typescript
// Source: packages/ui/src/components/store/StoreComponentList.tsx:77-97
const referencedByMap = new Map<string, string[]>();
for (const p of allProfiles) {
  for (const ref of p.agents) {
    const key = `agents:${ref}`;
    const existing = referencedByMap.get(key) ?? [];
    existing.push(p.name);
    referencedByMap.set(key, existing);
  }
  // ... skills, commands
}
// Phase 3: Extend UI to show profile names inline, not just count
```

### Existing Store Delete with Reference Block (Already Works)
```typescript
// Source: packages/cli/src/server/routes/store.ts:84-94
if (request.query.force !== 'true') {
  const refs = await storeService.getReferencingProfiles('agents', request.params.name);
  if (refs.length > 0) return reply.status(409).send({ error: 'Referenced by profiles', referencedBy: refs });
}
// Phase 3: Already warn-but-allow via force=true. UI already handles this.
```

### Existing Test Pattern for ProfileService
```typescript
// Source: packages/cli/src/server/services/__tests__/profileService.test.ts
describe('ProfileService', () => {
  let tmpDir: string;
  let service: ProfileService;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'profile-test-'));
    service = new ProfileService(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
  // Tests use real temp directories with real filesystem operations
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Soft warnings for missing components | Pre-flight blocking check | Phase 3 (this phase) | Profiles with missing components cannot be activated until fixed |
| Single `settings.backup.json` | Per-profile `settings.backup.<name>.json` | Phase 3 (this phase) | Backup filename encodes which profile's settings are stored |
| No rollback on activation failure | Step-based transaction with undo stack | Phase 3 (this phase) | Activation failures restore prior state automatically |
| No inter-process protection | File-based advisory lock | Phase 3 (this phase) | Concurrent activations fail with clear error |
| Client-side reference count only | Inline profile name display | Phase 3 (this phase) | Users see profile names, not just a count |
| Active profile can be deleted | Delete blocked if active | Phase 3 (this phase) | Must deactivate before deleting |

**Deprecated/outdated:**
- The current `activate()` returning `{ warnings: string[] }` for missing components: this behavior is replaced by the pre-flight blocking approach. The `warnings` field is repurposed for settings overwrite warnings only.

## Open Questions

1. **Write `.active` early or late in the transaction?**
   - What we know: Current flow writes `.active` last. This means a crash mid-activation leaves no `.active` but partial artifacts exist.
   - What's unclear: Whether moving `.active` write earlier (before symlink creation) is better for crash recovery.
   - Recommendation: Write `.active` as the first filesystem-modifying step in the transaction (after pre-flight passes). This way, if the process crashes, deactivation can detect and clean up the partially-activated profile. The undo stack still removes `.active` on rollback.

2. **Should preflight warnings be a separate API endpoint or part of activate?**
   - What we know: The UI needs to show warnings before the user confirms activation. The transaction needs internal preflight as a safety gate.
   - What's unclear: Whether to expose a `GET /api/profiles/:name/preflight` endpoint or include a `preflight: true` query parameter on the activate endpoint.
   - Recommendation: Separate `GET /api/profiles/:name/preflight` endpoint. Cleaner separation of concerns, easier to test, and the activate endpoint can still do internal validation.

3. ~~**Lock stale detection threshold**~~
   - **Resolved:** Using `proper-lockfile` with `stale: 10_000` (10s). No hand-rolled stale detection needed — `proper-lockfile` handles this natively.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9+ |
| CLI Config | `packages/cli/vitest.config.ts` (node environment) |
| UI Config | `packages/ui/vitest.config.ts` (jsdom environment, setup at `src/test/setup.ts`) |
| Quick run command | `pnpm --filter @claudeui/cli test` |
| Full suite command | `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-03 | Store component list shows referencing profile names inline | unit/component | `pnpm --filter @claudeui/ui test -- src/components/store/__tests__/StoreComponentList.test.tsx` | Yes -- extend existing |
| ACT-03 | Deactivation restores settings and cleans all generated artifacts | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | Yes -- extend existing |
| ACT-03 | Deactivation removes symlinks from agents/, skills/, commands/ | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | Yes -- extend existing |
| ACT-03 | Deactivation removes .claude-plugin, hooks, .mcp.json, .lsp.json | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | Yes -- extend existing |
| ACT-04 | Switching profiles (A->B) activates B if A was active | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | Yes -- extend existing |
| ACT-04 | If B activation fails during switch, A is restored | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| ACT-05 | Preflight check returns missing components | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| ACT-05 | Preflight check returns settings overwrite warnings | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| ACT-05 | Activation blocked when components missing | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| ACT-05 | Confirmation dialog shows warnings before activation | component | `pnpm --filter @claudeui/ui test` | No -- Wave 0 gap |
| ACT-06 | Rollback restores prior state when activation fails midway | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| ACT-06 | Rollback restores previous profile when switch fails | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| -- | File lock prevents concurrent activation | unit | `pnpm --filter @claudeui/cli test` | No -- Wave 0 gap |
| -- | Active profile deletion is blocked | unit (route) | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/profiles.test.ts` | No -- Wave 0 gap |
| -- | Per-profile backup naming works correctly | unit | `pnpm --filter @claudeui/cli test -- src/server/services/__tests__/profileService.test.ts` | No -- Wave 0 gap |
| -- | Preflight API endpoint returns expected shape | unit (route) | `pnpm --filter @claudeui/cli test -- src/server/routes/__tests__/profiles.test.ts` | No -- Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @claudeui/cli test && pnpm --filter @claudeui/ui test`
- **Per wave merge:** Full suite above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cli/src/server/services/__tests__/profileService.test.ts` -- add tests for: transaction rollback (ACT-06), per-profile backup naming, preflight check, missing component blocking, full artifact cleanup in deactivate, lock service
- [ ] `packages/cli/src/server/services/__tests__/lockService.test.ts` -- new file for LockService unit tests
- [ ] `packages/cli/src/server/routes/__tests__/profiles.test.ts` -- add tests for: preflight endpoint, active profile delete protection
- [ ] `packages/ui/src/components/profiles/__tests__/ConfirmSwitchDialog.test.tsx` -- new file for switch confirmation dialog
- [ ] `packages/ui/src/components/store/__tests__/StoreComponentList.test.tsx` -- extend for inline profile name display (INV-03)
- No framework install needed -- vitest already configured in both packages

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/cli/src/server/services/profileService.ts` -- current activation/deactivation behavior
- Existing codebase: `packages/cli/src/server/services/storeService.ts` -- reference checking already implemented
- Existing codebase: `packages/ui/src/components/store/StoreComponentList.tsx` -- client-side reference map already built
- Existing codebase: `packages/ui/src/components/store/DeleteConfirmDialog.tsx` -- warn-but-allow pattern already implemented
- Existing codebase: `packages/cli/src/server/routes/store.ts` -- reference block on delete already implemented
- Existing tests: `packages/cli/src/server/services/__tests__/profileService.test.ts` -- test patterns for ProfileService
- Project skill: `.claude/skills/linear-ui-skills/SKILL.md` -- AlertDialog mandate for destructive actions

### Secondary (MEDIUM confidence)
- Node.js `fs.open` with `wx` flag -- atomic file creation for advisory locking (built-in, well-documented)
- `proper-lockfile@4.1.2` npm registry -- fallback file locking library (verified version)

### Tertiary (LOW confidence)
- None needed for this phase -- all research is based on direct codebase analysis and well-known Node.js APIs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- one new dependency (`proper-lockfile`) plus existing codebase dependencies and built-in Node.js APIs
- Architecture: HIGH -- patterns derived from existing codebase structure and direct analysis of current ProfileService
- Pitfalls: HIGH -- identified from reading the actual activation/deactivation code and understanding the filesystem operations involved

**Research date:** 2026-04-05
**Valid until:** 30 days (stable domain -- filesystem operations, React confirmation patterns, Node.js APIs)
