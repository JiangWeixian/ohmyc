import { useQuery } from '@tanstack/react-query'

export type TimelineMetric = 'sessions' | 'tokens' | 'turns'

export interface HeatmapPoint {
  date: string
  value: number
}

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
}

export interface ProjectGroup {
  project: string
  sessions: SessionRow[]
  session_count: number
  turn_count: number
  token_count: number
  tool_count: number
  skill_count: number
}

export interface DayEvents {
  day: string
  projectGroups: ProjectGroup[]
  session_count: number
  turn_count: number
  token_count: number
}

export interface EventsResult {
  days: DayEvents[]
  nextCursor?: string
}

export interface TimelineStatus {
  sessionCount: number
  lastSyncAt: number | null
}

function isoDateToUtcMs(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  )
}

async function fetchJson<TResult>(url: string): Promise<TResult> {
  const r = await fetch(url)
  if (!r.ok) {
    throw new Error(`Request failed: ${url} (${r.status})`)
  }
  return r.json() as Promise<TResult>
}

export function useTimelineYears() {
  return useQuery({
    queryKey: ['timeline', 'years'],
    queryFn: () => fetchJson<{ years: number[] }>('/api/timeline/years').then(r => r.years),
  })
}

export function useTimelineProjects() {
  return useQuery({
    queryKey: ['timeline', 'projects'],
    queryFn: () =>
      fetchJson<{ projects: string[] }>('/api/timeline/projects').then(r => r.projects),
  })
}

export function useTimelineStatus() {
  return useQuery({
    queryKey: ['timeline', 'status'],
    queryFn: () => fetchJson<TimelineStatus>('/api/timeline/status'),
  })
}

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
