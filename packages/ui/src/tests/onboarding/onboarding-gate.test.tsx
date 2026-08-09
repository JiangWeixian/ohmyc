import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { OnboardingGate } from '@/components/onboarding/onboarding-gate'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

const PLUGIN_REPO = 'https://github.com/JiangWeixian/ohmyc-plugins'

function renderGate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <QueryClientProvider client={client}>
      <OnboardingGate />
    </QueryClientProvider>,
  )
}

describe('OnboardingGate', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders the monitor-not-connected copy for missing_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByText('Monitor not connected')).toBeTruthy()
    expect(
      screen.getByText('Install the OhMyC plugin to start collecting local AI coding activity.'),
    ).toBeTruthy()
  })

  it('renders the unreadable-store status line for unreadable_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'unreadable_store' }))
    renderGate()
    expect(
      await screen.findByText('Local monitor store exists but could not be opened.'),
    ).toBeTruthy()
  })

  it('renders the internal-error status line for internal_error', async () => {
    setMockHandler('setup.status', async () => ({ state: 'internal_error' }))
    renderGate()
    expect(
      await screen.findByText(
        'OhMyC could not confirm the monitor connection. Install the plugin, then check again.',
      ),
    ).toBeTruthy()
  })

  it('does not render the status line for missing_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    await screen.findByText('Monitor not connected')
    expect(screen.queryByText('Local monitor store exists but could not be opened.')).toBeNull()
  })

  it('links the primary action to the plugin repo', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    const link = await screen.findByRole('link', { name: /open install instructions/i })
    expect(link.getAttribute('href')).toBe(PLUGIN_REPO)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('renders a Retry button', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByRole('button', { name: /check again/i })).toBeTruthy()
  })
})
