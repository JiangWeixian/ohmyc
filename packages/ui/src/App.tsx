import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ViewSwitcher, type ViewId } from './components/ViewSwitcher';
import { CommandPaletteProvider } from './components/ui/CommandPalette';
import { ToastProvider } from './components/ui/Toast';
import Explorer from './Explorer';
import { ProfilesView } from './ProfilesView';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const active: ViewId = location.pathname.startsWith('/profiles') ? 'profiles' : 'agent-home';

  const handleChange = (id: ViewId) => {
    navigate(id === 'profiles' ? '/profiles' : '/explore');
  };

  return (
    <div className="h-dvh flex flex-col bg-[var(--surface-base)] text-[var(--text-primary)]">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/profiles/*" element={<ProfilesView viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
          <Route path="/explore/:tab" element={<Explorer viewSwitcher={<ViewSwitcher active={active} onChange={handleChange} />} />} />
          <Route path="/explore" element={<Navigate to="/explore/agents" replace />} />
          <Route path="*" element={<Navigate to="/explore/agents" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <CommandPaletteProvider>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </CommandPaletteProvider>
  );
}
