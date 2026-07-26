import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { useFsChanged } from '@/hooks/use-fs-changed'

const bridgeMock = vi.hoisted(() => ({
  state: {
    handler: null as ((payload: unknown) => void) | null,
  },
  unlisten: vi.fn(),
}))

vi.mock('@/lib/tauri-event-bridge', () => ({
  subscribe: vi.fn(async (_event: string, handler: (payload: unknown) => void) => {
    bridgeMock.state.handler = handler
    return bridgeMock.unlisten
  }),
}))

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

afterEach(() => {
  bridgeMock.state.handler = null
  bridgeMock.unlisten.mockClear()
  vi.clearAllMocks()
})

describe('useFsChanged', () => {
  it('invalidates provider resources after provider config changes', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useFsChanged(), { wrapper: wrapper(client) })

    await waitFor(() => expect(bridgeMock.state.handler).not.toBeNull())

    act(() => {
      bridgeMock.state.handler?.({
        kind: 'provider_config',
        path: '/home/alice/.codex/agents/reviewer.toml',
      })
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['agents'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['skills'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['commands'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plugins'] })
  })
})
