import {
  act,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { TimelineView } from '@/components/timeline/timeline-view'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function installTimelineHandlers(options?: { projects?: string[] }) {
  const currentYear = new Date().getFullYear()
  const capturedHeatmapArgs: unknown[] = []

  setMockHandler('timeline.years', async () => ({ years: [currentYear - 1, currentYear] }))
  setMockHandler('timeline.projects', async () => ({ projects: options?.projects ?? ['alpha', 'beta'] }))
  setMockHandler('timeline.status', async () => ({ sessionCount: 9, lastSyncAt: Date.UTC(currentYear, 0, 1) }))
  setMockHandler('timeline.heatmap', async (args) => {
    capturedHeatmapArgs.push(args)
    const metric = (args as { metric: string }).metric
    return { data: [{ date: `${currentYear}-06-16`, value: ({ sessions: 9, turns: 12, tokens: 4_238_700_000 } as Record<string, number>)[metric] }] }
  })
  setMockHandler('timeline.events', async () => ({
    days: [
      {
        day: `${currentYear}-06-16`,
        session_count: 1,
        turn_count: 12,
        token_count: 4_238_700_000,
        project_groups: [{
          project: 'alpha',
          sessions: [{
            session_id: 's1',
            project: 'alpha',
            started_at: Date.UTC(currentYear, 5, 16, 9, 0),
            ended_at: Date.UTC(currentYear, 5, 16, 9, 45),
            duration_ms: 45 * 60_000,
            turns: 12,
            tokens_input: 100,
            tokens_output: 200,
            tokens_cached: 300,
            summary: 'Timeline work',
            summary_source: 'generated',
            transcript_path: '/tmp/s1.jsonl',
            last_offset: 1,
            ingested_at: Date.UTC(currentYear, 5, 16, 10, 0),
            model: 'claude-opus',
            agent_name: 'claude',
          }],
          session_count: 1,
          turn_count: 12,
          token_count: 4_238_700_000,
          tool_count: 2,
          skill_count: 1,
          agents: ['claude'],
        }],
      },
    ],
    next_cursor: 'earlier',
  }))

  return { capturedHeatmapArgs, currentYear }
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('TimelineView', () => {
  it('refreshes all full-year totals after new data arrives without remounting', async () => {
    vi.useFakeTimers()
    const { currentYear } = installTimelineHandlers()
    let totals = { sessions: 9, turns: 12, tokens: 4_200_000_000 }
    setMockHandler('timeline.heatmap', async (args) => {
      const { metric } = args as { metric: keyof typeof totals }
      return { data: [{ date: `${currentYear}-06-16`, value: totals[metric] }] }
    })
    const { container, unmount, queryClient } = renderWithProviders(<TimelineView />)
    const stats = () => container.querySelector('.timeline-stats')!
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
      expect(stats()).toHaveTextContent('9 sessions · 12 turns · 4.2B tokens')

      totals = { sessions: 10, turns: 24, tokens: 4_500_000_000 }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      expect(stats()).toHaveTextContent('10 sessions · 24 turns · 4.5B tokens')

      totals = { sessions: 11, turns: 26, tokens: 4_600_000_000 }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      expect(stats()).toHaveTextContent('11 sessions · 26 turns · 4.6B tokens')
    } finally {
      unmount()
      queryClient.clear()
      vi.useRealTimers()
    }
  })

  it('scopes all totals to the full year and project independently of list pagination and metric tab', async () => {
    const user = userEvent.setup()
    const { currentYear } = installTimelineHandlers()
    setMockHandler('timeline.status', async () => ({ sessionCount: 9999 }))
    setMockHandler('timeline.heatmap', async (args) => {
      const { metric, project, from, to } = args as { metric: string; project?: string; from: number; to: number }
      const year = new Date(from).getUTCFullYear()
      expect(from).toBe(Date.UTC(year, 0, 1))
      expect(to).toBe(Date.UTC(year, 11, 31))
      const values = project === 'beta'
        ? (year === currentYear ? { sessions: 1, turns: 30, tokens: 500_000_000 } : { sessions: 0, turns: 0, tokens: 20_000_000 })
        : { sessions: 5, turns: 112, tokens: 6_238_700_000 }
      const value = values[metric as keyof typeof values]
      const earlierValue = Math.floor(value / 2)
      return { data: [{ date: `${year}-01-01`, value: earlierValue }, { date: `${year}-06-16`, value: value - earlierValue }] }
    })
    const { container } = renderWithProviders(<TimelineView />)
    const stats = () => container.querySelector('.timeline-stats')!
    await waitFor(() => expect(stats()).toHaveTextContent('5 sessions · 112 turns · 6.2B tokens'))
    expect(await screen.findByText(/older sessions hidden/)).toBeInTheDocument()
    expect(screen.getByText('Timeline work')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Project'))
    await user.click(await screen.findByText('beta'))
    await waitFor(() => expect(stats()).toHaveTextContent('1 sessions · 30 turns · 500M tokens'))

    await user.click(screen.getByLabelText('Year'))
    await user.click(await screen.findByText(String(currentYear - 1)))
    await waitFor(() => expect(stats()).toHaveTextContent('0 sessions · 0 turns · 20M tokens'))
    const tokensTab = screen.getByText('Tokens').closest('[role="tab"]')!
    fireEvent.mouseDown(tokensTab, { button: 0, ctrlKey: false })
    await waitFor(() => expect(tokensTab).toHaveAttribute('aria-selected', 'true'))
    expect(stats()).toHaveTextContent('0 sessions · 0 turns · 20M tokens')
  })

  it('shows zero totals for an empty filtered range even when other sessions exist', async () => {
    installTimelineHandlers()
    setMockHandler('timeline.heatmap', async () => ({ data: [] }))
    const { container } = renderWithProviders(<TimelineView />)
    await screen.findByText('Timeline work')
    await waitFor(() => expect(container.querySelector('.timeline-stats')).toHaveTextContent('0 sessions · 0 turns · 0 tokens'))
  })

  it('keeps unresolved totals unavailable instead of reading global or paginated values', async () => {
    installTimelineHandlers()
    setMockHandler('timeline.heatmap', async () => {
      await new Promise(() => {})
      return { data: [] }
    })
    const { container } = renderWithProviders(<TimelineView />)
    await screen.findByText('Timeline work')
    expect(container.querySelector('.timeline-stats')).toHaveTextContent('— sessions · — turns · — tokens')
  })

  it('renders timeline totals, heatmap, and events from transport data', async () => {
    installTimelineHandlers()

    const { container } = renderWithProviders(<TimelineView />)

    await waitFor(() => {
      expect(container.textContent).toContain('Timeline')
      expect(container.textContent).toContain('Timeline work')
    })
    expect(container.textContent).toContain('9 sessions')
    expect(container.textContent).toContain('12 turns')
    expect(container.textContent).toContain('4.2B tokens')
    expect(container.textContent).toContain('older sessions hidden')
  })

  it('tells a first-run user why the timeline is blank instead of blaming filters', async () => {
    installTimelineHandlers()
    // Nothing has ever been recorded — the state right after installing.
    setMockHandler('timeline.status', async () => ({ sessionCount: 0, lastSyncAt: null }))
    setMockHandler('timeline.events', async () => ({ days: [] }))

    const { container } = renderWithProviders(<TimelineView />)

    await waitFor(() => {
      expect(container.textContent).toContain('No sessions recorded yet.')
    })
    expect(container.textContent).toContain(
      'Run a session with Claude Code, Codex, or OpenCode and it shows up here.',
    )
    expect(container.textContent).not.toContain('No sessions match the current filters')
  })

  it('still blames filters when sessions exist but none match', async () => {
    installTimelineHandlers()
    setMockHandler('timeline.status', async () => ({ sessionCount: 9, lastSyncAt: null }))
    setMockHandler('timeline.events', async () => ({ days: [] }))

    const { container } = renderWithProviders(<TimelineView />)

    await waitFor(() => {
      expect(container.textContent).toContain('No sessions match the current filters')
    })
    expect(container.textContent).not.toContain('No sessions recorded yet.')
  })

  it('switches heatmap metric, project, and year filters through accessible controls', async () => {
    const user = userEvent.setup()
    const { capturedHeatmapArgs, currentYear } = installTimelineHandlers()

    renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(screen.getByText('Timeline work')).toBeInTheDocument()
    })

    const activityTab = screen.getByText('Activity').closest('[role="tab"]')
    expect(activityTab).not.toBeNull()
    expect(activityTab).toHaveAttribute('aria-selected', 'true')

    const tokensTab = screen.getByText('Tokens').closest('[role="tab"]')
    expect(tokensTab).not.toBeNull()
    fireEvent.mouseDown(tokensTab!, { button: 0, ctrlKey: false })
    await waitFor(() => {
      expect(tokensTab).toHaveAttribute('aria-selected', 'true')
    })
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { metric?: string }).metric === 'tokens')).toBe(true)
    })

    const projectSelect = screen.getByLabelText('Project')
    expect(projectSelect).toHaveAttribute('role', 'combobox')
    await user.click(projectSelect)
    await user.click(await screen.findByText('beta'))
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { project?: string }).project === 'beta')).toBe(true)
    })

    const yearSelect = screen.getByLabelText('Year')
    expect(yearSelect).toHaveAttribute('role', 'combobox')
    await user.click(yearSelect)
    await user.click(await screen.findByText(String(currentYear - 1)))
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { from?: number }).from === Date.UTC(currentYear - 1, 0, 1))).toBe(true)
    })
  })

  it('uses theme-token control classes for the timeline filter row', async () => {
    installTimelineHandlers()

    renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(screen.getByText('Timeline work')).toBeInTheDocument()
    })

    const tabList = screen.getByText('Activity').closest('[role="tablist"]')
    expect(tabList).not.toBeNull()
    expect(tabList).toHaveClass('timeline-tabs')
    expect(tabList).toHaveClass('h-auto')

    const tokensTab = screen.getByText('Tokens').closest('[role="tab"]')
    expect(tokensTab).not.toBeNull()
    expect(tokensTab).toHaveClass('timeline-tab')
    expect(tokensTab).toHaveClass('h-auto')
    expect(tokensTab).not.toHaveClass('py-[6px]')

    expect(screen.getByLabelText('Project')).toHaveAttribute('data-size', 'default')
    expect(screen.getByLabelText('Project')).toHaveClass('timeline-filter-select')
    expect(screen.getByLabelText('Year')).toHaveAttribute('data-size', 'default')
    expect(screen.getByLabelText('Year')).toHaveClass('timeline-filter-select')
  })

  it('renders when the backend returns blank project names', async () => {
    installTimelineHandlers({ projects: ['', '   ', 'alpha'] })

    renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(screen.getByText('Timeline work')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Project')).toBeInTheDocument()
  })
})

it('shows token query errors while keeping session activity visible', async () => {
  installTimelineHandlers()
  setMockHandler('timeline.heatmap', async (args) => {
    if ((args as { metric: string }).metric === 'tokens') {
      throw new Error('database disk image is malformed')
    }
    return { data: [] }
  })
  const { container } = renderWithProviders(<TimelineView />)
  await screen.findByText('Timeline work')
  fireEvent.mouseDown(screen.getByText('Tokens').closest('[role="tab"]')!, { button: 0, ctrlKey: false })
  expect(await screen.findByText('Tokens unavailable.')).toBeInTheDocument()
  expect(container.querySelector('.timeline-stats')).toHaveTextContent('0 sessions · 0 turns · — tokens')
  expect(screen.getByText('Timeline work')).toBeInTheDocument()
})
