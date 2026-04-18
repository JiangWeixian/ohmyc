import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreComponentEditor } from '../StoreComponentEditor';
import { renderWithProviders } from '../../../test/renderWithProviders';

const createAgentMutate = vi.fn();
const updateAgentMutate = vi.fn();
const existingAgent = {
  id: 'existing-agent',
  frontmatter: { name: 'Existing Agent', description: 'Existing description' },
  content: 'Existing content',
};

vi.mock('../../../hooks/useStore', () => ({
  useStoreAgent: (name: string | null) => ({
    data: name === 'existing-agent' ? existingAgent : null,
  }),
  useStoreSkill: () => ({ data: null }),
  useStoreCommand: () => ({ data: null }),
  useCreateStoreAgent: () => ({ mutate: createAgentMutate, isPending: false }),
  useUpdateStoreAgent: () => ({ mutate: updateAgentMutate, isPending: false }),
  useCreateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStoreCommand: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('StoreComponentEditor', () => {
  beforeEach(() => {
    createAgentMutate.mockReset();
    updateAgentMutate.mockReset();
  });

  it('shows validation messages for create and calls save on success', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'fresh-agent');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Description is required for agents')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Description'), 'Creates a new thing');
    await user.type(screen.getByLabelText('Content (Markdown)'), 'System prompt');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(createAgentMutate).toHaveBeenCalledWith(
      {
        frontmatter: { name: 'fresh-agent', description: 'Creates a new thing' },
        content: 'System prompt',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('loads edit values, saves updates, and shows destructive delete copy', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <StoreComponentEditor
        category="agents"
        editName="existing-agent"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Existing description')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Updated description');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateAgentMutate).toHaveBeenCalledWith(
      {
        name: 'existing-agent',
        body: {
          frontmatter: { name: 'Existing Agent', description: 'Updated description' },
          content: 'Existing content',
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete this store component?')).toBeInTheDocument();
  });
});
