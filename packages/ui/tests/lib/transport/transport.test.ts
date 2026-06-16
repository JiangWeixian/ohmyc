import { afterEach, describe, expect, it } from 'vitest'

import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests, request, resetTransportForTests } from '@/lib/transport'

describe('transport seam', () => {
  afterEach(() => {
    resetMock()
    resetTransportForTests()
  })

  it('routes wire name to mock handler in tests', async () => {
    setMockHandler('settings.get', async () => ({ settings: { theme: 'dark' } }))
    __setTransportForTests('mock')

    const result = await request<{ settings: { theme: string } }>('settings.get', {})

    expect(result).toEqual({ settings: { theme: 'dark' } })
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
    setMockHandler('settings.get', async () => {
      throw Object.assign(new Error('missing'), {
        code: 'NotFound',
        detail: { kind: 'settings', name: 'user' },
      })
    })
    __setTransportForTests('mock')

    await expect(request('settings.get', {})).rejects.toMatchObject({
      code: 'NotFound',
      message: 'missing',
      detail: { kind: 'settings', name: 'user' },
    })
  })

  it('throws when no handler is registered for a wire name', async () => {
    __setTransportForTests('mock')

    await expect(request('unknown.op', {})).rejects.toMatchObject({
      code: 'Internal',
    })
  })
})
