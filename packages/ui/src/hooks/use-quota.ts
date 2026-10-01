// React Query hook for subscription quota snapshots — one cache entry shared
// by the Quota page and the menubar popover. Types mirror the serde camelCase
// contract of `ohmyc_core::quota::types` exactly; keep them in sync.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { request } from '@/lib/transport'

export type QuotaProviderId
  = 'claude' | 'codex' | 'cursor' | 'gemini' | 'grok' | 'kimi' | 'opencodeGo'

export type WindowKind = 'daily' | 'monthly' | 'other' | 'session' | 'weekly'

export interface UsageWindow {
  kind: WindowKind
  label: string
  /** 0–100; null means unknown — render "—", never a fabricated 0%. */
  usedPercent: number | null
  /** ISO-8601 instant. */
  resetsAt: string | null
  /** 18000 = 5h, 604800 = 7d; null when the window length is not fixed. */
  windowSeconds: number | null
  /** Model-specific window (e.g. Claude's sonnet weekly). */
  model: string | null
}

export type MeterKind = 'count' | 'dollars' | 'percent'

export interface UsageMeter {
  label: string
  value: number
  kind: MeterKind
  currency: string | null
}

export type SnapshotStatus
  = { status: 'error'; message?: string } | { status: 'notLoggedIn' } | { status: 'ok' } | { status: 'rateLimited'; retryAfterSeconds?: number | null } | { status: 'tokenExpired' } | { status: 'unsupported' }

export type Provenance = 'experimental' | 'localEstimate' | 'officialEndpoint'

export interface Identity {
  email: string | null
  plan: string | null
}

export type UsageSnapshot = SnapshotStatus & {
  provider: QuotaProviderId
  windows: UsageWindow[]
  meters: UsageMeter[]
  identity: Identity | null
  provenance: Provenance
  /** ISO-8601 instant. */
  fetchedAt: string
}

export const QUOTA_QUERY_KEY = ['quota'] as const

/**
 * Subscription quota snapshots from the desktop's polling cache.
 *
 * `staleTime` is generous on purpose: the backend command serves a shared
 * cache that the poller keeps fresh (default every 5 min) — re-fetching
 * aggressively here would just re-read the same cache.
 *
 * The hook also subscribes to the backend's `quota:changed` broadcast and
 * writes the payload straight into the cache (the event carries the full
 * fresh snapshot list, so no invalidation round-trip is needed). Outside
 * Tauri (web dev, vitest, storybook) the subscription no-ops.
 */
export function useQuota() {
  const qc = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const { subscribe } = await import('../lib/tauri-event-bridge')
        const off = await subscribe<UsageSnapshot[]>('quota:changed', (payload) => {
          if (Array.isArray(payload)) {
            qc.setQueryData(QUOTA_QUERY_KEY, payload)
          } else {
            void qc.invalidateQueries({ queryKey: QUOTA_QUERY_KEY })
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

  return useQuery({
    queryKey: QUOTA_QUERY_KEY,
    staleTime: 60_000,
    queryFn: () => request<UsageSnapshot[]>('quota.list', {}),
  })
}

/** Force-refresh action for the page header's ghost button. */
export function useQuotaRefresh() {
  const qc = useQueryClient()
  return async () => {
    const snapshots = await request<UsageSnapshot[]>('quota.refresh', {})
    qc.setQueryData(QUOTA_QUERY_KEY, snapshots)
    return snapshots
  }
}
