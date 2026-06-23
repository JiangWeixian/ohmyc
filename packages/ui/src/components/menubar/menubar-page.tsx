// Menubar popover page — owns view state, fetches data, switches between
// dual-line and heatmap views. Lives at /menubar.

import { useMemo, useState } from 'react'

import { DualLineChart } from './dual-line-chart'
import { RecentHeatmap } from './recent-heatmap'
import { type MenubarView, ViewSwitch } from './view-switch'
import { useFsChanged } from '@/hooks/use-fs-changed'
import { useTimelineHeatmapRange } from '@/hooks/use-timeline'

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

const MONO = 'var(--font-mono)'

export function MenubarPage() {
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
    <div
      className="min-h-dvh w-full py-[18px] px-6 text-[var(--text-primary)] overflow-hidden rounded-[12px]"
      style={{
        // macOS NSVisualEffectView (HudWindow) is applied to the Tauri window
        // and provides the desktop-blur. Light dark tint sits on top to
        // ensure text contrast against bright desktop content.
        background: 'color-mix(in srgb, var(--bg-surface) 45%, transparent)',
      }}
      data-menubar-page
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <span
          className="deco-title-shadow font-display text-[12px] font-medium uppercase tracking-normal text-[var(--text-secondary)]"
        >
          Activity
        </span>
        <ViewSwitch value={view} onChange={setView} />
      </header>

      {/* No overflow-hidden here: the heatmap tooltip escapes the slot upward
          for top-row cells. The gradient is a background and cannot overflow. */}
      <div
        className="min-h-[168px]"
        style={view === 'line'
          ? { background: 'linear-gradient(180deg, var(--surface-raised) 0%, transparent 100%)' }
          : undefined}
      >
        {view === 'line'
          ? (
              <DualLineChart tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )
          : (
              <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )}
      </div>

      {/* KPI row — three mono numbers with hairline dividers */}
      <div className="flex mt-3.5">
        <div className="flex flex-1 flex-col gap-1 pr-3.5">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: MONO }}
          >
            {formatTokens(totalTokens)}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: MONO }}
          >
            Tokens
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 pl-3.5 pr-3.5 border-l border-[var(--border-subtle)]">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: MONO }}
          >
            {/* exact count — unlike tokens, sessions are never compressed to k/M */}
            {totalSessions.toLocaleString()}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: MONO }}
          >
            Sessions
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 pl-3.5 border-l border-[var(--border-subtle)]">
          <span
            className="text-[22px] font-medium tracking-[-0.5px] leading-none text-[var(--text-primary)] tabular-nums"
            style={{ fontFamily: MONO }}
          >
            {peak ? formatTokens(peak.value) : '—'}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
            style={{ fontFamily: MONO }}
          >
            Peak
          </span>
        </div>
      </div>

      {/* Footer — peak-day eyebrow + Open link on one row */}
      <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]"
          style={{ fontFamily: MONO }}
        >
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
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ fontFamily: MONO }}
        >
          Open OhMyC →
        </button>
      </div>
    </div>
  )
}
