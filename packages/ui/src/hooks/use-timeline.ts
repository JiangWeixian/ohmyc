// React Query hooks for timeline analytics — heatmap, events, years, projects, and sync status.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

/** Allowed aggregation metrics for the timeline heatmap. */
export type TimelineMetric = 'sessions' | 'tokens' | 'turns'

/** A single data point in the heatmap response. */
export interface HeatmapPoint {
  date: string
  value: number
}

/** A single coding session row from the timeline database. */
export interface SessionRow {
  session_id: string
  project: string
  started_at: number
  ended_at: number
  duration_ms: number
  turns: number
  tokens_input: number
  tokens_output: number
  tokens_cached: number
  summary: string | null
  summary_source: string
  transcript_path: string
  last_offset: number
  ingested_at: number
  model: string | null
  agent_name: string | null
}

/** Sessions grouped by project, with aggregated counts. */
export interface ProjectGroup {
  project: string
  sessions: SessionRow[]
  session_count: number
  turn_count: number
  token_count: number
  tool_count: number
  skill_count: number
  agents: string[]
}

/** All sessions for a single day, grouped by project. */
export interface DayEvents {
  day: string
  projectGroups: ProjectGroup[]
  session_count: number
  turn_count: number
  token_count: number
}

/** Paginated result of day-grouped session events. */
export interface EventsResult {
  days: DayEvents[]
  nextCursor?: string
}

/** Timeline database status — total sessions and last sync timestamp. */
export interface TimelineStatus {
  sessionCount: number
  lastSyncAt: number | null
}

/** Converts an ISO date string (`YYYY-MM-DD`) to UTC midnight milliseconds. */
function isoDateToUtcMs(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  )
}

function normalizeEvents(raw: unknown): EventsResult {
  const r = raw as { days?: unknown[]; nextCursor?: string; next_cursor?: string }
  const days = (r.days ?? []).map((d) => {
    const dd = d as Record<string, unknown>
    const groups = (dd.projectGroups ?? dd.project_groups ?? []) as unknown[]
    return {
      day: dd.day as string,
      projectGroups: groups as ProjectGroup[],
      session_count: dd.session_count as number,
      turn_count: dd.turn_count as number,
      token_count: dd.token_count as number,
    }
  })
  return { days, nextCursor: r.nextCursor ?? r.next_cursor }
}

/** Query hook for the list of years that have timeline data. */
export function useTimelineYears() {
  return useQuery({
    queryKey: ['timeline', 'years'],
    queryFn: async () => {
      const r = await request<{ years: number[] }>('timeline.years', {})
      return r.years
    },
  })
}

/** Query hook for the list of projects with timeline data. */
export function useTimelineProjects() {
  return useQuery({
    queryKey: ['timeline', 'projects'],
    queryFn: async () => {
      const r = await request<{ projects: string[] }>('timeline.projects', {})
      return r.projects
    },
  })
}

/** Query hook for timeline database status (session count and last sync). */
export function useTimelineStatus() {
  return useQuery({
    queryKey: ['timeline', 'status'],
    queryFn: async () => {
      const raw = await request<Record<string, unknown>>('timeline.status', {})
      return {
        sessionCount: (raw.sessionCount ?? raw.session_count) as number,
        lastSyncAt: (raw.lastSyncAt ?? raw.last_sync_at ?? null) as number | null,
      } satisfies TimelineStatus
    },
  })
}

/**
 * Query hook for the yearly heatmap data.
 */
export function useTimelineHeatmap(params: {
  year: number
  metric: TimelineMetric
  project?: string
}) {
  const { year, metric, project } = params
  const fromMs = isoDateToUtcMs(`${year}-01-01`)
  const toMs = isoDateToUtcMs(`${year}-12-31`)
  return useQuery({
    queryKey: ['timeline', 'heatmap', year, metric, project ?? null],
    queryFn: async () => {
      const r = await request<{ data: HeatmapPoint[] }>('timeline.heatmap', {
        from: fromMs,
        to: toMs,
        metric,
        ...(project ? { project } : {}),
      })
      return r.data
    },
  })
}

/**
 * Date-range variant of {@link useTimelineHeatmap}.
 */
export function useTimelineHeatmapRange(params: {
  from: string
  to: string
  metric: TimelineMetric
  project?: string
}) {
  const { from, to, metric, project } = params
  const fromMs = isoDateToUtcMs(from)
  const toMs = isoDateToUtcMs(to)
  return useQuery({
    queryKey: ['timeline', 'heatmap-range', from, to, metric, project ?? null],
    queryFn: async () => {
      const r = await request<{ data: HeatmapPoint[] }>('timeline.heatmap', {
        from: fromMs,
        to: toMs,
        metric,
        ...(project ? { project } : {}),
      })
      return r.data
    },
  })
}

/**
 * Query hook for paginated session events grouped by day.
 */
export function useTimelineEvents(params: { project?: string; year?: number }) {
  const { project, year } = params
  const args: Record<string, unknown> = { limit: 60 }
  if (project) {
    args.project = project
  }
  if (year !== undefined) {
    args.from = isoDateToUtcMs(`${year}-01-01`)
    args.to = isoDateToUtcMs(`${year}-12-31`)
  }
  return useQuery({
    queryKey: ['timeline', 'events', project ?? null, year ?? null],
    queryFn: async () => normalizeEvents(await request<unknown>('timeline.events', args)),
  })
}
