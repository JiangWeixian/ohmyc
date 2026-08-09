import { render } from '@testing-library/react'
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { AreaTrendChart } from '@/components/menubar/area-trend-chart'

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

describe('AreaTrendChart', () => {
  it('renders a Recharts wrapper (shadcn ChartContainer internals)', () => {
    const { container } = render(
      <AreaTrendChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('renders a line path for the tokens series', () => {
    const { container } = render(
      <AreaTrendChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    // Recharts v3 renames the class from recharts-curve to recharts-area-curve
    expect(container.querySelector('path.recharts-area-curve')).toBeInTheDocument()
  })

  it('renders a filled area path for the tokens series', () => {
    const { container } = render(
      <AreaTrendChart tokens={mockTokens()} sessions={mockSessions()} />,
    )
    // AreaChart emits both path.recharts-area-area (the filled area shape) and
    // path.recharts-area-curve (the stroked top line). LineChart emits only curve.
    // Note: Recharts v3 uses recharts-area-area / recharts-area-curve (v2 used recharts-area / recharts-curve).
    expect(container.querySelector('path.recharts-area-area')).toBeInTheDocument()
  })

  it('handles empty data without crashing', () => {
    const { container } = render(<AreaTrendChart tokens={[]} sessions={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
