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

  it('fetch transport sends POST with JSON body for settings.set', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ success: true, path: '/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('settings.set', { content: { model: 'sonnet' } })
      expect(seen).toHaveLength(1)
      expect(seen[0].url).toBe('/api/settings')
      expect(seen[0].init?.method).toBe('POST')
      const body = JSON.parse(String(seen[0].init?.body ?? ''))
      expect(body).toEqual({ content: { model: 'sonnet' } })
      expect((seen[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport sends GET for settings.get with optional project query', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ exists: false, content: null, path: '/x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('settings.get', {})
      await fetchTransport('settings.get', { project: '/my/project' })
      expect(calls).toEqual([
        '/api/settings',
        '/api/settings?project=%2Fmy%2Fproject',
      ])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport sends DELETE for store.agents.delete', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.delete', { name: 'alpha' })
      expect(seen).toHaveLength(1)
      expect(seen[0].url).toBe('/api/store/agents/alpha')
      expect(seen[0].init?.method).toBe('DELETE')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport appends ?force=true on store.agents.delete with force', async () => {
    const seen: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      seen.push(url)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.delete', { name: 'alpha', force: true })
      expect(seen[0]).toBe('/api/store/agents/alpha?force=true')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport sends PUT with body for store.agents.update', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ agent: { id: 'a' } }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.update', {
        name: 'alpha',
        body: { frontmatter: { description: 'new' } },
      })
      expect(seen[0].url).toBe('/api/store/agents/alpha')
      expect(seen[0].init?.method).toBe('PUT')
      const body = JSON.parse(String(seen[0].init?.body ?? ''))
      expect(body).toEqual({ frontmatter: { description: 'new' } })
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport routes profiles.delete with DELETE method and path-param', async () => {
    const calls: { url: string, method?: string }[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('profiles.delete', { name: 'dev' })
      expect(calls).toEqual([{ url: '/api/profiles/dev', method: 'DELETE' }])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport routes plugins.get via the id path-param table', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ plugin: { id: 'gitlab@m' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('plugins.get', { id: 'gitlab@m' })
      expect(calls).toEqual(['/api/plugins/gitlab%40m'])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport routes profiles.activate with POST + empty body', async () => {
    const calls: { url: string, method?: string, body?: string }[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method,
        body: init?.body as string | undefined,
      })
      return new Response(JSON.stringify({ success: true, warnings: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('profiles.activate', { name: 'dev' })
      expect(calls).toEqual([{
        url: '/api/profiles/dev/activate',
        method: 'POST',
        body: '{}',
      }])
    }
    finally {
      globalThis.fetch = orig
    }
  })
})
