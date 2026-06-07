// Page header — displays breadcrumb navigation and command palette trigger.
import { useLocation } from 'react-router-dom'

import { CommandPaletteTrigger } from './command-palette-trigger'
import { SourceSwitcher } from './source-switcher'
import { cn } from '@/lib/utils'

/** Derives breadcrumb labels from the current React Router pathname. */
function useBreadcrumb(): { root: string; current: string } {
  const { pathname } = useLocation()
  if (pathname.startsWith('/explore/')) {
    const tab = pathname.slice('/explore/'.length)
    const labels: Record<string, string> = {
      timeline: 'Timeline',
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

/** Top navigation bar with breadcrumb, command palette trigger, and source switcher. */
export function Header() {
  const breadcrumb = useBreadcrumb()
  const { pathname } = useLocation()
  const showSourceSwitcher = pathname.startsWith('/explore/')

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
        {showSourceSwitcher && <SourceSwitcher />}
        <CommandPaletteTrigger />
      </div>
    </header>
  )
}
