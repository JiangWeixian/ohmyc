import { Check } from 'lucide-react'
import { useMemo } from 'react'

import { intensities, themes } from './registry'
import { useTheme } from './theme-provider'

import type { CommandItem } from '@/components/command-palette'

/**
 * Returns ⌘K command items for switching theme and intensity.
 * Spread the result into the main palette's commands array — do not
 * render a second CommandPalette (would duplicate the ⌘K listener).
 */

export function useThemeCommands(): CommandItem[] {
  const { theme, intensity, setTheme, setIntensity } = useTheme()

  return useMemo<CommandItem[]>(() => {
    const themeCommands: CommandItem[] = themes.map(t => ({
      id: `theme-${t.id}`,
      label: `Theme: ${t.name}`,
      category: 'Theme',
      icon: theme === t.id ? <Check size={15} /> : undefined,
      action: () => {
        void setTheme(t.id)
      },
    }))

    const intensityCommands: CommandItem[] = intensities.map(i => ({
      id: `intensity-${i}`,
      label: `Intensity: ${i.charAt(0).toUpperCase() + i.slice(1)}`,
      category: 'Intensity',
      icon: intensity === i ? <Check size={15} /> : undefined,
      action: () => setIntensity(i),
    }))

    return [...themeCommands, ...intensityCommands]
  }, [theme, intensity, setTheme, setIntensity])
}
