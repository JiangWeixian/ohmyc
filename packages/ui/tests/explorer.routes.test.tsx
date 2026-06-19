import {
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from './test/render-with-providers'
import { App } from '@/app'
import { Explorer } from '@/explorer'

const opencodeAgentFixture = {
  id: 'opencode-agent',
  source: 'opencode' as const,
  scope: 'user' as const,
  pluginId: null,
  filePath: '/tmp/opencode-agent.md',
  content: '# Opencode agent',
  frontmatter: {
    name: 'opencode-agent',
    description: 'An opencode agent with mode + permission',
    mode: 'primary',
    permission: { edit: 'deny', bash: 'ask' },
  },
  origins: ['opencode'],
  badges: [],
}

vi.mock('@/hooks/use-agents', () => ({
  useAgents: () => ({ data: [opencodeAgentFixture], isLoading: false, isError: false }),
  useAgent: () => ({ data: opencodeAgentFixture }),
}))

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({ data: [], isLoading: false, isError: false }),
  useSkill: () => ({ data: null }),
}))

vi.mock('@/hooks/use-commands', () => ({
  useCommands: () => ({ data: [], isLoading: false, isError: false }),
  useCommand: () => ({ data: null }),
}))

vi.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    data: [
      {
        id: 'review-pack@market',
        name: 'review-pack',
        marketplace: 'market',
        enabled: true,
        installs: [{ version: '1.0.0' }],
        componentCounts: {
          agents: 1,
          skills: 1,
          commands: 1,
        },
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useMarketplaces: () => ({
    data: [{ id: 'market' }],
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/components/monitor-spike/monitor-spike-view', () => ({
  MonitorSpikeView: () => <div data-testid="monitor-spike-route">Monitor spike route</div>,
}))

vi.mock('@/components/monitor-spike/lanyard-stats-spike-view', () => ({
  LanyardStatsSpikeView: () => <div data-testid="lanyard-stats-spike-route">Lanyard stats spike route</div>,
}))

describe('Explorer route views', () => {
  it('shows the floating navigation island with Signal and Explore groups', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    const island = screen.getByRole('navigation', { name: 'Primary' })

    expect(island).toHaveTextContent('OhMyC')
    expect(island).toHaveTextContent('coding monitor')
    expect(island).toHaveTextContent('Signal')
    expect(island).toHaveTextContent('Monitor')
    expect(island).toHaveTextContent('Timeline')
    expect(island).toHaveTextContent('Explore')
    expect(island).toHaveTextContent('Agents')
    expect(island).toHaveTextContent('Commands')
    expect(island).toHaveTextContent('Skills')
    expect(island).toHaveTextContent('Plugins')

    expect(document.querySelector('aside')).not.toBeInTheDocument()
    expect(document.querySelector('main header')).not.toBeInTheDocument()
  })

  it('collapses the navigation island to a single icon button and expands it again', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    const collapseButton = document.querySelector('button[aria-label="Collapse navigation"]')
    expect(collapseButton).not.toBeNull()
    fireEvent.click(collapseButton as HTMLElement)

    let expandButton: HTMLButtonElement | null = null
    await waitFor(() => {
      expandButton = document.querySelector('button[aria-label="Expand navigation"]')
      expect(expandButton).not.toBeNull()
    })

    fireEvent.click(expandButton as HTMLButtonElement)

    await waitFor(() => {
      expect(document.querySelector('a[href="/explore/timeline"]')?.textContent).toContain('Timeline')
    })
  })

  it('renders Monitor route as a full-bleed personal coding monitor surface', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/monitor' },
    )

    expect(screen.getByRole('heading', { name: 'Coding Monitor' })).toBeInTheDocument()
    expect(screen.getByText('sessions')).toBeInTheDocument()
    expect(screen.getByText('tokens')).toBeInTheDocument()
    expect(screen.getByText('last sync')).toBeInTheDocument()
    expect(screen.queryByTestId('explorer-content-shell')).not.toBeInTheDocument()
  })

  it('uses an island-aware content shell for non-Monitor routes', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    const shell = screen.getByTestId('explorer-content-shell')

    expect(shell).toHaveClass('pl-[280px]')
    expect(shell).toHaveClass('max-lg:pl-[260px]')
  })

  it('shows plugin inventory details without the Environment summary', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
    expect(screen.queryByText('Current workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Hooks')).not.toBeInTheDocument()
    expect(screen.queryByText('MCP servers')).not.toBeInTheDocument()
    expect(screen.queryByText('LSP servers')).not.toBeInTheDocument()

    expect(screen.getByText('review-pack')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Agents: 1')).toBeInTheDocument()
    expect(screen.getByText('Skills: 1')).toBeInTheDocument()
    expect(screen.getByText('Commands: 1')).toBeInTheDocument()
    expect(screen.getByText('Installs: 1')).toBeInTheDocument()
    expect(screen.getByText('Marketplace: market')).toBeInTheDocument()
  })

  it('renders flattened permission.* rows and mode in the detail panel for opencode agents', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/agents' },
    )

    // Click the agent card to open the detail panel.
    const card = screen.getByText('opencode-agent')
    fireEvent.click(card)

    // mode + primary
    expect(screen.getByText('mode')).toBeInTheDocument()
    expect(screen.getByText('primary')).toBeInTheDocument()
    // permission.edit + deny
    expect(screen.getByText('permission.edit')).toBeInTheDocument()
    expect(screen.getByText('deny')).toBeInTheDocument()
    // permission.bash + ask
    expect(screen.getByText('permission.bash')).toBeInTheDocument()
    expect(screen.getByText('ask')).toBeInTheDocument()
  })

  it('clears resource detail selection when navigating between island routes', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/agents' },
    )

    fireEvent.click(screen.getByText('opencode-agent'))

    expect(screen.getByText('permission.edit')).toBeInTheDocument()

    const pluginsLink = document.querySelector('a[href="/explore/plugins"]')
    expect(pluginsLink).not.toBeNull()
    fireEvent.click(pluginsLink as HTMLElement)

    expect(screen.getByText('review-pack')).toBeInTheDocument()

    const agentsLink = document.querySelector('a[href="/explore/agents"]')
    expect(agentsLink).not.toBeNull()
    fireEvent.click(agentsLink as HTMLElement)

    expect(screen.queryByText('permission.edit')).not.toBeInTheDocument()
    expect(screen.getByText('opencode-agent')).toBeInTheDocument()
  })

  it.each([
    ['/explore/hooks', 'Hooks', 'No hooks configured in settings.json'],
    ['/explore/mcp', 'MCP Servers', 'No MCP servers configured in .mcp.json'],
    ['/explore/lsp', 'LSP Servers', 'No LSP servers configured in .lsp.json'],
  ])('treats %s as a removed Explorer tab and falls back to Timeline content', (route, removedHeading, removedEmptyState) => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route },
    )

    const main = document.querySelector('main')
    const timelineHeading = document.querySelector('main h1')

    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveTextContent('Timeline')
    expect(timelineHeading?.textContent).toBe('Timeline')
    expect(main?.textContent).not.toContain(removedHeading)
    expect(screen.queryByText(removedEmptyState)).not.toBeInTheDocument()
  })

  it('treats /explore/settings as an invalid tab and falls back to timeline content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/settings' },
    )

    expect(document.body.textContent).toContain('Timeline')
    expect(document.body.textContent).not.toContain('Settings panel')
    expect(document.body.textContent).not.toContain('General')
    expect(document.body.textContent).not.toContain('Configure your general settings')
  })

  it('keeps resource page internals while changing only the shell', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    const main = document.querySelector('main')

    expect(main?.textContent).toContain('Plugins')
    expect(main?.textContent).toContain('Inspect installed plugins, enabled state, and bundled component counts for the current environment.')
    expect(main?.textContent).toContain('review-pack')
    expect(main?.textContent).toContain('Enabled')
    expect(main?.textContent).toContain('Agents: 1')
    expect(main?.textContent).toContain('Skills: 1')
    expect(main?.textContent).toContain('Commands: 1')
  })

  it('keeps Timeline route owned content inside the new shell', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveTextContent('Timeline')
    expect(document.querySelector('main h1')?.textContent).toBe('Timeline')
    expect(document.body.textContent).toContain('Every Claude Code session')
  })
})

describe('Explorer spike routes', () => {
  it('renders the monitor spike route', () => {
    renderWithProviders(<App />, { route: '/explore/monitor-spike' })

    expect(screen.getByTestId('monitor-spike-route')).toBeInTheDocument()
  })

  it('renders the lanyard stats spike route', () => {
    renderWithProviders(<App />, { route: '/explore/monitor-lanyard-stats-spike' })

    expect(screen.getByTestId('lanyard-stats-spike-route')).toBeInTheDocument()
  })
})
