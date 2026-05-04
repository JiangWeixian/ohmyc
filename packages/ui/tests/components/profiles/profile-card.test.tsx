import { screen } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { ProfileCard } from '@/components/profiles/profile-card'

import type { Profile } from '@ohmyc/shared'

vi.mock('@/hooks/use-profiles', () => ({
  usePreflight: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/hooks/use-store', () => ({
  useStoreModelConfigs: () => ({
    data: [
      { name: 'gpt-4', apiKey: 'sk-test-key-1234', baseUrl: 'https://api.openai.com', modelName: 'gpt-4', provider: 'openai' },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/utils/mask-api-key', () => ({
  maskApiKey: (key: string) => `****${key.slice(-4)}`,
}))

const baseProfile: Profile = {
  name: 'daily',
  agents: [],
  skills: [],
  commands: [],
  plugins: [],
}

describe('ProfileCard', () => {
  it('renders component names in the Components section', () => {
    const profile: Profile = {
      ...baseProfile,
      agents: ['code-reviewer', 'test-writer'],
      skills: ['refactor'],
      commands: ['build', 'test', 'lint'],
      plugins: ['git-helper'],
    }

    renderWithProviders(
      <ProfileCard
        profile={profile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('code-reviewer')).toBeInTheDocument()
    expect(screen.getByText('test-writer')).toBeInTheDocument()
    expect(screen.getByText('refactor')).toBeInTheDocument()
    expect(screen.getByText('build')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('lint')).toBeInTheDocument()
    expect(screen.getByText('git-helper')).toBeInTheDocument()
  })

  it('renders runtime config key names', () => {
    const profile: Profile = {
      ...baseProfile,
      hooks: { 'pre-commit': { command: 'lint' }, 'post-merge': { command: 'install' } },
      mcpServers: { 'github-mcp': { url: 'http://localhost:3000' } },
      lspServers: { 'typescript-lsp': { command: 'tsserver' } },
      settings: { theme: 'dark', fontSize: 14 },
    }

    renderWithProviders(
      <ProfileCard
        profile={profile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(screen.getByText('Runtime config')).toBeInTheDocument()
    expect(screen.getByText('pre-commit')).toBeInTheDocument()
    expect(screen.getByText('post-merge')).toBeInTheDocument()
    expect(screen.getByText('github-mcp')).toBeInTheDocument()
    expect(screen.getByText('typescript-lsp')).toBeInTheDocument()
    expect(screen.getByText('theme')).toBeInTheDocument()
    expect(screen.getByText('fontSize')).toBeInTheDocument()
  })

  it('renders Active badge when isActive is true', () => {
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        isActive={true}
        activeProfileName="daily"
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    const badges = screen.getAllByText('Active')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render Active badge when isActive is false', () => {
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('hides empty groups instead of rendering placeholders', () => {
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(screen.queryByText(/No agents selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No skills selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No commands selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No plugins selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No model config selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No hooks configured/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No MCP servers configured/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No LSP servers configured/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No settings configured/i)).not.toBeInTheDocument()
  })

  it('does not render a <pre> element for raw settings JSON', () => {
    const profile: Profile = {
      ...baseProfile,
      settings: { theme: 'dark', fontSize: 14 },
    }

    const { container } = renderWithProviders(
      <ProfileCard
        profile={profile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(container.querySelector('pre')).not.toBeInTheDocument()
  })

  it('renders profile name and description', () => {
    const profile: Profile = {
      ...baseProfile,
      description: 'My daily driver profile',
    }

    renderWithProviders(
      <ProfileCard
        profile={profile}
        isActive={false}
        activeProfileName={null}
        onActivate={() => {}}
        onDeactivate={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
      />,
    )

    expect(screen.getByText('daily')).toBeInTheDocument()
    expect(screen.getByText('My daily driver profile')).toBeInTheDocument()
  })
})
