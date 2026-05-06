// Two-tab switcher for toggling between the Profiles and Explorer views.
import { LayoutGrid, List } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Available primary view identifiers. */
const VIEWS = [
  { id: 'profiles', label: 'Profiles', icon: List },
  { id: 'agent-home', label: 'Explorer', icon: LayoutGrid },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

interface ViewSwitcherProperties {
  active: ViewId
  onChange: (id: ViewId) => void
}

/**
 * Renders the Profiles / Explorer toggle in the sidebar header.
 * @param active - Currently selected view.
 * @param onChange - Callback when the user selects a different view.
 */
export function ViewSwitcher({ active, onChange }: ViewSwitcherProperties) {
  return (
    <div className="flex items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-1 gap-0.5 w-full">
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-[510] transition-colors duration-150',
              isActive
                ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)]',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
