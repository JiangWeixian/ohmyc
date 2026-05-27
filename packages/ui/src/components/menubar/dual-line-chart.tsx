// Menubar area chart — shadcn ChartContainer wrapping a Recharts AreaChart.
// Renders a single monochrome filled area (tokens). Sessions are surfaced
// per-day via the customTooltip on hover.

import {
  createContext,
  useContext,
  useMemo,
} from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart'

import type { HeatmapPoint } from '@/hooks/use-timeline'

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

interface ChartRow {
  date: string
  iso: string
  tokens: number
}

// Context carries the sessionMap so the tooltip component can live at module scope
// (ESLint rule react-hooks-extra/no-nested-component-definitions).
const SessionMapContext = createContext<Map<string, number>>(new Map())

interface RechartsTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: ChartRow }>
}

function ChartTooltipContent({ active, payload }: RechartsTooltipProps) {
  const sessionMap = useContext(SessionMapContext)
  if (!active || !payload?.[0]) {
    return null
  }
  const row = payload[0].payload
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

const chartConfig = {
  tokens: { label: 'Tokens', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

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
      <ChartContainer
        config={chartConfig}
        className="h-[140px] w-full"
        style={{ fontFamily: MONO }}
      >
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border-default)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            interval="preserveStartEnd"
            tick={{ fontSize: 9, fill: 'var(--text-quaternary)' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={formatTokens}
            tick={{ fontSize: 9, fill: 'var(--text-quaternary)' }}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border-default)' }}
            content={<ChartTooltipContent />}
          />
          <Area
            dataKey="tokens"
            type="natural"
            stroke="var(--color-tokens)"
            fill="var(--color-tokens)"
            fillOpacity={0.12}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </SessionMapContext.Provider>
  )
}
