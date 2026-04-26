import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import { Header } from './components/header'
import { CommandPaletteProvider } from './components/ui/command-palette'
import { type ViewId, ViewSwitcher } from './components/view-switcher'
import { Explorer } from './explorer'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { ProfilesView } from './profiles-view'

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
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' } }} />
    </CommandPaletteProvider>
  )
}
