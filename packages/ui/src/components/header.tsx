import { useLocation } from 'react-router-dom'

import { ActiveProfileChip } from './active-profile-chip'
import { CommandPaletteTrigger } from './command-palette-trigger'
import { cn } from '@/lib/utils'

function useBreadcrumb(): { root: string; current: string } {
  const { pathname } = useLocation()
  if (pathname.startsWith('/profiles/new')) {
    return { root: 'Profiles', current: 'New profile' }
  }
  const profileComponents: Record<string, string> = {
    agents: 'Agents',
    skills: 'Skills',
    commands: 'Commands',
    'model-configs': 'Model Configs',
  }
  for (const [key, label] of Object.entries(profileComponents)) {
    if (pathname.startsWith(`/profiles/${key}`)) {
      return { root: 'Profiles', current: label }
    }
  }
  if (pathname.startsWith('/profiles/')) {
    const name = pathname.slice('/profiles/'.length)
    return { root: 'Profiles', current: name || 'All profiles' }
  }
  if (pathname.startsWith('/profiles')) {
    return { root: 'Profiles', current: 'All profiles' }
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
    return { root: 'Explorer', current: labels[tab] ?? tab }
  }
  return { root: 'Explorer', current: '' }
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
      <nav className="flex items-center gap-2 text-[13px] tracking-[-0.01em]">
        <span className="text-[var(--text-tertiary)]">{breadcrumb.root}</span>
        {breadcrumb.current && (
          <>
            <span className="text-[rgba(255,255,255,0.08)]">/</span>
            <span className="font-[510] text-[var(--text-primary)]">{breadcrumb.current}</span>
          </>
        )}
      </nav>
      <div className="flex items-center gap-3">
        <CommandPaletteTrigger />
        <ActiveProfileChip onCompare={onCompare} />
      </div>
    </header>
  )
}
