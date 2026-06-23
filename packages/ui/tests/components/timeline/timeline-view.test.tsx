import {
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
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { TimelineView } from '@/components/timeline/timeline-view'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function installTimelineHandlers() {
  const currentYear = new Date().getFullYear()
  const capturedHeatmapArgs: unknown[] = []

  setMockHandler('timeline.years', async () => ({ years: [currentYear - 1, currentYear] }))
  setMockHandler('timeline.projects', async () => ({ projects: ['alpha', 'beta'] }))
  setMockHandler('timeline.status', async () => ({ sessionCount: 9, lastSyncAt: Date.UTC(currentYear, 0, 1) }))
  setMockHandler('timeline.heatmap', async (args) => {
    capturedHeatmapArgs.push(args)
    return { data: [{ date: `${currentYear}-06-16`, value: 8 }] }
  })
  setMockHandler('timeline.events', async () => ({
    days: [
      {
        day: `${currentYear}-06-16`,
        session_count: 1,
        turn_count: 12,
        token_count: 1500,
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
          token_count: 1500,
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
  it('renders timeline totals, heatmap, and events from transport data', async () => {
    installTimelineHandlers()

    const { container } = renderWithProviders(<TimelineView />)

    await waitFor(() => {
      expect(container.textContent).toContain('Timeline')
      expect(container.textContent).toContain('Timeline work')
    })
    expect(container.textContent).toContain('9 sessions')
    expect(container.textContent).toContain('12 turns')
    expect(container.textContent).toContain('1.5k tokens')
    expect(container.textContent).toContain('earlier sessions truncated')
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
    expect(tabList).not.toHaveClass('h-auto')

    const tokensTab = screen.getByText('Tokens').closest('[role="tab"]')
    expect(tokensTab).not.toBeNull()
    expect(tokensTab).toHaveClass('timeline-tab')
    expect(tokensTab).not.toHaveClass('h-auto')
    expect(tokensTab).not.toHaveClass('py-[6px]')

    expect(screen.getByLabelText('Project')).toHaveAttribute('data-size', 'default')
    expect(screen.getByLabelText('Project')).toHaveClass('timeline-filter-select')
    expect(screen.getByLabelText('Year')).toHaveAttribute('data-size', 'default')
    expect(screen.getByLabelText('Year')).toHaveClass('timeline-filter-select')
  })
})
