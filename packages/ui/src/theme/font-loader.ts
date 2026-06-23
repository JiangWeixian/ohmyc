// packages/ui/src/theme/font-loader.ts
import type { ThemeId } from './registry'

const fontBundles: Record<ThemeId, () => Promise<unknown>> = {
  monitor: () => import('@fontsource/inter'),
  phosphor: () => Promise.all([import('@fontsource/jetbrains-mono'), import('@fontsource/inter')]),
  amber: () => Promise.all([import('@fontsource/vt323'), import('@fontsource/ibm-plex-mono')]),
  retro: () => Promise.all([import('@fontsource/press-start-2p'), import('@fontsource/silkscreen')]),
  cyberpunk: () =>
    Promise.all([import('@fontsource/chakra-petch'), import('@fontsource/rajdhani'), import('@fontsource/share-tech-mono')]),
}

export async function loadThemeFonts(theme: ThemeId): Promise<void> {
  await fontBundles[theme]()
}
