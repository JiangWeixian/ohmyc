import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { SetupGate } from '@/app-setup-gate'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

vi.mock('@/app-shell', () => ({
  AppLayout: () => <nav aria-label="Primary">Ready shell</nav>,
  AppCommandPalette: () => <div data-testid="command-palette" />,
}))

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="path">{location.pathname}</output>
}

function renderGate(initialEntries = ['/explore/timeline']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>
        <SetupGate />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('SetupGate', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders OnboardingGate (and not the Explorer) when not ready', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeTruthy()
    expect(screen.getByLabelText('path').textContent).toBe('/onboard')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(screen.queryByTestId('command-palette')).toBeNull()
  })

  it('renders the normal shell when ready', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    renderGate(['/explore/timeline'])
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByTestId('command-palette')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('redirects a ready direct /onboard visit back to timeline', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    renderGate(['/onboard'])
    await waitFor(() => {
      expect(screen.getByLabelText('path').textContent).toBe('/explore/timeline')
    })
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('leaves /menubar on the ready shell for the menubar-internal gate', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate(['/menubar'])
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByLabelText('path').textContent).toBe('/menubar')
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('renders a minimal checking state while loading', () => {
    // Handler never resolves → query stays pending.
    setMockHandler('setup.status', async () => {
      await new Promise(() => {})
      return { state: 'ready' }
    })
    const { container } = renderGate()
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
    expect(container.querySelector('.onboarding-spike')).toBeNull()
  })
})
