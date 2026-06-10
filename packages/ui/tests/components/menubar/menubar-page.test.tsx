import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { MenubarPage } from '@/components/menubar/menubar-page'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

import type { ReactNode } from 'react'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {}),
}))

function setupTimelineMock() {
  setMockHandler('timeline.heatmap', async (args) => {
    const { metric } = args as { metric: string }
    if (metric === 'tokens') {
      return {
        data: [
          { date: '2026-05-22', value: 10_000 },
          { date: '2026-05-21', value: 5000 },
        ],
      }
    }
    return {
      data: [
        { date: '2026-05-22', value: 3 },
        { date: '2026-05-21', value: 2 },
      ],
    }
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

beforeEach(() => {
  __setTransportForTests('mock')
  setupTimelineMock()
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('MenubarPage', () => {
  it('renders the ACTIVITY mono title in the header', async () => {
    render(<MenubarPage />, { wrapper })
    const title = await screen.findByText(/^Activity$/i)
    expect(title).toBeInTheDocument()
    expect(title.tagName.toLowerCase()).toBe('span')
  })

  it('keeps the ACTIVITY title after switching to heatmap view', async () => {
    render(<MenubarPage />, { wrapper })
    await screen.findByText(/^Activity$/i)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    await userEvent.click(heatmapBtn)
    expect(await screen.findByText(/^Activity$/i)).toBeInTheDocument()
  })

  it('renders the DualLineChart in line view (Recharts wrapper present)', async () => {
    const { container } = render(<MenubarPage />, { wrapper })
    // Activity is static JSX (renders before data); the waitFor below is what
    // actually gates on Recharts mounting once query data arrives.
    await screen.findByText(/^Activity$/i)
    await waitFor(() => expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument())
  })

  it('does not render the Recharts wrapper in heatmap view', async () => {
    const { container } = render(<MenubarPage />, { wrapper })
    await screen.findByText(/^Activity$/i)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders the footer with peak-day eyebrow and Open OhMyC link on one row', async () => {
    render(<MenubarPage />, { wrapper })
    // New footer: `peak {DOW MMM D}` (mono uppercase micro) on the left,
    // Open OhMyC link on the right. Peak token value + session count moved
    // into the KPI row (covered by the "three KPI cells" test).
    const footer = await screen.findByText(content => /^peak\s/.test(content))
    // Footer no longer carries the tokens or session-count strings:
    expect(footer.textContent).not.toMatch(/sessions/i)
    expect(footer.textContent).not.toMatch(/10k/)
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

  it('renders the three KPI cells with mono labels and values', async () => {
    render(<MenubarPage />, { wrapper })

    // Tokens sum: 10000 + 5000 = 15000 → "15k"
    expect(await screen.findByText(/^15k$/i)).toBeInTheDocument()
    expect(await screen.findByText(/^Tokens$/i)).toBeInTheDocument()

    // Sessions sum: 3 + 2 = 5
    expect(await screen.findByText(/^5$/)).toBeInTheDocument()
    expect(await screen.findByText(/^Sessions$/i)).toBeInTheDocument()

    // Peak day token value: max(10000, 5000) = 10000 → "10k"
    // The Recharts chart may also render "10k" as a tspan axis label; ensure
    // at least one matching element is the KPI <span> (not an SVG tspan).
    const peakValueEls = await screen.findAllByText(/^10k$/i)
    const hasSpan = peakValueEls.some(el => el.tagName.toLowerCase() === 'span')
    expect(hasSpan).toBe(true)
    expect(await screen.findByText(/^Peak$/i)).toBeInTheDocument()
  })
})
