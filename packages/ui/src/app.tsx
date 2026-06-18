// Root application component — sets up routing, command palette, and global keyboard shortcuts.
import {
  Activity,
  Bot,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import { CommandPalette, CommandPaletteProvider } from './components/command-palette'
import { MenubarPage } from './components/menubar/menubar-page'
import { LanyardStatsSpikeView } from './components/monitor-spike/lanyard-stats-spike-view'
import { MonitorSpikeView } from './components/monitor-spike/monitor-spike-view'
import { Explorer } from './explorer'
import { useAgents } from './hooks/use-agents'
import { useCommands } from './hooks/use-commands'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useSkills } from './hooks/use-skills'

/** Command palette content — exposes navigation and entity search. */
function AppCommandPalette() {
  const navigate = useNavigate()

  const { data: agents } = useAgents()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  const goToCommands = [
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
      action: () => navigate('/explore/timeline'),
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

/** Main layout with route configuration and global keyboard shortcuts. */
function AppLayout() {
  useGlobalKeyboardShortcuts()

  return (
    <div className="h-dvh overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Routes>
        <Route path="/explore/monitor-lanyard-stats-spike" element={<LanyardStatsSpikeView />} />
        <Route path="/explore/monitor-spike" element={<MonitorSpikeView />} />
        <Route path="/explore/:tab" element={<Explorer viewSwitcher={null} />} />
        <Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
        <Route path="/menubar" element={<MenubarPage />} />
        <Route path="*" element={<Navigate to="/explore/timeline" replace />} />
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
