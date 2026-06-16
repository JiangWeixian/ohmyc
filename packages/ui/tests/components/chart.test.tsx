import { render, screen } from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  ChartContainer,
  ChartLegendContent,
  ChartStyle,
  ChartTooltipContent,
} from '@/components/chart'

import type { ReactNode } from 'react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => null,
  Legend: () => null,
}))

function Icon() {
  return <svg data-testid="series-icon" />
}

describe('chart helpers', () => {
  it('renders CSS variables for color and theme configs', () => {
    render(
      <ChartStyle
        id="sales"
        config={{
          revenue: { label: 'Revenue', color: '#f00' },
          cost: { label: 'Cost', theme: { light: '#111', dark: '#eee' } },
          skipped: { label: 'Skipped' },
        }}
      />,
    )

    const style = document.querySelector('style')
    expect(style?.textContent).toContain('[data-chart=sales]')
    expect(style?.textContent).toContain('--color-revenue: #f00')
    expect(style?.textContent).toContain('.dark [data-chart=sales]')
    expect(style?.textContent).toContain('--color-cost: #eee')
  })

  it('returns no style element when no series has colors', () => {
    const { container } = render(<ChartStyle id="empty" config={{ plain: { label: 'Plain' } }} />)
    expect(container.querySelector('style')).toBeNull()
  })

  it('renders tooltip labels, indicators, icons, formatters, and filtered payloads', () => {
    const formatter = vi.fn((value: unknown, name: unknown) => (
      <span>{String(name)}={String(value)}</span>
    ))

    render(
      <ChartContainer
        id="tooltip"
        config={{
          revenue: { label: 'Revenue', color: '#0f0' },
          profit: { label: 'Profit', icon: Icon },
        }}
      >
        <ChartTooltipContent
          active
          label="revenue"
          formatter={formatter}
          payload={[
            { name: 'revenue', dataKey: 'revenue', value: 1200, color: '#0f0', payload: { fill: '#123' } },
            { name: 'profit', dataKey: 'profit', value: 'high', color: '#00f', payload: {} },
            { name: 'hidden', dataKey: 'hidden', value: 1, type: 'none', payload: {} },
          ] as never}
        />
      </ChartContainer>,
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('revenue=1200')).toBeInTheDocument()
    expect(screen.getByText('profit=high')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
    expect(formatter).toHaveBeenCalled()
  })

  it('renders nested dashed tooltip labels and custom label formatters', () => {
    render(
      <ChartContainer id="nested" config={{ visits: { label: 'Visits', color: '#999' } }}>
        <ChartTooltipContent
          active
          indicator="dashed"
          label="visits"
          labelFormatter={value => <span>Formatted {value}</span>}
          payload={[
            { name: 'visits', dataKey: 'visits', value: 42, color: '#999', payload: {} },
          ] as never}
        />
      </ChartContainer>,
    )

    expect(screen.getByText('Formatted Visits')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('hides inactive tooltips and rejects tooltip content outside a chart container', () => {
    const { container } = render(
      <ChartContainer id="inactive" config={{ value: { label: 'Value', color: '#fff' } }}>
        <ChartTooltipContent active={false} payload={[]} />
      </ChartContainer>,
    )
    expect(container.textContent).not.toContain('Value')

    expect(() => render(<ChartTooltipContent active payload={[]} />)).toThrow(
      'useChart must be used within a <ChartContainer />',
    )
  })

  it('renders legend entries with icons, swatches, alignment, and name keys', () => {
    render(
      <ChartContainer
        id="legend"
        config={{
          revenue: { label: 'Revenue', icon: Icon },
          cost: { label: 'Cost', color: '#f00' },
        }}
      >
        <ChartLegendContent
          verticalAlign="top"
          payload={[
            { dataKey: 'revenue', color: '#0f0', value: 'revenue' },
            { dataKey: 'cost', color: '#f00', value: 'cost' },
            { dataKey: 'hidden', type: 'none', color: '#000', value: 'hidden' },
          ] as never}
        />
      </ChartContainer>,
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
    expect(screen.getByTestId('series-icon')).toBeInTheDocument()
  })

  it('returns no legend content when payload is empty', () => {
    const { container } = render(
      <ChartContainer id="legend-empty" config={{}}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    )
    expect(container.textContent).toBe('')
  })
})
