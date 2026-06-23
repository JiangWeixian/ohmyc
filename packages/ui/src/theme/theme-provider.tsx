// packages/ui/src/theme/theme-provider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { loadThemeFonts } from './font-loader'
import {
  DEFAULT_INTENSITY,
  DEFAULT_THEME,
  type Intensity,
  loadPersistedTheme,
  persistTheme,
  type ThemeId,
} from './registry'

interface ThemeContextValue {
  theme: ThemeId
  intensity: Intensity
  setTheme: (theme: ThemeId) => Promise<void>
  setIntensity: (intensity: Intensity) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  intensity: DEFAULT_INTENSITY,
  setTheme: async () => {},
  setIntensity: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initial = loadPersistedTheme()
  const [theme, setThemeState] = useState<ThemeId>(initial.theme)
  const [intensity, setIntensityState] = useState<Intensity>(initial.intensity)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.intensity = intensity
  }, [intensity])

  const setTheme = useCallback(async (next: ThemeId) => {
    await loadThemeFonts(next)
    setThemeState(next)
    persistTheme({ theme: next, intensity })
  }, [intensity])

  const setIntensity = useCallback((next: Intensity) => {
    setIntensityState(next)
    persistTheme({ theme, intensity: next })
  }, [theme])

  return <ThemeContext.Provider value={{ theme, intensity, setTheme, setIntensity }}>{children}</ThemeContext.Provider>
}
