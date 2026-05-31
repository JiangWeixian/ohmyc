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
  useTimelineEvents,
  useTimelineHeatmap,
  useTimelineHeatmapRange,
  useTimelineProjects,
  useTimelineStatus,
  useTimelineYears,
} from './use-timeline'
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

describe('useTimelineYears', () => {
  it('returns the years array unwrapped from the response envelope', async () => {
    setMockHandler('timeline.years', async () => ({ years: [2024, 2025, 2026] }))
    const { result } = renderHook(() => useTimelineYears(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([2024, 2025, 2026])
  })
})

describe('useTimelineProjects', () => {
  it('returns the projects array unwrapped from the response envelope', async () => {
    setMockHandler('timeline.projects', async () => ({ projects: ['a', 'b'] }))
    const { result } = renderHook(() => useTimelineProjects(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['a', 'b'])
  })
})

describe('useTimelineStatus', () => {
  it('normalizes camelCase keys from the TS server', async () => {
    setMockHandler('timeline.status', async () => ({
      sessionCount: 7,
      lastSyncAt: 1_700_000_000_000,
    }))
    const { result } = renderHook(() => useTimelineStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ sessionCount: 7, lastSyncAt: 1_700_000_000_000 })
  })

  it('normalizes snake_case keys from the Rust backend', async () => {
    setMockHandler('timeline.status', async () => ({
      session_count: 9,
      last_sync_at: 1_700_000_000_001,
    }))
    const { result } = renderHook(() => useTimelineStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ sessionCount: 9, lastSyncAt: 1_700_000_000_001 })
  })
})

describe('useTimelineHeatmap', () => {
  it('sends from/to ms for a calendar year and unwraps data', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [{ date: '2026-01-01', value: 5 }] }
    })
    const { result } = renderHook(
      () => useTimelineHeatmap({ year: 2026, metric: 'tokens' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ date: '2026-01-01', value: 5 }])
    const a = captured as { from: number; to: number; metric: string }
    expect(a.metric).toBe('tokens')
    expect(a.from).toBe(Date.UTC(2026, 0, 1))
    expect(a.to).toBe(Date.UTC(2026, 11, 31))
  })

  it('includes project arg when provided', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [] }
    })
    renderHook(
      () => useTimelineHeatmap({ year: 2026, metric: 'sessions', project: 'x' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => {
      expect((captured as { project?: string } | null)?.project).toBe('x')
    })
  })
})

describe('useTimelineHeatmapRange', () => {
  it('sends arbitrary date range as from/to ms', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [{ date: '2026-05-01', value: 100 }] }
    })
    const { result } = renderHook(
      () => useTimelineHeatmapRange({
        from: '2026-04-15', to: '2026-05-15', metric: 'tokens',
      }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const a = captured as { from: number; to: number }
    expect(a.from).toBe(Date.UTC(2026, 3, 15))
    expect(a.to).toBe(Date.UTC(2026, 4, 15))
  })
})

describe('useTimelineEvents', () => {
  it('normalizes snake_case project_groups from Rust to camelCase', async () => {
    setMockHandler('timeline.events', async () => ({
      days: [
        {
          day: '2026-05-01',
          project_groups: [{
            project: 'a',
            sessions: [],
            session_count: 1,
            turn_count: 2,
            token_count: 3,
            tool_count: 0,
            skill_count: 0,
            agents: [],
          }],
          session_count: 1,
          turn_count: 2,
          token_count: 3,
        },
      ],
      next_cursor: '2026-05-01',
    }))
    const { result } = renderHook(() => useTimelineEvents({}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.days[0].projectGroups).toHaveLength(1)
    expect(result.current.data?.nextCursor).toBe('2026-05-01')
  })

  it('accepts camelCase from the TS server unchanged', async () => {
    setMockHandler('timeline.events', async () => ({
      days: [
        {
          day: '2026-05-01',
          projectGroups: [],
          session_count: 0,
          turn_count: 0,
          token_count: 0,
        },
      ],
      nextCursor: undefined,
    }))
    const { result } = renderHook(() => useTimelineEvents({}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.days[0].day).toBe('2026-05-01')
  })
})
