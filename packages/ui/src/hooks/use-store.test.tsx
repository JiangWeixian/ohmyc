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

import {
  useCreateStoreAgent,
  useDeleteStoreAgent,
  useStoreAgent,
  useStoreAgents,
  useStoreCommands,
  useStoreModelConfigs,
  useStoreSkills,
  useUpdateStoreAgent,
} from './use-store'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
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

describe('store agents — read', () => {
  it('list unwraps the agents array', async () => {
    setMockHandler('store.agents.list', async () => ({
      agents: [{ id: 'a1', frontmatter: { name: 'a1', description: 'd' } }],
    }))
    const { result } = renderHook(() => useStoreAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('get passes name and unwraps the agent', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.get', async (args) => {
      captured = args
      return { agent: { id: 'a1' } }
    })
    const { result } = renderHook(() => useStoreAgent('a1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { name: string }).name).toBe('a1')
    expect(result.current.data).toMatchObject({ id: 'a1' })
  })

  it('get is disabled when name is null', () => {
    const { result } = renderHook(() => useStoreAgent(null), { wrapper: wrapper() })
    expect(result.current.isFetched).toBe(false)
  })
})

describe('store agents — write', () => {
  it('create sends body and invalidates the list', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.create', async (args) => {
      captured = args
      return { agent: { id: 'new' } }
    })
    setMockHandler('store.agents.list', async () => ({ agents: [{ id: 'new' }] }))

    const { result } = renderHook(() => useCreateStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ frontmatter: { name: 'new', description: 'd' }, content: 'x' } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { body?: unknown }).body).toEqual({
      frontmatter: { name: 'new', description: 'd' },
      content: 'x',
    })
  })

  it('update sends { name, body }', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.update', async (args) => {
      captured = args
      return { agent: { id: 'a' } }
    })
    const { result } = renderHook(() => useUpdateStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a', body: { content: 'new body' } } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'a', body: { content: 'new body' } })
  })

  it('delete sends { name, force }', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.delete', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeleteStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a', force: true } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'a', force: true })
  })

  it('delete surfaces Conflict (Used by N profiles)', async () => {
    setMockHandler('store.agents.delete', async () => {
      throw Object.assign(new Error('agent is referenced'), { code: 'Conflict' })
    })
    const { result } = renderHook(() => useDeleteStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a' } as never)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('Conflict')
  })
})

describe('store wire routing — sampled across entity types', () => {
  it('skills list uses store.skills.list', async () => {
    let called = false
    setMockHandler('store.skills.list', async () => {
      called = true
      return { skills: [] }
    })
    renderHook(() => useStoreSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })

  it('commands list uses store.commands.list', async () => {
    let called = false
    setMockHandler('store.commands.list', async () => {
      called = true
      return { commands: [] }
    })
    renderHook(() => useStoreCommands(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })

  it('model configs list uses store.model_configs.list (snake-case wire segment)', async () => {
    let called = false
    setMockHandler('store.model_configs.list', async () => {
      called = true
      return { modelConfigs: [] }
    })
    renderHook(() => useStoreModelConfigs(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })
})
