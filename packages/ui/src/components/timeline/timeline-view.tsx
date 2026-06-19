// Timeline view — full-page timeline with metric/project/year filters,
// contribution heatmap, and expandable event list.

import { ChevronDown } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ContributionGraph } from './contribution-graph'
import { EventList } from './event-list'
import {
  type TimelineMetric,
  useTimelineEvents,
  useTimelineHeatmap,
  useTimelineProjects,
  useTimelineStatus,
  useTimelineYears,
} from '@/hooks/use-timeline'
import { cn } from '@/lib/utils'

/**
 * Top-level timeline page. Owns filter state (metric, project, year),
 * renders the contribution heatmap and the expandable event list below it.
 * Clicking a heatmap day scrolls to that day's events.
 */
export function TimelineView() {
  // ── Filter state ─────────────────────────────────────────────────
  const [currentYear] = useState(() => new Date().getFullYear())
  const [metric, setMetric] = useState<'activity' | 'tokens'>('activity')
  const [project, setProject] = useState<string | undefined>()
  const [year, setYear] = useState<number>(currentYear)
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null)
  const eventsRef = useRef<HTMLDivElement | null>(null)

  // ── Data queries ─────────────────────────────────────────────────
  const { data: years } = useTimelineYears()
  const { data: projects } = useTimelineProjects()
  const { data: status } = useTimelineStatus()

  // 'Activity' is composite — turns dominate naturally, so we use turns as the
  // intensity signal for the activity heatmap (sessions+turns are surfaced in
  // the tooltip/day heading).
  const heatmapMetric: TimelineMetric = metric === 'tokens' ? 'tokens' : 'turns'

  const { data: heatmap, isLoading: heatmapLoading } = useTimelineHeatmap({
    year,
    metric: heatmapMetric,
    project,
  })
  const { data: events, isLoading: eventsLoading } = useTimelineEvents({
    project,
    year,
  })

  // Snap to the latest available year when the selected year is no longer
  // present in the backend data (e.g. after a data reset or year-list refresh).
  useEffect(() => {
    if (years && years.length > 0 && !years.includes(year)) {
      // eslint-disable-next-line react/set-state-in-effect, react-hooks/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect
      setYear(years.at(-1)!)
    }
  }, [years, year])

  const totals = useMemo(() => {
    const days = events?.days ?? []
    let sessions = 0
    let turns = 0
    let tokens = 0
    for (const d of days) {
      sessions += d.session_count
      turns += d.turn_count
      tokens += d.token_count
    }
    return { sessions, turns, tokens }
  }, [events])

  const handleSelectDay = (date: string) => {
    setHighlightedDay(date)
    // Scroll to that day heading
    const node = eventsRef.current?.querySelector(`[data-day="${date}"]`)
    if (node) {
      ;(node as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const yearOptions = years ?? [currentYear]

  return (
    <div className="w-full max-w-[920px]">
      <h1 className="mb-1 text-[24px] font-[590] tracking-[-0.2px] text-[var(--text-primary)]">
        Timeline
      </h1>
      <p className="mb-7 max-w-screen-sm text-[14px] text-[var(--text-tertiary)]">
        Every Claude Code session you've run, across every project. Auto-synced via the Stop hook.
      </p>

      {/* Controls bar */}
      <div className="mb-7 flex items-center gap-2.5">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { id: 'activity', label: 'Activity' },
            { id: 'tokens', label: 'Tokens' },
          ]}
        />
        <CtrlSelect
          label="Project"
          value={project ?? '__all__'}
          onChange={v => setProject(v === '__all__' ? undefined : v)}
          options={[
            { value: '__all__', label: 'All projects' },
            ...(projects ?? []).map(p => ({ value: p, label: p })),
          ]}
        />
        <CtrlSelect
          label="Year"
          value={String(year)}
          onChange={v => setYear(Number(v))}
          options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
        />
        <span className="flex-1" />
        <span
          className="text-[11px] text-[var(--text-quaternary)]"
          style={{ fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace', letterSpacing: '0.02em' }}
        >
          {(status?.sessionCount ?? 0).toLocaleString()}
          {' sessions · '}
          {totals.turns.toLocaleString()}
          {' turns · '}
          {formatTokensCompact(totals.tokens)}
          {' tokens'}
        </span>
      </div>

      {/* Heatmap */}
      <div className="mb-9">
        {heatmapLoading || !heatmap
          ? (
              <div className="rounded-[10px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-[22px] py-[18px] text-[12px] text-[var(--text-tertiary)]">
                Loading…
              </div>
            )
          : (
              <ContributionGraph
                year={year}
                metric={heatmapMetric}
                data={heatmap}
                onSelectDay={handleSelectDay}
              />
            )}
      </div>

      {/* Events header */}
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[13px] font-[590] tracking-[-0.05px] text-[var(--text-primary)]">
          Recent activity
        </h3>
        {events?.nextCursor && (
          <span
            className="text-[11px] text-[var(--text-quaternary)]"
            style={{ fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace' }}
          >
            Showing {events.days.length} days · earlier sessions truncated
          </span>
        )}
      </div>

      <div ref={eventsRef}>
        {eventsLoading || !events
          ? (
              <div
                className="my-3 border-y border-[var(--border-subtle)] px-3 py-[14px] text-[12px] text-[var(--text-tertiary)]"
                style={{ fontFamily: 'Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace' }}
              >
                Loading…
              </div>
            )
          : <EventList days={events.days} highlightedDay={highlightedDay} />}
      </div>
    </div>
  )
}

// ── Internal helpers ──────────────────────────────────────────────

function formatTokensCompact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

function Segmented<TValue extends string>({
  value,
  onChange,
  options,
}: {
  value: TValue
  onChange: (v: TValue) => void
  options: { id: TValue; label: string }[]
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] p-[3px]">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded px-3 py-[6px] text-[12px] font-[510] transition-colors',
              active
                ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function CtrlSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="relative inline-flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-3 py-[7px] text-[12px] font-[510] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-primary)]">
        {options.find(o => o.value === value)?.label ?? '—'}
      </span>
      <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#191a1b', color: '#f7f8f8' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
