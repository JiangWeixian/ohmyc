import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { MenubarPage } from './menubar-page'

import type { ReactNode } from 'react'

function setupMockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const u = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url)
    if (u.includes('metric=tokens')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-05-22', value: 10_000 },
            { date: '2026-05-21', value: 5000 },
          ],
        }),
      } as Response
    }
    if (u.includes('metric=sessions')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-05-22', value: 3 },
            { date: '2026-05-21', value: 2 },
          ],
        }),
      } as Response
    }
    return { ok: true, json: async () => ({ data: [] }) } as Response
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('MenubarPage', () => {
  it('renders in line view by default and shows "Last 7 days"', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    expect(await screen.findByText(/Last 7 days/i)).toBeInTheDocument()
  })

  it('renders header totals after data loads', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    expect(await screen.findByText(/15k/i)).toBeInTheDocument()
    expect(await screen.findByText(/tokens · 5 sessions/i)).toBeInTheDocument()
  })

  it('switches to heatmap view when the heatmap icon is clicked', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 7 days/i)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    await userEvent.click(heatmapBtn)
    expect(await screen.findByText(/Last 365 days/i)).toBeInTheDocument()
  })

  it('renders the DualLineChart in line view (polyline elements present)', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    // Wait for data to load (tokens total appears once queries resolve)
    expect(await screen.findByText(/15k/i)).toBeInTheDocument()
    expect(container.querySelectorAll('polyline').length).toBeGreaterThanOrEqual(2)
  })

  it('does not render polylines in heatmap view', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 7 days/i)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    await screen.findByText(/Last 365 days/i)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})
