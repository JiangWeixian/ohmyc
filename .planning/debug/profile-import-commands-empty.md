---
status: awaiting_human_verify
trigger: "When importing components from a profile (e.g., import from ~/.claude), the commands tab doesn't show anything — it appears empty after import."
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T11:35:00Z
---

## Current Focus

hypothesis: CONFIRMED — Store-to-Explorer bridge was missing. Fix applied and self-verified.
test: TypeScript compiles cleanly, all server-side tests pass (26 command tests, 8 agent tests, 8 skill tests, 9 store tests, 45 profile tests)
expecting: User can import commands from ~/.claude and see them in the Explorer commands tab
next_action: Await human verification

## Symptoms

expected: When importing components (specifically commands) from ~/.claude via the profile import feature, the commands tab should display the imported commands.
actual: The commands tab shows nothing / is empty after import.
errors: User did not mention specific errors — check for silent failures in code.
reproduction: Use the profile import feature to import components from ~/.claude, then check the commands tab.
started: Not specified — assume it may never have worked correctly.

## Eliminated

## Evidence

- timestamp: 2026-04-08T00:05:00Z
  checked: Explorer.tsx commands tab data flow
  found: Uses useCommands() hook which fetches /api/commands
  implication: Commands tab reads from API endpoint /api/commands

- timestamp: 2026-04-08T00:08:00Z
  checked: useCommands.ts hook
  found: Fetches from /api/commands endpoint
  implication: Confirms commands tab depends on /api/commands API

- timestamp: 2026-04-08T00:10:00Z
  checked: server/index.ts route setup (line 66)
  found: commandsRoutes gets commandsDir = path.join(baseDir, 'commands') = ~/.claude/commands/
  implication: /api/commands reads from ~/.claude/commands/ (the LIVE directory)

- timestamp: 2026-04-08T00:15:00Z
  checked: commands.ts route handler
  found: Creates CommandService(options.commandsDir) which reads from ~/.claude/commands/, also reads from plugin paths
  implication: /api/commands never reads from the store directory

- timestamp: 2026-04-08T00:20:00Z
  checked: storeService.ts scanCommands and applyImport
  found: Import copies commands to path.join(storeDir, 'commands', filename) where storeDir = ~/.claude/store/
  implication: Import writes to ~/.claude/store/commands/ — a DIFFERENT directory

- timestamp: 2026-04-08T00:25:00Z
  checked: store.ts route setup (line 20)
  found: storeDir = path.join(options.baseDir, 'store') = ~/.claude/store/
  implication: Store commands are at ~/.claude/store/commands/, completely separate from live ~/.claude/commands/

- timestamp: 2026-04-08T00:30:00Z
  checked: agents.ts and skills.ts routes
  found: Same pattern — they read from ~/.claude/agents/ and ~/.claude/skills/ respectively, NOT from the store
  implication: The same bug affects agents and skills tabs, not just commands

- timestamp: 2026-04-08T00:35:00Z
  checked: profileService.ts activate method
  found: Activation creates symlinks in ~/.claude/profiles/<name>/commands/ pointing to ~/.claude/store/commands/
  implication: Even profile activation doesn't bridge to the live ~/.claude/commands/ directory

- timestamp: 2026-04-08T00:40:00Z
  checked: useStoreImport mutation onSuccess
  found: Invalidates queryKey ['store'] only (useStore.ts line 168)
  implication: After import, store queries refresh but Explorer queries (['commands'], ['agents'], ['skills']) do not

- timestamp: 2026-04-08T11:35:00Z
  checked: TypeScript compilation and server-side tests after fix
  found: tsc --noEmit passes with zero errors. All 96 server-side tests pass (commands, agents, skills, store, profile).
  implication: Fix is type-safe and does not break existing functionality

## Resolution

root_cause: The Explorer Commands tab reads from /api/commands which serves from ~/.claude/commands/ (live directory). The import feature writes to ~/.claude/store/commands/ (store directory). These are two completely separate locations with no data bridge. The /api/commands route did not include store commands in its listing. Same issue existed for agents and skills.
fix: Added store directory aggregation to /api/commands, /api/agents, and /api/skills routes (both list and single-item endpoints). Added 'store' as a recognized source type in shared schemas and SourceBadge UI component. Updated useStoreImport to invalidate Explorer query keys after import.
verification: TypeScript compiles cleanly. All 96 server-side tests pass. Awaiting human verification.
files_changed:
  - packages/cli/src/server/routes/commands.ts
  - packages/cli/src/server/routes/agents.ts
  - packages/cli/src/server/routes/skills.ts
  - packages/shared/src/commandSchema.ts
  - packages/shared/src/agentSchema.ts
  - packages/shared/src/skillSchema.ts
  - packages/ui/src/components/SourceBadge.tsx
  - packages/ui/src/hooks/useStore.ts
