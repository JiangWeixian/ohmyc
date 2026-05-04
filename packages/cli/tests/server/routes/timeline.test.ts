import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { timelineRoutes } from '@/server/routes/timeline'

describe('timeline routes', () => {
  let tmpDir: string
  let originalCuiHome: string | undefined
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-route-test-'))
    originalCuiHome = process.env.CUI_HOME
    process.env.CUI_HOME = tmpDir
    app = Fastify()
    await app.register(timelineRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    if (originalCuiHome === undefined) {
      delete process.env.CUI_HOME
    } else {
      process.env.CUI_HOME = originalCuiHome
    }
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/timeline/status returns 200 with sessionCount=0, lastSyncAt=null', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/status' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.sessionCount).toBe(0)
    expect(body.lastSyncAt).toBeNull()
  })

  it('GET /api/timeline/heatmap returns 400 for missing params', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/heatmap' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('from/to')
  })

  it('GET /api/timeline/heatmap returns 200 for valid params', async () => {
    const fromMs = Date.UTC(2026, 0, 1)
    const toMs = Date.UTC(2026, 0, 7)
    const res = await app.inject({
      method: 'GET',
      url: `/api/timeline/heatmap?from=${fromMs}&to=${toMs}&metric=sessions`,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data).toHaveLength(7)
    expect(data[0]).toEqual({ date: '2026-01-01', value: 0 })
    expect(data[6]).toEqual({ date: '2026-01-07', value: 0 })
  })

  it('GET /api/timeline/heatmap returns 400 for invalid metric', async () => {
    const fromMs = Date.UTC(2026, 0, 1)
    const toMs = Date.UTC(2026, 0, 7)
    const res = await app.inject({
      method: 'GET',
      url: `/api/timeline/heatmap?from=${fromMs}&to=${toMs}&metric=invalid`,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('metric')
  })

  it('GET /api/timeline/events returns empty days initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/events' })
    expect(res.statusCode).toBe(200)
    expect(res.json().days).toEqual([])
  })

  it('GET /api/timeline/events respects limit param', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/events?limit=abc' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('limit')
  })

  it('GET /api/timeline/projects returns empty array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/projects' })
    expect(res.statusCode).toBe(200)
    expect(res.json().projects).toEqual([])
  })

  it('GET /api/timeline/years returns empty array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/years' })
    expect(res.statusCode).toBe(200)
    expect(res.json().years).toEqual([])
  })

  it('GET /api/timeline/sessions/:id returns 404 for nonexistent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/timeline/sessions/nonexistent' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toContain('Session not found')
  })
})
