// Setup readiness hook. Independent of useTimelineStatus — the onboarding gate
// must not reuse Timeline queries (spec). Retry is driven by explicit user
// action from the gate, so background polling/refetch is disabled.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

/** Tagged union mirroring `ohmyc_core::setup::SetupStatus` on the wire. */
export type SetupStatus
  = | { state: 'internal_error'; reason?: string }
    | { state: 'missing_store' }
    | { state: 'ready' }
    | { state: 'unreadable_store'; reason?: string }

/** Query hook for monitor store readiness. */
export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup', 'status'],
    queryFn: async () => request<SetupStatus>('setup.status', {}),
    // No aggressive polling — Retry is an explicit user action (spec).
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
