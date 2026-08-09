// Menubar area chart — shadcn ChartContainer wrapping a Recharts AreaChart.
// Renders a single monochrome filled area (tokens). Sessions are surfaced
// per-day via the customTooltip on hover.

import {
  createContext,
  useContext,
  useId,
  useMemo,
} from 'react'
import {
  Area,
  AreaChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from 'recharts'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/chart'

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface AreaTrendChartProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const MONO = 'var(--font-mono)'
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const
const FUTURE_PADDING_DAYS = 14

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

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function findPeak(points: ChartRow[]): ChartRow | null {
  const realPoints = points.filter(point => point.tokens !== null)
  if (realPoints.length === 0) {
    return null
  }
  let peak = realPoints[0]
  for (const point of realPoints) {
    if (point.tokens !== null && peak.tokens !== null && point.tokens > peak.tokens) {
      peak = point
    }
  }
  return peak
}

interface ChartRow {
  date: string
  iso: string
  tokens: number | null
  isPadding?: boolean
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
  if (row.isPadding || row.tokens === null) {
    return null
  }
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

export function AreaTrendChart({ tokens, sessions }: AreaTrendChartProps) {
  const gradientId = useId().replaceAll(':', '')
  const strokeId = `${gradientId}-menubar-area-stroke`
  const fillId = `${gradientId}-menubar-area-fill`
  const chartData = useMemo<ChartRow[]>(() => {
    const rows: ChartRow[] = tokens.map(p => ({ date: shortLabel(p.date), iso: p.date, tokens: p.value }))
    const lastIso = rows.at(-1)?.iso
    if (!lastIso) {
      return rows
    }
    for (let i = 1; i <= FUTURE_PADDING_DAYS; i++) {
      const iso = addDaysIso(lastIso, i)
      rows.push({ date: shortLabel(iso), iso, tokens: null, isPadding: true })
    }
    return rows
  }, [tokens])
  const sessionMap = useMemo(
    () => new Map(sessions.map(p => [p.date, p.value])),
    [sessions],
  )
  const peak = useMemo(() => findPeak(chartData), [chartData])

  return (
    <SessionMapContext.Provider value={sessionMap}>
      <ChartContainer
        config={chartConfig}
        className="h-[168px] w-full"
        style={{ fontFamily: MONO }}
      >
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={strokeId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--menubar-chart-stroke-start)" />
              <stop offset="50%" stopColor="var(--menubar-chart-stroke-mid)" />
              <stop offset="100%" stopColor="var(--menubar-chart-stroke-end)" />
            </linearGradient>
            <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--menubar-chart-fill-color)" stopOpacity="var(--menubar-chart-fill-opacity)" />
              <stop offset="62%" stopColor="var(--menubar-chart-fill-color)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--menubar-chart-fill-color)" stopOpacity="0.07" />
            </linearGradient>
          </defs>
          {/* Axes stay hidden: the menubar chart should read as a clean sparkline. */}
          <XAxis dataKey="iso" hide />
          <YAxis hide width={0} domain={[0, 'dataMax']} />
          <ChartTooltip
            cursor={{ stroke: 'var(--border-default)' }}
            content={<ChartTooltipContent />}
          />
          <Area
            dataKey="tokens"
            type="natural"
            baseValue={0}
            stroke={`url(#${strokeId})`}
            fill={`url(#${fillId})`}
            fillOpacity={1}
            strokeWidth={1.75}
            dot={false}
            style={{ filter: 'var(--menubar-chart-shadow)' }}
          />
          {peak
            ? (
                <ReferenceDot
                  x={peak.iso}
                  y={peak.tokens ?? 0}
                  r={3}
                  fill="var(--menubar-chart-peak-color)"
                  stroke="none"
                  ifOverflow="extendDomain"
                  style={{ filter: 'var(--menubar-chart-peak-shadow)' }}
                />
              )
            : null}
        </AreaChart>
      </ChartContainer>
    </SessionMapContext.Provider>
  )
}
