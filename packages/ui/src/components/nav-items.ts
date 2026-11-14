// Single source of truth for first-class explorer navigation. Consumed by
// the route table (app-shell.tsx), the command palette goToCommands, and
// NavigationIsland. Adding a destination here + a matching <Route> line is
// the only change required; a unit test enforces the two stay in sync.
import {
  Activity,
  Blocks,
  Bot,
  Code2,
  Gauge,
  Settings,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export type NavItemId = 'agents' | 'commands' | 'monitor' | 'plugins' | 'quota' | 'settings' | 'skills' | 'timeline'

export interface NavItem {
  id: NavItemId
  path: `/explore/${NavItemId}`
  label: string
  icon: LucideIcon
  /** Single uppercase letter. Shown on the NavigationIsland and used for the `g <key>` ⌘K shortcut. */
  keycap: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'monitor', path: '/explore/monitor', label: 'Monitor', icon: Code2, keycap: 'M' },
  { id: 'timeline', path: '/explore/timeline', label: 'Timeline', icon: Activity, keycap: 'T' },
  { id: 'quota', path: '/explore/quota', label: 'Quota', icon: Gauge, keycap: 'Q' },
  { id: 'agents', path: '/explore/agents', label: 'Agents', icon: Bot, keycap: 'A' },
  { id: 'commands', path: '/explore/commands', label: 'Commands', icon: TerminalSquare, keycap: 'C' },
  { id: 'skills', path: '/explore/skills', label: 'Skills', icon: Sparkles, keycap: 'S' },
  { id: 'plugins', path: '/explore/plugins', label: 'Plugins', icon: Blocks, keycap: 'P' },
  { id: 'settings', path: '/explore/settings', label: 'Settings', icon: Settings, keycap: 'E' },
]
