import { fireEvent, waitFor } from '@testing-library/react'
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

  it('switches heatmap metric and project filters through the controls', async () => {
    const { capturedHeatmapArgs } = installTimelineHandlers()

    const { container } = renderWithProviders(<TimelineView />)
    await waitFor(() => {
      expect(container.textContent).toContain('Timeline work')
    })

    const tokensButton = [...container.querySelectorAll('button')]
      .find(button => button.textContent === 'Tokens')
    expect(tokensButton).toBeDefined()
    fireEvent.click(tokensButton!)
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { metric?: string }).metric === 'tokens')).toBe(true)
    })

    const selects = container.querySelectorAll('select')
    expect(selects).toHaveLength(2)
    fireEvent.change(selects[0], { target: { value: 'beta' } })
    await waitFor(() => {
      expect(capturedHeatmapArgs.some(args => (args as { project?: string }).project === 'beta')).toBe(true)
    })
  })
})
