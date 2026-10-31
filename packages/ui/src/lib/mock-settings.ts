// In-memory settings.get/settings.set handlers for the mock transport.
// Used by vitest and storybook: call `registerMockSettings()` after
// `__setTransportForTests('mock')`; `resetMock()` clears them like any handler.
import { setMockHandler } from './transport/mock'

import type { ResolvedSettings, SettingsPatch } from '@/hooks/use-app-settings'

const PROVIDER_DEFAULTS: Record<string, boolean> = {
  claude: false,
  codex: true,
  cursor: true,
  gemini: true,
  glm: true,
  grok: true,
  kimi: true,
  opencodeGo: true,
}

export function defaultResolvedSettings(): ResolvedSettings {
  return {
    quotaEnabled: { value: true, source: 'default', envVar: null },
    quotaPollSecs: { value: 300, source: 'default', envVar: null },
    providers: Object.fromEntries(
      Object.entries(PROVIDER_DEFAULTS).map(([id, value]) => [id, { value, source: 'default', envVar: null }]),
    ) as ResolvedSettings['providers'],
    menubarIconVisible: { value: true, source: 'default', envVar: null },
    themeId: { value: 'phosphor', source: 'default', envVar: null },
    themeIntensity: { value: 'expressive', source: 'default', envVar: null },
  }
}

export function mergeSettingsPatch(base: ResolvedSettings, patch: SettingsPatch): ResolvedSettings {
  const next = structuredClone(base)
  if (patch.quota) {
    if (patch.quota.enabled !== undefined) {
      next.quotaEnabled = { value: patch.quota.enabled, source: 'settings', envVar: null }
    }
    if (patch.quota.pollSecs !== undefined) {
      next.quotaPollSecs = { value: patch.quota.pollSecs, source: 'settings', envVar: null }
    }
    if (patch.quota.providers) {
      for (const [id, settings] of Object.entries(patch.quota.providers)) {
        if (settings?.enabled !== undefined) {
          next.providers[id as keyof typeof next.providers] = { value: settings.enabled, source: 'settings', envVar: null }
        }
      }
    }
  }
  if (patch.menubar?.iconVisible !== undefined) {
    next.menubarIconVisible = { value: patch.menubar.iconVisible, source: 'settings', envVar: null }
  }
  if (patch.theme?.id !== undefined) {
    next.themeId = { value: patch.theme.id, source: 'settings', envVar: null }
  }
  if (patch.theme?.intensity !== undefined) {
    next.themeIntensity = { value: patch.theme.intensity, source: 'settings', envVar: null }
  }
  return next
}

export function registerMockSettings(): void {
  let state = defaultResolvedSettings()
  setMockHandler('settings.get', async () => state)
  setMockHandler('settings.set', async (args) => {
    state = mergeSettingsPatch(state, args as SettingsPatch)
    return state
  })
}
