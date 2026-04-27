import { useLocation } from 'react-router-dom'

import { ActiveProfileChip } from './active-profile-chip'
import { CommandPaletteTrigger } from './command-palette-trigger'
import { cn } from '@/lib/utils'

function useBreadcrumb() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/profiles/new')) {
    return 'New Profile'
  }
  if (pathname.startsWith('/profiles/agents')) {
    return 'Agents'
  }
  if (pathname.startsWith('/profiles/skills')) {
    return 'Skills'
  }
  if (pathname.startsWith('/profiles/commands')) {
    return 'Commands'
  }
  if (pathname.startsWith('/profiles/model-configs')) {
    return 'Model Configs'
  }
  if (pathname.startsWith('/profiles/')) {
    const name = pathname.slice('/profiles/'.length)
    return name || 'Profiles'
  }
  if (pathname.startsWith('/profiles')) {
    return 'Profiles'
  }
  if (pathname.startsWith('/explore/')) {
    const tab = pathname.slice('/explore/'.length)
    const labels: Record<string, string> = {
      agents: 'Agents',
      skills: 'Skills',
      commands: 'Commands',
      plugins: 'Plugins',
      hooks: 'Hooks',
      mcp: 'MCP Servers',
      lsp: 'LSP Servers',
      settings: 'Settings',
    }
    return labels[tab] ?? tab
  }
  return 'Explorer'
}

interface HeaderProps {
  onCompare?: () => void
}

export function Header({ onCompare }: HeaderProps) {
  const breadcrumb = useBreadcrumb()

  return (
    <header
      className={cn(
        'h-16 bg-[#0f1011] border-b border-[rgba(255,255,255,0.05)]',
        'flex items-center justify-between px-6 shrink-0',
      )}
    >
      <span className="text-[13px] font-[510] text-[var(--text-tertiary)] tracking-[-0.01em]">
        {breadcrumb}
      </span>
      <div className="flex items-center gap-3">
        <CommandPaletteTrigger />
        <ActiveProfileChip onCompare={onCompare} />
      </div>
    </header>
  )
}
