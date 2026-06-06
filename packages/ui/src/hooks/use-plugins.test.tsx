import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useMarketplaces, usePlugins } from './use-plugins'
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

describe('usePlugins', () => {
  it('unwraps the plugins envelope and normalizes component counts', async () => {
    setMockHandler('plugins.list', async () => ({
      plugins: [
        {
          id: 'gitlab@m',
          name: 'gitlab',
          marketplace: 'm',
          enabled: true,
          installs: [{ version: '1', installedAt: '', lastUpdated: '', installPath: '/p', scope: 'user' }],
          manifest: { name: 'gitlab', description: 'd' },
          components: {
            agents: ['reviewer', 'debugger'],
            skills: ['deploy'],
            commands: ['commit-push'],
            hooks: null,
            mcpServers: null,
            lspServers: null,
          },
        },
      ],
    }))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    const p = result.current.data![0]
    expect(p.id).toBe('gitlab@m')
    expect(p.enabled).toBe(true)
    expect(p.componentCounts).toEqual({ agents: 2, skills: 1, commands: 1 })
    expect(p.manifest?.description).toBe('d')
  })

  it('returns an empty array when the wire response has no plugins field', async () => {
    setMockHandler('plugins.list', async () => ({}))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('tolerates a plugin with missing components/manifest', async () => {
    setMockHandler('plugins.list', async () => ({
      plugins: [
        { id: 'bare@m', name: 'bare', marketplace: 'm', enabled: false, installs: [] },
      ],
    }))
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const p = result.current.data![0]
    expect(p.componentCounts).toEqual({ agents: 0, skills: 0, commands: 0 })
    expect(p.manifest).toBeNull()
  })

  it('surfaces transport errors with their wire shape', async () => {
    setMockHandler('plugins.list', async () => {
      throw Object.assign(new Error('boom'), {
        code: 'Internal',
        detail: 'disk on fire',
      })
    })
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const err = result.current.error as { code?: string; detail?: unknown }
    expect(err.code).toBe('Internal')
  })
})

describe('useMarketplaces', () => {
  it('unwraps marketplaces envelope into an array', async () => {
    setMockHandler('marketplaces.list', async () => ({
      marketplaces: [
        { id: 'm1', source: { source: 'git', url: 'https://x' }, installLocation: '/m1' },
        { id: 'm2', source: { source: 'git' }, installLocation: '/m2' },
      ],
    }))
    const { result } = renderHook(() => useMarketplaces(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].id).toBe('m1')
  })

  it('returns empty when wire response has no marketplaces field', async () => {
    setMockHandler('marketplaces.list', async () => ({}))
    const { result } = renderHook(() => useMarketplaces(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
