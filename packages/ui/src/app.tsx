// Root application component — sets up routing, command palette, and global keyboard shortcuts.
import {
  Activity,
  Bot,
  Check,
  Copy,
  FolderOpen,
  GitCompare,
  Pencil,
  Search,
  Settings,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import { Header } from './components/header'
import { ProfilesSidebar } from './components/profiles/profiles-sidebar'
import { TimelineView } from './components/timeline/timeline-view'
import { CommandPalette, CommandPaletteProvider } from './components/ui/command-palette'
import { type ViewId, ViewSwitcher } from './components/view-switcher'
import { Explorer } from './explorer'
import { useAgents } from './hooks/use-agents'
import { useCommands } from './hooks/use-commands'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useActivateProfile, useProfiles } from './hooks/use-profiles'
import { useSkills } from './hooks/use-skills'
import { ProfilesView } from './profiles-view'

/** Command palette content — exposes profile actions, navigation, and entity search. */
function AppCommandPalette() {
  const navigate = useNavigate()
  const { data } = useProfiles()
  const profiles = data?.profiles ?? []
  const active = data?.active
  const activeProfile = profiles.find(p => p.name === active)
  const activate = useActivateProfile()

  const { data: agents } = useAgents()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  const profileCommands = profiles
    .filter(p => p.name !== active)
    .map((p, i) => ({
      id: `activate-${p.name}`,
      label: `Activate ${p.name}`,
      shortcut: i < 3 ? `⌘${i + 1}` : undefined,
      icon: <Check size={14} />,
      category: 'Profile',
      action: () => activate.mutate(p.name),
    }))

  const compareCommands = profiles
    .filter(p => p.name !== active)
    .map(p => ({
      id: `compare-${p.name}`,
      label: `Compare ${p.name} with ${active ?? 'active'}`,
      icon: <GitCompare size={14} />,
      category: 'Profile',
      action: () => navigate(`/profiles?compare=${encodeURIComponent(p.name)}`),
    }))

  const activeProfileCommands = activeProfile
    ? [
        {
          id: 'edit-active',
          label: `Edit ${activeProfile.name}`,
          icon: <Pencil size={14} />,
          category: 'Profile' as const,
          action: () => navigate(`/profiles/${activeProfile.name}`),
        },
        {
          id: 'duplicate-active',
          label: `Duplicate ${activeProfile.name}`,
          icon: <Copy size={14} />,
          category: 'Profile' as const,
          action: () => navigate(`/profiles/new?from=${encodeURIComponent(activeProfile.name)}`),
        },
      ]
    : []

  const goToCommands = [
    {
      id: 'goto-profiles',
      label: 'Profiles',
      shortcut: 'g p',
      icon: <FolderOpen size={14} />,
      category: 'Go to',
      action: () => navigate('/profiles'),
    },
    {
      id: 'goto-agents',
      label: 'Agents',
      shortcut: 'g a',
      icon: <Bot size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/agents'),
    },
    {
      id: 'goto-skills',
      label: 'Skills',
      shortcut: 'g s',
      icon: <Sparkles size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/skills'),
    },
    {
      id: 'goto-commands',
      label: 'Commands',
      shortcut: 'g c',
      icon: <TerminalSquare size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/commands'),
    },
    {
      id: 'goto-timeline',
      label: 'Timeline',
      shortcut: 'g t',
      icon: <Activity size={14} />,
      category: 'Go to',
      action: () => navigate('/timeline'),
    },
    {
      id: 'goto-settings',
      label: 'Settings',
      icon: <Settings size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/settings'),
    },
  ]

  const searchCommands = [
    ...(agents ?? [])
      .filter(a => a.frontmatter.name)
      .map(a => ({
        id: `search-agent-${a.id}`,
        label: a.frontmatter.name as string,
        icon: <Search size={14} />,
        category: 'Search',
        action: () => navigate('/explore/agents'),
      })),
    ...(skills ?? [])
      .filter(s => s.frontmatter.name)
      .map(s => ({
        id: `search-skill-${s.id}`,
        label: s.frontmatter.name as string,
        icon: <Search size={14} />,
        category: 'Search',
        action: () => navigate('/explore/skills'),
      })),
    ...(commands ?? [])
      .filter(c => c.frontmatter.name)
      .map(c => ({
        id: `search-cmd-${c.id}`,
        label: `/${c.frontmatter.name as string}`,
        icon: <Search size={14} />,
        category: 'Search',
        action: () => navigate('/explore/commands'),
      })),
  ]

  const allCommands = [
    ...profileCommands,
    ...activeProfileCommands,
    ...compareCommands,
    ...goToCommands,
    ...searchCommands,
  ]

  return (
    <CommandPalette
      commands={allCommands}
      placeholder="Type a command or search…"
    />
  )
}

/** Renders the timeline view with the profiles sidebar and view switcher. */
function TimelineRoute({ viewSwitcher }: { viewSwitcher: React.ReactNode }) {
  const navigate = useNavigate()
  const { data } = useProfiles()
  const profiles = data?.profiles ?? []
  const active = data?.active ?? null

  return (
    <div className="flex h-full min-w-0">
      <ProfilesSidebar
        profiles={profiles}
        active={active}
        selection={null}
        timelineActive
        onSelect={(sel) => {
          if (sel.type === 'new-profile') {
            navigate('/profiles/new')
          } else if (sel.type === 'components') {
            navigate(`/profiles/${sel.category}`)
          } else {
            navigate(`/profiles/${sel.name}`)
          }
        }}
        headerSlot={viewSwitcher}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-marketing)]">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <TimelineView />
        </div>
      </main>
    </div>
  )
}

/** Main layout with route configuration and global keyboard shortcuts. */
function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  const active: ViewId = location.pathname.startsWith('/profiles') ? 'profiles' : 'agent-home'

  const handleChange = (id: ViewId) => {
    navigate(id === 'profiles' ? '/profiles' : '/explore')
  }

  useGlobalKeyboardShortcuts()

  return (
    <div className="h-dvh overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Routes>
        <Route path="/timeline" element={<TimelineRoute viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
        <Route path="/profiles/*" element={<ProfilesView viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
        <Route path="/explore/:tab" element={<Explorer viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
        <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
        <Route path="*" element={<Navigate to="/profiles" replace />} />
      </Routes>
    </div>
  )
}

/** Root exported component — wraps the app in the command palette provider and toaster. */
export function App() {
  return (
    <CommandPaletteProvider>
      <AppLayout />
      <AppCommandPalette />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' } }} />
    </CommandPaletteProvider>
  )
}
