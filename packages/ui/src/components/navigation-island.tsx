import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'
import {
  Activity,
  Blocks,
  Bot,
  Code2,
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
  { id: 'monitor', label: 'Monitor', to: '/explore/monitor', icon: Code2 },
  { id: 'timeline', label: 'Timeline', to: '/explore/timeline', icon: Activity },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { id: 'agents', label: 'Agents', to: '/explore/agents', icon: Bot },
  { id: 'commands', label: 'Commands', to: '/explore/commands', icon: TerminalSquare },
  { id: 'skills', label: 'Skills', to: '/explore/skills', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', to: '/explore/plugins', icon: Blocks },
]

const SHELL_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const

const CONTENT_TRANSITION = {
  duration: 0.16,
  ease: [0.25, 1, 0.5, 1],
} as const

export function NavigationIsland() {
  const [collapsed, setCollapsed] = useState(false)
  const hookReduceMotion = useReducedMotion()
  const reduceMotion = hookReduceMotion
    || (
      typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  const { open } = useCommandPalette()
  const hasToggledRef = useRef(false)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const collapseButtonRef = useRef<HTMLButtonElement>(null)
  const motionMode = reduceMotion ? 'reduced' : 'full'
  const shellLayout = !reduceMotion
  const shellLayoutId = reduceMotion ? undefined : 'primary-navigation-island-shell'

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

  return (
    <AnimatePresence initial={false} mode="sync">
      {collapsed
        ? (
            <motion.div
              key="collapsed"
              layout={shellLayout}
              layoutId={shellLayoutId}
              data-motion-mode={motionMode}
              className="fixed left-[18px] top-[18px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: 'blur(3px)' }}
              whileHover={undefined}
              transition={SHELL_TRANSITION}
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
                  'size-14 rounded-[14px] border border-[rgba(255,255,255,0.05)] bg-[rgba(15,16,17,0.72)]',
                  'text-[var(--text-primary)] [box-shadow:0_0_0_0.5px_rgba(255,255,255,0.10),0_8px_30px_rgba(0,0,0,0.38),0_24px_60px_rgba(0,0,0,0.22)]',
                  '[backdrop-filter:saturate(180%)_blur(24px)] [-webkit-backdrop-filter:saturate(180%)_blur(24px)]',
                  'hover:bg-[rgba(255,255,255,0.04)]',
                  'motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]',
                )}
              >
                <Code2 size={20} aria-hidden="true" />
              </Button>
            </motion.div>
          )
        : (
            <motion.nav
              key="expanded"
              layout={shellLayout}
              layoutId={shellLayoutId}
              data-motion-mode={motionMode}
              id="primary-navigation-island"
              aria-label="Primary"
              className={cn(
                'fixed left-[18px] top-[18px] z-40 flex h-[calc(100dvh-36px)] w-[220px] flex-col overflow-hidden rounded-[14px]',
                'border border-[rgba(255,255,255,0.05)] bg-[rgba(15,16,17,0.72)]',
                'p-3 [box-shadow:0_0_0_0.5px_rgba(255,255,255,0.10),0_8px_30px_rgba(0,0,0,0.38),0_24px_60px_rgba(0,0,0,0.22)]',
                '[backdrop-filter:saturate(180%)_blur(24px)] [-webkit-backdrop-filter:saturate(180%)_blur(24px)]',
                'max-sm:left-[14px] max-sm:top-[14px] max-sm:h-[calc(100dvh-28px)] max-sm:w-[216px]',
              )}
              initial={reduceMotion ? false : { opacity: 0, x: -6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -4, filter: 'blur(3px)' }}
              transition={SHELL_TRANSITION}
            >
              <motion.div
                className="flex h-full flex-col"
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...CONTENT_TRANSITION, delay: 0.04 }}
              >
                <div className="mb-5 flex min-h-11 items-start justify-between gap-3">
                  <div className="min-w-0 px-1">
                    <div className="truncate text-[14px] font-[590] text-[var(--text-primary)]">OhMyC</div>
                    <div className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                      coding monitor
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
                    'mt-auto flex h-8 w-full items-center justify-between rounded-md border border-[rgba(255,255,255,0.08)]',
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
              </motion.div>
            </motion.nav>
          )}
    </AnimatePresence>
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
                'flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-[510] transition-colors',
                isActive
                  ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]'
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
