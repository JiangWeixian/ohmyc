// packages/ui/src/theme/theme-provider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { loadThemeFonts } from './font-loader'
import {
  DEFAULT_INTENSITY,
  DEFAULT_THEME,
  intensities,
  type Intensity,
  loadPersistedTheme,
  loadPersistedThemeFields,
  persistTheme,
  type ThemeId,
  themes,
} from './registry'
import { request } from '@/lib/transport'

import type {
  ResolvedSettings,
  SettingSource,
  SettingsPatch,
} from '@/hooks/use-app-settings'

interface ThemeSources {
  theme: SettingSource
  intensity: SettingSource
}

interface ThemeContextValue {
  theme: ThemeId
  intensity: Intensity
  setTheme: (theme: ThemeId) => Promise<void>
  setIntensity: (intensity: Intensity) => void
  sources: ThemeSources
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  intensity: DEFAULT_INTENSITY,
  setTheme: async () => {},
  setIntensity: () => {},
  sources: { theme: 'default', intensity: 'default' },
})

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

function isThemeId(id: string): id is ThemeId {
  return themes.some(t => t.id === id)
}
function isIntensity(value: string): value is Intensity {
  return (intensities as readonly string[]).includes(value)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initial = loadPersistedTheme()
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(initial.theme)
  const [currentIntensity, setCurrentIntensity] = useState<Intensity>(initial.intensity)
  const [sources, setSources] = useState<ThemeSources>({ theme: 'default', intensity: 'default' })
  const [mode, setMode] = useState<'local' | 'settings'>('local')
  const modeRef = useRef(mode)
  const sourcesRef = useRef(sources)
  useEffect(() => {
    modeRef.current = mode
    sourcesRef.current = sources
  }, [mode, sources])

  useEffect(() => {
    void loadThemeFonts(currentTheme)
    document.documentElement.dataset.theme = currentTheme
  }, [currentTheme])
  useEffect(() => {
    document.documentElement.dataset.intensity = currentIntensity
  }, [currentIntensity])

  // Settings-file integration (desktop). When the backend answers, the
  // settings file becomes the source of truth; otherwise we stay in the
  // legacy localStorage mode (web dev, vitest, storybook without a backend).
  useEffect(() => {
    let cancelled = false

    const applyResolved = async (resolved: ResolvedSettings, migrate: boolean) => {
      const legacy = migrate ? loadPersistedThemeFields() : {}
      // Per-field migration: a field still at its default inherits the old
      // localStorage value (and is written back); file/env values win.
      const migratedTheme = resolved.themeId.source === 'default' ? legacy.theme : undefined
      const migratedIntensity = resolved.themeIntensity.source === 'default' ? legacy.intensity : undefined
      let writeLanded = false
      if (migratedTheme || migratedIntensity) {
        const patch: SettingsPatch = { theme: {} }
        if (migratedTheme) {
          patch.theme!.id = migratedTheme
        }
        if (migratedIntensity) {
          patch.theme!.intensity = migratedIntensity
        }
        try {
          await request<ResolvedSettings>('settings.set', { patch })
          writeLanded = true
        } catch {
          writeLanded = false
        }
      }
      if (cancelled) {
        return
      }
      // Only claim migrated values when the write actually landed — a failed
      // write must not pretend the migration succeeded.
      const useMigration = writeLanded
      const themeValue = useMigration && migratedTheme ? migratedTheme : resolved.themeId.value
      const intensityValue = useMigration && migratedIntensity ? migratedIntensity : resolved.themeIntensity.value
      setCurrentTheme(isThemeId(themeValue) ? themeValue : DEFAULT_THEME)
      setCurrentIntensity(isIntensity(intensityValue) ? intensityValue : DEFAULT_INTENSITY)
      setSources({
        theme: useMigration && migratedTheme ? 'settings' : resolved.themeId.source,
        intensity: useMigration && migratedIntensity ? 'settings' : resolved.themeIntensity.source,
      })
      setMode('settings')
    }

    void request<ResolvedSettings>('settings.get', {})
      .then(resolved => applyResolved(resolved, true))
      .catch(() => {
        // No settings backend: keep localStorage mode.
      })

    const refetch = () => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void request<ResolvedSettings>('settings.get', {})
        .then(resolved => applyResolved(resolved, false))
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', refetch)
    window.addEventListener('focus', refetch)

    let unlisten: (() => void) | null = null
    void (async () => {
      try {
        const { subscribe } = await import('../lib/tauri-event-bridge')
        const off = await subscribe<ResolvedSettings>('settings:changed', (payload) => {
          if (payload && typeof payload === 'object') {
            void applyResolved(payload, false)
          }
        })
        if (cancelled) {
          off()
        } else {
          unlisten = off
        }
      } catch {
        // Not running inside Tauri — nothing to subscribe to.
      }
    })()

    return () => {
      cancelled = true
      if (unlisten) {
        unlisten()
      }
      document.removeEventListener('visibilitychange', refetch)
      window.removeEventListener('focus', refetch)
    }
  }, [])

  const setTheme = useCallback(async (next: ThemeId) => {
    if (sourcesRef.current.theme === 'env') {
      return // overridden by OHMYC_THEME — switching would be a no-op lie
    }
    await loadThemeFonts(next)
    if (modeRef.current === 'settings') {
      const resolved = await request<ResolvedSettings>('settings.set', { patch: { theme: { id: next } } })
      setSources(s => ({ ...s, theme: resolved.themeId.source }))
    } else {
      persistTheme({ theme: next, intensity: currentIntensity })
    }
    setCurrentTheme(next)
  }, [currentIntensity])

  const setIntensity = useCallback((next: Intensity) => {
    if (sourcesRef.current.intensity === 'env') {
      return
    }
    if (modeRef.current === 'settings') {
      void (async () => {
        try {
          const resolved = await request<ResolvedSettings>('settings.set', { patch: { theme: { intensity: next } } })
          setSources(s => ({ ...s, intensity: resolved.themeIntensity.source }))
          setCurrentIntensity(next)
        } catch {
          // Write failed: keep the previous intensity instead of pretending.
        }
      })()
    } else {
      persistTheme({ theme: currentTheme, intensity: next })
      setCurrentIntensity(next)
    }
  }, [currentTheme])

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, intensity: currentIntensity, setTheme, setIntensity, sources }}>
      {children}
    </ThemeContext.Provider>
  )
}
