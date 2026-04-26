import { screen } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { Explorer } from '../explorer'
import { renderWithProviders } from '../test/render-with-providers'

vi.mock('../hooks/use-agents', () => ({
  useAgents: () => ({ data: [], isLoading: false, isError: false }),
  useAgent: () => ({ data: null }),
}))

vi.mock('../hooks/use-skills', () => ({
  useSkills: () => ({ data: [], isLoading: false, isError: false }),
  useSkill: () => ({ data: null }),
}))

vi.mock('../hooks/use-commands', () => ({
  useCommands: () => ({ data: [], isLoading: false, isError: false }),
  useCommand: () => ({ data: null }),
}))

vi.mock('../hooks/use-configs', () => ({
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

vi.mock('../hooks/use-plugins', () => ({
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

vi.mock('../hooks/use-profiles', () => ({
  useProfiles: () => ({
    data: {
      profiles: [
        { name: 'default', plugins: ['review-pack@market'], agents: [], skills: [], commands: [] },
      ],
      active: null,
    },
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
