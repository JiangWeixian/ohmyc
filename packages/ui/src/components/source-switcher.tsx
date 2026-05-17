// Explorer-only header dropdown for filtering inventory by provider origin.
// See spec §SourceSwitcher and wireframe 04-explorer.html lines 92-113.
import { ChevronDown } from 'lucide-react'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { cn } from '@/lib/utils'

import type { Origin } from '@ohmyc/shared'

const ORIGIN_LABELS: Record<Origin, string> = {
  claude: 'Claude',
  opencode: 'Opencode',
  agents: 'Agents',
}

function buttonLabel(selected: Set<Origin>): string {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return 'All'
  }
  if (selected.size === 1) {
    const [only] = selected
    return ORIGIN_LABELS[only]
  }
  return [...selected].map(o => ORIGIN_LABELS[o]).join(', ')
}

export function SourceSwitcher() {
  const selected = useSources(state => state.selected)
  const toggle = useSources(state => state.toggle)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md px-3',
          'text-[13px] text-[var(--text-secondary)]',
          'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)]',
          'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]',
          'transition-colors duration-150',
        )}
      >
        <span className="text-[var(--text-tertiary)]">Source:</span>
        <span>{buttonLabel(selected)}</span>
        <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191a1b] p-2"
      >
        {REGISTERED_ORIGINS.map((origin) => {
          const isOnly = selected.size === 1 && selected.has(origin)
          return (
            <DropdownMenuCheckboxItem
              key={origin}
              checked={selected.has(origin)}
              disabled={isOnly}
              onSelect={(event) => {
                event.preventDefault() // keep menu open while toggling
                toggle(origin)
              }}
            >
              {ORIGIN_LABELS[origin]}
            </DropdownMenuCheckboxItem>
          )
        })}
        <div className="px-2 pt-1.5 text-[11px] text-[var(--text-quaternary)]">
          At least one must stay on.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
