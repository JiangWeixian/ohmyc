import {
  Activity,
  Bot,
  Code2,
  Search,
  TerminalSquare,
} from 'lucide-react'

export const commandPaletteCommands = [
  { id: 'monitor', label: 'Open Monitor', category: 'Go to', shortcut: 'g m', icon: <Code2 size={15} />, action: () => {} },
  { id: 'timeline', label: 'Open Timeline', category: 'Go to', shortcut: 'g t', icon: <Activity size={15} />, action: () => {} },
  { id: 'agents', label: 'Open Agents', category: 'Go to', shortcut: 'g a', icon: <Bot size={15} />, action: () => {} },
  { id: 'commands', label: 'Open Commands', category: 'Go to', shortcut: 'g c', icon: <TerminalSquare size={15} />, action: () => {} },
  { id: 'long', label: 'Open the generated command with a very long name without squeezing the shortcut column', category: 'Commands', shortcut: 'meta+shift+p', icon: <Search size={15} />, action: () => {} },
]
