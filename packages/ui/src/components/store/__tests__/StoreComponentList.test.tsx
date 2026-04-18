import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreComponentList } from '../StoreComponentList';
import { renderWithProviders } from '../../../test/renderWithProviders';

const mockUseStoreAgents = vi.fn();
const mockUseStoreSkills = vi.fn();
const mockUseStoreCommands = vi.fn();
const mockUseStoreModelConfigs = vi.fn();
const mockUseProfiles = vi.fn();

vi.mock('../../../hooks/useStore', () => ({
  useStoreAgents: () => mockUseStoreAgents(),
  useStoreSkills: () => mockUseStoreSkills(),
  useStoreCommands: () => mockUseStoreCommands(),
  useStoreModelConfigs: () => mockUseStoreModelConfigs(),
  useDeleteStoreAgent: () => ({ mutate: vi.fn() }),
  useDeleteStoreSkill: () => ({ mutate: vi.fn() }),
  useDeleteStoreCommand: () => ({ mutate: vi.fn() }),
  useDeleteStoreModelConfig: () => ({ mutate: vi.fn() }),
  useStoreAgent: () => ({ data: null }),
  useStoreSkill: () => ({ data: null }),
  useStoreCommand: () => ({ data: null }),
  useStoreModelConfig: () => ({ data: null }),
  useCreateStoreAgent: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreAgent: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStoreModelConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreModelConfig: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../hooks/useProfiles', () => ({
  useProfiles: () => mockUseProfiles(),
}));

describe('StoreComponentList', () => {
  beforeEach(() => {
    mockUseStoreAgents.mockReturnValue({
      data: [
        {
          id: 'alpha-agent',
          frontmatter: { name: 'Alpha Agent', description: 'Primary agent' },
          provenance: {
            importPath: '/tmp/source/alpha-agent.md',
            importedAt: '2026-03-29T00:00:00.000Z',
          },
        },
      ],
      isLoading: false,
    });
    mockUseStoreSkills.mockReturnValue({
      data: [
        {
          id: 'review-skill',
          frontmatter: { name: 'Review Skill', description: 'Checks diffs' },
        },
      ],
      isLoading: false,
    });
    mockUseStoreCommands.mockReturnValue({
      data: [
        {
          id: 'ship-command',
          frontmatter: { name: 'Ship Command', description: 'Publishes changes' },
        },
      ],
      isLoading: false,
    });
    mockUseStoreModelConfigs.mockReturnValue({ data: [], isLoading: false });
    mockUseProfiles.mockReturnValue({
      data: {
        profiles: [{ name: 'daily', agents: ['alpha-agent'], skills: [], commands: [], modelConfig: null }],
      },
    });
  });

  it('filters by name and type while keeping provenance secondary', async () => {
    const user = userEvent.setup();

    renderWithProviders(<StoreComponentList category="all" />);

    await user.type(screen.getByLabelText('Search store components'), 'alpha');
    expect(screen.getByText('Alpha Agent')).toBeInTheDocument();
    await user.click(screen.getByText('Source details'));
    expect(screen.getByText(/importPath/i)).toBeInTheDocument();
    expect(screen.getByText(/\/tmp\/source\/alpha-agent\.md/)).toBeInTheDocument();
    expect(screen.getByText(/importedAt/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search store components'));
    await user.selectOptions(screen.getByLabelText('Filter by type'), 'commands');

    expect(screen.getByText('Ship Command')).toBeInTheDocument();
  });

  it('shows the exact empty state copy when the store has no components', () => {
    mockUseStoreAgents.mockReturnValue({ data: [], isLoading: false });
    mockUseStoreSkills.mockReturnValue({ data: [], isLoading: false });
    mockUseStoreCommands.mockReturnValue({ data: [], isLoading: false });
    mockUseStoreModelConfigs.mockReturnValue({ data: [], isLoading: false });

    renderWithProviders(<StoreComponentList category="all" />);

    expect(screen.getByText('No components in this store yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Import agents, skills, or commands from an existing Claude-compatible directory to start building a canonical local store.',
      ),
    ).toBeInTheDocument();
  });
});
