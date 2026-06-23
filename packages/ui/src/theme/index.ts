// packages/ui/src/theme/index.ts
// Re-export named bindings trip @typescript-eslint/no-use-before-define in barrel files.

export { themes, intensities, DEFAULT_THEME, DEFAULT_INTENSITY, loadPersistedTheme, persistTheme } from './registry'
export type { ThemeId, Intensity, PersistedTheme } from './registry'
export { ThemeProvider, useTheme } from './theme-provider'
export { useThemeCommands } from './use-theme-commands'
