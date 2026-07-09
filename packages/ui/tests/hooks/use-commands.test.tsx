import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useCommand, useCommands } from '@/hooks/use-commands'
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
  useSources.setState({ selected: new Set(['codex', 'claude', 'opencode']) })
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useCommands', () => {
  it('returns the commands array unwrapped from the response envelope', async () => {
    setMockHandler('commands.list', async () => ({
      commands: [{ id: 'c1', frontmatter: { name: 'build', description: 'Build' }, content: '', raw: '', filename: 'build.md', source: 'local' }],
    }))
    const { result } = renderHook(() => useCommands(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].frontmatter.name).toBe('build')
  })

  it('does not pass origins when all sources are selected', async () => {
    let captured: unknown = null
    setMockHandler('commands.list', async (args) => {
      captured = args
      return { commands: [] }
    })
    renderHook(() => useCommands(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as Record<string, unknown>).origins).toBeUndefined()
  })

  it('passes origins=opencode when only opencode is selected', async () => {
    useSources.setState({ selected: new Set(['opencode']) })
    let captured: unknown = null
    setMockHandler('commands.list', async (args) => {
      captured = args
      return { commands: [] }
    })
    renderHook(() => useCommands(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { origins?: string }).origins).toBe('opencode')
  })
})

describe('useCommand', () => {
  it('returns the command unwrapped from the response envelope', async () => {
    setMockHandler('commands.get', async () => ({
      command: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' },
    }))
    const { result } = renderHook(() => useCommand({ name: 'x' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('x')
  })

  it('forwards locator fields as args', async () => {
    let captured: unknown = null
    setMockHandler('commands.get', async (args) => {
      captured = args
      return { command: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' } }
    })
    renderHook(
      () => useCommand({ name: 'x', locatorId: 'commands:opencode:local:global:none:x:abc', source: 'plugin', pluginId: 'p1', scope: 'project' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toEqual({
      name: 'x',
      locator_id: 'commands:opencode:local:global:none:x:abc',
      source: 'plugin',
      pluginId: 'p1',
      scope: 'project',
    })
  })

  it('is disabled when no locator is provided', () => {
    const { result } = renderHook(() => useCommand(null), { wrapper: wrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetched).toBe(false)
  })
})
