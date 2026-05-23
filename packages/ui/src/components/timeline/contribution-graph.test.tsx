import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { ContributionGraph } from './contribution-graph'

import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const sampleData = [
  { date: '2026-01-15', value: 10 },
  { date: '2026-06-15', value: 50 },
  { date: '2026-12-15', value: 30 },
]

describe('ContributionGraph compact mode', () => {
  it('renders month labels in default (non-compact) mode', () => {
    const { container } = render(<ContributionGraph year={2026} metric="tokens" data={sampleData} />, { wrapper })
    // Month label spans carry data-month-label attribute in non-compact mode.
    expect(container.querySelector('[data-month-label="Jan"]')).toBeInTheDocument()
  })

  it('renders the "Less / More" legend in default mode', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} />, { wrapper })
    expect(screen.getByText(/Less/i)).toBeInTheDocument()
    expect(screen.getByText(/More/i)).toBeInTheDocument()
  })

  it('hides month labels when compact={true}', () => {
    const { container } = render(<ContributionGraph year={2026} metric="tokens" data={sampleData} compact />, { wrapper })
    // No data-month-label spans should be present in compact mode.
    expect(container.querySelector('[data-month-label]')).not.toBeInTheDocument()
  })

  it('hides "Less / More" legend when compact={true}', () => {
    render(<ContributionGraph year={2026} metric="tokens" data={sampleData} compact />, { wrapper })
    expect(screen.queryByText(/Less/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/More/i)).not.toBeInTheDocument()
  })

  it('still renders the cell grid in compact mode', () => {
    const { container } = render(
      <ContributionGraph year={2026} metric="tokens" data={sampleData} compact />,
      { wrapper },
    )
    const cells = container.querySelectorAll('[data-heat-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(365)
  })
})
