import {
  FolderOpen,
  LayoutGrid,
  Settings,
  User,
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
import { CommandPalette, CommandPaletteProvider } from './components/ui/command-palette'
import { type ViewId, ViewSwitcher } from './components/view-switcher'
import { Explorer } from './explorer'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useProfiles } from './hooks/use-profiles'
import { ProfilesView } from './profiles-view'

function AppCommandPalette() {
  const navigate = useNavigate()
  const { data } = useProfiles()
  const profiles = data?.profiles ?? []

  const commands = [
    ...profiles.slice(0, 3).map((p, i) => ({
      id: `profile-${p.name}`,
      label: p.name,
      shortcut: `⌘${i + 1}`,
      icon: <User size={14} />,
      category: 'Profiles',
      action: () => navigate(`/profiles/${p.name}`),
    })),
    {
      id: 'goto-profiles',
      label: 'Go to Profiles',
      shortcut: 'gp',
      icon: <FolderOpen size={14} />,
      category: 'Go to',
      action: () => navigate('/profiles'),
    },
    {
      id: 'goto-explorer',
      label: 'Go to Explorer',
      shortcut: 'ge',
      icon: <LayoutGrid size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/agents'),
    },
    {
      id: 'goto-settings',
      label: 'Go to Settings',
      shortcut: 'gs',
      icon: <Settings size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/settings'),
    },
  ]

  return <CommandPalette commands={commands} placeholder="Search profiles and commands..." />
}

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  const active: ViewId = location.pathname.startsWith('/profiles') ? 'profiles' : 'agent-home'

  const handleChange = (id: ViewId) => {
    navigate(id === 'profiles' ? '/profiles' : '/explore')
  }

  useGlobalKeyboardShortcuts()

  return (
    <div className="h-dvh flex flex-col bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Header />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/profiles/*" element={<ProfilesView viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
          <Route path="/explore/:tab" element={<Explorer viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
          <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
          <Route path="*" element={<Navigate to="/profiles" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return (
    <CommandPaletteProvider>
      <AppLayout />
      <AppCommandPalette />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' } }} />
    </CommandPaletteProvider>
  )
}
