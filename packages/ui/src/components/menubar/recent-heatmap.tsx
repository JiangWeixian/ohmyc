// Menubar heatmap — 16 weeks × 7 days, fixed 16×16 cells with 3px gap.
// Ghost variant (no card chrome). Four labelling elements (month row, DOW
// column, range label, Less/More legend) and a 2-line hover tooltip.

import { useState } from 'react'

import type { HeatmapPoint } from '@/hooks/use-timeline'

interface RecentHeatmapProps {
  tokens: HeatmapPoint[]
  sessions: HeatmapPoint[]
}

const WEEKS = 16
const DAYS = 7
const CELL_SIZE = 16
const CELL_GAP = 3
const DOW_COL_WIDTH = 14
const COL_GAP = 4

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const BUCKET_COLORS = [
  'rgba(255,255,255,0.04)', // 0
  'rgba(255,255,255,0.10)', // 1
  'rgba(255,255,255,0.22)', // 2
  'rgba(255,255,255,0.45)', // 3
  'rgba(255,255,255,0.72)', // 4
] as const

// Legend shows all 5 cell buckets plus a "More" extreme at 0.92
const LEGEND_COLORS = [...BUCKET_COLORS, 'rgba(255,255,255,0.92)']

const MONO = '"Berkeley Mono", ui-monospace, SF Mono, Menlo, monospace'

function bucketFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) {
    return 0
  }
  const ratio = value / max
  if (ratio <= 0.15) {
    return 1
  }
  if (ratio <= 0.4) {
    return 2
  }
  if (ratio <= 0.7) {
    return 3
  }
  return 4
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() - n)
  return copy
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

interface HoverState {
  date: string
  tokens: number
  sessions: number
  x: number
  y: number
}

interface Cell {
  iso: string
  value: number
  bucket: 0 | 1 | 2 | 3 | 4
  col: number
  row: number
}

export function RecentHeatmap({ tokens, sessions }: RecentHeatmapProps) {
  const [hover, setHover] = useState<HoverState | null>(null)

  const today = new Date()
  const start = subDays(today, WEEKS * DAYS - 1)

  const tokenMap = new Map(tokens.map(p => [p.date, p.value]))
  const sessionMap = new Map(sessions.map(p => [p.date, p.value]))
  const maxToken = Math.max(0, ...tokens.map(p => p.value))

  const cells: Cell[] = []
  for (let col = 0; col < WEEKS; col++) {
    for (let row = 0; row < DAYS; row++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + col * DAYS + row)
      const iso = isoDate(d)
      const value = tokenMap.get(iso) ?? 0
      cells.push({ iso, value, bucket: bucketFor(value, maxToken), col, row })
    }
  }

  const seenMonths = new Set<number>()
  const monthLabels: { col: number; name: string }[] = []
  for (let col = 0; col < WEEKS; col++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + col * DAYS)
    const m = d.getUTCMonth()
    if (!seenMonths.has(m)) {
      seenMonths.add(m)
      monthLabels.push({ col, name: MONTH_NAMES[m].toUpperCase() })
    }
  }

  const rangeText = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()} → ${MONTH_NAMES[today.getUTCMonth()]} ${today.getUTCDate()}, ${today.getUTCFullYear()}`

  // DOW labels: blank rows for Sun/Tue/Thu/Sat per the wireframe
  const dowVisible: readonly string[] = ['', 'M', '', 'W', '', 'F', '']

  function onCellEnter(cell: Cell, event: React.MouseEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const wrap = target.closest('[data-heatmap-wrap]')
    if (!wrap) {
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const cellRect = target.getBoundingClientRect()
    setHover({
      date: cell.iso,
      tokens: cell.value,
      sessions: sessionMap.get(cell.iso) ?? 0,
      x: cellRect.left - wrapRect.left + cellRect.width / 2,
      y: cellRect.top - wrapRect.top,
    })
  }

  return (
    <div data-heatmap-wrap className="pt-1 relative">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${DOW_COL_WIDTH}px auto`,
          gridTemplateRows: '14px auto',
          columnGap: `${COL_GAP}px`,
          rowGap: '2px',
        }}
      >
        {/* corner */}
        <div />

        {/* month labels row */}
        <div
          data-heatmap-months
          className="grid overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            columnGap: `${CELL_GAP}px`,
          }}
        >
          {monthLabels.map((label, i) => {
            const span = Math.min(2, WEEKS - label.col)
            return (
              <span
                key={i}
                className="text-[9px] uppercase whitespace-nowrap text-[var(--text-quaternary)]"
                style={{
                  gridColumn: `${label.col + 1} / span ${span}`,
                  fontFamily: MONO,
                  letterSpacing: '0.04em',
                  alignSelf: 'center',
                }}
              >
                {label.name}
              </span>
            )
          })}
        </div>

        {/* DOW column */}
        <div
          data-heatmap-dow
          className="grid items-center"
          style={{
            gridTemplateRows: `repeat(${DAYS}, ${CELL_SIZE}px)`,
            rowGap: `${CELL_GAP}px`,
            justifyItems: 'start',
          }}
        >
          {dowVisible.map((letter, i) => (
            <span
              key={i}
              className="text-[9px] text-[var(--text-quaternary)]"
              style={{
                fontFamily: MONO,
                lineHeight: `${CELL_SIZE}px`,
                height: CELL_SIZE,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* cells grid */}
        <div
          data-heatmap-grid
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${DAYS}, ${CELL_SIZE}px)`,
            gap: `${CELL_GAP}px`,
          }}
        >
          {cells.map((cell, i) => (
            <div
              key={i}
              data-heat-cell
              data-bucket={cell.bucket}
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
                background: BUCKET_COLORS[cell.bucket],
                borderRadius: 2,
                cursor: 'pointer',
              }}
              onMouseEnter={e => onCellEnter(cell, e)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>

      {/* footer: range left, Less/More right */}
      <div
        className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--text-quaternary)]"
        style={{ fontFamily: MONO }}
      >
        <span data-heatmap-range>{rangeText}</span>
        <span data-heatmap-legend className="inline-flex items-center gap-1.5">
          Less
          <span className="inline-flex items-center gap-[3px] mx-1.5">
            {LEGEND_COLORS.map((c, i) => (
              <span
                key={i}
                style={{ width: 9, height: 9, borderRadius: 1, display: 'inline-block', background: c }}
              />
            ))}
          </span>
          More
        </span>
      </div>

      {/* hover tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1.5 rounded text-[11px] text-[var(--text-primary)] shadow-lg"
          style={{
            left: hover.x,
            top: hover.y - 8,
            transform: 'translate(-50%, -100%)',
            background: '#08090a',
            border: '1px solid var(--border-default)',
            fontFamily: MONO,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-[var(--text-primary)]">{hover.sessions} sessions · {formatTokens(hover.tokens)} tokens</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">{longDate(hover.date)}</div>
        </div>
      )}
    </div>
  )
}
