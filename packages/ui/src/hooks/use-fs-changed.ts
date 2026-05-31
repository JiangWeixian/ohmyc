import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface FsEvent {
  kind: 'claude_home' | 'timeline_db'
  path: string
}

/**
 * Subscribe to backend `fs:changed` events and invalidate related React
 * Query keys so views re-fetch automatically.
 *
 * No-ops when running outside Tauri (web dev loop) — the dynamic import
 * fails gracefully without crashing the hook.
 */
export function useFsChanged(): void {
  const qc = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const tauriEventModule = '@tauri-apps/api/event'
        const mod = await import(/* webpackChunkName: "tauri-event" */ tauriEventModule) as Record<string, (...args: unknown[]) => Promise<unknown>>
        const listen = mod.listen as (event: string, handler: (ev: { payload: FsEvent }) => void) => Promise<() => void>
        const off = await listen('fs:changed', (ev) => {
          if (ev.payload.kind === 'timeline_db') {
            void qc.invalidateQueries({ queryKey: ['timeline'] })
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
}
