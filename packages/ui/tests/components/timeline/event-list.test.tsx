import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { EventList } from '@/components/timeline/event-list'

import type { DayEvents, SessionRow } from '@/hooks/use-timeline'

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    session_id: 's1',
    project: 'alpha',
    started_at: Date.UTC(2026, 5, 16, 9, 0),
    ended_at: Date.UTC(2026, 5, 16, 10, 30),
    duration_ms: 90 * 60_000,
    turns: 12,
    tokens_input: 1000,
    tokens_output: 2000,
    tokens_cached: 500,
    summary: 'Investigate timeline',
    summary_source: 'generated',
    transcript_path: '/tmp/transcript.jsonl',
    last_offset: 10,
    ingested_at: Date.UTC(2026, 5, 16, 11, 0),
    model: 'claude-opus',
    agent_name: 'claude',
    ...overrides,
  }
}

function day(overrides: Partial<DayEvents> = {}): DayEvents {
  return {
    day: '2026-06-16',
    session_count: 2,
    turn_count: 24,
    token_count: 3_500_000,
    projectGroups: [
      {
        project: 'alpha',
        sessions: [
          session(),
          session({
            session_id: 's2',
            duration_ms: 30_000,
            summary: null,
            summary_source: 'first_message',
            model: null,
            agent_name: 'opencode',
          }),
        ],
        session_count: 2,
        turn_count: 24,
        token_count: 3_500_000,
        tool_count: 3,
        skill_count: 1,
        agents: ['claude', 'opencode'],
      },
    ],
    ...overrides,
  }
}

describe('EventList', () => {
  it('renders an empty state when no days match', () => {
    render(<EventList days={[]} />)
    expect(screen.getByText('No sessions match the current filters.')).toBeInTheDocument()
  })

  it('renders day rollups and expanded sessions for the first day', () => {
    render(<EventList days={[day()]} highlightedDay="2026-06-16" />)

    expect(document.body.textContent).toContain('Jun 16, 2026')
    expect(document.body.textContent).toContain('2 sessions')
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('Investigate timeline')).toBeInTheDocument()
    expect(screen.getByText('(no summary)')).toBeInTheDocument()
    expect(screen.getByText('claude-opus')).toBeInTheDocument()
    expect(document.body.textContent).toContain('3.5M tokens')
  })

  it('collapses and expands project rollups with click and keyboard', () => {
    render(<EventList days={[day()]} />)

    const rollup = screen.getByRole('button')
    fireEvent.click(rollup)
    expect(screen.queryByText('Investigate timeline')).not.toBeInTheDocument()

    fireEvent.keyDown(rollup, { key: 'Enter' })
    expect(screen.getByText('Investigate timeline')).toBeInTheDocument()

    fireEvent.keyDown(rollup, { key: ' ' })
    expect(screen.queryByText('Investigate timeline')).not.toBeInTheDocument()
  })

  it('keeps later days collapsed until their project is opened', () => {
    render(
      <EventList
        days={[
          day(),
          day({
            day: '2026-06-15',
            session_count: 1,
            turn_count: 1,
            token_count: 800,
            projectGroups: [{
              project: 'beta',
              sessions: [session({ session_id: 's3', project: 'beta', summary: 'Second day', tokens_input: 200, tokens_output: 300, tokens_cached: 300 })],
              session_count: 1,
              turn_count: 1,
              token_count: 800,
              tool_count: 0,
              skill_count: 0,
              agents: [],
            }],
          }),
        ]}
      />,
    )

    const betaRollup = screen.getByText('beta').closest('[role="button"]')
    expect(betaRollup).not.toBeNull()
    expect(within(betaRollup!).getByText(/1 session/)).toBeInTheDocument()
    expect(screen.queryByText('Second day')).not.toBeInTheDocument()

    fireEvent.click(betaRollup!)
    expect(screen.getByText('Second day')).toBeInTheDocument()
    expect(screen.getByText('800 tokens')).toBeInTheDocument()
  })
})
