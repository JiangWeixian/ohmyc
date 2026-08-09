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
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(initial.theme)
  const [currentIntensity, setCurrentIntensity] = useState<Intensity>(initial.intensity)

  useEffect(() => {
    void loadThemeFonts(currentTheme)
    document.documentElement.dataset.theme = currentTheme
  }, [currentTheme])
  useEffect(() => {
    document.documentElement.dataset.intensity = currentIntensity
  }, [currentIntensity])

  const setTheme = useCallback(async (next: ThemeId) => {
    await loadThemeFonts(next)
    setCurrentTheme(next)
    persistTheme({ theme: next, intensity: currentIntensity })
  }, [currentIntensity])

  const setIntensity = useCallback((next: Intensity) => {
    setCurrentIntensity(next)
    persistTheme({ theme: currentTheme, intensity: next })
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, intensity: currentIntensity, setTheme, setIntensity }}>
      {children}
    </ThemeContext.Provider>
  )
}
