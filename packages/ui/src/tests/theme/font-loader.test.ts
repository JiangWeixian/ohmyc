// packages/ui/src/tests/theme/font-loader.test.ts
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { loadThemeFonts } from '@/theme/font-loader'

vi.mock('@fontsource/inter', () => ({ default: {} }))
vi.mock('@fontsource/jetbrains-mono', () => ({ default: {} }))

describe('loadThemeFonts', () => {
  it('resolves for monitor and phosphor', async () => {
    await expect(loadThemeFonts('monitor')).resolves.toBeUndefined()
    await expect(loadThemeFonts('phosphor')).resolves.toBeUndefined()
  })

  it('resolves for all five theme ids', async () => {
    for (const id of ['monitor', 'phosphor', 'amber', 'retro', 'cyberpunk'] as const) {
      await expect(loadThemeFonts(id)).resolves.toBeUndefined()
    }
  })
})
