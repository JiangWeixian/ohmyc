import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface FsEvent {
  kind: 'claude_home' | 'provider_config' | 'timeline_db'
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
            return
          }
          if (payload.kind === 'provider_config') {
            void qc.invalidateQueries({ queryKey: ['agents'] })
            void qc.invalidateQueries({ queryKey: ['skills'] })
            void qc.invalidateQueries({ queryKey: ['commands'] })
            void qc.invalidateQueries({ queryKey: ['plugins'] })
            return
          }
          if (payload.kind === 'claude_home') {
            const path = payload.path
            if (path.includes('/agents/')) {
              void qc.invalidateQueries({ queryKey: ['agents'] })
            }
            if (path.includes('/skills/')) {
              void qc.invalidateQueries({ queryKey: ['skills'] })
            }
            if (path.includes('/commands/')) {
              void qc.invalidateQueries({ queryKey: ['commands'] })
            }
            if (path.endsWith('/settings.json')) {
              void qc.invalidateQueries({ queryKey: ['settings'] })
              void qc.invalidateQueries({ queryKey: ['hooks'] })
              void qc.invalidateQueries({ queryKey: ['lsp'] })
              void qc.invalidateQueries({ queryKey: ['plugins'] })
            }
            if (path.endsWith('/.mcp.json')) {
              void qc.invalidateQueries({ queryKey: ['mcp'] })
            }
            if (path.endsWith('/installed_plugins.json')) {
              void qc.invalidateQueries({ queryKey: ['plugins'] })
            }
            if (path.endsWith('/known_marketplaces.json')) {
              void qc.invalidateQueries({ queryKey: ['marketplaces'] })
            }
            if (path.includes('/store/agents/')) {
              void qc.invalidateQueries({ queryKey: ['store', 'agents'] })
            }
            if (path.includes('/store/skills/')) {
              void qc.invalidateQueries({ queryKey: ['store', 'skills'] })
            }
            if (path.includes('/store/commands/')) {
              void qc.invalidateQueries({ queryKey: ['store', 'commands'] })
            }
            if (path.includes('/store/model-configs/')) {
              void qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
            }
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
