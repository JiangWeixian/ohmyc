// Hand-rolled SVG dual-axis line chart for the menubar popover.
// Tokens on left axis (solid line), sessions on right axis (dashed line).
// Legend hidden by default, revealed on chart-wrap :hover via CSS.

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface DualLineChartProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const VIEW_W = 320
const VIEW_H = 140
const X_PAD_LEFT = 30
const X_PAD_RIGHT = 20
const Y_TOP = 0
const Y_BOTTOM = 110
const PLOT_WIDTH = VIEW_W - X_PAD_LEFT - X_PAD_RIGHT
const PLOT_HEIGHT = Y_BOTTOM - Y_TOP

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Round up to the nearest "nice" number: 1, 2, 5, 10, 20, 50, 100, ... */
function niceCeil(value: number): number {
  if (value <= 0) {
    return 1
  }
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const normalized = value / base
  let nice: number
  if (normalized <= 1) {
    nice = 1
  } else if (normalized <= 2) {
    nice = 2
  } else if (normalized <= 5) {
    nice = 5
  } else {
    nice = 10
  }
  return nice * base
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

function dowLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return DOW[d.getUTCDay()]
}

export function DualLineChart({ tokens, sessions }: DualLineChartProps) {
  if (tokens.length === 0 || sessions.length === 0) {
    return (
      <div data-empty className="rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] p-3.5" />
    )
  }

  const tokensMax = niceCeil(Math.max(...tokens.map(p => p.value), 1))
  const sessionsMax = niceCeil(Math.max(...sessions.map(p => p.value), 1))

  const n = tokens.length
  const stepX = PLOT_WIDTH / Math.max(n - 1, 1)
  const xs = Array.from({ length: n }, (_, i) => X_PAD_LEFT + i * stepX)

  const yTokens = tokens.map(p => Y_BOTTOM - (p.value / tokensMax) * PLOT_HEIGHT)
  const ySessions = sessions.map(p => Y_BOTTOM - (p.value / sessionsMax) * PLOT_HEIGHT)

  const tokensPath = xs.map((x, i) => `${x},${yTokens[i]}`).join(' ')
  const sessionsPath = xs.map((x, i) => `${x},${ySessions[i]}`).join(' ')

  const yTicks = [Y_BOTTOM, Y_BOTTOM - PLOT_HEIGHT / 2, Y_TOP]
  const monoFamily = '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace'

  return (
    <div className="group rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] p-3.5">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="block w-full h-[140px]"
        aria-label="Daily tokens and sessions for the last 7 days"
      >
        {yTicks.map((y, i) => (
          <line
            key={i}
            x1={X_PAD_LEFT}
            y1={y}
            x2={VIEW_W - X_PAD_RIGHT}
            y2={y}
            stroke="var(--border-soft)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}
        {[tokensMax, tokensMax / 2, 0].map((v, i) => (
          <text
            key={`l-${i}`}
            x={X_PAD_LEFT - 4}
            y={yTicks[i] + 3}
            fill="var(--text-quaternary)"
            fontSize={9}
            textAnchor="end"
            style={{ fontFamily: monoFamily }}
            data-tick-left
          >
            {formatTokens(v)}
          </text>
        ))}
        {[sessionsMax, sessionsMax / 2, 0].map((v, i) => (
          <text
            key={`r-${i}`}
            x={VIEW_W - X_PAD_RIGHT + 4}
            y={yTicks[i] + 3}
            fill="var(--text-quaternary)"
            fontSize={9}
            textAnchor="start"
            style={{ fontFamily: monoFamily }}
            data-tick-right
          >
            {Math.round(v)}
          </text>
        ))}
        <polyline
          points={tokensPath}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth={1.5}
        />
        <polyline
          points={sessionsPath}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
        />
        {xs.map((x, i) => (
          <circle key={`t-${i}`} cx={x} cy={yTokens[i]} r={2.5} fill="var(--text-primary)" />
        ))}
        {xs.map((x, i) => (
          <circle key={`s-${i}`} cx={x} cy={ySessions[i]} r={2} fill="var(--text-tertiary)" />
        ))}
        {xs.map((x, i) => (
          <text
            key={`x-${i}`}
            x={x}
            y={VIEW_H - 2}
            fill="var(--text-quaternary)"
            fontSize={10}
            textAnchor="middle"
            style={{ fontFamily: monoFamily }}
            data-x-label
          >
            {dowLabel(tokens[i].date)}
          </text>
        ))}
      </svg>
      <div
        data-legend
        data-default-hidden="true"
        className="mt-2 flex items-center gap-3.5 text-[11px] opacity-0 group-hover:opacity-100"
        style={{
          color: 'var(--text-tertiary)',
          fontFamily: monoFamily,
        }}
      >
        <span>
          <span
            className="inline-block w-3.5 h-0.5 align-middle mr-1.5"
            style={{ background: 'var(--text-primary)' }}
          />
          Tokens · left axis
        </span>
        <span>
          <span
            className="inline-block w-3.5 h-0.5 align-middle mr-1.5"
            style={{
              background:
                'repeating-linear-gradient(to right, var(--text-tertiary) 0 4px, transparent 4px 7px)',
            }}
          />
          Sessions · right axis
        </span>
      </div>
    </div>
  )
}
