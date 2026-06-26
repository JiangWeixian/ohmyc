// Ready-state app shell — route table, command palette, and global keyboard
// shortcuts. Extracted from app.tsx so the setup gate (app-setup-gate.tsx) can
// unit-test routing without mounting the toaster/provider composition.
import {
  Activity,
  Bot,
  Code2,
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

import { CommandPalette } from './components/command-palette'
import { MenubarPage } from './components/menubar/menubar-page'
import { LanyardStatsSpikeView } from './components/monitor-spike/lanyard-stats-spike-view'
import { MonitorSpikeView } from './components/monitor-spike/monitor-spike-view'
import { NavigationIsland } from './components/navigation-island'
import { Explorer } from './explorer'
import { useAgents } from './hooks/use-agents'
import { useCommands } from './hooks/use-commands'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useSkills } from './hooks/use-skills'
import { useThemeCommands } from './theme'

/** Command palette content — exposes navigation and entity search. */
export function AppCommandPalette() {
  const navigate = useNavigate()
  const themeCommands = useThemeCommands()

  const { data: agents } = useAgents()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  const goToCommands = [
    {
      id: 'goto-monitor',
      label: 'Monitor',
      shortcut: 'g m',
      icon: <Code2 size={14} />,
      category: 'Go to',
      action: () => navigate('/explore/monitor'),
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
    ...themeCommands,
  ]

  return (
    <CommandPalette
      commands={allCommands}
      placeholder="Type a command or search…"
    />
  )
}

/** Main layout with route configuration and global keyboard shortcuts. */
export function AppLayout() {
  useGlobalKeyboardShortcuts()

  return (
    <div className="h-dvh overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Routes>
        <Route path="/explore/monitor-lanyard-stats-spike" element={<><NavigationIsland /><LanyardStatsSpikeView /></>} />
        <Route path="/explore/monitor-spike" element={<><NavigationIsland /><MonitorSpikeView /></>} />
        <Route path="/explore/:tab" element={<Explorer viewSwitcher={null} />} />
        <Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
        <Route path="/menubar" element={<MenubarPage />} />
        <Route path="/onboard" element={<Navigate to="/explore/timeline" replace />} />
        <Route path="*" element={<Navigate to="/explore/timeline" replace />} />
      </Routes>
    </div>
  )
}
