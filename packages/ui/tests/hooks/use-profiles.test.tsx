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
  useActivateProfile,
  useCreateProfile,
  useDeactivateProfile,
  useDeleteProfile,
  usePreflight,
  useProfile,
  useProfiles,
  useUpdateProfile,
} from '@/hooks/use-profiles'
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

describe('useProfiles — read', () => {
  it('list returns { profiles, active } envelope verbatim', async () => {
    setMockHandler('profiles.list', async () => ({
      profiles: [
        { name: 'dev', agents: [], skills: [], commands: [], plugins: [] },
      ],
      active: 'dev',
    }))
    const { result } = renderHook(() => useProfiles(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.active).toBe('dev')
    expect(result.current.data?.profiles).toHaveLength(1)
  })

  it('get passes name and unwraps the profile envelope', async () => {
    let captured: unknown = null
    setMockHandler('profiles.get', async (args) => {
      captured = args
      return { profile: { name: 'dev', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useProfile('dev'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { name: string }).name).toBe('dev')
    expect(result.current.data?.name).toBe('dev')
  })

  it('get is disabled when name is null', () => {
    const { result } = renderHook(() => useProfile(null), { wrapper: wrapper() })
    expect(result.current.isFetched).toBe(false)
  })
})

describe('useProfiles — write', () => {
  it('create sends { body } and invalidates the list', async () => {
    let captured: unknown = null
    setMockHandler('profiles.create', async (args) => {
      captured = args
      return { profile: { name: 'new', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useCreateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'new', description: 'd' } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { body: unknown }).body).toEqual({ name: 'new', description: 'd' })
  })

  it('update sends { name, body }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.update', async (args) => {
      captured = args
      return { profile: { name: 'dev', agents: [], skills: [], commands: [], plugins: [] } }
    })
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'dev', body: { description: 'new' } } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev', body: { description: 'new' } })
  })

  it('delete sends { name }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.delete', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeleteProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('doomed' as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'doomed' })
  })

  it('delete surfaces Conflict with the real wire shape when active', async () => {
    setMockHandler('profiles.delete', async () => {
      throw Object.assign(new Error('cannot delete active'), {
        code: 'Conflict',
        detail: 'Cannot delete active profile. Deactivate dev before deleting it.',
      })
    })
    const { result } = renderHook(() => useDeleteProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev' as never)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string; detail?: string }
    expect(err.code).toBe('Conflict')
    expect(err.detail).toContain('Deactivate dev')
  })
})

describe('usePreflight', () => {
  it('passes { name } and unwraps the PreflightResult', async () => {
    let captured: unknown = null
    setMockHandler('profiles.preflight', async (args) => {
      captured = args
      return {
        canActivate: true,
        missing: [],
        settingsWarnings: [],
        currentActive: null,
      }
    })
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
    expect(result.current.data?.canActivate).toBe(true)
  })

  it('surfaces NotFound when profile is missing', async () => {
    setMockHandler('profiles.preflight', async () => {
      throw Object.assign(new Error('profile not found'), {
        code: 'NotFound',
        detail: { kind: 'profile', name: 'ghost' },
      })
    })
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('ghost')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string; detail?: { kind?: string } }
    expect(err.code).toBe('NotFound')
    expect(err.detail?.kind).toBe('profile')
  })

  it('passes through model-config changes envelope', async () => {
    setMockHandler('profiles.preflight', async () => ({
      canActivate: true,
      missing: [],
      settingsWarnings: [],
      currentActive: null,
      modelConfigChanges: {
        configName: 'anthropic',
        changes: [
          { action: 'SET', key: 'ANTHROPIC_AUTH_TOKEN', value: '****1234' },
          { action: 'CHANGE', key: 'ANTHROPIC_BASE_URL', value: 'https://new', previousValue: 'https://old' },
        ],
      },
    }))
    const { result } = renderHook(() => usePreflight(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.modelConfigChanges?.configName).toBe('anthropic')
    expect(result.current.data?.modelConfigChanges?.changes).toHaveLength(2)
  })
})

describe('useActivateProfile + useDeactivateProfile', () => {
  it('activate sends { name } and returns { success, warnings }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.activate', async (args) => {
      captured = args
      return { success: true, warnings: ["Settings key 'effort' would be overwritten"] }
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
    expect(result.current.data?.warnings).toHaveLength(1)
  })

  it('activate surfaces ActivationBlocked with missing-components list', async () => {
    setMockHandler('profiles.activate', async () => {
      throw Object.assign(new Error('activation blocked'), {
        code: 'ActivationBlocked',
        detail: { missing: ['agent:reviewer', 'skill:deploy'] },
      })
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string; detail?: { missing?: string[] } }
    expect(err.code).toBe('ActivationBlocked')
    expect(err.detail?.missing).toEqual(['agent:reviewer', 'skill:deploy'])
  })

  it('activate surfaces lock-held Conflict', async () => {
    setMockHandler('profiles.activate', async () => {
      throw Object.assign(new Error('lock held'), {
        code: 'Conflict',
        detail: 'Another activation is in progress. Wait a moment and try again.',
      })
    })
    const { result } = renderHook(() => useActivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string; detail?: string }
    expect(err.code).toBe('Conflict')
    expect(err.detail).toContain('Another activation is in progress')
  })

  it('deactivate sends { name } and returns { success: true }', async () => {
    let captured: unknown = null
    setMockHandler('profiles.deactivate', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeactivateProfile(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate('dev')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'dev' })
  })
})
