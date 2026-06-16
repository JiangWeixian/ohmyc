import { fireEvent, screen } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from './test/render-with-providers'
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

describe('Explorer inventory views', () => {
  it('shows Timeline plus only the four core Explorer resource tabs in the sidebar', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    const tabs = [...document.querySelectorAll('[role="tab"]')]
    const timelineButton = document.querySelector('aside button')

    expect(timelineButton?.textContent).toBe('Timeline')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Agents',
      'Commands',
      'Skills',
      'Plugins',
    ])
    expect(tabs.map(tab => tab.textContent)).not.toContain('Hooks')
    expect(tabs.map(tab => tab.textContent)).not.toContain('MCP Servers')
    expect(tabs.map(tab => tab.textContent)).not.toContain('LSP Servers')
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
    const breadcrumb = document.querySelector('main header nav')

    expect(timelineHeading?.textContent).toBe('Timeline')
    expect(breadcrumb?.textContent).toContain('Timeline')
    expect(breadcrumb?.textContent).not.toContain(removedHeading)
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
})
