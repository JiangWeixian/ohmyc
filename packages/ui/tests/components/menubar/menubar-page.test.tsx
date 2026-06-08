import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { MenubarPage } from '@/components/menubar/menubar-page'

import type { ReactNode } from 'react'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {}),
}))

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

beforeAll(() => {
  // Recharts skips SVG emission when container dims are 0×0 in jsdom.
  // Mock getBoundingClientRect so Tremor's Recharts internals can render.
  const originalGetBCR = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, width: 400, height: 200, top: 0, left: 0, right: 400, bottom: 200, toJSON: () => ({}) } as DOMRect
  }
  return () => {
    Element.prototype.getBoundingClientRect = originalGetBCR
  }
})

describe('MenubarPage', () => {
  it('renders in line view by default and shows the unified "Last 16 weeks" range', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    expect(await screen.findByText(/Last 16 weeks/i)).toBeInTheDocument()
  })

  it('renders header totals after data loads', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    expect(await screen.findByText(/15k/i)).toBeInTheDocument()
    expect(await screen.findByText(/tokens · 5 sessions/i)).toBeInTheDocument()
  })

  it('keeps the same "Last 16 weeks" range label after switching to heatmap view', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 16 weeks/i)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    await userEvent.click(heatmapBtn)
    expect(await screen.findByText(/Last 16 weeks/i)).toBeInTheDocument()
  })

  it('renders the DualLineChart in line view (Recharts wrapper present)', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    // Wait for data to load (tokens total appears once queries resolve)
    expect(await screen.findByText(/15k/i)).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('does not render the Recharts wrapper in heatmap view', async () => {
    setupMockFetch()
    const { container } = render(<MenubarPage />, { wrapper })
    await screen.findByText(/Last 16 weeks/i)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders the footer meta line with peak day for line view', async () => {
    setupMockFetch()
    render(<MenubarPage />, { wrapper })
    // Wait for data to load. The footer reads:
    //   peak {DOW MMM D} · {peakTokens} · {peakSessions} sessions
    // Mocked tokens peak at 10_000 on 2026-05-22 → "10k"; 3 sessions that day.
    const footer = await screen.findByText(/peak/i)
    expect(footer.textContent).toMatch(/10k/)
    expect(footer.textContent).toMatch(/3 sessions/)
  })

  it('renders an Open OhMyC button that invokes open_main_window then hide_popover', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    ;(invoke as ReturnType<typeof vi.fn>).mockClear()

    const { findByRole } = render(<MenubarPage />, { wrapper })
    const button = await findByRole('button', { name: /open ohmyc/i })

    fireEvent.click(button)

    await waitFor(() => {
      const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])
      expect(calls).toEqual(['open_main_window', 'hide_popover'])
    })
  })
})
