import { render } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { RecentHeatmap } from '@/components/menubar/recent-heatmap'

// Fix "today" so the component's rolling-16-week start date is deterministic.
// Component computes: start = today - (16*7 - 1) days = today - 111 days.
// With today = 2026-05-24 UTC → start = 2026-02-02 UTC.
const FIXED_TODAY = '2026-05-24T00:00:00Z'
const FIXED_START_ISO = '2026-02-02'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_TODAY))
})

afterEach(() => {
  vi.useRealTimers()
})

function makeTokenData(): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = []
  const start = new Date(`${FIXED_START_ISO}T00:00:00Z`)
  for (let i = 0; i < 112; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    points.push({
      date: d.toISOString().slice(0, 10),
      // Every 4th day peaks (100_000); others low (1_000)
      value: i % 4 === 0 ? 100_000 : 1000,
    })
  }
  return points
}

function makeSessionData(): { date: string; value: number }[] {
  return makeTokenData().map(p => ({ ...p, value: Math.round(p.value / 10_000) }))
}

describe('RecentHeatmap', () => {
  it('renders exactly 112 cells (16 weeks × 7 days)', () => {
    const { container } = render(
      <RecentHeatmap tokens={makeTokenData()} sessions={makeSessionData()} />,
    )
    expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(16 * 7)
  })

  it('renders all four chrome elements', () => {
    const { container } = render(
      <RecentHeatmap tokens={makeTokenData()} sessions={makeSessionData()} />,
    )
    expect(container.querySelector('[data-heatmap-months]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-dow]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-range]')).toBeInTheDocument()
    expect(container.querySelector('[data-heatmap-legend]')).toBeInTheDocument()
  })

  it('applies highest-bucket to peak cells and low bucket to low cells', () => {
    const tokens = makeTokenData() // peaks 100_000, lows 1_000
    const { container } = render(
      <RecentHeatmap tokens={tokens} sessions={makeSessionData()} />,
    )
    const cells = [...container.querySelectorAll<HTMLElement>('[data-heat-cell]')]
    // Cells render in column-major order: i = col * 7 + row.
    // First cell (i=0) is Feb 2 — test data i=0 → value 100_000 → bucket 4 (max ratio)
    expect(cells[0].dataset.bucket).toBe('4')
    // Second cell (i=1) is Feb 3 — test data i=1 → value 1_000 → ratio 0.01 → bucket 1
    expect(cells[1].dataset.bucket).toBe('1')
  })

  it('handles empty data — all cells render at bucket 0', () => {
    const { container } = render(<RecentHeatmap tokens={[]} sessions={[]} />)
    const cells = container.querySelectorAll<HTMLElement>('[data-heat-cell]')
    expect(cells).toHaveLength(112)
    for (const cell of cells) {
      expect(cell.dataset.bucket).toBe('0')
    }
  })
})
