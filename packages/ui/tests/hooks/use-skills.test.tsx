import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { useSkill, useSkills } from '@/hooks/use-skills'
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

describe('useSkills', () => {
  it('returns the skills array unwrapped from the response envelope', async () => {
    setMockHandler('skills.list', async () => ({
      skills: [{ id: 's1', frontmatter: { name: 'review', description: 'Review' }, content: '', raw: '', filename: 'review.md', source: 'local' }],
    }))
    const { result } = renderHook(() => useSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].frontmatter.name).toBe('review')
  })

  it('does not pass origins when all sources are selected', async () => {
    let captured: unknown = null
    setMockHandler('skills.list', async (args) => {
      captured = args
      return { skills: [] }
    })
    renderHook(() => useSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as Record<string, unknown>).origins).toBeUndefined()
  })

  it('passes sorted selected origins', async () => {
    useSources.setState({ selected: new Set(['opencode', 'claude']) })
    let captured: unknown = null
    setMockHandler('skills.list', async (args) => {
      captured = args
      return { skills: [] }
    })
    renderHook(() => useSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { origins?: string }).origins).toBeUndefined()
  })

  it('passes origins=claude when only claude is selected', async () => {
    useSources.setState({ selected: new Set(['claude']) })
    let captured: unknown = null
    setMockHandler('skills.list', async (args) => {
      captured = args
      return { skills: [] }
    })
    renderHook(() => useSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(captured).not.toBeNull())
    expect((captured as { origins?: string }).origins).toBe('claude')
  })
})

describe('useSkill', () => {
  it('returns the skill unwrapped from the response envelope', async () => {
    setMockHandler('skills.get', async () => ({
      skill: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' },
    }))
    const { result } = renderHook(() => useSkill({ name: 'x' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('x')
  })

  it('forwards locator fields as args', async () => {
    let captured: unknown = null
    setMockHandler('skills.get', async (args) => {
      captured = args
      return { skill: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' } }
    })
    renderHook(
      () => useSkill({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'user' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toEqual({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'user' })
  })

  it('is disabled when no locator is provided', () => {
    const { result } = renderHook(() => useSkill(null), { wrapper: wrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetched).toBe(false)
  })
})
