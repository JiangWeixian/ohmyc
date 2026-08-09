// Expandable event list for the timeline page.
// Renders day headings, project rollups (collapsible), and per-session detail rows.

import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AgentGlyph } from '@/components/agent-glyph'

import type {
  DayEvents,
  ProjectGroup,
  SessionRow,
} from '@/hooks/use-timeline'

const motionEaseOut = [0.23, 1, 0.32, 1] as const

// ── Agent glyph components ────────────────────────────────────────

// Avatar-stack of distinct agents for a project rollup.
// 16px circular chips with 1px ring + page-bg fill so the overlap reads as
// layered (Linear/GitHub assignee convention). Single agent = single chip.
function AgentStack({ agents }: { agents: string[] }) {
  if (agents.length === 0) {
    return null
  }
  return (
    <span className="inline-flex items-center" style={{ marginRight: 8 }}>
      {agents.map((agent, i) => (
        <span
          key={agent}
          title={agent}
          className="inline-flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--bg-marketing)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            marginLeft: i === 0 ? 0 : -6,
            flexShrink: 0,
          }}
        >
          <AgentGlyph name={agent} size={11} />
        </span>
      ))}
    </span>
  )
}

// ── Formatting & scoring utilities ────────────────────────────────

const TODAY_ISO = (() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})()

function formatDayHeading(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  const text = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return day === TODAY_ISO ? `${text} · Today` : text
}

// Compact k/M formatting matches the heatmap legend for page-wide consistency.
function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M tokens`
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k tokens`
  }
  return `${n} tokens`
}

function pickDotClass(bucket: number): 'l0' | 'l1' | 'l2' | 'l3' {
  if (bucket >= 3) {
    return 'l3'
  }
  if (bucket === 2) {
    return 'l2'
  }
  if (bucket === 1) {
    return 'l1'
  }
  return 'l0'
}

function pickDotBg(cls: 'l0' | 'l1' | 'l2' | 'l3'): string {
  if (cls === 'l3') {
    return 'var(--text-primary)'
  }
  if (cls === 'l2') {
    return 'rgba(255,255,255,0.55)'
  }
  if (cls === 'l1') {
    return 'rgba(255,255,255,0.35)'
  }
  return 'var(--text-secondary)'
}

function formatHm(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatTimeRange(start: number, end: number): string {
  return `${formatHm(start)} → ${formatHm(end)}`
}

// Rounds to whole minutes — sub-minute sessions show "0 min" rather than
// misleading seconds-level precision.
function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) {
    return `${min} min`
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Composite score blends sessions (weight 1) with turns (weight 1/12) so that
// a day with many short sessions is not visually identical to one long session.
function bucketForDay(day: DayEvents, max: number): 0 | 1 | 2 | 3 {
  if (max <= 0) {
    return 0
  }
  const score = day.session_count + day.turn_count / 12
  const ratio = score / max
  if (ratio <= 0.25) {
    return 0
  }
  if (ratio <= 0.5) {
    return 1
  }
  if (ratio <= 0.8) {
    return 2
  }
  return 3
}

// ── EventList (exported) ──────────────────────────────────────────

interface EventListProps {
  days: DayEvents[]
  highlightedDay?: string | null
}

/**
 * Expandable event list grouped by day and project. The most recent day's
 * projects start expanded; all others start collapsed. Each session row
 * shows summary, duration, turn count, and token usage.
 */
export function EventList({ days, highlightedDay }: EventListProps) {
  const [openProjects, setOpenProjects] = useState<Set<string>>(() => {
    // Open the most recent day's projects by default for quick scan.
    const first = days[0]
    if (!first) {
      return new Set()
    }
    return new Set(first.projectGroups.map(g => `${first.day}::${g.project}`))
  })

  const maxDayScore = useMemo(() => {
    let n = 0
    for (const d of days) {
      const s = d.session_count + d.turn_count / 12
      if (s > n) {
        n = s
      }
    }
    return n
  }, [days])

  if (days.length === 0) {
    return (
      <div
        className="my-3 border-y border-[var(--border-subtle)] px-3 py-[14px] text-[12px] text-[var(--text-tertiary)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        No sessions match the current filters.
      </div>
    )
  }

  const toggle = (key: string) => {
    setOpenProjects((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div>
      {days.map((day) => {
        const bucket = bucketForDay(day, maxDayScore)
        const isHighlighted = highlightedDay === day.day
        return (
          <section key={day.day} data-day={day.day}>
            <div
              className="sticky top-0 z-[1] px-2 pb-[6px] pt-[10px] text-[13px] font-[510] text-[var(--text-primary)]"
              style={{
                fontFamily: 'var(--font-mono)',
                background:
                  'linear-gradient(to bottom, var(--bg-marketing) 70%, rgba(8,9,10,0))',
                outline: isHighlighted ? '1px solid var(--border-default)' : 'none',
                borderRadius: 4,
              }}
            >
              {formatDayHeading(day.day)}
              <span className="ml-[10px] font-normal text-[var(--text-quaternary)]">
                {day.session_count}
                {' '}
                session
                {day.session_count === 1 ? '' : 's'}
                {' · '}
                {day.turn_count}
                {' '}
                turns
                {' · '}
                {formatTokens(day.token_count)}
              </span>
            </div>

            {day.projectGroups.map((group) => {
              const key = `${day.day}::${group.project}`
              const isOpen = openProjects.has(key)
              return (
                <ProjectRollup
                  key={key}
                  open={isOpen}
                  onToggle={() => toggle(key)}
                  group={group}
                  bucket={bucket}
                />
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

// ── ProjectRollup ─────────────────────────────────────────────────

function ProjectRollup({
  group,
  open,
  onToggle,
  bucket,
}: {
  group: ProjectGroup
  open: boolean
  onToggle: () => void
  bucket: 0 | 1 | 2 | 3
}) {
  const sessions = group.sessions
  const firstStart = sessions.at(-1)?.started_at ?? 0
  const lastEnd = sessions[0]?.ended_at ?? 0
  const reduceMotion = useReducedMotion() ?? false
  const sessionGroupMotion = reduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, transform: 'translateY(-4px)' },
        animate: { opacity: 1, transform: 'translateY(0px)' },
        exit: { opacity: 0, transform: 'translateY(-2px)' },
        transition: { duration: 0.14, ease: motionEaseOut },
      }
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-md hover:bg-[rgba(255,255,255,0.02)]"
          // Expanded state gets taller padding so the chevron/content
          // transition does not feel cramped against the session list below.
        style={{
          padding: open ? '10px 14px' : '7px 14px',
          marginBottom: open ? 2 : 1,
        }}
      >
        <ChevronRight
          size={12}
          className={open ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}
          style={{ transition: 'transform 150ms ease-out', transform: open ? 'rotate(90deg)' : undefined, flexShrink: 0 }}
        />
        <span className="min-w-0 truncate text-[13px] font-[510] tracking-[-0.05px] text-[var(--text-primary)]">
          {group.project}
        </span>
        <span
          className="shrink-0 whitespace-nowrap text-[12px] text-[var(--text-tertiary)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {group.session_count}
          {' '}
          session
          {group.session_count === 1 ? '' : 's'}
          <Sep />
          {group.turn_count}
          {' turns'}
          <Sep />
          {formatTokens(group.token_count)}
          <Sep />
          {group.tool_count}
          {' tools'}
          <Sep />
          {group.skill_count}
          {' skills'}
        </span>
        <AgentStack agents={group.agents} />
        <span
          className="shrink-0 text-[11px] text-[var(--text-quaternary)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {formatTimeRange(firstStart, lastEnd)}
        </span>
      </div>
      {open && (
        <motion.div
          {...sessionGroupMotion}
          data-testid={`timeline-session-group-${group.project}`}
          data-motion-role="timeline-session-group"
          className="mb-2"
          style={{ margin: '2px 0 8px 28px', paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)' }}
        >
          {sessions.map(s => (
            <SessionItem key={s.session_id} session={s} bucket={bucket} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ── SessionItem ───────────────────────────────────────────────────

function SessionItem({ session, bucket }: { session: SessionRow; bucket: 0 | 1 | 2 | 3 }) {
  const totalTokens = session.tokens_input + session.tokens_output + session.tokens_cached
  // Summaries sourced from the user's first message are wrapped in quotes to
  // visually distinguish verbatim prompts from AI-generated summaries.
  const isQuoted = session.summary_source === 'first_message'
  const summary = session.summary ?? '(no summary)'
  const start = new Date(session.started_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Tools and skills counts aren't on session row; we leave them out per row
  // (the rollup carries the project totals — per-session tool/skill detail
  // would require a per-session fetch).

  const dotClass = pickDotClass(bucket)
  const dotBg = pickDotBg(dotClass)

  return (
    <div className="cursor-pointer rounded-md px-3 py-[10px] hover:bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-3">
        <span
          className="shrink-0"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotBg,
          }}
        />
        <span
          className="min-w-0 flex-1 truncate text-[14px] font-[510] text-[var(--text-primary)]"
          style={{ letterSpacing: '-0.05px' }}
        >
          {isQuoted
            ? (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>“</span>
              {summary}
              <span style={{ color: 'var(--text-tertiary)' }}>”</span>
            </>
              )
            : (
                summary
              )}
        </span>
        <span
          className="shrink-0 text-[11px] text-[var(--text-tertiary)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {start}
          {' · '}
          {formatDuration(session.duration_ms)}
        </span>
      </div>
      <div
        className="mt-1 flex flex-wrap items-center text-[11px] text-[var(--text-tertiary)]"
        style={{ marginLeft: 20, fontFamily: 'var(--font-mono)', gap: '0 8px' }}
      >
        {session.agent_name && (
          <span
            title={session.agent_name}
            className="inline-flex items-center text-[var(--text-secondary)]"
            style={{ opacity: 0.85 }}
          >
            <AgentGlyph name={session.agent_name} size={12} />
          </span>
        )}
        <span>
          {session.turns}
          {' turns'}
        </span>
        <Sep />
        <span>{formatTokens(totalTokens)}</span>
        {session.model && (
          <>
            <Sep />
            <span>{session.model}</span>
          </>
        )}
      </div>
    </div>
  )
}

function Sep() {
  return <span className="text-[var(--text-quaternary)]">·</span>
}
