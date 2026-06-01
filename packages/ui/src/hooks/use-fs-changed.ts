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
 * of the tauri-event bridge fails gracefully without crashing the hook.
 * The bridge file is the only place that statically imports
 * `@tauri-apps/api/event`, which keeps that dep out of the web/test
 * bundles unless this hook actually runs in the Tauri build.
 */
export function useFsChanged(): void {
  const qc = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const { subscribe } = await import('../lib/tauri-event-bridge')
        const off = await subscribe<FsEvent>('fs:changed', (payload) => {
          if (payload.kind === 'timeline_db') {
            void qc.invalidateQueries({ queryKey: ['timeline'] })
          }
        })
        if (cancelled) {
          off()
        } else {
          unlisten = off
        }
      } catch {
        // Not running inside Tauri (no @tauri-apps/api/event resolvable),
        // or the bridge file failed to import — nothing to subscribe to.
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
