import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useSettings } from './use-settings'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useSettings', () => {
  it('returns the settings response shape on read', async () => {
    setMockHandler('settings.get', async () => ({
      path: '/home/me/.claude/settings.json',
      content: { model: 'sonnet-4' },
      exists: true,
    }))
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.exists).toBe(true)
    expect(result.current.data?.content).toEqual({ model: 'sonnet-4' })
  })

  it('passes project arg when provided', async () => {
    let captured: unknown = null
    setMockHandler('settings.get', async (args) => {
      captured = args
      return { path: '/x', content: null, exists: false }
    })
    renderHook(() => useSettings('/path/to/project'), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { project?: string }).project).toBe('/path/to/project')
  })

  it('omits project arg when not provided', async () => {
    let captured: unknown = null
    setMockHandler('settings.get', async (args) => {
      captured = args
      return { path: '/x', content: null, exists: false }
    })
    renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { project?: string }).project).toBeUndefined()
  })

  it('sends content via the save mutation', async () => {
    setMockHandler('settings.get', async () => ({ path: '/x', content: null, exists: false }))
    let sent: unknown = null
    setMockHandler('settings.set', async (args) => {
      sent = args
      return { success: true, path: '/x' }
    })
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.mutate({ model: 'opus' } as never)
    })
    await waitFor(() => expect(result.current.saveData).toBeDefined())
    expect((sent as { content?: unknown }).content).toEqual({ model: 'opus' })
  })

  it('surfaces save errors via saveError', async () => {
    setMockHandler('settings.get', async () => ({ path: '/x', content: null, exists: false }))
    setMockHandler('settings.set', async () => {
      throw Object.assign(new Error('content must be a JSON object'), { code: 'Validation' })
    })
    const { result } = renderHook(() => useSettings(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.mutate('not-an-object' as never)
    })
    await waitFor(() => expect(result.current.saveError).toBeTruthy())
  })
})
