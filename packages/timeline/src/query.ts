// ============================================================
// @ohmyc/timeline — Read-only Query Functions
// Provides heatmap, paginated events, session detail, project
// list, year list, and sync-status queries against the SQLite DB.
// ============================================================

import type {
  DayEvents,
  EventsParams,
  EventsResult,
  HeatmapParams,
  HeatmapPoint,
  ProjectGroup,
  SessionDetail,
  SessionRow,
} from './schema.js'
import type { SqliteDatabase } from './writer.js'

// ------------------------------------------------------------------
// Date helpers (YYYY-MM-DD <-> milliseconds)
// All conversions use UTC to avoid timezone-dependent results.
// ------------------------------------------------------------------

function dateToMs(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  )
}

function msToDate(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const start = dateToMs(from)
  const end = dateToMs(to)
  for (let t = start; t <= end; t += 86_400_000) {
    dates.push(msToDate(t))
  }
  return dates
}

// ------------------------------------------------------------------
// Heatmap
// ------------------------------------------------------------------

/**
 * Returns daily aggregate values for a date range, suitable for a heatmap chart.
 * Gaps in the range are filled with `0` values. Supports sessions, turns, or
 * tokens as the aggregation metric, with optional project filtering.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @param params - Date range, metric, and optional project filter.
 * @returns One {@link HeatmapPoint} per day in the range, zero-filled.
 */
export function getHeatmap(
  db: SqliteDatabase,
  params: HeatmapParams,
): HeatmapPoint[] {
  const { from, to, metric, project } = params
  const dates = generateDateRange(from, to)
  if (dates.length === 0) {
    return []
  }

  const startMs = dateToMs(from)
  // End-of-day boundary: subtracting 1ms from the next midnight includes the entire last day
  const endMs = dateToMs(to) + 86_400_000 - 1

  let selectMetric: string
  switch (metric) {
    case 'sessions': {
      selectMetric = 'COUNT(*)'
      break
    }
    case 'turns': {
      selectMetric = 'SUM(turns)'
      break
    }
    case 'tokens': {
      selectMetric = 'SUM(tokens_input + tokens_output + tokens_cached)'
      break
    }
    default: {
      throw new Error(`Unknown metric: ${metric}`)
    }
  }

  const projectFilter = project ? 'AND project = ?' : ''
  const sql = `
    SELECT
      date(started_at / 1000, 'unixepoch') AS day,
      ${selectMetric} AS value
    FROM sessions
    WHERE started_at >= ? AND started_at <= ? ${projectFilter}
    GROUP BY day
  `

  const args = project
    ? [startMs, endMs, project]
    : [startMs, endMs]

  const rows = db.prepare(sql).all(...args) as { day: string; value: number | null }[]
  const valueMap = new Map(rows.map(r => [r.day, r.value ?? 0]))

  return dates.map(date => ({
    date,
    value: valueMap.get(date) ?? 0,
  }))
}

// ------------------------------------------------------------------
// Events (paginated session list grouped by day / project)
// ------------------------------------------------------------------

/**
 * Returns sessions grouped by calendar day and project, paginated by day
 * (newest first). Each page contains up to `limit` distinct days. The
 * `nextCursor` value is the last day string in the page — pass it as
 * `cursor` to fetch the next page.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @param params - Filter, pagination, and limit options.
 * @returns Days with nested project groups and a cursor for the next page.
 */
export function getEvents(
  db: SqliteDatabase,
  params: EventsParams = {},
): EventsResult {
  const { from, to, project, limit = 30, cursor } = params

  // Build WHERE clause for sessions
  const conditions: string[] = []
  const args: (number | string)[] = []

  if (from !== undefined) {
    conditions.push('started_at >= ?')
    args.push(dateToMs(from))
  }
  if (to !== undefined) {
    conditions.push('started_at <= ?')
    // End-of-day boundary: subtracting 1ms from the next midnight includes the entire last day
    args.push(dateToMs(to) + 86_400_000 - 1)
  }
  if (project !== undefined) {
    conditions.push('project = ?')
    args.push(project)
  }
  if (cursor !== undefined) {
    conditions.push("date(started_at / 1000, 'unixepoch') < ?")
    args.push(cursor)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 1. Fetch distinct days (newest first), limit + 1 to detect next page
  // Using date() in SQLite converts the millisecond timestamp to YYYY-MM-DD
  const daySql = `
    SELECT DISTINCT date(started_at / 1000, 'unixepoch') AS day
    FROM sessions
    ${whereClause}
    ORDER BY day DESC
    LIMIT ?
  `
  const dayRows = db.prepare(daySql).all(...args, limit + 1) as { day: string }[]

  const hasMore = dayRows.length > limit
  const dayBatch = hasMore ? dayRows.slice(0, limit) : dayRows
  const days = dayBatch.map(r => r.day)

  if (days.length === 0) {
    return { days: [] }
  }

  // 2. Fetch all sessions for those days
  const placeholders = days.map(() => '?').join(', ')
  const projectSessionFilter = project ? 'AND project = ?' : ''
  const sessionSql = `
    SELECT * FROM sessions
    WHERE date(started_at / 1000, 'unixepoch') IN (${placeholders}) ${projectSessionFilter}
    ORDER BY started_at DESC
  `
  const sessionArgs = project ? [...days, project] : days
  const sessions = db.prepare(sessionSql).all(...sessionArgs) as SessionRow[]

  // 3. Group by day, then project
  const dayMap = new Map<string, Map<string, ProjectGroup>>()
  for (const session of sessions) {
    const day = msToDate(session.started_at)
    if (!dayMap.has(day)) {
      dayMap.set(day, new Map())
    }
    const projects = dayMap.get(day)!
    if (!projects.has(session.project)) {
      projects.set(session.project, {
        project: session.project,
        sessions: [],
        session_count: 0,
        turn_count: 0,
        token_count: 0,
        tool_count: 0,
        skill_count: 0,
        agents: [],
      })
    }
    const group = projects.get(session.project)!
    group.sessions.push(session)
    group.session_count += 1
    group.turn_count += session.turns
    group.token_count += session.tokens_input + session.tokens_output + session.tokens_cached
    if (session.agent_name && !group.agents.includes(session.agent_name)) {
      group.agents.push(session.agent_name)
    }
  }

  // 4. Add tool / skill counts per project group
  for (const projects of dayMap.values()) {
    const sessionIds = [...projects.values()].flatMap(g => g.sessions.map(s => s.session_id))
    if (sessionIds.length === 0) {
      continue
    }

    const idPlaceholders = sessionIds.map(() => '?').join(', ')

    const toolRows = db.prepare(
      `SELECT session_id, SUM(call_count) AS cnt FROM session_tools WHERE session_id IN (${idPlaceholders}) GROUP BY session_id`,
    ).all(...sessionIds) as { session_id: string; cnt: number }[]

    const skillRows = db.prepare(
      `SELECT session_id, COUNT(*) AS cnt FROM session_skills WHERE session_id IN (${idPlaceholders}) GROUP BY session_id`,
    ).all(...sessionIds) as { session_id: string; cnt: number }[]

    const toolMap = new Map(toolRows.map(r => [r.session_id, r.cnt]))
    const skillMap = new Map(skillRows.map(r => [r.session_id, r.cnt]))

    for (const group of projects.values()) {
      group.tool_count = group.sessions.reduce((sum, s) => sum + (toolMap.get(s.session_id) ?? 0), 0)
      group.skill_count = group.sessions.reduce((sum, s) => sum + (skillMap.get(s.session_id) ?? 0), 0)
    }
  }

  // 5. Build result in correct order (days desc, projects by first session desc)
  const dayEvents: DayEvents[] = []
  for (const day of days) {
    const projects = dayMap.get(day)
    if (!projects) {
      continue
    }

    const projectGroups = [...projects.values()]
    // Sort projects by the started_at of their first session (newest first)
    projectGroups.sort((a, b) => {
      const aFirst = a.sessions[0]?.started_at ?? 0
      const bFirst = b.sessions[0]?.started_at ?? 0
      return bFirst - aFirst
    })

    dayEvents.push({
      day,
      projectGroups,
      session_count: projectGroups.reduce((s, g) => s + g.session_count, 0),
      turn_count: projectGroups.reduce((s, g) => s + g.turn_count, 0),
      token_count: projectGroups.reduce((s, g) => s + g.token_count, 0),
    })
  }

  return {
    days: dayEvents,
    nextCursor: hasMore ? days.at(-1) : undefined,
  }
}

// ------------------------------------------------------------------
// Single session (with tools + skills)
// ------------------------------------------------------------------

/**
 * Returns a single session enriched with its tool usage and skill invocation
 * records. Returns `null` if the session ID is not found.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @param sessionId - The session UUID to look up.
 * @returns The session with tools and skills, or `null`.
 */
export function getSession(
  db: SqliteDatabase,
  sessionId: string,
): SessionDetail | null {
  const session = db
    .prepare('SELECT * FROM sessions WHERE session_id = ?')
    .get(sessionId) as SessionRow | undefined

  if (!session) {
    return null
  }

  const tools = db
    .prepare('SELECT * FROM session_tools WHERE session_id = ?')
    .all(sessionId) as SessionDetail['tools']

  const skills = db
    .prepare('SELECT * FROM session_skills WHERE session_id = ?')
    .all(sessionId) as SessionDetail['skills']

  return { ...session, tools, skills }
}

// ------------------------------------------------------------------
// Projects list
// ------------------------------------------------------------------

/**
 * Returns all distinct project names that have at least one session, sorted alphabetically.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @returns Sorted array of project names.
 */
export function getProjects(db: SqliteDatabase): string[] {
  const rows = db
    .prepare('SELECT DISTINCT project FROM sessions ORDER BY project')
    .all() as { project: string }[]

  return rows.map(r => r.project)
}

// ------------------------------------------------------------------
// Years list
// ------------------------------------------------------------------

/**
 * Returns all distinct years that contain sessions, sorted ascending.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @returns Sorted array of years (e.g. `[2024, 2025]`).
 */
export function getYears(db: SqliteDatabase): number[] {
  const rows = db
    .prepare("SELECT DISTINCT CAST(strftime('%Y', started_at / 1000, 'unixepoch') AS INTEGER) AS year FROM sessions ORDER BY year")
    .all() as { year: number }[]

  return rows.map(r => r.year)
}

// ------------------------------------------------------------------
// Status
// ------------------------------------------------------------------

/**
 * Returns database status: total session count and timestamp of the last sync (if any).
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @returns Session count and optional last-sync timestamp (epoch ms).
 */
export function getStatus(db: SqliteDatabase): { sessionCount: number; lastSyncAt?: number } {
  const countRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM sessions')
    .get() as { cnt: number }

  const syncRow = db
    .prepare("SELECT value FROM meta WHERE key = 'last_sync_at'")
    .get() as { value: string } | undefined

  return {
    sessionCount: countRow.cnt,
    lastSyncAt: syncRow ? Number.parseInt(syncRow.value, 10) : undefined,
  }
}
