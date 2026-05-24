import { render } from '@testing-library/react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { DualLineChart } from './dual-line-chart'

const tokens = [
  { date: '2026-05-16', value: 12_000 },
  { date: '2026-05-17', value: 30_000 },
  { date: '2026-05-18', value: 22_000 },
  { date: '2026-05-19', value: 70_000 },
  { date: '2026-05-20', value: 55_000 },
  { date: '2026-05-21', value: 98_000 },
  { date: '2026-05-22', value: 40_000 },
]
const sessions = [
  { date: '2026-05-16', value: 2 },
  { date: '2026-05-17', value: 4 },
  { date: '2026-05-18', value: 3 },
  { date: '2026-05-19', value: 8 },
  { date: '2026-05-20', value: 6 },
  { date: '2026-05-21', value: 11 },
  { date: '2026-05-22', value: 5 },
]

describe('DualLineChart', () => {
  it('renders exactly two polylines (tokens + sessions)', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('renders 7 dots for tokens and 7 for sessions (14 total)', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    expect(container.querySelectorAll('circle')).toHaveLength(14)
  })

  it('renders day-of-week labels for all 7 points', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    expect(container.querySelectorAll('text[data-x-label]')).toHaveLength(7)
  })

  it('renders 3 left-axis tick labels and 3 right-axis tick labels', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    expect(container.querySelectorAll('text[data-tick-left]')).toHaveLength(3)
    expect(container.querySelectorAll('text[data-tick-right]')).toHaveLength(3)
  })

  it('marks the legend element as default-hidden', () => {
    const { container } = render(<DualLineChart tokens={tokens} sessions={sessions} />)
    const legend = container.querySelector('[data-legend]') as HTMLElement
    expect(legend).toBeInTheDocument()
    expect(legend).toHaveAttribute('data-default-hidden', 'true')
  })

  it('handles empty arrays without crashing', () => {
    const { container } = render(<DualLineChart tokens={[]} sessions={[]} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})
