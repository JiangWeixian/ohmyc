// Timeline view — full-page timeline with metric/project/year filters,
// contribution heatmap, and expandable event list.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ContributionGraph } from './contribution-graph'
import { EventList } from './event-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  type TimelineMetric,
  useTimelineEvents,
  useTimelineHeatmap,
  useTimelineProjects,
  useTimelineStatus,
  useTimelineYears,
} from '@/hooks/use-timeline'

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
      const reduceMotion = typeof globalThis.matchMedia === 'function'
        && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      ;(node as HTMLElement).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
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
        <Tabs
          value={metric}
          onValueChange={value => setMetric(value as 'activity' | 'tokens')}
          className="flex-row gap-0"
        >
          <TabsList className="h-auto gap-0.5 rounded-md border border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] p-[3px]">
            <TabsTrigger
              value="activity"
              className="h-auto flex-none rounded px-3 py-[6px] text-[12px] font-[510] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] data-[state=active]:border-transparent data-[state=active]:bg-[rgba(255,255,255,0.08)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-none"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="tokens"
              className="h-auto flex-none rounded px-3 py-[6px] text-[12px] font-[510] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] data-[state=active]:border-transparent data-[state=active]:bg-[rgba(255,255,255,0.08)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-none"
            >
              Tokens
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <TimelineSelect
          label="Project"
          value={project ?? '__all__'}
          onChange={v => setProject(v === '__all__' ? undefined : v)}
          options={[
            { value: '__all__', label: 'All projects' },
            ...(projects ?? []).map(p => ({ value: p, label: p })),
          ]}
        />
        <TimelineSelect
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

function TimelineSelect({
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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className="rounded-md border-[var(--border-default)] bg-[rgba(255,255,255,0.02)] px-3 py-[7px] text-[12px] font-[510] text-[var(--text-secondary)] hover:border-[var(--border-hover)] focus-visible:ring-0 data-[state=open]:border-[var(--border-hover)] [&_svg]:size-3"
      >
        <span className="text-[var(--text-tertiary)]">{label}</span>
        <span className="text-[var(--text-primary)]">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className="border border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] shadow-none ring-0"
      >
        {options.map(o => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="text-[12px] text-[var(--text-secondary)] focus:bg-white/[0.06] focus:text-[var(--text-primary)]"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
