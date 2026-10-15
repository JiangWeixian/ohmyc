import { QueryClientProvider } from '@tanstack/react-query'
import { __emitForTests, __resetListenersForTests } from '@tauri-apps/api/event'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { createTestQueryClient } from '../test/render-with-providers'
import { useQuota } from '@/hooks/use-quota'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { quotaSnapshots, quotaSnapshotsLoggedOut } from '@/stories/fixtures/quota'

import type { PropsWithChildren } from 'react'

function renderUseQuota() {
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useQuota(), { wrapper })
}

describe('useQuota', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
    __resetListenersForTests()
  })

  it('loads snapshots through quota.list', async () => {
    setMockHandler('quota.list', async () => quotaSnapshots())
    const { result } = renderUseQuota()
    await waitFor(() => expect(result.current.data?.length).toBe(8))
  })

  it('applies a quota:changed array payload straight into the cache', async () => {
    let listCalls = 0
    setMockHandler('quota.list', async () => {
      listCalls += 1
      return quotaSnapshots()
    })
    const { result } = renderUseQuota()
    await waitFor(() => expect(result.current.data?.length).toBe(8))
    expect(listCalls).toBe(1)

    // The backend pushes full snapshots on every poll — the cache must swap
    // without a refetch round-trip.
    __emitForTests('quota:changed', quotaSnapshotsLoggedOut())
    await waitFor(() => expect(result.current.data?.every(s => s.status === 'notLoggedIn')).toBe(true))
    expect(listCalls).toBe(1)
  })

  it('invalidates (refetches) on a non-array quota:changed payload', async () => {
    let listCalls = 0
    setMockHandler('quota.list', async () => {
      listCalls += 1
      return quotaSnapshots()
    })
    const { result } = renderUseQuota()
    await waitFor(() => expect(result.current.data?.length).toBe(8))
    expect(listCalls).toBe(1)

    __emitForTests('quota:changed', null)
    await waitFor(() => expect(listCalls).toBe(2))
  })
})
