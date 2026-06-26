import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useSetupStatus } from '@/hooks/use-setup-status'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSetupStatus', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('returns ready state from the setup.status transport call', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ state: 'ready' })
  })

  it('returns missing_store state', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('missing_store')
  })

  it('returns unreadable_store with reason', async () => {
    setMockHandler('setup.status', async () => ({
      state: 'unreadable_store',
      reason: 'schema could not be read',
    }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      state: 'unreadable_store',
      reason: 'schema could not be read',
    })
  })

  it('refetches when refetch is called (Retry action)', async () => {
    let calls = 0
    let state = 'missing_store'
    setMockHandler('setup.status', async () => {
      calls += 1
      return { state }
    })
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.data?.state).toBe('missing_store'))
    // Simulate the user installing the plugin then pressing Retry.
    state = 'ready'
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.data?.state).toBe('ready'))
    expect(calls).toBe(2)
  })
})
