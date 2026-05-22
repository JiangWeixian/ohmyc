import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { useTimelineHeatmapRange } from './use-timeline'

import type { ReactNode } from 'react'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useTimelineHeatmapRange', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('queries the heatmap endpoint with from/to milliseconds and the metric', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ date: '2026-05-22', value: 42 }] }),
    } as Response)

    const { result } = renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-16', to: '2026-05-22', metric: 'tokens' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchSpy).toHaveBeenCalledOnce()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('/api/timeline/heatmap?')
    expect(url).toContain('metric=tokens')
    expect(url).toContain(`from=${Date.UTC(2026, 4, 16)}`)
    expect(url).toContain(`to=${Date.UTC(2026, 4, 22)}`)
    expect(result.current.data).toEqual([{ date: '2026-05-22', value: 42 }])
  })

  it('omits project from the URL when not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-22', to: '2026-05-22', metric: 'sessions' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('project=')
  })

  it('includes project in the URL when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    renderHook(
      () => useTimelineHeatmapRange({ from: '2026-05-22', to: '2026-05-22', metric: 'sessions', project: 'foo' }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('project=foo')
  })
})
