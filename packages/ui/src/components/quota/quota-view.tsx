// Quota page (DESIGN.md §Quota): title row with an icon-only Refresh action
// (tooltip), then a uniform 2-column grid of provider cards, then the legend
// row which also carries the freshness meta (`updated N min ago · every
// 5 min`). No first-paint skeleton — cards render directly in whatever state
// the cache reports. A 30s local tick keeps countdowns and pace ticks
// walking between polls (disabled under prefers-reduced-motion).

import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  formatUpdatedAgo,
  HEAT_FILL_CLASS,
  latestFetchedAt,
} from './format'
import { ProviderCard } from './provider-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useQuota, useQuotaRefresh } from '@/hooks/use-quota'
import { cn } from '@/lib/utils'

/** 30s re-render clock shared by countdowns, pace ticks, and the header meta. */
function useNowTick(intervalMs = 30_000): number {
  const reduceMotion = usePrefersReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (reduceMotion) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, reduceMotion])
  return now
}

function Legend({ fetchedAtMs, nowMs }: { fetchedAtMs: number | null; nowMs: number }) {
  return (
    <div className="mt-[22px] flex flex-wrap items-center gap-[22px] font-mono-theme text-[10px] text-[var(--text-quaternary)]">
      {(['low', 'mid', 'high', 'critical'] as const).map((label, index) => (
        <span key={label} className="flex items-center gap-[7px]">
          <span className={cn('h-1.5 w-3.5 rounded-[3px]', HEAT_FILL_CLASS[(index + 1) as 1 | 2 | 3 | 4])} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-[7px]">
        <span className="relative h-2.5 w-px bg-[var(--text-quaternary)]">
          <span className="absolute left-[-1.5px] top-[-3px] size-1 rounded-full bg-[var(--text-tertiary)]" />
        </span>
        pace = time elapsed
      </span>
      <span className="flex items-center gap-[7px]">
        <span className="size-1.5 rounded-full bg-[var(--heat-4)]" />
        official endpoint
      </span>
      <span className="flex items-center gap-[7px]">
        <span className="size-1.5 rounded-full border border-[var(--text-quaternary)] bg-transparent" />
        undocumented endpoint
      </span>
      {/* Freshness meta lives in the legend row — same mono micro type, out of
          the title row's way. */}
      <span className="ml-auto whitespace-nowrap text-[11px]">
        {fetchedAtMs == null ? 'not fetched yet' : `updated ${formatUpdatedAgo(fetchedAtMs, nowMs)}`}
        {' '}
        · every 5 min
      </span>
    </div>
  )
}

export function QuotaView() {
  const nowMs = useNowTick()
  const reduceMotion = usePrefersReducedMotion()
  const { data, isLoading, isError, error } = useQuota()
  const refresh = useQuotaRefresh()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const snapshots = data ?? []
  const allLoggedOut = snapshots.length > 0 && snapshots.every(s => s.status === 'notLoggedIn')
  const fetchedAtMs = latestFetchedAt(snapshots)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await refresh()
    } catch (error_) {
      setRefreshError(error_ instanceof Error ? error_.message : 'transport error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="w-full max-w-[1180px]">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2.5 font-mono-theme text-[11px] font-[510] uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
            Signal
          </div>
          <h1 className="font-display text-[24px] font-[510] tracking-[-0.2px] text-[var(--text-primary)]">
            Quota
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--text-tertiary)]">
            Subscription usage across your coding CLIs — 5h windows, weekly pools, monthly budgets.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Refresh quota now"
                onClick={() => {
                  void handleRefresh()
                }}
                disabled={refreshing}
                className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <RefreshCw size={13} aria-hidden="true" className={cn(refreshing && !reduceMotion && 'animate-spin')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              Refresh quota now
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {(isError || refreshError) && (
        <div className="mb-4 rounded-lg border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)] px-5 py-4 font-mono-theme text-[11px] text-[var(--text-tertiary)]">
          Couldn’t load quota snapshots — {refreshError ?? (error instanceof Error ? error.message : 'transport error')}. Try Refresh.
        </div>
      )}

      {allLoggedOut && (
        <div className="mb-4 rounded-lg border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)] px-5 py-4 text-[13px] text-[var(--text-tertiary)]">
          No CLI credentials found on this machine — sign in to a CLI to see its quota here.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {snapshots.map(snapshot => (
              <ProviderCard key={snapshot.provider} snapshot={snapshot} nowMs={nowMs} />
            ))}
          </div>
          <Legend fetchedAtMs={fetchedAtMs} nowMs={nowMs} />
        </>
      )}
    </div>
  )
}
