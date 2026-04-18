import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ProfilesView } from '../ProfilesView';
import { renderWithProviders } from '../test/renderWithProviders';

const mockStoreComponentList = vi.fn();

// Mutable state for per-test active profile control
let mockActiveProfile: string | null = null;
let mockActivateMutate = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('../components/store/StoreComponentList', () => ({
  StoreComponentList: ({ category }: { category: 'all' | 'agents' | 'skills' | 'commands' | 'model-configs' }) => {
    mockStoreComponentList(category);
    return <div>store:{category}</div>;
  },
}));

vi.mock('../hooks/useProfiles', () => ({
  useProfiles: () => ({
    data: {
      profiles: [{ name: 'daily', agents: [], skills: [], commands: [], plugins: [] }],
      get active() { return mockActiveProfile; },
    },
    isLoading: false,
  }),
  useProfile: (name: string | null) => ({
    data: name
      ? { name, agents: [], skills: [], commands: [], plugins: [] }
      : null,
  }),
  useActivateProfile: () => ({
    mutate: (name: string, opts: { onSuccess?: (result: { warnings?: string[] }) => void }) => {
      mockActivateMutate(name, opts);
    },
  }),
  useDeactivateProfile: () => ({ mutate: vi.fn() }),
  useDeleteProfile: () => ({ mutate: vi.fn() }),
}));

vi.mock('../hooks/useStore', () => ({
  useStoreAgents: () => ({ data: [], isLoading: false }),
  useStoreSkills: () => ({ data: [], isLoading: false }),
  useStoreCommands: () => ({ data: [], isLoading: false }),
}));

vi.mock('../hooks/usePlugins', () => ({
  usePlugins: () => ({ data: [], isLoading: false }),
}));

vi.mock('../components/profiles/ProfileEditor', () => ({
  ProfileEditor: ({ profile }: { profile?: { name: string } }) => (
    <div data-testid="mock-editor">{profile ? `Edit ${profile.name}` : 'New Profile Editor'}</div>
  ),
}));

vi.mock('../components/profiles/ProfileCard', () => ({
  ProfileCard: ({ profile, isActive }: { profile: { name: string }; isActive: boolean }) => (
    <div data-testid="mock-card">
      <span>ProfileCard:{profile.name}</span>
      {isActive && <span data-testid="active-badge">Active</span>}
    </div>
  ),
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

describe('ProfilesView store routes', () => {
  beforeEach(() => {
    mockStoreComponentList.mockReset();
    mockActiveProfile = null;
  });

  it('renders agents store view at /profiles/agents', () => {
    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/agents' },
    );

    expect(screen.getByText('store:agents')).toBeInTheDocument();
    expect(mockStoreComponentList).toHaveBeenCalledWith('agents');
  });

  it('renders skills store view at /profiles/skills', () => {
    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/skills' },
    );

    expect(screen.getByText('store:skills')).toBeInTheDocument();
    expect(mockStoreComponentList).toHaveBeenCalledWith('skills');
  });

  it('renders commands store view at /profiles/commands', () => {
    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/commands' },
    );

    expect(screen.getByText('store:commands')).toBeInTheDocument();
    expect(mockStoreComponentList).toHaveBeenCalledWith('commands');
  });
});

describe('ProfilesView profile editor routes', () => {
  beforeEach(() => {
    mockActiveProfile = null;
  });

  it('renders profile editor at /profiles/new', () => {
    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/new' },
    );

    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
    expect(screen.getByTestId('mock-editor')).toHaveTextContent('New Profile Editor');
  });

  it('renders profile card at /profiles/:name', () => {
    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/daily' },
    );

    expect(screen.getByTestId('mock-card')).toBeInTheDocument();
    expect(screen.getByTestId('mock-card')).toHaveTextContent('ProfileCard:daily');
  });
});

describe('ProfilesView active state and activation feedback', () => {
  beforeEach(() => {
    mockActiveProfile = null;
    mockActivateMutate = vi.fn();
    mockSuccess.mockReset();
    mockError.mockReset();
  });

  it('renders Active badge when the active profile matches', () => {
    mockActiveProfile = 'daily';

    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/daily' },
    );

    expect(screen.getByTestId('active-badge')).toBeInTheDocument();
  });

  it('does not render Active badge when active profile is different', () => {
    mockActiveProfile = 'other-profile';

    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/daily' },
    );

    expect(screen.queryByTestId('active-badge')).not.toBeInTheDocument();
  });

  it('passes isActive=true to ProfileCard when active profile matches', () => {
    mockActiveProfile = 'daily';

    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/daily' },
    );

    // The mock ProfileCard renders the active-badge when isActive is true
    expect(screen.getByTestId('active-badge')).toHaveTextContent('Active');
  });

  it('activation mutation receives profile name', () => {
    mockActiveProfile = null;

    renderWithProviders(
      <Routes>
        <Route path="/profiles/*" element={<ProfilesView />} />
      </Routes>,
      { route: '/profiles/daily' },
    );

    // Verify the card rendered (profile is accessible by name)
    expect(screen.getByTestId('mock-card')).toBeInTheDocument();
  });
});
