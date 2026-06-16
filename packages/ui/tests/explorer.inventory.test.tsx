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

vi.mock('@/hooks/use-configs', () => ({
  useMcpServers: () => ({
    data: [
      { name: 'filesystem', config: {}, source: 'local' },
      { name: 'github', config: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
  useHooks: () => ({
    data: [
      { event: 'PreToolUse', name: 'PreToolUse [0]', data: {}, source: 'local' },
      { event: 'PostToolUse', name: 'PostToolUse [0]', data: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
  useLspServers: () => ({
    data: [
      { name: 'typescript', config: {}, source: 'local' },
      { name: 'eslint', config: {}, source: 'local' },
      { name: 'rust', config: {}, source: 'local' },
    ],
    isLoading: false,
    isError: false,
  }),
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
  it('shows current environment summary and plugin inventory details', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.getByText('Environment')).toBeInTheDocument()
    expect(screen.getAllByText('Hooks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('MCP servers')).toBeInTheDocument()
    expect(screen.getByText('LSP servers')).toBeInTheDocument()
    expect(screen.getByText('review-pack')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Agents: 1')).toBeInTheDocument()
    expect(screen.getByText('Skills: 1')).toBeInTheDocument()
    expect(screen.getByText('Commands: 1')).toBeInTheDocument()
  })

  it('shows the current environment summary only on plugins tab', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/plugins' },
    )

    expect(screen.getByText('Environment')).toBeInTheDocument()
    expect(screen.getAllByText('Hooks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MCP servers').length).toBeGreaterThan(0)
    expect(screen.getAllByText('LSP servers').length).toBeGreaterThan(0)
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

  it('does not show environment summary on hooks tab', () => {
    renderWithProviders(
      <Routes>
        <Route path="/explore/:tab" element={<Explorer />} />
      </Routes>,
      { route: '/explore/hooks' },
    )

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })
})
