// Menubar popover page — owns view state, fetches data, switches between
// dual-line and heatmap views. Lives at /menubar.

import { useMemo, useState } from 'react'

import { DualLineChart } from './dual-line-chart'
import { MenubarOnboard } from './menubar-onboard'
import { RecentHeatmap } from './recent-heatmap'
import { menubarPopoverStyles } from './styles'
import { type MenubarView, ViewSwitch } from './view-switch'
import { useFsChanged } from '@/hooks/use-fs-changed'
import { useSetupStatus } from '@/hooks/use-setup-status'
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'

import type { SetupStatus } from '@/hooks/use-setup-status'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() - n)
  return copy
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${Math.round(n / 100_000) / 10}M`
  }
  if (n >= 1000) {
    return `${Math.round(n / 100) / 10}k`
  }
  return String(n)
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

function MenubarActivity() {
  useFsChanged()
  const [view, setView] = useState<MenubarView>('line')

  const today = useMemo(() => new Date(), [])
  const todayIso = isoDate(today)
  const fourMonthAgoIso = isoDate(subDays(today, 16 * 7 - 1))

  // Both views share the same 16-week rolling window — the line and heatmap
  // are two visualizations of the same data, not different time scopes.
  const tokensRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'tokens' })
  const sessionsRecent = useTimelineHeatmapRange({ from: fourMonthAgoIso, to: todayIso, metric: 'sessions' })

  // KPI row: 16-week totals across the same window.
  const totalTokens = (tokensRecent.data ?? []).reduce((s, p) => s + p.value, 0)
  const totalSessions = (sessionsRecent.data ?? []).reduce((s, p) => s + p.value, 0)

  // Footer: peak day only — peak token value and session count are now
  // surfaced in the KPI row above.
  // NOTE: peak is computed over the fetched range, which must stay equal to
  // RecentHeatmap's self-derived 16-week window (it re-derives from today).
  const peak = findPeak(tokensRecent.data ?? [])
  const peakMeta = peak
    ? `peak ${shortDayLabel(peak.date)}`
    : 'no activity yet'

  return (
    <>
      <style>{menubarPopoverStyles}</style>
      <div
        className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover"
        data-menubar-page
      >
        <span className="menubar-popover-corner" aria-hidden="true" />
        <div className="relative z-[1] menubar-content">
          <header className="mb-3 flex items-center justify-between gap-3">
            <span className="menubar-title">Activity</span>
            <ViewSwitch value={view} onChange={setView} />
          </header>

          {/* No overflow-hidden here: the heatmap tooltip escapes the slot upward
              for top-row cells. */}
          <div className={view === 'line' ? 'relative -mx-1 min-h-[168px] rounded menubar-chart-area' : 'relative -mx-1 min-h-[168px]'}>
            {view === 'line'
              ? (
                  <DualLineChart tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
                )
              : (
                  <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
                )}
          </div>

          <div className="mt-3.5 flex">
            <div className="flex flex-1 flex-col gap-1 pr-3.5">
              <span className="menubar-kpi-value" data-kpi="tokens">
                {formatTokens(totalTokens)}
              </span>
              <span className="menubar-label">Tokens</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 border-l border-[var(--border-subtle)] px-3.5">
              <span className="menubar-kpi-value" data-kpi="sessions">
                {/* exact count — unlike tokens, sessions are never compressed to k/M */}
                {totalSessions.toLocaleString()}
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

          <div className="mt-3.5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
            <span className="menubar-label menubar-footer-meta">
              {peakMeta}
            </span>
            <button
              type="button"
              onClick={async () => {
                // Tauri supplies this module at runtime in the desktop shell.
                // eslint-disable-next-line import/no-extraneous-dependencies
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('open_main_window')
                await invoke('hide_popover')
              }}
              className="menubar-label menubar-open transition-colors"
            >
              Open OhMyC →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/** Compact status line for the popover (mirrors the main gate). */
function menubarStatusLine(state: SetupStatus['state']): string | undefined {
  switch (state) {
    case 'unreadable_store': {
      return 'Local monitor store exists but could not be opened.'
    }
    case 'internal_error': {
      return 'Setup check failed. Retry after installing the plugin.'
    }
    default: {
      return undefined
    }
  }
}

/**
 * Menubar popover page. Owns view state, fetches data, switches between
 * dual-line and heatmap views. When the monitor store is not ready it shows
 * the compact MenubarOnboard instead of an empty activity chart. Lives at
 * /menubar — outside the main-window setup gate.
 */
export function MenubarPage() {
  const { data, isLoading } = useSetupStatus()

  // While the readiness check is in flight, render nothing — the popover is
  // transient and a flash of empty space is preferable to a flash of the
  // wrong surface.
  if (isLoading || !data) {
    return null
  }
  if (data.state !== 'ready') {
    return <MenubarOnboard statusLine={menubarStatusLine(data.state)} />
  }
  return <MenubarActivity />
}
