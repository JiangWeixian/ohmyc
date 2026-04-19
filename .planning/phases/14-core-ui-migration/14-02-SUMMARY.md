---
phase: 14-core-ui-migration
plan: 02
subsystem: navigation
tags: [sidebar, tabs, layoutId, framer-motion-removal, view-switcher]
dependency_graph:
  requires: [13-01, 13-02, 13-03]
  provides: [animated-sidebar-indicators, view-switcher-tabs]
  affects: [Explorer.tsx, App.tsx, SettingsLayout]
tech_stack:
  added: [Tabs/TabsTrigger from @/components/ui/tabs, motion.div layoutId]
  patterns: [shadcn-tabs-with-layoutId-indicator]
key_files:
  created: []
  modified:
    - packages/ui/src/components/Sidebar.tsx
    - packages/ui/src/components/profiles/ProfilesSidebar.tsx
    - packages/ui/src/components/settings/SettingsSidebar.tsx
    - packages/ui/src/components/ViewSwitcher.tsx
decisions:
  - Used Tabs/TabsTrigger from shadcn directly with motion.div layoutId instead of full NativeTabs component
  - Each sidebar uses a unique layoutId (sidebar-active, profiles-sidebar-active, settings-sidebar-active, view-switcher-active) to avoid cross-component conflicts
  - Profile list items use Tabs/TabsTrigger, but "New Profile" button and "Components" section buttons remain plain buttons (not tabs)
metrics:
  duration: 4min
  completed: "2026-04-19"
  tasks: 3
  files: 4
---

# Phase 14 Plan 02: Sidebar & ViewSwitcher Native-Tabs Migration Summary

Animated tab indicators via Tabs/TabsTrigger with framer-motion layoutId replace entry animations across all three sidebars and ViewSwitcher, removing stagger/whileHover/whileTap patterns.

## Completed Tasks

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Migrate Sidebar.tsx to animated tab indicator | 468ca27 | Sidebar.tsx |
| 2 | Migrate ProfilesSidebar and SettingsSidebar | ac3611e | ProfilesSidebar.tsx, SettingsSidebar.tsx |
| 3 | Migrate ViewSwitcher to native-tabs pattern | acf9444 | ViewSwitcher.tsx |

## Changes Made

### Task 1: Sidebar.tsx
- Removed `SidebarItem` component and `transitionDelay` stagger pattern
- Added `Tabs`/`TabsTrigger` wrapper with `motion.div layoutId="sidebar-active"` animated indicator
- Active section gets blue border + blue bg indicator that animates between sections
- Same `SidebarProps` interface, `SidebarHeader`, `StatusIndicator` unchanged

### Task 2: ProfilesSidebar.tsx + SettingsSidebar.tsx
- **ProfilesSidebar**: Removed all `motion.button` (entry animations), `AnimatePresence`, `whileHover`, `whileTap`. Profile list items now use `Tabs`/`TabsTrigger` with `layoutId="profiles-sidebar-active"`. "New Profile" button and "Components" section buttons remain plain `<button>` elements outside the Tabs context.
- **SettingsSidebar**: Removed all `motion.button`, `motion.span`, `initial`, `animate`, `transition`, `whileHover`, `whileTap`. Categories now use `Tabs`/`TabsTrigger` with `layoutId="settings-sidebar-active"`.
- Both sidebars keep CSS `transition-colors` for hover states. Same exported props interfaces.

### Task 3: ViewSwitcher.tsx
- Replaced manual `<div className="grid">` + `<button>` implementation with `Tabs`/`TabsTrigger` pattern
- Added `motion.div layoutId="view-switcher-active"` animated indicator that slides between tabs
- Same `ViewId` type and `ViewSwitcherProps` interface. Visual appearance identical.

## Key Decisions

1. **Tabs/TabsTrigger directly, not full NativeTabs**: The plan's native-tabs component renders content panels (`TabsContent`), which sidebars don't need. Using the lower-level `Tabs`/`TabsTrigger` with `motion.div layoutId` matches the pattern without unnecessary content panels.
2. **Unique layoutId per sidebar**: Each sidebar uses its own layoutId to prevent framer-motion from animating between unrelated components on the same page.
3. **Components section as plain buttons**: ProfilesSidebar's "Components" section items navigate to categories, not profiles — they don't share the same selection context as profiles, so they remain outside the Tabs wrapper.

## Verification Results

All 77 tests pass across 12 test files. All four files contain `layoutId` for animated indicators. Zero framer-motion entry animations (`initial={{ opacity: 0 }}`), zero `whileHover`/`whileTap` micro-interactions.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] Sidebar.tsx exists and contains `layoutId`, `TabsTrigger`
- [x] ProfilesSidebar.tsx exists and contains `layoutId`, `TabsTrigger`
- [x] SettingsSidebar.tsx exists and contains `layoutId`, `TabsTrigger`
- [x] ViewSwitcher.tsx exists and contains `layoutId`, `TabsTrigger`
- [x] Commit 468ca27 exists in git log
- [x] Commit ac3611e exists in git log
- [x] Commit acf9444 exists in git log
