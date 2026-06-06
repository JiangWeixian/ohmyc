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
import {
  __setTransportForTests,
  request,
  resetTransportForTests,
} from '@/lib/transport'
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

// Wire contract for get-by-id routes. No UI hook calls plugins.get or
// marketplaces.get today, but the Tauri commands are registered and slice 7
// (profiles) is the likely first consumer. Asserting the envelope shape +
// NotFound error shape here keeps the wire contract honest before a hook
// lands — and prevents the slice-5-style regression where test mocks
// drifted from the real wire.
describe('get-by-id wire contract (slice 7 prereq)', () => {
  it('plugins.get returns the { plugin } envelope shape', async () => {
    let capturedArgs: unknown = null
    setMockHandler('plugins.get', async (args) => {
      capturedArgs = args
      return {
        plugin: {
          id: 'gitlab@m',
          name: 'gitlab',
          marketplace: 'm',
          enabled: false,
          installs: [],
        },
      }
    })
    const result = await request<{ plugin: { id: string } }>('plugins.get', { id: 'gitlab@m' })
    expect(capturedArgs).toEqual({ id: 'gitlab@m' })
    expect(result.plugin.id).toBe('gitlab@m')
  })

  it('marketplaces.get rejects with NotFound shape when missing', async () => {
    // Real ApiError::NotFound serializes as { code, detail: { kind, name } }.
    // Mirror that here so slice 7 can rely on the same error shape.
    setMockHandler('marketplaces.get', async () => {
      throw Object.assign(new Error('marketplace not found'), {
        code: 'NotFound',
        detail: { kind: 'marketplace', name: 'nope' },
      })
    })
    await expect(request('marketplaces.get', { id: 'nope' })).rejects.toMatchObject({
      code: 'NotFound',
      detail: { kind: 'marketplace', name: 'nope' },
    })
  })
})
