// React Query hook for OhMyC app settings — one cache entry shared by the
// settings page and any surface reading resolved values (e.g. theme).
// Types mirror the serde camelCase contract of `ohmyc_core::settings`.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { request } from '@/lib/transport'

import type { QuotaProviderId } from './use-quota'

export type SettingSource = 'default' | 'env' | 'settings'

export interface ResolvedSetting<TValue> {
  value: TValue
  source: SettingSource
  envVar: string | null
}

export interface ResolvedSettings {
  quotaEnabled: ResolvedSetting<boolean>
  quotaPollSecs: ResolvedSetting<number>
  providers: Record<QuotaProviderId, ResolvedSetting<boolean>>
  menubarIconVisible: ResolvedSetting<boolean>
  themeId: ResolvedSetting<string>
  themeIntensity: ResolvedSetting<string>
}

export interface SettingsPatch {
  quota?: {
    enabled?: boolean
    pollSecs?: number
    providers?: Partial<Record<QuotaProviderId, { enabled: boolean }>>
  }
  menubar?: { iconVisible?: boolean }
  theme?: { id?: string; intensity?: string }
}

export const SETTINGS_QUERY_KEY = ['app-settings'] as const

/**
 * Resolved app settings from the desktop backend. Subscribes to the
 * `settings:changed` broadcast (payload is the full fresh resolved view) and
 * self-heals on visibility/focus: a hidden webview's JS is suspended, so
 * broadcasts fired while hidden are lost — invalidating on resume keeps the
 * popover and main window consistent without a polling loop.
 */
export function useAppSettings() {
  const qc = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const { subscribe } = await import('../lib/tauri-event-bridge')
        const off = await subscribe<ResolvedSettings>('settings:changed', (payload) => {
          if (payload && typeof payload === 'object') {
            qc.setQueryData(SETTINGS_QUERY_KEY, payload)
          } else {
            void qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
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
    }
  }, [qc])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [qc])

  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    staleTime: 60_000,
    queryFn: () => request<ResolvedSettings>('settings.get', {}),
  })
}

/** Write a settings patch; the backend returns the fresh resolved view. */
export function useUpdateSettings() {
  const qc = useQueryClient()
  return async (patch: SettingsPatch) => {
    const resolved = await request<ResolvedSettings>('settings.set', { patch })
    qc.setQueryData(SETTINGS_QUERY_KEY, resolved)
    return resolved
  }
}
