import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { StoreComponentList } from '@/components/store/store-component-list'

const mockUseStoreAgents = vi.fn()
const mockUseStoreSkills = vi.fn()
const mockUseStoreCommands = vi.fn()
const mockUseStoreModelConfigs = vi.fn()

vi.mock('@/hooks/use-store', () => ({
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
}))

describe('StoreComponentList', () => {
  beforeEach(() => {
    mockUseStoreAgents.mockReturnValue({
      data: [
        {
          id: 'alpha-agent',
          frontmatter: { name: 'Alpha Agent', description: 'Primary agent', model: 'sonnet' },
          source: 'local',
          provenance: {
            importPath: '/tmp/source/alpha-agent.md',
            importedAt: '2026-03-29T00:00:00.000Z',
          },
        },
        {
          id: 'lonely-agent',
          frontmatter: { name: 'Lonely Agent', description: 'Nobody references me' },
          source: 'local',
        },
      ],
      isLoading: false,
    })
    mockUseStoreSkills.mockReturnValue({ data: [], isLoading: false })
    mockUseStoreCommands.mockReturnValue({ data: [], isLoading: false })
    mockUseStoreModelConfigs.mockReturnValue({ data: [], isLoading: false })
  })

  it('renders heading, counter line, and store rows without reference status', () => {
    renderWithProviders(<StoreComponentList category="agents" />)

    expect(screen.getByRole('heading', { name: 'Agents', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/2 agents/)).toBeInTheDocument()
    expect(screen.queryByText(/referenced/)).not.toBeInTheDocument()
    expect(screen.queryByText(/unused/)).not.toBeInTheDocument()

    expect(screen.getByText('Alpha Agent')).toBeInTheDocument()
    expect(screen.getByText('Lonely Agent')).toBeInTheDocument()
    expect(screen.queryByText('daily')).not.toBeInTheDocument()
  })

  it('filters items by name via the toolbar search', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StoreComponentList category="agents" />)

    await user.type(screen.getByLabelText('Search store components'), 'alpha')

    expect(screen.getByText('Alpha Agent')).toBeInTheDocument()
    expect(screen.queryByText('Lonely Agent')).not.toBeInTheDocument()
  })

  it('shows the empty state when the store has no components', () => {
    mockUseStoreAgents.mockReturnValue({ data: [], isLoading: false })

    renderWithProviders(<StoreComponentList category="agents" />)

    expect(screen.getByText('No agents in your store yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create agent' })).toBeInTheDocument()
  })
})
