import { render } from '@testing-library/react'
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { DualLineChart } from './dual-line-chart'

import type { HeatmapPoint } from '@/hooks/use-timeline'

// Recharts uses getBoundingClientRect to determine chart dimensions.
// jsdom returns 0×0 which prevents SVG rendering; mock it to give
// the chart a real viewport so Recharts renders the SVG tree.
beforeAll(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 200,
    top: 0,
    left: 0,
    bottom: 200,
    right: 400,
    x: 0,
    y: 0,
    toJSON: () => {},
  })
})

function mockTokens(): HeatmapPoint[] {
  return [
    { date: '2026-05-16', value: 12_000 },
    { date: '2026-05-17', value: 30_000 },
    { date: '2026-05-18', value: 22_000 },
    { date: '2026-05-19', value: 70_000 },
    { date: '2026-05-20', value: 55_000 },
    { date: '2026-05-21', value: 98_000 },
    { date: '2026-05-22', value: 40_000 },
  ]
}

function mockSessions(): HeatmapPoint[] {
  return [
    { date: '2026-05-16', value: 2 },
    { date: '2026-05-17', value: 4 },
    { date: '2026-05-18', value: 3 },
    { date: '2026-05-19', value: 8 },
    { date: '2026-05-20', value: 6 },
    { date: '2026-05-21', value: 11 },
    { date: '2026-05-22', value: 5 },
  ]
}

describe('DualLineChart', () => {
  it('renders a Recharts wrapper (Tremor internals)', () => {
    const { container } = render(
      <DualLineChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('renders a line path for the tokens series', () => {
    const { container } = render(
      <DualLineChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    expect(container.querySelector('path.recharts-curve')).toBeInTheDocument()
  })

  it('handles empty data without crashing', () => {
    const { container } = render(<DualLineChart tokens={[]} sessions={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
