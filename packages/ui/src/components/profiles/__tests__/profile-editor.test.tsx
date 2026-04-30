import { fireEvent, screen } from '@testing-library/react'
import React from 'react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../../test/render-with-providers'
import { ProfileEditor } from '../profile-editor'

import type { Profile } from '@claudeui/shared'

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()

vi.mock('../../../hooks/use-profiles', () => ({
  useCreateProfile: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateProfile: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}))

vi.mock('../../../hooks/use-store', () => ({
  useStoreAgents: () => ({
    data: [{ id: 'agent-a', frontmatter: { description: 'Test agent' } }],
    isLoading: false,
  }),
  useStoreSkills: () => ({
    data: [{ id: 'skill-a', frontmatter: { description: 'Test skill' } }],
    isLoading: false,
  }),
  useStoreCommands: () => ({
    data: [{ id: 'cmd-a', frontmatter: { description: 'Test command' } }],
    isLoading: false,
  }),
  useStoreModelConfigs: () => ({
    data: [
      { name: 'gpt-4', apiKey: 'sk-test-key-1234', baseUrl: 'https://api.openai.com', modelName: 'gpt-4', provider: 'openai' },
      { name: 'claude-3', apiKey: 'sk-ant-test-5678', baseUrl: 'https://api.anthropic.com', modelName: 'claude-3', provider: 'anthropic' },
    ],
    isLoading: false,
  }),
}))

vi.mock('../../../hooks/use-plugins', () => ({
  usePlugins: () => ({
    data: [
      { id: 'plugin-x', name: 'Plugin X', marketplace: 'npm' },
    ],
    isLoading: false,
  }),
}))

vi.mock('../../json-editor', () => ({
  JsonEditor: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div data-testid="json-editor">
      <textarea
        data-testid="json-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}))

describe('ProfileEditor', () => {
  beforeEach(() => {
    mockCreateMutate.mockReset()
    mockUpdateMutate.mockReset()
  })

  it('renders section headings Basics, Components, Plugins & model, Runtime config, and Settings overlay in order', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    const headings = screen.getAllByRole('heading', { level: 2 })
    const headingTexts = headings.map(h => h.textContent)

    const expected = ['Basics', 'Components', 'Plugins & model', 'Runtime config', 'Settings overlay']
    for (const label of expected) {
      expect(headingTexts).toContain(label)
    }
    const indexes = expected.map(l => headingTexts.indexOf(l))
    for (let i = 1; i < indexes.length; i++) {
      expect(indexes[i - 1]).toBeLessThan(indexes[i])
    }
  })

  it('renders the save button (disabled until dirty)', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    const button = screen.getByRole('button', { name: /Create profile/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('renders Agents, Skills, Commands picker cards and Plugins / Model Config panels', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Commands')).toBeInTheDocument()
    expect(screen.getByText(/Plugins \(/)).toBeInTheDocument()
    expect(screen.getByText('Model Config')).toBeInTheDocument()
  })

  it('renders New profile breadcrumb in create mode', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('New profile')).toBeInTheDocument()
  })

  it('renders breadcrumb with profile name and Edit in edit mode', () => {
    const profile: Profile = {
      name: 'my-profile',
      agents: [],
      skills: [],
      commands: [],
      plugins: [],
    }

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('my-profile')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('disables name input in edit mode', () => {
    const profile: Profile = {
      name: 'my-profile',
      agents: [],
      skills: [],
      commands: [],
      plugins: [],
    }

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    const nameInput = screen.getByPlaceholderText('my-profile')
    expect(nameInput).toBeDisabled()
  })

  it('calls create mutation on save with valid data', () => {
    mockCreateMutate.mockImplementation((_body: unknown, options: { onSuccess: () => void }) => {
      options.onSuccess()
    })

    const onSaved = vi.fn()
    renderWithProviders(
      <ProfileEditor onSaved={onSaved} onCancel={vi.fn()} />,
    )

    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Create profile/i }))

    expect(mockCreateMutate).toHaveBeenCalledTimes(1)
    const call = mockCreateMutate.mock.calls[0]
    expect(call[0].name).toBe('test-profile')
  })

  it('shows live error in the hooks code panel when JSON is invalid', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    const textareas = screen.getAllByTestId('json-textarea')
    fireEvent.change(textareas[0], { target: { value: '{invalid' } })
    expect(screen.getByText(/Hooks must be valid JSON/i)).toBeInTheDocument()
  })

  it('shows live error in the mcpServers code panel when JSON is invalid', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    const textareas = screen.getAllByTestId('json-textarea')
    fireEvent.change(textareas[1], { target: { value: 'not-json' } })
    expect(screen.getByText(/MCP Servers must be valid JSON/i)).toBeInTheDocument()
  })

  it('shows live error in the lspServers code panel when JSON is invalid', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    const textareas = screen.getAllByTestId('json-textarea')
    fireEvent.change(textareas[2], { target: { value: '}' } })
    expect(screen.getByText(/LSP Servers must be valid JSON/i)).toBeInTheDocument()
  })

  it('shows live error in the settings code panel when JSON is invalid', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    const textareas = screen.getAllByTestId('json-textarea')
    fireEvent.change(textareas[3], { target: { value: 'not valid' } })
    expect(screen.getByText(/Settings Overlay must be valid JSON/i)).toBeInTheDocument()
  })

  it('preserves existing profile data in edit mode', () => {
    const profile: Profile = {
      name: 'existing',
      description: 'A test profile',
      agents: ['agent-a'],
      skills: ['skill-a'],
      commands: ['cmd-a'],
      plugins: [],
    }

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByDisplayValue('existing')).toBeDisabled()
    expect(screen.getByDisplayValue('A test profile')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={onCancel} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
