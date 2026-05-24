// GitHub-style contribution heatmap for timeline activity.
// Renders a 53-week x 7-day grid with heat-intensity coloring and hover tooltips.

import { useMemo, useState } from 'react'

import type { HeatmapPoint, TimelineMetric } from '@/hooks/use-timeline'

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const HEAT_CLASSES = ['heat-l0', 'heat-l1', 'heat-l2', 'heat-l3', 'heat-l4'] as const

const DOW_LABELS = ['', 'M', '', 'W', '', 'F', ''] as const

// Non-linear bucket thresholds approximate perceptual uniformity — small
// values spread across more buckets so sparse days remain distinguishable.
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

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export interface ContributionGraphProps {
  year: number
  metric: TimelineMetric
  data: HeatmapPoint[]
  onSelectDay?: (date: string) => void
  /** Compact mode for the menubar popover: hides month/day-of-week labels and the legend; shrinks cells. */
  compact?: boolean
}

/**
 * GitHub-style contribution graph. Cells are colored by heat intensity
 * relative to the maximum value in the dataset. Clicking a cell calls
 * onSelectDay so the parent can scroll the event list to that date.
 */
export function ContributionGraph({ year, metric, data, onSelectDay, compact = false }: ContributionGraphProps) {
  // Compact cells sized to fit a 360px popover: 53 cols × 4px + 52 × 1px gap = 264px,
  // well under the ~296px available inside the chart card (popover 360 − page 36 − card 28).
  const CELL_SIZE = compact ? 4 : 10
  const CELL_GAP = compact ? 1 : 4
  const [hover, setHover] = useState<{
    x: number
    y: number
    point: HeatmapPoint
  } | null>(null)

  const valueByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of data) {
      m.set(p.date, p.value)
    }
    return m
  }, [data])

  const max = useMemo(() => {
    let n = 0
    for (const p of data) {
      if (p.value > n) {
        n = p.value
      }
    }
    return n
  }, [data])

  // Build 53-week x 7-day grid anchored to this calendar year.
  // Column 0 starts at the Sunday on/before Jan 1.
  // 53 weeks ensures full-year coverage even when Jan 1 falls on a Saturday.
  const { cells, monthSpans } = useMemo(() => {
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31))
    const startDow = yearStart.getUTCDay()
    const firstCell = new Date(yearStart)
    firstCell.setUTCDate(yearStart.getUTCDate() - startDow)

    const totalDays = 53 * 7
    const cellList: { date: string; value: number; inYear: boolean }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(firstCell)
      d.setUTCDate(firstCell.getUTCDate() + i)
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const inYear = d >= yearStart && d <= yearEnd
      cellList.push({
        date: dateStr,
        value: inYear ? valueByDate.get(dateStr) ?? 0 : 0,
        inYear,
      })
    }

    // Compute month spans for the top strip.
    const spans: { label: string; weeks: number }[] = []
    let lastMonth = -1
    for (let w = 0; w < 53; w++) {
      const d = new Date(firstCell)
      d.setUTCDate(firstCell.getUTCDate() + w * 7)
      const m = d.getUTCMonth()
      if (d.getUTCFullYear() !== year) {
        if (spans.length > 0) {
          spans.at(-1)!.weeks += 1
        } else {
          spans.push({ label: '', weeks: 1 })
        }
        continue
      }
      if (m === lastMonth) {
        spans.at(-1)!.weeks += 1
      } else {
        spans.push({ label: MONTH_NAMES[m], weeks: 1 })
        lastMonth = m
      }
    }

    return { cells: cellList, monthSpans: spans }
  }, [year, valueByDate])

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-[22px] py-[18px]">
      <div
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '18px 1fr',
          gridTemplateRows: compact ? '1fr' : '16px 1fr',
          gap: CELL_GAP,
        }}
      >
        {/* Months strip */}
        {!compact && (
          <div
            style={{
              gridColumn: 2,
              display: 'flex',
              fontSize: 10,
              fontWeight: 510,
              color: 'var(--text-quaternary)',
              fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {monthSpans.map((s, i) => (
              <span key={i} data-month-label={s.label || undefined} style={{ flex: `0 0 ${s.weeks * 14}px` }}>{s.label}</span>
            ))}
          </div>
        )}

        {/* Day-of-week labels */}
        {!compact && (
          <div
            style={{
              gridColumn: 1,
              gridRow: 2,
              display: 'grid',
              gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
              gap: CELL_GAP,
              fontSize: 9,
              fontWeight: 510,
              color: 'var(--text-quaternary)',
              fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace',
              textTransform: 'uppercase',
              alignItems: 'center',
            }}
          >
            {DOW_LABELS.map((label, i) => (
              <span key={i} style={{ lineHeight: `${CELL_SIZE}px`, height: CELL_SIZE, visibility: label ? 'visible' : 'hidden' }}>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Cells grid */}
        <div
          style={{
            gridColumn: compact ? 1 : 2,
            gridRow: compact ? 1 : 2,
            display: 'grid',
            gridTemplateColumns: `repeat(53, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
            gridAutoFlow: 'column',
            gap: CELL_GAP,
          }}
        >
          {cells.map((c, i) => {
            const bucket = c.inYear ? bucketFor(c.value, max) : 0
            const cls = HEAT_CLASSES[bucket]
            return (
              <div
                key={i}
                data-heat-cell
                role={c.inYear && c.value > 0 ? 'button' : undefined}
                onClick={() => {
                  if (c.inYear && c.value > 0 && onSelectDay) {
                    onSelectDay(c.date)
                  }
                }}
                onMouseEnter={(e) => {
                  if (!c.inYear) {
                    return
                  }
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const parent = (e.currentTarget.closest('.relative') as HTMLElement | null)?.getBoundingClientRect()
                  setHover({
                    x: rect.left - (parent?.left ?? 0) + 14,
                    y: rect.top - (parent?.top ?? 0) - 8,
                    point: { date: c.date, value: c.value },
                  })
                }}
                onMouseLeave={() => setHover(null)}
                className={`heat-cell ${cls}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  cursor: c.inYear && c.value > 0 ? 'pointer' : 'default',
                }}
              />
            )
          })}
        </div>

        {/* Tooltip: labels adapt to the active metric (tokens suffix vs metric name). */}
        {hover && (
          <div
            style={{
              position: 'absolute',
              left: hover.x,
              top: hover.y,
              transform: 'translate(-50%, -100%)',
              background: 'var(--surface-overlay)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              padding: '8px 10px',
              boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.4))',
              fontSize: 11,
              color: 'var(--text-primary)',
              fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            {metric === 'tokens'
              ? `${formatNumber(hover.point.value)} tokens`
              : `${formatNumber(hover.point.value)} ${metric}`}
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: 10, marginTop: 2 }}>
              {formatDay(hover.point.date)}
            </span>
          </div>
        )}
      </div>

      {!compact && (
        <div
          className="mt-[14px] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]"
          style={{ fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace' }}
        >
          <span>
            Jan 1 → Dec 31, {year}
          </span>
          <span className="inline-flex items-center gap-[6px] text-[var(--text-quaternary)]">
            Less
            <span className="inline-flex gap-[3px]">
              {(['heat-l0', 'heat-l1', 'heat-l2', 'heat-l3', 'heat-l4'] as const).map(k => (
                <span key={k} className={`heat-cell ${k}`} style={{ width: 10, height: 10, borderRadius: 2 }} />
              ))}
            </span>
            More
          </span>
        </div>
      )}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}
