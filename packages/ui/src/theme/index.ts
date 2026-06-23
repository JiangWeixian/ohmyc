// packages/ui/src/theme/index.ts
// Re-export named bindings trip @typescript-eslint/no-use-before-define in barrel files.
/* eslint-disable @typescript-eslint/no-use-before-define */
export { themes, intensities, DEFAULT_THEME, DEFAULT_INTENSITY, loadPersistedTheme, persistTheme }
export type { ThemeId, Intensity, PersistedTheme }
export { ThemeProvider, useTheme } from './theme-provider'
// useThemeCommands export added in Task 13
