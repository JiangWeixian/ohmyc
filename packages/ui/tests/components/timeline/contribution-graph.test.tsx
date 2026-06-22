import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { calculateContributionGraphLayout, ContributionGraph } from '@/components/timeline/contribution-graph'

describe('ContributionGraph', () => {
  it('calculates readable square cells while widening the week tracks', () => {
    expect(calculateContributionGraphLayout(760)).toEqual({ cellSize: 10, rowGap: 4 })
    expect(calculateContributionGraphLayout(1166)).toEqual({ cellSize: 15, rowGap: 4 })
    expect(calculateContributionGraphLayout(1800)).toEqual({ cellSize: 18, rowGap: 4 })
  })

  it('renders the year grid, legend, and clickable populated days', () => {
    const onSelectDay = vi.fn()
    render(
      <ContributionGraph
        year={2026}
        metric="tokens"
        data={[
          { date: '2026-01-01', value: 0 },
          { date: '2026-03-15', value: 1500 },
          { date: '2026-12-31', value: 3000 },
        ]}
        onSelectDay={onSelectDay}
      />,
    )

    expect(screen.getByText('Jan 1 → Dec 31, 2026')).toBeInTheDocument()
    expect(document.body.textContent).toContain('Less')
    expect(document.body.textContent).toContain('More')
    expect(screen.getByTestId('timeline-heatmap-grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(53, minmax(0, 1fr))',
    })
    expect(screen.getByTestId('timeline-heatmap-months').firstElementChild).toHaveStyle({
      flex: '1 1 0px',
    })

    const populatedDays = screen.getAllByRole('button')
    expect(populatedDays).toHaveLength(2)

    fireEvent.mouseEnter(populatedDays[0])
    expect(screen.getByText('1.5k tokens')).toBeInTheDocument()
    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument()

    fireEvent.click(populatedDays[0])
    expect(onSelectDay).toHaveBeenCalledWith('2026-03-15')

    fireEvent.mouseLeave(populatedDays[0])
    expect(screen.queryByText('1.5k tokens')).not.toBeInTheDocument()
  })

  it('labels non-token metrics with the metric name', () => {
    render(
      <ContributionGraph
        year={2026}
        metric="sessions"
        data={[{ date: '2026-06-16', value: 4 }]}
      />,
    )

    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByText('4 sessions')).toBeInTheDocument()
  })
})
