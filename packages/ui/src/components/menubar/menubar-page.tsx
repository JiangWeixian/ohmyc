// Menubar popover page — owns view state, fetches data, switches between
// dual-line and heatmap views. Lives at /menubar.

import { useMemo, useState } from 'react'

import { DualLineChart } from './dual-line-chart'
import { type MenubarView, ViewSwitch } from './view-switch'
import { ContributionGraph } from '@/components/timeline/contribution-graph'
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

const CURRENT_YEAR = new Date().getUTCFullYear()

export function MenubarPage() {
  const [view, setView] = useState<MenubarView>('line')

  const today = useMemo(() => new Date(), [])
  const todayIso = isoDate(today)
  const weekAgoIso = isoDate(subDays(today, 6))
  const yearStartIso = `${CURRENT_YEAR}-01-01`
  const yearEndIso = `${CURRENT_YEAR}-12-31`

  const tokensWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'tokens' })
  const sessionsWeek = useTimelineHeatmapRange({ from: weekAgoIso, to: todayIso, metric: 'sessions' })
  const tokensYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'tokens' })
  const sessionsYear = useTimelineHeatmapRange({ from: yearStartIso, to: yearEndIso, metric: 'sessions' })

  const tokensWeekTotal = (tokensWeek.data ?? []).reduce((s, p) => s + p.value, 0)
  const sessionsWeekTotal = (sessionsWeek.data ?? []).reduce((s, p) => s + p.value, 0)
  const tokensYearTotal = (tokensYear.data ?? []).reduce((s, p) => s + p.value, 0)
  const sessionsYearTotal = (sessionsYear.data ?? []).reduce((s, p) => s + p.value, 0)

  const headerTokens = view === 'line' ? tokensWeekTotal : tokensYearTotal
  const headerSessions = view === 'line' ? sessionsWeekTotal : sessionsYearTotal
  const rangeLabel = view === 'line' ? 'Last 7 days' : 'Last 365 days'

  return (
    <div
      className="min-h-dvh w-full p-[18px] bg-[#191a1b] text-[var(--text-primary)]"
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

      {view === 'line'
        ? (
        <DualLineChart tokens={tokensWeek.data ?? []} sessions={sessionsWeek.data ?? []} />
          )
        : (
        <ContributionGraph
          year={CURRENT_YEAR}
          metric="tokens"
          data={tokensYear.data ?? []}
          compact
        />
          )}
    </div>
  )
}
