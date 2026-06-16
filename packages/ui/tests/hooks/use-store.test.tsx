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
  useCreateStoreCommand,
  useCreateStoreModelConfig,
  useCreateStoreSkill,
  useDeleteStoreAgent,
  useDeleteStoreCommand,
  useDeleteStoreModelConfig,
  useDeleteStoreSkill,
  useStoreAgent,
  useStoreAgents,
  useStoreCommand,
  useStoreCommands,
  useStoreModelConfig,
  useStoreModelConfigs,
  useStoreSkill,
  useStoreSkills,
  useUpdateStoreAgent,
  useUpdateStoreCommand,
  useUpdateStoreModelConfig,
  useUpdateStoreSkill,
} from '@/hooks/use-store'
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

describe('store skills — read and write', () => {
  it('get passes name, unwraps the skill, and stays disabled for null', async () => {
    let captured: unknown = null
    setMockHandler('store.skills.get', async (args) => {
      captured = args
      return { skill: { id: 'skill-1' } }
    })

    const { result } = renderHook(() => useStoreSkill('skill-1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'skill-1' })
    expect(result.current.data).toMatchObject({ id: 'skill-1' })

    const disabled = renderHook(() => useStoreSkill(null), { wrapper: wrapper() })
    expect(disabled.result.current.isFetched).toBe(false)
  })

  it('create, update, and delete call skill wire methods', async () => {
    const captured: unknown[] = []
    setMockHandler('store.skills.create', async (args) => {
      captured.push(['create', args])
      return { skill: { id: 'new-skill' } }
    })
    setMockHandler('store.skills.update', async (args) => {
      captured.push(['update', args])
      return { skill: { id: 'new-skill' } }
    })
    setMockHandler('store.skills.delete', async (args) => {
      captured.push(['delete', args])
      return { success: true }
    })

    const create = renderHook(() => useCreateStoreSkill(), { wrapper: wrapper() })
    await act(async () => {
      create.result.current.mutate({ frontmatter: { name: 'new-skill' }, content: 'body' } as never)
    })
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true))

    const update = renderHook(() => useUpdateStoreSkill(), { wrapper: wrapper() })
    await act(async () => {
      update.result.current.mutate({ name: 'new-skill', body: { content: 'updated' } } as never)
    })
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true))

    const remove = renderHook(() => useDeleteStoreSkill(), { wrapper: wrapper() })
    await act(async () => {
      remove.result.current.mutate({ name: 'new-skill', force: true } as never)
    })
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))

    expect(captured).toEqual([
      ['create', { body: { frontmatter: { name: 'new-skill' }, content: 'body' } }],
      ['update', { name: 'new-skill', body: { content: 'updated' } }],
      ['delete', { name: 'new-skill', force: true }],
    ])
  })
})

describe('store commands — read and write', () => {
  it('get passes name, unwraps the command, and stays disabled for null', async () => {
    let captured: unknown = null
    setMockHandler('store.commands.get', async (args) => {
      captured = args
      return { command: { id: 'cmd-1' } }
    })

    const { result } = renderHook(() => useStoreCommand('cmd-1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'cmd-1' })
    expect(result.current.data).toMatchObject({ id: 'cmd-1' })

    const disabled = renderHook(() => useStoreCommand(null), { wrapper: wrapper() })
    expect(disabled.result.current.isFetched).toBe(false)
  })

  it('create, update, and delete call command wire methods', async () => {
    const captured: unknown[] = []
    setMockHandler('store.commands.create', async (args) => {
      captured.push(['create', args])
      return { command: { id: 'new-command' } }
    })
    setMockHandler('store.commands.update', async (args) => {
      captured.push(['update', args])
      return { command: { id: 'new-command' } }
    })
    setMockHandler('store.commands.delete', async (args) => {
      captured.push(['delete', args])
      return { success: true }
    })

    const create = renderHook(() => useCreateStoreCommand(), { wrapper: wrapper() })
    await act(async () => {
      create.result.current.mutate({ frontmatter: { name: 'new-command' }, content: 'body' } as never)
    })
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true))

    const update = renderHook(() => useUpdateStoreCommand(), { wrapper: wrapper() })
    await act(async () => {
      update.result.current.mutate({ name: 'new-command', body: { content: 'updated' } } as never)
    })
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true))

    const remove = renderHook(() => useDeleteStoreCommand(), { wrapper: wrapper() })
    await act(async () => {
      remove.result.current.mutate({ name: 'new-command', force: false } as never)
    })
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))

    expect(captured).toEqual([
      ['create', { body: { frontmatter: { name: 'new-command' }, content: 'body' } }],
      ['update', { name: 'new-command', body: { content: 'updated' } }],
      ['delete', { name: 'new-command', force: false }],
    ])
  })
})

describe('store model configs — read and write', () => {
  it('get passes name, unwraps the config, and stays disabled for null', async () => {
    let captured: unknown = null
    setMockHandler('store.model_configs.get', async (args) => {
      captured = args
      return { modelConfig: { name: 'anthropic', apiKey: 'sk-secret', baseUrl: 'https://api.example.com' } }
    })

    const { result } = renderHook(() => useStoreModelConfig('anthropic'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'anthropic' })
    expect(result.current.data).toMatchObject({ name: 'anthropic' })

    const disabled = renderHook(() => useStoreModelConfig(null), { wrapper: wrapper() })
    expect(disabled.result.current.isFetched).toBe(false)
  })

  it('create, update, and delete call model config wire methods', async () => {
    const captured: unknown[] = []
    setMockHandler('store.model_configs.create', async (args) => {
      captured.push(['create', args])
      return { modelConfig: { name: 'anthropic' } }
    })
    setMockHandler('store.model_configs.update', async (args) => {
      captured.push(['update', args])
      return { modelConfig: { name: 'anthropic' } }
    })
    setMockHandler('store.model_configs.delete', async (args) => {
      captured.push(['delete', args])
      return { success: true }
    })

    const create = renderHook(() => useCreateStoreModelConfig(), { wrapper: wrapper() })
    await act(async () => {
      create.result.current.mutate({ name: 'anthropic', apiKey: 'sk', baseUrl: 'https://api.example.com' } as never)
    })
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true))

    const update = renderHook(() => useUpdateStoreModelConfig(), { wrapper: wrapper() })
    await act(async () => {
      update.result.current.mutate({ name: 'anthropic', body: { provider: 'anthropic' } } as never)
    })
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true))

    const remove = renderHook(() => useDeleteStoreModelConfig(), { wrapper: wrapper() })
    await act(async () => {
      remove.result.current.mutate({ name: 'anthropic', force: true } as never)
    })
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))

    expect(captured).toEqual([
      ['create', { body: { name: 'anthropic', apiKey: 'sk', baseUrl: 'https://api.example.com' } }],
      ['update', { name: 'anthropic', body: { provider: 'anthropic' } }],
      ['delete', { name: 'anthropic', force: true }],
    ])
  })
})
