import { afterEach, describe, expect, it } from 'vitest'

import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests, request, resetTransportForTests } from '@/lib/transport'

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
})
