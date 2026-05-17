// Verifies useAgents threads the SourceSwitcher selection into ?origins= and the React Query cache key.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { useAgents } from './use-agents'

import type { ReactNode } from 'react'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useAgents origins query wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
    vi.restoreAllMocks()
  })

  it('omits ?origins= when all sources are selected', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ agents: [] }, { status: 200 }),
    )
    renderHook(() => useAgents(), { wrapper: makeWrapper() })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/agents')
  })

  it('appends sorted ?origins= when a subset is selected', async () => {
    useSources.setState({ selected: new Set(['claude']) })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ agents: [] }, { status: 200 }),
    )
    renderHook(() => useAgents(), { wrapper: makeWrapper() })
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/agents?origins=claude')
  })
})
