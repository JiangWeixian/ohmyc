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

  const headerTokens = (tokensRecent.data ?? []).reduce((s, p) => s + p.value, 0)
  const headerSessions = (sessionsRecent.data ?? []).reduce((s, p) => s + p.value, 0)
  const rangeLabel = 'Last 16 weeks'

  // Footer meta: peak day across the same 16-week window.
  const peak = findPeak(tokensRecent.data ?? [])
  const peakSessionCount = peak
    ? (sessionsRecent.data ?? []).find(p => p.date === peak.date)?.value ?? 0
    : 0
  const footerMeta = peak
    ? `peak ${shortDayLabel(peak.date)} · ${formatTokens(peak.value)} · ${peakSessionCount} sessions`
    : 'no activity yet'

  return (
    <div
      className="min-h-dvh w-full p-[18px] text-[var(--text-primary)] overflow-hidden rounded-[12px]"
      style={{
        // macOS NSVisualEffectView (HudWindow) is applied to the Tauri window
        // and provides the desktop-blur. Light dark tint sits on top to
        // ensure text contrast against bright desktop content.
        background: 'rgba(25, 26, 27, 0.45)',
      }}
      data-menubar-page
    >
      <header className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex flex-col gap-[3px] min-w-0">
          <div className="text-[13px] font-medium tracking-[-0.05px] whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="font-medium">{formatTokens(headerTokens)}</span>
            <span className="ml-2 font-normal text-[var(--text-secondary)] tabular-nums">
              tokens · {headerSessions.toLocaleString()} sessions
            </span>
          </div>
          <span
            className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]"
            style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
          >
            {rangeLabel}
          </span>
        </div>
        <ViewSwitch value={view} onChange={setView} />
      </header>

      <div className="min-h-[168px]">
        {view === 'line'
          ? (
          <DualLineChart tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )
          : (
          <RecentHeatmap tokens={tokensRecent.data ?? []} sessions={sessionsRecent.data ?? []} />
            )}
      </div>

      <div
        className="mt-2.5 pt-2 border-t border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)]"
        style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
      >
        {footerMeta}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('open_main_window')
            await invoke('hide_popover')
          }}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ fontFamily: '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace' }}
        >
          Open OhMyC →
        </button>
      </div>
    </div>
  )
}
