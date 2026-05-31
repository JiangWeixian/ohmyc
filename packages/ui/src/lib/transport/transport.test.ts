import { afterEach, describe, expect, it } from 'vitest'

import { resetMock, setMockHandler } from './mock'
import { __setTransportForTests, request, resetTransportForTests } from '../transport'

describe('transport seam', () => {
  afterEach(() => {
    resetMock()
    resetTransportForTests()
  })

  it('routes wire name to mock handler in tests', async () => {
    setMockHandler('profiles.list', async () => [{ name: 'default' }])
    __setTransportForTests('mock')

    const result = await request<Array<{ name: string }>>('profiles.list', {})

    expect(result).toEqual([{ name: 'default' }])
  })

  it('propagates handler arguments to the mock', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return []
    })
    __setTransportForTests('mock')

    await request('timeline.heatmap', { year: 2026, metric: 'tokens' })

    expect(captured).toEqual({ year: 2026, metric: 'tokens' })
  })

  it('rejects with ApiError shape when handler throws', async () => {
    setMockHandler('profiles.get', async () => {
      throw Object.assign(new Error('missing'), {
        code: 'NotFound',
        detail: { kind: 'profile', name: 'x' },
      })
    })
    __setTransportForTests('mock')

    await expect(request('profiles.get', { name: 'x' })).rejects.toMatchObject({
      code: 'NotFound',
      message: 'missing',
      detail: { kind: 'profile', name: 'x' },
    })
  })

  it('throws when no handler is registered for a wire name', async () => {
    __setTransportForTests('mock')

    await expect(request('unknown.op', {})).rejects.toMatchObject({
      code: 'Internal',
    })
  })

  it('fetch transport routes timeline.session via the path-param table', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('timeline.session', { id: 'abc-123' })
      expect(calls).toEqual(['/api/timeline/sessions/abc-123'])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport falls back to naive dotted path when wire has no entry', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('foo.bar', {})
      expect(calls).toEqual(['/api/foo/bar'])
    }
    finally {
      globalThis.fetch = orig
    }
  })
})
