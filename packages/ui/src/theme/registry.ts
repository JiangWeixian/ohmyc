// packages/ui/src/theme/registry.ts
export const themes = [
  { id: 'monitor', name: 'Monitor', description: 'Clean monochrome.', swatch: '#f7f8f8', fonts: ['Inter', 'Berkeley Mono'] },
  { id: 'phosphor', name: 'Phosphor Mono', description: 'Textured monochrome.', swatch: '#f7f8f8', fonts: ['JetBrains Mono', 'Inter'] },
  { id: 'amber', name: 'Amber CRT', description: 'IBM 3270 amber phosphor.', swatch: '#ffb000', fonts: ['VT323', 'IBM Plex Mono'] },
  { id: 'retro', name: 'Retro Wave', description: '80s synthwave.', swatch: '#00f0ff', fonts: ['Press Start 2P', 'Silkscreen'] },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Game HUD.', swatch: '#fcee0a', fonts: ['Chakra Petch', 'Rajdhani', 'Share Tech Mono'] },
] as const

export type ThemeId = (typeof themes)[number]['id']

export const intensities = ['calm', 'expressive'] as const
export type Intensity = (typeof intensities)[number]

export const DEFAULT_THEME: ThemeId = 'phosphor'
export const DEFAULT_INTENSITY: Intensity = 'expressive'

const STORAGE_KEY = 'ohmyc-theme'

export interface PersistedTheme { theme: ThemeId; intensity: Intensity }

export function loadPersistedTheme(): PersistedTheme {
  if (typeof localStorage === 'undefined') {
    return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY }
    }
    const parsed = JSON.parse(raw) as Partial<PersistedTheme>
    const validThemes = themes.map(t => t.id)
    const theme = parsed.theme && validThemes.includes(parsed.theme) ? parsed.theme : DEFAULT_THEME
    const intensity = parsed.intensity && intensities.includes(parsed.intensity) ? parsed.intensity : DEFAULT_INTENSITY
    return { theme, intensity }
  } catch {
    return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY }
  }
}

export function persistTheme(value: PersistedTheme): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}
