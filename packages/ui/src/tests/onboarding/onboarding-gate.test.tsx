import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** missing_store plus a given agent-detection result — the install entry state. */
function detectable(agents: unknown[]): void {
  setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
  setMockHandler('setup.detect_agents', async () => agents)
}

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

  describe('one-click install', () => {
    it('offers to install for agents that are present and automatic', async () => {
      detectable([{ agent: 'claude', present: true, installed: false, automatic: true }])
      renderGate()
      expect(await screen.findByRole('button', { name: /install plugin/i })).toBeTruthy()
    })

    it('hides the install action when nothing is installable', async () => {
      detectable([
        { agent: 'claude', present: false, installed: false, automatic: true },
        { agent: 'codex', present: true, installed: false, automatic: false },
      ])
      renderGate()
      await screen.findByText('Monitor not connected')
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /install plugin/i })).toBeNull()
      })
      // The manual route must survive: it is the only way forward now.
      expect(screen.getByRole('link', { name: /open install instructions/i })).toBeTruthy()
    })

    it('falls back to the manual route when detection fails', async () => {
      setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
      setMockHandler('setup.detect_agents', async () => {
        throw new Error('no such command')
      })
      renderGate()
      await screen.findByText('Monitor not connected')
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /install plugin/i })).toBeNull()
      })
      expect(screen.getByRole('link', { name: /open install instructions/i })).toBeTruthy()
    })

    it('only asks to install the agents that need it', async () => {
      let requested: unknown
      detectable([
        { agent: 'claude', present: true, installed: false, automatic: true },
        { agent: 'codex', present: true, installed: false, automatic: false },
        { agent: 'opencode', present: true, installed: true, automatic: true },
      ])
      setMockHandler('setup.install', async (args) => {
        requested = args
        return [{ agent: 'claude', state: 'installed' }]
      })
      renderGate()

      await userEvent.click(await screen.findByRole('button', { name: /install plugin/i }))

      await waitFor(() => {
        expect(requested).toEqual({ agents: ['claude'] })
      })
    })

    it('switches to the installed state and explains that data comes next session', async () => {
      detectable([{ agent: 'claude', present: true, installed: false, automatic: true }])
      setMockHandler('setup.install', async () => [{ agent: 'claude', state: 'installed' }])
      renderGate()

      await userEvent.click(await screen.findByRole('button', { name: /install plugin/i }))

      expect(await screen.findByText('Plugin installed')).toBeTruthy()
      expect(
        screen.getByText(/recording starts with your next coding session/i),
      ).toBeTruthy()
      expect(screen.getByText('Claude Code: installed')).toBeTruthy()
    })

    it('shows the command for agents we will not install automatically', async () => {
      detectable([
        { agent: 'claude', present: true, installed: false, automatic: true },
        { agent: 'codex', present: true, installed: false, automatic: false },
      ])
      setMockHandler('setup.install', async () => [
        { agent: 'claude', state: 'installed' },
        { agent: 'codex', state: 'manual', hint: 'codex plugin add timeline@ohmyc' },
      ])
      renderGate()

      await userEvent.click(await screen.findByRole('button', { name: /install plugin/i }))

      expect(await screen.findByText('Codex: run this yourself')).toBeTruthy()
      expect(screen.getByText('codex plugin add timeline@ohmyc')).toBeTruthy()
    })

    it('keeps the not-connected framing and surfaces the reason when install fails', async () => {
      detectable([{ agent: 'claude', present: true, installed: false, automatic: true }])
      setMockHandler('setup.install', async () => [
        { agent: 'claude', state: 'failed', reason: 'installed_plugins.json is not valid JSON' },
      ])
      renderGate()

      await userEvent.click(await screen.findByRole('button', { name: /install plugin/i }))

      expect(
        await screen.findByText(/Claude Code: installed_plugins.json is not valid JSON/),
      ).toBeTruthy()
      expect(screen.getByText('Monitor not connected')).toBeTruthy()
    })
  })
})
