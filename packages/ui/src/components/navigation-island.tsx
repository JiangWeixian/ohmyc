import {
  motion,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  Activity,
  Blocks,
  Bot,
  Code2,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useCommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'
import { useIslandStore } from '@/state/island-store'

import type { LucideIcon } from 'lucide-react'

interface IslandItem {
  keycap: string
  label: string
  to: string
  icon: LucideIcon
}

const SIGNAL_ITEMS: IslandItem[] = [
  { keycap: 'M', label: 'Monitor', to: '/explore/monitor', icon: Code2 },
  { keycap: 'T', label: 'Timeline', to: '/explore/timeline', icon: Activity },
]

const EXPLORE_ITEMS: IslandItem[] = [
  { keycap: 'A', label: 'Agents', to: '/explore/agents', icon: Bot },
  { keycap: 'C', label: 'Commands', to: '/explore/commands', icon: TerminalSquare },
  { keycap: 'S', label: 'Skills', to: '/explore/skills', icon: Sparkles },
  { keycap: 'P', label: 'Plugins', to: '/explore/plugins', icon: Blocks },
]

const ALL_ITEMS = [...SIGNAL_ITEMS, ...EXPLORE_ITEMS]

const COLLAPSED_WIDTH = 56
const EXPANDED_WIDTH = 220
const ROTATION_DEG = 18

function detectTouch(): boolean {
  if (typeof globalThis.matchMedia !== 'function') {
    return false
  }
  return globalThis.matchMedia('(hover: none)').matches
}

export function NavigationIsland() {
  const { hoverProgress, isHovered, setHovered, toggle } = useIslandStore()
  const { open: openPalette } = useCommandPalette()
  const hookReduceMotion = useReducedMotion()
  const reduceMotion = hookReduceMotion
    || (typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const [isTouch] = useState(detectTouch)

  const containerWidth = useTransform(
    hoverProgress,
    v => `${COLLAPSED_WIDTH + v * (EXPANDED_WIDTH - COLLAPSED_WIDTH)}px`,
  )
  const rotateY = useTransform(hoverProgress, [0, 1], [0, ROTATION_DEG])
  const keycapOpacity = useTransform(hoverProgress, [0, 0.35], [1, 0])
  const keycapPointer = useTransform(keycapOpacity, v => (v < 0.5 ? 'none' : 'auto'))
  const navOpacity = useTransform(hoverProgress, [0.25, 1], [0, 1])
  const navX = useTransform(hoverProgress, [0.25, 1], [-8, 0])
  const navPointer = useTransform(navOpacity, v => (v > 0.5 ? 'auto' : 'none'))

  function handleMouseEnter() {
    if (!isTouch && !reduceMotion) {
      setHovered(true)
    }
  }

  function handleMouseLeave() {
    if (!isTouch && !reduceMotion) {
      setHovered(false)
    }
  }

  function handleNavigate() {
    if (isTouch) {
      setHovered(false)
    }
  }

  return (
    <motion.div
      style={{ width: containerWidth }}
      className="fixed left-[18px] top-[48px] z-40 max-sm:left-[14px] max-sm:top-[14px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => {
        if (!isTouch) {
          setHovered(true)
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !isTouch) {
          setHovered(false)
        }
      }}
    >
      <div style={{ perspective: 1200 }}>
        <motion.div
          style={{
            rotateY: reduceMotion ? 0 : rotateY,
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
          }}
          className="flex h-[calc(100dvh-66px)] max-sm:h-[calc(100dvh-28px)] flex-col overflow-hidden"
        >
          <motion.div
            style={{ opacity: keycapOpacity, pointerEvents: keycapPointer }}
            className="flex flex-col gap-1 pt-2"
          >
            {ALL_ITEMS.map(item => (
              <button
                key={item.keycap}
                type="button"
                onClick={isTouch ? toggle : undefined}
                className={cn(
                  'flex size-11 items-center justify-center rounded-lg font-mono text-sm font-medium',
                  'text-[var(--text-tertiary)] transition-colors',
                  'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                )}
                aria-label={item.label}
                aria-expanded={isHovered}
              >
                {item.keycap}
              </button>
            ))}
          </motion.div>

          <motion.div
            style={{ opacity: navOpacity, x: navX, pointerEvents: navPointer }}
            className="absolute inset-0 flex flex-col p-3"
          >
            <div className="mb-5 px-1">
              <div className="truncate text-[14px] font-[590] text-[var(--text-primary)]">OhMyC</div>
              <div className="truncate font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                coding monitor
              </div>
            </div>

            <IslandGroup label="Signal" items={SIGNAL_ITEMS} onNavigate={handleNavigate} />
            <IslandGroup label="Explore" items={EXPLORE_ITEMS} className="mt-4" onNavigate={handleNavigate} />

            <button
              type="button"
              onClick={openPalette}
              className={cn(
                'mt-auto flex h-8 w-full items-center justify-between rounded-md border border-[var(--border-standard)]',
                'bg-[var(--surface-raised)] px-2.5 text-[12px] text-[var(--text-tertiary)]',
                'transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]',
              )}
            >
              <span className="flex items-center gap-2">
                <Search size={13} aria-hidden="true" />
                Command
              </span>
              <kbd className="rounded border border-[var(--border-standard)] px-1.5 py-0.5 text-[10px] text-[var(--text-quaternary)]">
                Cmd K
              </kbd>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
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
            key={item.keycap}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-[510] transition-colors',
                isActive
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-[inset_0_0_0_0.5px_var(--border-standard)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
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
