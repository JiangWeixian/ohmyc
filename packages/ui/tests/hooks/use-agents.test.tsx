import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useAgent, useAgents } from '@/hooks/use-agents'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { useSources } from '@/state/sources'

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
  useSources.setState({ selected: new Set(['claude', 'opencode']) })
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useAgents', () => {
  it('returns the agents array unwrapped from the response envelope', async () => {
    setMockHandler('agents.list', async () => ({
      agents: [{ id: 'a1', frontmatter: { name: 'a1', description: 'd' }, content: '', raw: '', filename: 'a1.md', source: 'local' }],
    }))
    const { result } = renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('a1')
  })

  it('does not pass origins when all sources are selected', async () => {
    let captured: unknown = null
    setMockHandler('agents.list', async (args) => {
      captured = args
      return { agents: [] }
    })
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(captured).not.toBeNull()
    })
    expect((captured as Record<string, unknown>).origins).toBeUndefined()
  })

  it('passes origins=claude when only claude is selected', async () => {
    useSources.setState({ selected: new Set(['claude']) })
    let captured: unknown = null
    setMockHandler('agents.list', async (args) => {
      captured = args
      return { agents: [] }
    })
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(captured).not.toBeNull()
    })
    expect((captured as { origins?: string }).origins).toBe('claude')
  })
})

describe('useAgent', () => {
  it('returns the agent unwrapped from the response envelope', async () => {
    setMockHandler('agents.get', async () => ({
      agent: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' },
    }))
    const { result } = renderHook(
      () => useAgent({ name: 'x' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('x')
  })

  it('forwards locator fields (source, pluginId, scope) as args', async () => {
    let captured: unknown = null
    setMockHandler('agents.get', async (args) => {
      captured = args
      return { agent: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' } }
    })
    renderHook(
      () => useAgent({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'global' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toEqual({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'global' })
  })

  it('is disabled when no locator is provided', async () => {
    const { result } = renderHook(() => useAgent(null), { wrapper: wrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetched).toBe(false)
  })
})
