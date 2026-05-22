// React Query hooks for timeline analytics — heatmap, events, years, projects, and sync status.
import { useQuery } from '@tanstack/react-query'

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

/** Generic JSON fetch helper for timeline endpoints. */
async function fetchJson<TResult>(url: string): Promise<TResult> {
  const r = await fetch(url)
  if (!r.ok) {
    throw new Error(`Request failed: ${url} (${r.status})`)
  }
  return r.json() as Promise<TResult>
}

/** Query hook for the list of years that have timeline data. */
export function useTimelineYears() {
  return useQuery({
    queryKey: ['timeline', 'years'],
    queryFn: () => fetchJson<{ years: number[] }>('/api/timeline/years').then(r => r.years),
  })
}

/** Query hook for the list of projects with timeline data. */
export function useTimelineProjects() {
  return useQuery({
    queryKey: ['timeline', 'projects'],
    queryFn: () =>
      fetchJson<{ projects: string[] }>('/api/timeline/projects').then(r => r.projects),
  })
}

/** Query hook for timeline database status (session count and last sync). */
export function useTimelineStatus() {
  return useQuery({
    queryKey: ['timeline', 'status'],
    queryFn: () => fetchJson<TimelineStatus>('/api/timeline/status'),
  })
}

/**
 * Query hook for the yearly heatmap data.
 * @param params.year - Year to fetch heatmap for.
 * @param params.metric - Aggregation metric (`sessions`, `tokens`, or `turns`).
 * @param params.project - Optional project filter.
 */
export function useTimelineHeatmap(params: {
  year: number
  metric: TimelineMetric
  project?: string
}) {
  const { year, metric, project } = params
  const fromMs = isoDateToUtcMs(`${year}-01-01`)
  const toMs = isoDateToUtcMs(`${year}-12-31`)
  const qs = new URLSearchParams({
    from: String(fromMs),
    to: String(toMs),
    metric,
  })
  if (project) {
    qs.set('project', project)
  }
  return useQuery({
    queryKey: ['timeline', 'heatmap', year, metric, project ?? null],
    queryFn: () =>
      fetchJson<{ data: HeatmapPoint[] }>(`/api/timeline/heatmap?${qs.toString()}`).then(
        r => r.data,
      ),
  })
}

/**
 * Date-range variant of {@link useTimelineHeatmap}. Accepts arbitrary
 * ISO date strings (`YYYY-MM-DD`). Used by the menubar popover, which
 * needs a 7-day window not aligned to a calendar year.
 *
 * @param params.from - Inclusive start date (ISO YYYY-MM-DD).
 * @param params.to - Inclusive end date (ISO YYYY-MM-DD).
 * @param params.metric - Which metric to aggregate.
 * @param params.project - Optional project filter.
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
  const qs = new URLSearchParams({
    from: String(fromMs),
    to: String(toMs),
    metric,
  })
  if (project) {
    qs.set('project', project)
  }
  return useQuery({
    queryKey: ['timeline', 'heatmap-range', from, to, metric, project ?? null],
    queryFn: () =>
      fetchJson<{ data: HeatmapPoint[] }>(`/api/timeline/heatmap?${qs.toString()}`).then(
        r => r.data,
      ),
  })
}

/**
 * Query hook for paginated session events grouped by day.
 * @param params.project - Optional project filter.
 * @param params.year - Optional year filter.
 */
export function useTimelineEvents(params: { project?: string; year?: number }) {
  const { project, year } = params
  const qs = new URLSearchParams()
  if (project) {
    qs.set('project', project)
  }
  if (year !== undefined) {
    qs.set('from', String(isoDateToUtcMs(`${year}-01-01`)))
    qs.set('to', String(isoDateToUtcMs(`${year}-12-31`)))
  }
  qs.set('limit', '60')
  return useQuery({
    queryKey: ['timeline', 'events', project ?? null, year ?? null],
    queryFn: () => fetchJson<EventsResult>(`/api/timeline/events?${qs.toString()}`),
  })
}
