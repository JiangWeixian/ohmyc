// Timeline analytics REST API — exposes heatmap, events, session detail, projects, years, and sync status.
import {
  closeDatabase,
  getEvents,
  getHeatmap,
  getProjects,
  getSession,
  getStatus,
  getYears,
  openDatabase,
} from '@ohmyc/timeline'

import type { FastifyPluginAsync } from 'fastify'

/** Converts a Unix timestamp (ms) into a UTC `YYYY-MM-DD` string for SQLite queries. */
function msToDate(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Allowed aggregation metrics for the heatmap endpoint. */
const VALID_METRICS = ['sessions', 'turns', 'tokens'] as const

/**
 * Registers timeline analytics routes backed by the SQLite database.
 * Each route opens its own DB connection and closes it in a finally block.
 */
export const timelineRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/timeline/heatmap?from=<ms>&to=<ms>&metric=<sessions|turns|tokens>&project=<optional>
  fastify.get<{
    Querystring: {
      from: string
      to: string
      metric: string
      project?: string
    }
  }>('/api/timeline/heatmap', async (request, reply) => {
    const fromMs = Number(request.query.from)
    const toMs = Number(request.query.to)
    const metric = request.query.metric
    const project = request.query.project

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      return reply.status(400).send({ error: 'Invalid from/to: must be numbers' })
    }

    if (!VALID_METRICS.includes(metric as typeof VALID_METRICS[number])) {
      return reply.status(400).send({ error: `Invalid metric: must be one of ${VALID_METRICS.join(', ')}` })
    }

    const db = openDatabase()
    try {
      const data = getHeatmap(db, {
        from: msToDate(fromMs),
        to: msToDate(toMs),
        metric: metric as typeof VALID_METRICS[number],
        project,
      })
      return { data }
    } finally {
      closeDatabase(db)
    }
  })

  // GET /api/timeline/events?from=<ms>&to=<ms>&project=<optional>&limit=<n>&cursor=<YYYY-MM-DD>
  fastify.get<{
    Querystring: {
      from?: string
      to?: string
      project?: string
      limit?: string
      cursor?: string
    }
  }>('/api/timeline/events', async (request, reply) => {
    const fromMs = request.query.from === undefined ? undefined : Number(request.query.from)
    const toMs = request.query.to === undefined ? undefined : Number(request.query.to)
    const limit = request.query.limit === undefined ? undefined : Number(request.query.limit)
    const cursor = request.query.cursor
    const project = request.query.project

    if (fromMs !== undefined && Number.isNaN(fromMs)) {
      return reply.status(400).send({ error: 'Invalid from: must be a number' })
    }
    if (toMs !== undefined && Number.isNaN(toMs)) {
      return reply.status(400).send({ error: 'Invalid to: must be a number' })
    }
    if (limit !== undefined && (Number.isNaN(limit) || limit <= 0 || !Number.isInteger(limit))) {
      return reply.status(400).send({ error: 'Invalid limit: must be a positive integer' })
    }

    const db = openDatabase()
    try {
      const result = getEvents(db, {
        from: fromMs === undefined ? undefined : msToDate(fromMs),
        to: toMs === undefined ? undefined : msToDate(toMs),
        project,
        limit,
        cursor,
      })
      return result
    } finally {
      closeDatabase(db)
    }
  })

  // GET /api/timeline/sessions/:id
  fastify.get<{ Params: { id: string } }>('/api/timeline/sessions/:id', async (request, reply) => {
    const db = openDatabase()
    try {
      const session = getSession(db, request.params.id)
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' })
      }
      return session
    } finally {
      closeDatabase(db)
    }
  })

  // GET /api/timeline/projects
  fastify.get('/api/timeline/projects', async () => {
    const db = openDatabase()
    try {
      const projects = getProjects(db)
      return { projects }
    } finally {
      closeDatabase(db)
    }
  })

  // GET /api/timeline/years
  fastify.get('/api/timeline/years', async () => {
    const db = openDatabase()
    try {
      const years = getYears(db)
      return { years }
    } finally {
      closeDatabase(db)
    }
  })

  // GET /api/timeline/status
  fastify.get('/api/timeline/status', async () => {
    const db = openDatabase()
    try {
      const status = getStatus(db)
      return {
        sessionCount: status.sessionCount,
        lastSyncAt: status.lastSyncAt ?? null,
      }
    } finally {
      closeDatabase(db)
    }
  })
}
