import { forwardRef } from 'react'

import { AreaTrendChart } from './area-trend-chart'
import { MenubarQuotaFocus, MenubarQuotaSection } from './quota-section'
import { RecentHeatmap } from './recent-heatmap'
import { menubarPopoverStyles } from './styles'
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'
import { formatTokens } from '@/lib/format-tokens'
import { cn } from '@/lib/utils'

import type { MenubarView } from '@/hooks/use-app-settings'

interface MenubarPresetContentProps {
  view: MenubarView
  today: Date
  onOpen?: () => void
  preview?: boolean
  className?: string
}

function isoDate(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function subDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - n)
  return copy
}

function findPeak(points: { date: string; value: number }[]): { date: string; value: number } | null {
  if (points.length === 0) {
    return null
  }
  let peak = points[0]
  for (const p of points) {
    if (p.value > peak.value) {
      peak = p
    }
  }
  return peak
}

function shortDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${dow[d.getUTCDay()]} ${mon[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export const MenubarPresetContent = forwardRef<HTMLDivElement, MenubarPresetContentProps>((
  { view, today, onOpen, preview = false, className },
  ref,
) => {
  const todayIso = isoDate(today)
  const fourMonthAgoIso = isoDate(subDays(today, 16 * 7 - 1))
  const tokensRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'tokens' })
  const sessionsRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'sessions' })
  const eventSessionsRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'event_sessions' })

  const totalTokens = tokensRecent.isError ? undefined : tokensRecent.data?.reduce((sum, point) => sum + point.value, 0)
  const totalSessions = sessionsRecent.isError ? undefined : sessionsRecent.data?.reduce((sum, point) => sum + point.value, 0)
  const peak = tokensRecent.isError ? null : findPeak(tokensRecent.data ?? [])
  const peakMeta = peak
    ? `peak ${shortDayLabel(peak.date)}`
    : (tokensRecent.isError ? 'tokens unavailable' : 'no activity yet')

  return (
    <>
      <style>{menubarPopoverStyles}</style>
      <div
        ref={ref}
        className={cn('relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover', className)}
        data-menubar-page
        data-layout={view}
      >
        <span className="menubar-popover-corner" aria-hidden="true" />
        <div className="relative z-[1] menubar-content">
          {view === 'quota'
            ? <MenubarQuotaFocus nowMs={today.getTime()} />
            : (
            <>
              <header className="mb-3 flex items-center justify-between gap-3">
                <span className="menubar-title">Activity</span>
              </header>
              <div className={preview ? 'pointer-events-none relative -mx-1 min-h-[168px]' : 'relative -mx-1 min-h-[168px]'} aria-hidden={preview || undefined}>
                <div className={view === 'area' ? 'rounded menubar-chart-area' : undefined}>
                  {view === 'area'
                    ? <AreaTrendChart sessionsUnavailable={eventSessionsRecent.isError} tokens={tokensRecent.isError ? [] : tokensRecent.data ?? []} sessions={eventSessionsRecent.data ?? []} />
                    : <RecentHeatmap sessionsUnavailable={eventSessionsRecent.isError} tokensUnavailable={tokensRecent.isError} today={today} tokens={tokensRecent.isError ? [] : tokensRecent.data ?? []} sessions={eventSessionsRecent.data ?? []} />}
                </div>
              </div>
              <div className="mt-3.5 flex">
                <div className="flex flex-1 flex-col gap-1 pr-3.5">
                  <span className="menubar-kpi-value" data-kpi="tokens">
                    {totalTokens === undefined ? '—' : formatTokens(totalTokens)}
                  </span>
                  <span className="menubar-label">Tokens</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 border-l border-[var(--border-subtle)] px-3.5">
                  <span className="menubar-kpi-value" data-kpi="sessions">
                    {totalSessions?.toLocaleString() ?? '—'}
                  </span>
                  <span className="menubar-label">Sessions</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 border-l border-[var(--border-subtle)] pl-3.5">
                  <span className="menubar-kpi-value" data-kpi="peak">
                    {peak ? formatTokens(peak.value) : '—'}
                  </span>
                  <span className="menubar-label">Peak</span>
                </div>
              </div>
              <MenubarQuotaSection nowMs={today.getTime()} />
            </>
              )}

          <div className="mt-3.5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
            <span className="menubar-label menubar-footer-meta">
              {view === 'quota' ? '' : peakMeta}
            </span>
            {onOpen
              ? <button type="button" onClick={onOpen} className="menubar-label menubar-open transition-colors">Open OhMyC →</button>
              : <span className="menubar-label menubar-open">Open OhMyC →</span>}
          </div>
        </div>
      </div>
    </>
  )
})
