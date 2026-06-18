import { motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  Atom,
  Blocks,
  Bot,
  PanelLeftClose,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { NavLink } from 'react-router-dom'

import { useCommandPalette } from '@/components/command-palette'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { LucideIcon } from 'lucide-react'

interface IslandItem {
  id: string
  label: string
  to: string
  icon: LucideIcon
}

const SIGNAL_ITEMS: IslandItem[] = [
  { id: 'monitor', label: 'Monitor', to: '/explore/monitor', icon: Atom },
  { id: 'timeline', label: 'Timeline', to: '/explore/timeline', icon: Activity },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { id: 'agents', label: 'Agents', to: '/explore/agents', icon: Bot },
  { id: 'commands', label: 'Commands', to: '/explore/commands', icon: TerminalSquare },
  { id: 'skills', label: 'Skills', to: '/explore/skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', to: '/explore/plugins', icon: Blocks },
]

export function NavigationIsland() {
  const [collapsed, setCollapsed] = useState(false)
  const reduceMotion = useReducedMotion()
  const { open } = useCommandPalette()
  const hasToggledRef = useRef(false)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const collapseButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!hasToggledRef.current) {
      return
    }

    if (collapsed) {
      expandButtonRef.current?.focus()
    } else {
      collapseButtonRef.current?.focus()
    }
  }, [collapsed])

  function updateCollapsed(nextCollapsed: boolean) {
    hasToggledRef.current = true
    setCollapsed(nextCollapsed)
  }

  function handleNavigate() {
    if (
      globalThis.window !== undefined
      && typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(max-width: 767px)').matches
    ) {
      updateCollapsed(true)
    }
  }

  if (collapsed) {
    return (
      <motion.div
        className="fixed left-[18px] top-[18px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        transition={{ duration: 0.18 }}
      >
        <Button
          ref={expandButtonRef}
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Expand navigation"
          aria-controls="primary-navigation-island"
          aria-expanded={false}
          onClick={() => updateCollapsed(false)}
          className={cn(
            'size-14 rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.72)]',
            'text-[var(--text-primary)] shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl',
            'hover:bg-[rgba(255,255,255,0.04)]',
          )}
        >
          <Atom size={20} aria-hidden="true" />
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.nav
      id="primary-navigation-island"
      aria-label="Primary"
      className={cn(
        'fixed left-[18px] top-[18px] z-40 w-[220px] overflow-hidden rounded-[14px]',
        'border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.72)]',
        'p-3 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl',
        'max-sm:left-[14px] max-sm:top-[14px] max-sm:w-[216px]',
      )}
      initial={reduceMotion ? false : { opacity: 0.92, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
            <Atom size={17} className="text-[var(--text-secondary)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-[590] text-[var(--text-primary)]">OhMyC</div>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              coding monitor
            </div>
          </div>
        </div>
        <Button
          ref={collapseButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Collapse navigation"
          aria-controls="primary-navigation-island"
          aria-expanded={true}
          onClick={() => updateCollapsed(true)}
          className="size-8 shrink-0 rounded-lg text-[var(--text-tertiary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]"
        >
          <PanelLeftClose size={15} aria-hidden="true" />
        </Button>
      </div>

      <IslandGroup label="Signal" items={SIGNAL_ITEMS} onNavigate={handleNavigate} />
      <IslandGroup label="Explore" items={EXPLORE_ITEMS} className="mt-4" onNavigate={handleNavigate} />

      <Button
        type="button"
        variant="ghost"
        onClick={open}
        className={cn(
          'mt-4 flex h-9 w-full items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)]',
          'bg-[rgba(255,255,255,0.02)] px-2.5 text-[12px] text-[var(--text-tertiary)]',
          'transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-secondary)]',
        )}
      >
        <span className="flex items-center gap-2">
          <Search size={13} aria-hidden="true" />
          Command
        </span>
        <kbd className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-[var(--text-quaternary)]">
          Cmd K
        </kbd>
      </Button>
    </motion.nav>
  )
}

function IslandGroup({
  label,
  items,
  className,
  onNavigate,
}: {
  label: string
  items: IslandItem[]
  className?: string
  onNavigate: () => void
}) {
  return (
    <div className={className}>
      <div className="mb-2 px-2 text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.id}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-[510] transition-colors',
                isActive
                  ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]',
              )}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
