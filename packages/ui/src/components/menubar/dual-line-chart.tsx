// Menubar line chart — Tremor LineChart wrapping Recharts.
// Renders a single monochrome line (tokens). Sessions are surfaced
// per-day via the customTooltip on hover.

import { LineChart } from '@tremor/react'
import {
  createContext,
  useContext,
  useMemo,
} from 'react'

import type { HeatmapPoint } from '@/hooks/use-timeline'
import type { CustomTooltipProps } from '@tremor/react'

interface DualLineChartProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const MONO = '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace'
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${Math.round(n / 100_000) / 10}M`
  }
  if (n >= 1000) {
    return `${Math.round(n / 100) / 10}k`
  }
  return String(n)
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function shortLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

// Each row in chartData carries the chart-display label (`date`), the canonical
// ISO date (for tooltip lookups), and the tokens value. The ChartTooltip reads
// the iso from payload[0].payload so sessionMap lookups don't depend on the
// possibly-truncated x-axis label.
interface ChartRow {
  date: string
  iso: string
  tokens: number
}

// Context carries the sessionMap so ChartTooltip can be defined at module level.
const SessionMapContext = createContext<Map<string, number>>(new Map())

function ChartTooltip({ payload, active }: CustomTooltipProps) {
  const sessionMap = useContext(SessionMapContext)
  if (!active || !payload?.[0]) {
    return null
  }
  const row = payload[0].payload as ChartRow
  const tokensVal = Number(payload[0].value ?? 0)
  const sessionsVal = sessionMap.get(row.iso) ?? 0
  return (
    <div
      className="rounded border border-[var(--border-default)] bg-[var(--surface-overlay)] px-2 py-1.5 text-[11px] shadow-md"
      style={{ fontFamily: MONO }}
    >
      <div className="text-[var(--text-primary)]">
        {sessionsVal} sessions · {formatTokens(tokensVal)} tokens
      </div>
      <div className="text-[10px] text-[var(--text-tertiary)]">
        {longDate(row.iso)}
      </div>
    </div>
  )
}

export function DualLineChart({ tokens, sessions }: DualLineChartProps) {
  const chartData = useMemo<ChartRow[]>(
    () => tokens.map(p => ({ date: shortLabel(p.date), iso: p.date, tokens: p.value })),
    [tokens],
  )
  const sessionMap = useMemo(
    () => new Map(sessions.map(p => [p.date, p.value])),
    [sessions],
  )

  return (
    <SessionMapContext.Provider value={sessionMap}>
      {/* Wrap so Tremor's axis tick text inherits Berkeley Mono + small monochrome size. */}
      <div
        className="h-[140px] text-[9px] text-[var(--text-quaternary)]"
        style={{ fontFamily: MONO }}
      >
        <LineChart
          data={chartData}
          index="date"
          categories={['tokens']}
          colors={['gray']}
          showLegend={false}
          showAnimation={false}
          showGridLines={true}
          showXAxis={true}
          showYAxis={true}
          yAxisWidth={36}
          intervalType="preserveStartEnd"
          valueFormatter={formatTokens}
          customTooltip={ChartTooltip}
          className="h-full w-full"
        />
      </div>
    </SessionMapContext.Provider>
  )
}
