// GitHub-style contribution heatmap for timeline activity.
// Renders a 53-week x 7-day grid with heat-intensity coloring and hover tooltips.

import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

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
const WEEK_COUNT = 53
const DAY_LABEL_WIDTH = 18
const LABEL_GAP = 4
const DEFAULT_GRID_WIDTH = 738

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
}

export function calculateContributionGraphLayout(containerWidth: number) {
  const graphWidth = Math.max(DEFAULT_GRID_WIDTH, containerWidth - DAY_LABEL_WIDTH - LABEL_GAP)
  const trackWidth = graphWidth / WEEK_COUNT
  const cellSize = Math.max(10, Math.min(14, Math.round(trackWidth)))
  const rowGap = 3

  return { cellSize, rowGap }
}

/**
 * GitHub-style contribution graph. Cells are colored by heat intensity
 * relative to the maximum value in the dataset. Clicking a cell calls
 * onSelectDay so the parent can scroll the event list to that date.
 */
export function ContributionGraph({ year, metric, data, onSelectDay }: ContributionGraphProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hover, setHover] = useState<{
    x: number
    y: number
    point: HeatmapPoint
  } | null>(null)
  const { cellSize, rowGap } = calculateContributionGraphLayout(containerWidth)

  useLayoutEffect(() => {
    const node = cardRef.current
    if (!node) {
      return
    }

    const updateWidth = () => {
      setContainerWidth(node.getBoundingClientRect().width)
    }
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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

    const totalDays = WEEK_COUNT * 7
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
    for (let w = 0; w < WEEK_COUNT; w++) {
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
    <div
      ref={cardRef}
      data-testid="timeline-heatmap-card"
      className="timeline-heatmap-card"
      style={{
        '--heatmap-cell': `${cellSize}px`,
        '--heatmap-row-gap': `${rowGap}px`,
      } as CSSProperties}
    >
      <div
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `${DAY_LABEL_WIDTH}px minmax(0, 1fr)`,
          gridTemplateRows: '1rem 1fr',
          columnGap: LABEL_GAP,
          rowGap,
        }}
      >
        {/* Months strip */}
        <div
          data-testid="timeline-heatmap-months"
          style={{
            gridColumn: 2,
            display: 'flex',
          }}
          className="timeline-heatmap-months"
        >
          {monthSpans.map((s, i) => (
            <span key={i} style={{ flex: `${s.weeks} ${s.weeks} 0`, minWidth: 0 }}>{s.label}</span>
          ))}
        </div>

        {/* Day-of-week labels */}
        <div
          style={{
            gridColumn: 1,
            gridRow: 2,
            display: 'grid',
            gridTemplateRows: 'repeat(7, var(--heatmap-cell))',
            gap: 'var(--heatmap-row-gap)',
            alignItems: 'center',
          }}
          className="timeline-heatmap-dows"
        >
          {DOW_LABELS.map((label, i) => (
            <span
              key={i}
              className={label ? 'timeline-heatmap-dow-visible' : undefined}
              style={{ lineHeight: 'var(--heatmap-cell)', height: 'var(--heatmap-cell)', visibility: label ? 'visible' : 'hidden' }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Cells grid */}
        <div
          data-testid="timeline-heatmap-grid"
          style={{
            gridColumn: 2,
            gridRow: 2,
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEK_COUNT}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(7, var(--heatmap-cell))',
            gridAutoFlow: 'column',
            rowGap: 'var(--heatmap-row-gap)',
            justifyItems: 'center',
          }}
        >
          {cells.map((c, i) => {
            const bucket = c.inYear ? bucketFor(c.value, max) : 0
            const cls = HEAT_CLASSES[bucket]
            return (
              <div
                key={i}
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
                  width: 'var(--heatmap-cell)',
                  height: 'var(--heatmap-cell)',
                  borderRadius: 'var(--heatmap-cell-radius)',
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
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              boxShadow: 'var(--shadow-md, 0 0.25rem 0.75rem rgba(0,0,0,0.4))',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            {metric === 'tokens'
              ? `${formatNumber(hover.point.value)} tokens`
              : `${formatNumber(hover.point.value)} ${metric}`}
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {formatDay(hover.point.date)}
            </span>
          </div>
        )}
      </div>

      <div
        className="timeline-heatmap-legend mt-3.5 flex items-center justify-between"
      >
        <span>
          Jan 1 → Dec 31, {year}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--text-quaternary)]">
          Less
          <span className="inline-flex gap-1">
            {(['heat-l0', 'heat-l1', 'heat-l2', 'heat-l3', 'heat-l4'] as const).map(k => (
              <span key={k} className={`heat-cell ${k}`} style={{ width: 'var(--heatmap-cell)', height: 'var(--heatmap-cell)', borderRadius: 'var(--heatmap-cell-radius)' }} />
            ))}
          </span>
          More
        </span>
      </div>
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
