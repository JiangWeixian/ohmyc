// Ready-state app shell — route table, command palette, and global keyboard
// shortcuts. Extracted from app.tsx so the setup gate (app-setup-gate.tsx) can
// unit-test routing without mounting the toaster/provider composition.
import { Search } from 'lucide-react'
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'

import { CommandPalette } from './components/command-palette'
import { ExplorerLayout } from './components/explorer-layout'
import { MenubarPage } from './components/menubar/menubar-page'
import { NAV_ITEMS } from './components/nav-items'
import { useAgents } from './hooks/use-agents'
import { useCommands } from './hooks/use-commands'
import { useGlobalKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useSkills } from './hooks/use-skills'
import { AgentsPage } from './routes/agents-page'
import { CommandsPage } from './routes/commands-page'
import { MonitorPage } from './routes/monitor-page'
import { PluginsPage } from './routes/plugins-page'
import { SkillsPage } from './routes/skills-page'
import { TimelinePage } from './routes/timeline-page'
import { useThemeCommands } from './theme'

/** Command palette content — exposes navigation and entity search. */
export function AppCommandPalette() {
  const navigate = useNavigate()
  const themeCommands = useThemeCommands()

  const { data: agents } = useAgents()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  const goToCommands = NAV_ITEMS.map(item => ({
    id: `goto-${item.id}`,
    label: item.label,
    shortcut: `g ${item.keycap.toLowerCase()}`,
    icon: <item.icon size={14} />,
    category: 'Go to',
    action: () => navigate(item.path),
  }))

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
        <Route path="/explore/monitor" element={<ExplorerLayout padded={false}><MonitorPage /></ExplorerLayout>} />
        <Route path="/explore/timeline" element={<ExplorerLayout><TimelinePage /></ExplorerLayout>} />
        <Route path="/explore/agents" element={<ExplorerLayout><AgentsPage /></ExplorerLayout>} />
        <Route path="/explore/skills" element={<ExplorerLayout><SkillsPage /></ExplorerLayout>} />
        <Route path="/explore/commands" element={<ExplorerLayout><CommandsPage /></ExplorerLayout>} />
        <Route path="/explore/plugins" element={<ExplorerLayout><PluginsPage /></ExplorerLayout>} />

        <Route path="/explore" element={<Navigate to="/explore/timeline" replace />} />
        <Route path="/explore/*" element={<Navigate to="/explore/timeline" replace />} />
        <Route path="/onboard" element={<Navigate to="/explore/timeline" replace />} />

        <Route path="/menubar" element={<MenubarPage />} />

        <Route path="*" element={<Navigate to="/explore/timeline" replace />} />
      </Routes>
    </div>
  )
}
