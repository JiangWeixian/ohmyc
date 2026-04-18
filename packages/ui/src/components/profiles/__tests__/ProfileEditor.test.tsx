import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { ProfileEditor } from '../ProfileEditor';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { Profile } from '@claudeui/shared';

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock('../../../hooks/useProfiles', () => ({
  useCreateProfile: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateProfile: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
}));

vi.mock('../../../hooks/useStore', () => ({
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
}));

vi.mock('../../../hooks/usePlugins', () => ({
  usePlugins: () => ({
    data: [
      { id: 'plugin-x', name: 'Plugin X', marketplace: 'npm' },
    ],
    isLoading: false,
  }),
}));

vi.mock('../../JsonEditor', () => ({
  JsonEditor: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div data-testid="json-editor">
      <textarea
        data-testid="json-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

describe('ProfileEditor', () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockUpdateMutate.mockReset();
  });

  it('renders section headings Basics, Selections, and Runtime config in order', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const headings = screen.getAllByRole('heading', { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);

    const basicsIndex = headingTexts.indexOf('Basics');
    const selectionsIndex = headingTexts.indexOf('Selections');
    const runtimeIndex = headingTexts.indexOf('Runtime config');

    expect(basicsIndex).toBeGreaterThanOrEqual(0);
    expect(selectionsIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThanOrEqual(0);
    expect(basicsIndex).toBeLessThan(selectionsIndex);
    expect(selectionsIndex).toBeLessThan(runtimeIndex);
  });

  it('renders the save button with text Save Profile', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeInTheDocument();
  });

  it('renders grouped picker labels Agents, Skills, Commands, Plugins, and Model Config in the Selections section', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('Model Config')).toBeInTheDocument();
  });

  it('renders New Profile title in create mode', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('New Profile')).toBeInTheDocument();
  });

  it('renders Edit {name} title in edit mode', () => {
    const profile: Profile = {
      name: 'my-profile',
      agents: [],
      skills: [],
      commands: [],
      plugins: [],
    };

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('Edit my-profile')).toBeInTheDocument();
  });

  it('disables name input in edit mode', () => {
    const profile: Profile = {
      name: 'my-profile',
      agents: [],
      skills: [],
      commands: [],
      plugins: [],
    };

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const nameInput = screen.getByPlaceholderText('my-profile');
    expect(nameInput).toBeDisabled();
  });

  it('calls create mutation on save with valid data', () => {
    mockCreateMutate.mockImplementation((_body: unknown, opts: { onSuccess: () => void }) => {
      opts.onSuccess();
    });

    const onSaved = vi.fn();
    renderWithProviders(
      <ProfileEditor onSaved={onSaved} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    const call = mockCreateMutate.mock.calls[0];
    expect(call[0].name).toBe('test-profile');
  });

  it('shows inline error for invalid hooks JSON near the Hooks field', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    // Enter a name so we pass the name-required check
    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    });

    // Find the hooks json textarea and enter invalid JSON
    const textareas = screen.getAllByTestId('json-textarea');
    // First textarea is Hooks (first runtime config field)
    fireEvent.change(textareas[0], { target: { value: '{invalid' } });

    // Click save to trigger validation
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    // Expect inline error message near the Hooks field
    expect(screen.getByText(/Hooks must be valid JSON/i)).toBeInTheDocument();
  });

  it('shows inline error for invalid MCP Servers JSON', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    });

    const textareas = screen.getAllByTestId('json-textarea');
    // Second textarea is MCP Servers
    fireEvent.change(textareas[1], { target: { value: 'not-json' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    expect(screen.getByText(/MCP Servers must be valid JSON/i)).toBeInTheDocument();
  });

  it('shows inline error for invalid LSP Servers JSON', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    });

    const textareas = screen.getAllByTestId('json-textarea');
    // Third textarea is LSP Servers
    fireEvent.change(textareas[2], { target: { value: '}' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    expect(screen.getByText(/LSP Servers must be valid JSON/i)).toBeInTheDocument();
  });

  it('shows inline error for invalid Settings Overlay JSON', () => {
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('my-profile'), {
      target: { value: 'test-profile' },
    });

    const textareas = screen.getAllByTestId('json-textarea');
    // Fourth textarea is Settings Overlay
    fireEvent.change(textareas[3], { target: { value: 'not valid' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    expect(screen.getByText(/Settings Overlay must be valid JSON/i)).toBeInTheDocument();
  });

  it('preserves existing profile data in edit mode', () => {
    const profile: Profile = {
      name: 'existing',
      description: 'A test profile',
      agents: ['agent-a'],
      skills: ['skill-a'],
      commands: ['cmd-a'],
      plugins: [],
    };

    renderWithProviders(
      <ProfileEditor profile={profile} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByDisplayValue('existing')).toBeDisabled();
    expect(screen.getByDisplayValue('A test profile')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <ProfileEditor onSaved={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
