import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  useHooks,
  useLspServers,
  useMcpServers,
} from '@/hooks/use-configs'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe('useMcpServers', () => {
  it('returns the mcpServers array selected from the envelope', async () => {
    setMockHandler('configs.mcp', async () => ({
      mcpServers: [
        { name: 'github', config: { command: 'gh' }, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useMcpServers(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].name).toBe('github')
  })
})

describe('useHooks', () => {
  it('returns the hooks array selected from the envelope', async () => {
    setMockHandler('configs.hooks', async () => ({
      hooks: [
        { event: 'PreToolUse', name: 'PreToolUse [0]', data: {}, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useHooks(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].event).toBe('PreToolUse')
  })
})

describe('useLspServers', () => {
  it('returns the lspServers array selected from the envelope', async () => {
    setMockHandler('configs.lsp', async () => ({
      lspServers: [
        { name: 'rust-analyzer', config: { command: 'ra' }, source: 'local', scope: 'global' },
      ],
    }))
    const { result } = renderHook(() => useLspServers(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].name).toBe('rust-analyzer')
  })
})
